-- Covers migration 0009 (Live Interactive Sessions) and 0010 (The
-- Bridge): status/lock-gated read+write RLS for live_sessions/
-- live_slides/live_responses, and interactive_blocks' public-read policy
-- for embedding a live session inside a published course block.

set client_min_messages to warning;
begin;
alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'author@example.com');
insert into organizations (id, name, subscription_tier) values
  ('22222222-2222-2222-2222-222222222222', 'Org A', 'MAXPRO');
insert into users (id, org_id, role) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ORG_ADMIN');
insert into courses (id, org_id, owner_id, title, status, publish_slug) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Course', 'PUBLISHED', 'course-a');
insert into sections (id, course_id, title, "order") values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Section 1', 0);
insert into lessons (id, section_id, title, type, "order") values
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'Lesson 1', 'BLOCK', 0);
insert into blocks (id, lesson_id, type, "order", content, config) values
  ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'interactive', 0, '{}', '{}');
insert into live_sessions (id, org_id, owner_id, title, join_code, status) values
  ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Live Poll', 'ABC123', 'live');
insert into live_slides (id, session_id, type, "order", config) values
  ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'poll', 0, '{"prompt": "Pick one", "options": ["A", "B"]}');
insert into interactive_blocks (block_id, live_session_id, mode) values
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'async');

alter table auth.users enable trigger on_auth_user_created;

set role anon;
set request.jwt.claim.role = 'anon';

-- 0010: anon can read the interactive block linking a published course's
-- block to a live session.
select test_assert(
  (select mode from interactive_blocks where block_id = '66666666-6666-6666-6666-666666666666') = 'async',
  '0010: anon should read interactive_blocks for a published course'
);

-- 0009: anon can read the linked live_session/live_slide while it's live.
select test_assert(
  (select status from live_sessions where id = '77777777-7777-7777-7777-777777777777') = 'live',
  '0009: anon should read a live_session while status = live'
);
select test_assert(
  (select count(*) from live_slides where session_id = '77777777-7777-7777-7777-777777777777') = 1,
  '0009: anon should read live_slides of a live session'
);

-- 0009: anon can submit a response to an unlocked, live slide.
insert into live_responses (live_slide_id, participant_token, response)
values ('88888888-8888-8888-8888-888888888888', 'learner-1', '{"choices": [0]}');

-- A second, independent participant can also respond (no accidental
-- single-response-per-slide constraint).
insert into live_responses (live_slide_id, participant_token, response)
values ('88888888-8888-8888-8888-888888888888', 'learner-2', '{"choices": [1]}');

select test_assert(
  (select count(*) from live_responses where live_slide_id = '88888888-8888-8888-8888-888888888888') = 2,
  '0009: two independent participants should both be able to respond to the same slide'
);

reset role;

-- Locking the session must block further anon submissions.
update live_sessions set locked = true where id = '77777777-7777-7777-7777-777777777777';

set role anon;
set request.jwt.claim.role = 'anon';
do $$
begin
  insert into live_responses (live_slide_id, participant_token, response)
  values ('88888888-8888-8888-8888-888888888888', 'learner-3', '{"choices": [0]}');
  perform test_assert(false, '0009: a locked session should reject new responses');
exception
  when insufficient_privilege then null;
end $$;
reset role;

-- Ending the session (status != 'live') must hide it from anon entirely
-- -- this is exactly what InteractiveBlockView's "not available right
-- now" fallback depends on.
update live_sessions set status = 'ended', locked = false where id = '77777777-7777-7777-7777-777777777777';

set role anon;
set request.jwt.claim.role = 'anon';
select test_assert(
  (select count(*) from live_sessions where id = '77777777-7777-7777-7777-777777777777') = 0,
  '0009: anon should NOT be able to read a live_session once it is no longer live'
);
reset role;

rollback;
