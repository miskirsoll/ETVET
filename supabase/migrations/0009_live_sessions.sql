-- Module B: Live Interactive Sessions (MAXPRO only). Schema for the
-- session builder, join-by-code participant flow, and realtime results.
--
-- Unlike learner_progress, response data here has no "read only my own
-- row" requirement -- a live poll's whole point is that everyone sees the
-- aggregate in real time, so plain RLS (no SECURITY DEFINER RPC) is
-- enough: the risk to guard against is an anonymous participant writing
-- into a session that isn't theirs or isn't currently live, not reading
-- someone else's individual response.

create type live_session_status as enum ('draft', 'live', 'ended');

-- Slide types built this pass: poll, word_cloud, open_ended, quiz,
-- qa_board. scale/ranking/100-point-allocation/reactions are deferred
-- (see PLANNING.md) -- same config-jsonb shape, just no editor/player UI
-- yet, matching how fill_blank/matching question types were handled.
create type live_slide_type as enum ('poll', 'word_cloud', 'open_ended', 'quiz', 'qa_board');

create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  owner_id uuid not null references users (id),
  title text not null,
  join_code text not null unique,
  status live_session_status not null default 'draft',
  current_slide_id uuid,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);

create index live_sessions_org_id_idx on live_sessions (org_id);
create index live_sessions_join_code_idx on live_sessions (join_code);

create table live_slides (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions (id) on delete cascade,
  type live_slide_type not null,
  "order" integer not null default 0,
  config jsonb not null default '{}'::jsonb
);

create index live_slides_session_id_idx on live_slides (session_id);

alter table live_sessions
  add constraint live_sessions_current_slide_fk
  foreign key (current_slide_id) references live_slides (id) on delete set null;

create table live_responses (
  id uuid primary key default gen_random_uuid(),
  live_slide_id uuid not null references live_slides (id) on delete cascade,
  participant_token text not null,
  display_name text,
  response jsonb not null,
  is_correct boolean,
  response_time_ms integer,
  submitted_at timestamptz not null default now()
);

create index live_responses_slide_id_idx on live_responses (live_slide_id);

create table qa_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions (id) on delete cascade,
  participant_token text not null,
  display_name text,
  text text not null,
  upvotes integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden', 'answered')),
  created_at timestamptz not null default now()
);

create index qa_questions_session_id_idx on qa_questions (session_id);

create table qa_upvotes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references qa_questions (id) on delete cascade,
  participant_token text not null,
  unique (question_id, participant_token)
);

alter table live_sessions enable row level security;
alter table live_slides enable row level security;
alter table live_responses enable row level security;
alter table qa_questions enable row level security;
alter table qa_upvotes enable row level security;

create policy "org members manage own live sessions" on live_sessions
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy "anyone reads live sessions that are live" on live_sessions
  for select using (status = 'live');

create policy "org members manage own live slides" on live_slides
  for all using (
    exists (select 1 from live_sessions s where s.id = live_slides.session_id and s.org_id = current_org_id())
  ) with check (
    exists (select 1 from live_sessions s where s.id = live_slides.session_id and s.org_id = current_org_id())
  );
create policy "anyone reads slides of live sessions" on live_slides
  for select using (
    exists (select 1 from live_sessions s where s.id = live_slides.session_id and s.status = 'live')
  );

create policy "org members read own responses" on live_responses
  for select using (
    exists (
      select 1 from live_slides sl join live_sessions s on s.id = sl.session_id
      where sl.id = live_responses.live_slide_id and s.org_id = current_org_id()
    )
  );
create policy "anyone reads responses of live sessions" on live_responses
  for select using (
    exists (
      select 1 from live_slides sl join live_sessions s on s.id = sl.session_id
      where sl.id = live_responses.live_slide_id and s.status = 'live'
    )
  );
create policy "anyone submits a response to an unlocked live slide" on live_responses
  for insert with check (
    exists (
      select 1 from live_slides sl join live_sessions s on s.id = sl.session_id
      where sl.id = live_responses.live_slide_id and s.status = 'live' and s.locked = false
    )
  );

create policy "org members manage own qa questions" on qa_questions
  for all using (
    exists (select 1 from live_sessions s where s.id = qa_questions.session_id and s.org_id = current_org_id())
  ) with check (
    exists (select 1 from live_sessions s where s.id = qa_questions.session_id and s.org_id = current_org_id())
  );
create policy "anyone reads non-hidden qa questions of live sessions" on qa_questions
  for select using (
    status != 'hidden'
    and exists (select 1 from live_sessions s where s.id = qa_questions.session_id and s.status = 'live')
  );
create policy "anyone submits a qa question to a live session" on qa_questions
  for insert with check (
    exists (select 1 from live_sessions s where s.id = qa_questions.session_id and s.status = 'live')
  );

create policy "anyone reads qa upvotes of live sessions" on qa_upvotes
  for select using (
    exists (
      select 1 from qa_questions q join live_sessions s on s.id = q.session_id
      where q.id = qa_upvotes.question_id and s.status = 'live'
    )
  );
create policy "anyone upvotes a qa question in a live session" on qa_upvotes
  for insert with check (
    exists (
      select 1 from qa_questions q join live_sessions s on s.id = q.session_id
      where q.id = qa_upvotes.question_id and s.status = 'live'
    )
  );

-- Keeps qa_questions.upvotes as a fast denormalized count instead of
-- requiring every reader to aggregate qa_upvotes themselves.
create function sync_qa_question_upvote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update qa_questions
    set upvotes = (select count(*) from qa_upvotes where question_id = coalesce(new.question_id, old.question_id))
    where id = coalesce(new.question_id, old.question_id);
  return null;
end;
$$;

create trigger on_qa_upvote_change
  after insert or delete on qa_upvotes
  for each row execute function sync_qa_question_upvote_count();

-- Realtime: Supabase's Postgres Changes feature only streams tables
-- explicitly added to this publication.
alter publication supabase_realtime add table live_sessions;
alter publication supabase_realtime add table live_responses;
alter publication supabase_realtime add table qa_questions;
alter publication supabase_realtime add table qa_upvotes;
