-- Covers migration 0014 (Super Admin console): admin_list_organizations()
-- and admin_set_org_tier() must both work for a SUPER_ADMIN and refuse
-- everyone else, including an ORG_ADMIN of one of the orgs being listed.

set client_min_messages to warning;
begin;
alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'super@platform.example'),
  ('22222222-2222-2222-2222-222222222222', 'admin@a.example');

insert into organizations (id, name, subscription_tier) values
  ('33333333-3333-3333-3333-333333333333', 'Org A', 'FREE'),
  ('44444444-4444-4444-4444-444444444444', 'Org B', 'PRO');

-- The super admin's own "home org" -- SUPER_ADMIN still needs a row in
-- `users` (and therefore some org_id) the same as everyone else; which
-- org it is doesn't matter for this role's cross-org powers.
insert into users (id, org_id, role) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'SUPER_ADMIN'),
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'ORG_ADMIN');

insert into courses (id, org_id, owner_id, title, status) values
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Course in Org B', 'DRAFT');

alter table auth.users enable trigger on_auth_user_created;

set role authenticated;

-- An ORG_ADMIN (not SUPER_ADMIN) must be refused, even though they can
-- read their own org just fine via the normal RLS path.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set request.jwt.claim.role = 'authenticated';
do $$
begin
  perform admin_list_organizations();
  perform test_assert(false, 'a non-SUPER_ADMIN should not be able to call admin_list_organizations()');
exception
  when others then
    perform test_assert(sqlerrm like '%requires SUPER_ADMIN%', 'expected the SUPER_ADMIN-required error, got: ' || sqlerrm);
end $$;

do $$
begin
  perform admin_set_org_tier('44444444-4444-4444-4444-444444444444', 'MAXPRO');
  perform test_assert(false, 'a non-SUPER_ADMIN should not be able to call admin_set_org_tier()');
exception
  when others then
    perform test_assert(sqlerrm like '%requires SUPER_ADMIN%', 'expected the SUPER_ADMIN-required error, got: ' || sqlerrm);
end $$;

-- The SUPER_ADMIN can list every org, including ones they aren't a
-- member of, with correct member/course counts.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select test_assert(
  (select count(*) from admin_list_organizations()) = 2,
  'SUPER_ADMIN should see both organizations, not just their own'
);
select test_assert(
  (select course_count from admin_list_organizations() where org_id = '44444444-4444-4444-4444-444444444444') = 1,
  'course_count for Org B should reflect its one course'
);
select test_assert(
  (select member_count from admin_list_organizations() where org_id = '33333333-3333-3333-3333-333333333333') = 2,
  'member_count for Org A should be 2 (the super admin + the org admin)'
);

-- The SUPER_ADMIN can override Org B's tier even though they aren't its
-- ORG_ADMIN and current_org_id() for them resolves to Org A.
select admin_set_org_tier('44444444-4444-4444-4444-444444444444', 'MAXPRO');
reset role;
select test_assert(
  (select subscription_tier from organizations where id = '44444444-4444-4444-4444-444444444444') = 'MAXPRO',
  'admin_set_org_tier should have updated Org B''s tier to MAXPRO'
);

rollback;
