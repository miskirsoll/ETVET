-- Bug fix, same family as 0005: the original insert/update policies on
-- learner_progress ("... or user_id is null") pass for *every* anonymous
-- row, not just the caller's own -- there is no way to phrase "the row's
-- anon_token equals the one this request claims" as an RLS USING/CHECK
-- clause, because anon_token is ordinary request data, not a verifiable
-- JWT claim the way auth.uid() is. In practice this meant any anonymous
-- caller could UPDATE (or INSERT a colliding row for) another learner's
-- progress directly through the API, bypassing whatever filter the app
-- itself applied.
--
-- Fix: remove anon/authenticated's direct write access to this table
-- entirely, and replace it with one SECURITY DEFINER function that takes
-- the anon token as an explicit argument and does the insert-or-update
-- atomically (also closing a check-then-write race in the app's previous
-- select-then-insert-or-update logic). A caller can no longer widen what
-- it touches by adjusting its own query -- the function's SQL is the only
-- filter that exists, same pattern as get_learner_progress() in 0005.

revoke insert, update, delete on learner_progress from anon, authenticated;
drop policy if exists "learners write own progress" on learner_progress;
drop policy if exists "learners update own progress" on learner_progress;

create unique index learner_progress_unique_learner
  on learner_progress (course_id, lesson_id, coalesce(user_id::text, anon_token));

create function submit_learner_progress(
  p_course_id uuid,
  p_lesson_id uuid,
  p_anon_token text,
  p_status text,
  p_score numeric,
  p_time_spent_seconds integer
)
returns learner_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row learner_progress;
begin
  if v_user_id is null and p_anon_token is null then
    raise exception 'submit_learner_progress requires an authenticated session or an anon token';
  end if;

  insert into learner_progress
    (course_id, lesson_id, user_id, anon_token, status, score, time_spent_seconds)
  values (
    p_course_id,
    p_lesson_id,
    v_user_id,
    case when v_user_id is null then p_anon_token end,
    p_status,
    p_score,
    greatest(p_time_spent_seconds, 0)
  )
  on conflict (course_id, lesson_id, coalesce(user_id::text, anon_token))
  do update set
    status = excluded.status,
    score = excluded.score,
    time_spent_seconds = learner_progress.time_spent_seconds + excluded.time_spent_seconds,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function submit_learner_progress(uuid, uuid, text, text, numeric, integer)
  to anon, authenticated;
