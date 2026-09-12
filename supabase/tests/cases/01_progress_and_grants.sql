-- Covers migrations 0004 (Data API grants), 0005 (get_learner_progress
-- RPC), 0006 (submit_learner_progress RPC). These three fixed real,
-- pre-existing bugs found by hand this session: nothing reachable via the
-- API at all, a learner unable to read back their own progress, and any
-- anonymous caller able to overwrite any other anonymous learner's row.

set client_min_messages to warning;
begin;
alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'author@example.com');
insert into organizations (id, name, subscription_tier) values
  ('22222222-2222-2222-2222-222222222222', 'Org A', 'PRO');
insert into users (id, org_id, role) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ORG_ADMIN');
insert into courses (id, org_id, owner_id, title, status, publish_slug) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Course', 'PUBLISHED', 'course-a');
insert into sections (id, course_id, title, "order") values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Section 1', 0);
insert into lessons (id, section_id, title, type, "order") values
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'Lesson 1', 'BLOCK', 0);

alter table auth.users enable trigger on_auth_user_created;

set role anon;
set request.jwt.claim.role = 'anon';

-- 0004: a published course must actually be reachable through the Data
-- API as anon -- RLS alone isn't enough without the underlying GRANT.
select test_assert(
  (select count(*) from courses where id = '33333333-3333-3333-3333-333333333333') = 1,
  '0004: anon should be able to read a published course (grants + RLS)'
);

-- 0006: direct table writes must be rejected now -- only the RPC can write.
do $$
begin
  insert into learner_progress (course_id, lesson_id, anon_token, status)
  values ('33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 'learner-a', 'completed');
  perform test_assert(false, '0006: direct anon INSERT into learner_progress should be rejected (insert privilege was revoked)');
exception
  when insufficient_privilege then null;
end $$;

-- 0006: submit_learner_progress() is the only write path, and upserts
-- rather than duplicating a row on a second call for the same learner.
select submit_learner_progress(
  '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555',
  'learner-a', 'in_progress', null, 30
);
select submit_learner_progress(
  '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555',
  'learner-a', 'completed', null, 45
);
select test_assert(
  (select count(*) from get_learner_progress('33333333-3333-3333-3333-333333333333', 'learner-a')) = 1,
  '0006: a second submit for the same learner+lesson should upsert, not duplicate'
);
select test_assert(
  (select time_spent_seconds from get_learner_progress('33333333-3333-3333-3333-333333333333', 'learner-a')) = 75,
  '0006: time_spent_seconds should accumulate across submits (30 + 45 = 75)'
);

-- A second, different anon learner writes their own row.
select submit_learner_progress(
  '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555',
  'learner-b', 'failed', 40, 20
);

-- 0005: get_learner_progress() must return ONLY the caller's own token's
-- row, not every anon learner's progress for the course -- this is the
-- exact cross-tenant leak a naive `using (anon_token is not null)` policy
-- would have allowed.
select test_assert(
  (select count(*) from get_learner_progress('33333333-3333-3333-3333-333333333333', 'learner-a')) = 1,
  '0005: get_learner_progress should return learner-a''s own row'
);
select test_assert(
  (select status from get_learner_progress('33333333-3333-3333-3333-333333333333', 'learner-a')) = 'completed',
  '0005: get_learner_progress should return learner-a''s OWN status, not learner-b''s'
);
select test_assert(
  (select status from get_learner_progress('33333333-3333-3333-3333-333333333333', 'learner-b')) = 'failed',
  '0005: get_learner_progress should return learner-b''s own status ("failed"), not leak learner-a''s ("completed")'
);
select test_assert(
  (select count(*) from get_learner_progress('33333333-3333-3333-3333-333333333333', 'learner-b')) = 1,
  '0005: get_learner_progress(learner-b''s token) should return exactly one row (learner-b''s), not both learners'''
);

reset role;
rollback;
