-- Covers migration 0011 (team invites): RLS on org_invites, the
-- get_invite_by_token() RPC, and the updated sign-up trigger joining an
-- existing org+role instead of always minting a new one.

set client_min_messages to warning;
begin;
alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@a.example'),
  ('12121212-1212-1212-1212-121212121212', 'author@a.example');
insert into organizations (id, name, subscription_tier) values
  ('22222222-2222-2222-2222-222222222222', 'Org A', 'MAXPRO');
insert into users (id, org_id, role) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ORG_ADMIN'),
  ('12121212-1212-1212-1212-121212121212', '22222222-2222-2222-2222-222222222222', 'AUTHOR');

insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'admin@b.example');
insert into organizations (id, name, subscription_tier) values
  ('88888888-8888-8888-8888-888888888888', 'Org B', 'MAXPRO');
insert into users (id, org_id, role) values
  ('99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888', 'ORG_ADMIN');

alter table auth.users enable trigger on_auth_user_created;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set request.jwt.claim.role = 'authenticated';

insert into org_invites (org_id, role, created_by, email)
values ('22222222-2222-2222-2222-222222222222', 'TRAINER', '11111111-1111-1111-1111-111111111111', 'newtrainer@a.example')
returning token as generated_token \gset

select test_assert(
  (select count(*) from org_invites where org_id = '22222222-2222-2222-2222-222222222222') = 1,
  'an ORG_ADMIN should be able to create an invite for their own org'
);

-- A non-admin AUTHOR in the same org cannot create invites.
set request.jwt.claim.sub = '12121212-1212-1212-1212-121212121212';
do $$
begin
  insert into org_invites (org_id, role, created_by)
  values ('22222222-2222-2222-2222-222222222222', 'AUTHOR', '12121212-1212-1212-1212-121212121212');
  perform test_assert(false, 'a non-admin AUTHOR should not be able to create an invite');
exception
  when insufficient_privilege then null;
end $$;

-- A different org's ORG_ADMIN can neither see nor delete this invite.
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select test_assert(
  (select count(*) from org_invites where org_id = '22222222-2222-2222-2222-222222222222') = 0,
  'a different org''s ORG_ADMIN should not see another org''s invites'
);
delete from org_invites where org_id = '22222222-2222-2222-2222-222222222222';
reset role;
select test_assert(
  (select count(*) from org_invites where org_id = '22222222-2222-2222-2222-222222222222') = 1,
  'a different org''s delete attempt should affect zero rows -- the invite must still exist'
);

-- anon can resolve a valid token via the RPC, and gets nothing for a bogus one.
set role anon;
set request.jwt.claim.role = 'anon';
select test_assert(
  (select valid from get_invite_by_token(:'generated_token')) = true,
  'get_invite_by_token should report a fresh invite as valid'
);
select test_assert(
  (select count(*) from get_invite_by_token('not-a-real-token')) = 0,
  'get_invite_by_token should return nothing for a bogus token'
);
reset role;

-- Signing up with the token joins Org A as TRAINER instead of minting a new org.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '55555555-5555-5555-5555-555555555555',
  'newtrainer@a.example',
  jsonb_build_object('invite_token', :'generated_token', 'display_name', 'New Trainer')
);
select test_assert(
  (select org_id from users where id = '55555555-5555-5555-5555-555555555555') = '22222222-2222-2222-2222-222222222222',
  'signing up with a valid invite token should join the inviting org, not a new one'
);
select test_assert(
  (select role from users where id = '55555555-5555-5555-5555-555555555555') = 'TRAINER',
  'signing up with the invite token should assign the invited role (TRAINER)'
);
select test_assert(
  (select accepted_at is not null from org_invites where token = :'generated_token'),
  'the invite should be marked accepted after being consumed'
);

-- Re-using the now-accepted token falls back to creating a new org
-- (never errors, never silently double-joins Org A).
insert into auth.users (id, email, raw_user_meta_data)
values (
  '56565656-5656-5656-5656-565656565656',
  'reuser@example.com',
  jsonb_build_object('invite_token', :'generated_token', 'org_name', 'Reuser Org')
);
select test_assert(
  (select org_id from users where id = '56565656-5656-5656-5656-565656565656')
    != '22222222-2222-2222-2222-222222222222',
  'reusing an already-accepted invite token must NOT join Org A a second time'
);

-- An expired invite is rejected too (reported invalid, and falls back cleanly).
insert into org_invites (org_id, role, created_by, expires_at)
values ('22222222-2222-2222-2222-222222222222', 'REVIEWER', '11111111-1111-1111-1111-111111111111', now() - interval '1 day')
returning token as expired_token \gset

select test_assert(
  (select valid from get_invite_by_token(:'expired_token')) = false,
  'get_invite_by_token should report an expired invite as invalid'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '58585858-5858-5858-5858-585858585858',
  'lateperson@example.com',
  jsonb_build_object('invite_token', :'expired_token', 'org_name', 'Late Org')
);
select test_assert(
  (select org_id from users where id = '58585858-5858-5858-5858-585858585858')
    != '22222222-2222-2222-2222-222222222222',
  'an expired invite token must fall back to a new org, not join Org A'
);

rollback;
