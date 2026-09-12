-- Covers migrations 0007 (theme public read) and 0008 (media storage
-- object RLS, unverified against real Storage but the metadata-table RLS
-- itself is testable here).

set client_min_messages to warning;
begin;
alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');
insert into organizations (id, name, subscription_tier) values
  ('33333333-3333-3333-3333-333333333333', 'Org A', 'PRO'),
  ('44444444-4444-4444-4444-444444444444', 'Org B', 'PRO');
insert into users (id, org_id, role) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'ORG_ADMIN'),
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'ORG_ADMIN');

insert into themes (id, org_id, name) values
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Org A Theme');
insert into courses (id, org_id, owner_id, title, status, publish_slug, theme_id) values
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Published Course', 'PUBLISHED', 'pub-course', '55555555-5555-5555-5555-555555555555'),
  ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Draft Course', 'DRAFT', null, '55555555-5555-5555-5555-555555555555');

alter table auth.users enable trigger on_auth_user_created;

set role anon;
set request.jwt.claim.role = 'anon';

-- 0007: anon can read a theme belonging to a PUBLISHED course.
select test_assert(
  (select count(*) from themes where id = '55555555-5555-5555-5555-555555555555') = 1,
  '0007: anon should read a theme referenced by a published course'
);

reset role;

-- The same theme, if referenced ONLY by draft courses, must stay hidden.
delete from courses where id = '66666666-6666-6666-6666-666666666666';

set role anon;
set request.jwt.claim.role = 'anon';
select test_assert(
  (select count(*) from themes where id = '55555555-5555-5555-5555-555555555555') = 0,
  '0007: anon should NOT read a theme only referenced by a draft course'
);
reset role;

-- 0008: media bucket object RLS (metadata table only -- see the
-- migration's own UNVERIFIED note re: the real Storage upload path).
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set request.jwt.claim.role = 'authenticated';

insert into storage.objects (bucket_id, name, owner)
values ('media', '33333333-3333-3333-3333-333333333333/logo.png', '11111111-1111-1111-1111-111111111111');

-- Org B cannot upload into Org A's folder prefix.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into storage.objects (bucket_id, name, owner)
  values ('media', '33333333-3333-3333-3333-333333333333/evil.png', '22222222-2222-2222-2222-222222222222');
  perform test_assert(false, '0008: a different org should not be able to upload into another org''s folder prefix');
exception
  when insufficient_privilege then null;
end $$;

reset role;

-- The bucket is public: anyone (even anon) can read any object in it.
set role anon;
set request.jwt.claim.role = 'anon';
select test_assert(
  (select count(*) from storage.objects where name = '33333333-3333-3333-3333-333333333333/logo.png') = 1,
  '0008: the media bucket is public -- anon should be able to read any object in it'
);
reset role;
rollback;
