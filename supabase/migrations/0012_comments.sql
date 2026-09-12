-- §7.12: Reviewer commenting ("Review-360-style" feedback). Course-level
-- threads for now (not yet scoped to a specific lesson/block) -- enough
-- for a first cut of async feedback; per-lesson threads are a natural
-- follow-up once this shape is proven out. Any org member can post or
-- resolve a comment (feedback is a team conversation, not reviewer-only,
-- since AUTHOR/TRAINER/ORG_ADMIN should be able to reply too), but only
-- the original author can delete their own comment.

create table course_comments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  author_id uuid not null references users (id),
  text text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index course_comments_course_id_idx on course_comments (course_id);

alter table course_comments enable row level security;

create policy "org members read own course comments" on course_comments
  for select using (
    exists (select 1 from courses c where c.id = course_comments.course_id and c.org_id = current_org_id())
  );

create policy "org members post own course comments" on course_comments
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from courses c where c.id = course_comments.course_id and c.org_id = current_org_id())
  );

create policy "org members resolve course comments" on course_comments
  for update using (
    exists (select 1 from courses c where c.id = course_comments.course_id and c.org_id = current_org_id())
  ) with check (
    exists (select 1 from courses c where c.id = course_comments.course_id and c.org_id = current_org_id())
  );

create policy "authors delete their own comments" on course_comments
  for delete using (author_id = auth.uid());

-- The app only ever updates `resolved` (comments are otherwise immutable
-- once posted, like a chat message) -- narrow the column-level grant so
-- that stays true at the database layer too, not just by convention in
-- the Server Action. This overrides migration 0004's blanket
-- `grant ... update ... on all tables` default-privilege grant for this
-- one table specifically.
revoke update on course_comments from anon, authenticated;
grant update (resolved) on course_comments to authenticated;
