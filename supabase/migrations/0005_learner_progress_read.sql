-- Bug fix: learner_progress had an insert policy ("learners write own
-- progress") but no matching select policy for the learner themselves --
-- only "org members read own learner progress" (for analytics) existed.
-- A learner could write a progress row and then never see it again,
-- which breaks the sidebar's completion state, sequential-navigation
-- unlocking, and the upsert-vs-insert check in the app's progress-writing
-- action (every visit would insert a fresh duplicate row instead of
-- updating the existing one).
--
-- The obvious-looking fix -- a permissive RLS policy like
-- `using (anon_token is not null)` -- would be a real cross-tenant leak:
-- anon_token isn't verifiable from a JWT the way auth.uid() is, so RLS
-- can't check "does this request actually own this token." A policy that
-- broad would let anyone holding only the public anon key read every
-- anonymous learner's progress across every organization, simply by
-- calling the REST API without the app's usual `eq(anon_token, ...)`
-- filter -- RLS is the only enforced boundary; a client-side filter is
-- not one.
--
-- Fix instead: a SECURITY DEFINER function that takes the anon token as
-- an explicit argument and filters by it *inside* the function body, so
-- the caller cannot broaden the result by omitting a filter -- the
-- function's own SQL is the only filter that exists. Authenticated
-- learners are matched by auth.uid() the normal, forgeable-proof way.

create function get_learner_progress(p_course_id uuid, p_anon_token text default null)
returns setof learner_progress
language sql
stable
security definer
set search_path = public
as $$
  select * from learner_progress
  where course_id = p_course_id
    and (
      (auth.uid() is not null and user_id = auth.uid())
      or (p_anon_token is not null and anon_token = p_anon_token)
    )
$$;

grant execute on function get_learner_progress(uuid, text) to anon, authenticated;
