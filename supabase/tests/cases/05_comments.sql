-- Covers migration 0012 (course feedback comments): RLS scoping,
-- forge-protection on insert, resolve-vs-delete permissions, and the
-- column-level grant that restricts UPDATE to `resolved` only.

set client_min_messages to warning;
begin;
alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'reviewer@a.example'),
  ('12121212-1212-1212-1212-121212121212', 'author@a.example');
insert into organizations (id, name, subscription_tier) values
  ('22222222-2222-2222-2222-222222222222', 'Org A', 'MAXPRO');
insert into users (id, org_id, role) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'REVIEWER'),
  ('12121212-1212-1212-1212-121212121212', '22222222-2222-2222-2222-222222222222', 'AUTHOR');

insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'admin@b.example');
insert into organizations (id, name, subscription_tier) values
  ('88888888-8888-8888-8888-888888888888', 'Org B', 'MAXPRO');
insert into users (id, org_id, role) values
  ('99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888', 'ORG_ADMIN');

insert into courses (id, org_id, owner_id, title, status, publish_slug) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '12121212-1212-1212-1212-121212121212', 'Course', 'DRAFT', null);

alter table auth.users enable trigger on_auth_user_created;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set request.jwt.claim.role = 'authenticated';

insert into course_comments (course_id, author_id, text)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Slide 3 has a typo.')
returning id as reviewer_comment_id \gset

select test_assert(
  (select count(*) from course_comments where id = :'reviewer_comment_id') = 1,
  'a REVIEWER should be able to post a comment on their own org''s course'
);

-- Can't forge a comment as someone else.
do $$
begin
  insert into course_comments (course_id, author_id, text)
  values ('33333333-3333-3333-3333-333333333333', '12121212-1212-1212-1212-121212121212', 'Forged comment');
  perform test_assert(false, 'a REVIEWER should not be able to post a comment as a different author_id');
exception
  when insufficient_privilege then null;
end $$;

-- An AUTHOR in the same org can see and resolve the REVIEWER's comment.
set request.jwt.claim.sub = '12121212-1212-1212-1212-121212121212';
select test_assert(
  (select resolved from course_comments where id = :'reviewer_comment_id') = false,
  'the comment should start unresolved'
);
update course_comments set resolved = true where id = :'reviewer_comment_id';
select test_assert(
  (select resolved from course_comments where id = :'reviewer_comment_id') = true,
  'a same-org AUTHOR (not the original author) should be able to mark a comment resolved'
);

-- But cannot delete it, or rewrite its text directly.
delete from course_comments where id = :'reviewer_comment_id';
select test_assert(
  (select count(*) from course_comments where id = :'reviewer_comment_id') = 1,
  'only the original author should be able to delete their own comment -- it must still exist'
);

do $$
begin
  update course_comments set text = 'tampered' where id = '11111111-1111-1111-1111-111111111111';
  perform test_assert(false, 'a direct UPDATE of the `text` column should be rejected by the column-level grant');
exception
  when insufficient_privilege then null;
end $$;

-- The original author (REVIEWER) can delete their own comment.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from course_comments where id = :'reviewer_comment_id';
select test_assert(
  (select count(*) from course_comments where id = :'reviewer_comment_id') = 0,
  'the original author should be able to delete their own comment'
);

-- A different org can neither read nor post into this course's thread.
insert into course_comments (course_id, author_id, text)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'seed for org B isolation check')
returning id as seed_id \gset

set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select test_assert(
  (select count(*) from course_comments where course_id = '33333333-3333-3333-3333-333333333333') = 0,
  'a different org should not be able to read this course''s comments at all'
);
do $$
begin
  insert into course_comments (course_id, author_id, text)
  values ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'Org B trying to comment on Org A''s course');
  perform test_assert(false, 'a different org should not be able to post into this course''s thread');
exception
  when insufficient_privilege then null;
end $$;

reset role;
rollback;
