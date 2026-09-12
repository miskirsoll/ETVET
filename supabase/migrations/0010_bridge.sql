-- Module C: The Bridge -- embedding a Live Session inside a course block,
-- sync (join point into a live-presented session) or async (a persistent,
-- always-open poll/word-cloud/open-ended embed, no presenter required).
--
-- interactive_blocks was scaffolded in migration 0001 for exactly this,
-- but was missing a public-read policy -- same gap pattern as themes
-- (0007): a published course's anonymous visitor could never have read
-- which live session a block links to. Also adds the foreign key to
-- live_sessions, which didn't exist yet when interactive_blocks was
-- first created.

alter table interactive_blocks
  add constraint interactive_blocks_live_session_fk
  foreign key (live_session_id) references live_sessions (id) on delete set null;

create policy "anyone reads interactive blocks of published courses" on interactive_blocks
  for select using (
    exists (
      select 1 from blocks b
      join lessons l on l.id = b.lesson_id
      join sections s on s.id = l.section_id
      join courses c on c.id = s.course_id
      where b.id = interactive_blocks.block_id and c.status = 'PUBLISHED'
    )
  );

-- Async embedding reuses the exact same live_sessions/live_slides/
-- live_responses machinery as a live-hosted session: the linked session
-- must be status='live' to accept responses (see the existing RLS on
-- live_responses/live_slides). There is no separate "always open"
-- concept -- an author starts the session once and leaves it live to
-- back an async embed; ending it also stops the embed. Documented here
-- since it's not obvious from the schema alone.
