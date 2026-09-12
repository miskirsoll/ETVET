-- Quiz Lesson editor (build plan step 3): questions + choices belong
-- directly to a Quiz Lesson (the lesson's question pool doubles as its
-- "bank" for now -- randomized draw pulls a subset of it via draw_count).
-- A separate reusable question_banks table shared across lessons is
-- deferred until there's a real need for banks independent of a lesson.

create type question_type as enum (
  'multiple_choice',
  'multiple_response',
  'true_false',
  'fill_blank',
  'matching'
);

alter table lessons add column pass_threshold integer not null default 70;
alter table lessons add column randomize_questions boolean not null default false;
alter table lessons add column draw_count integer;
alter table lessons add column time_limit_seconds integer;
alter table lessons add constraint lessons_pass_threshold_range
  check (pass_threshold between 0 and 100);
alter table lessons add constraint lessons_draw_count_positive
  check (draw_count is null or draw_count > 0);

create table questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  type question_type not null default 'multiple_choice',
  "order" integer not null default 0,
  prompt text not null,
  config jsonb not null default '{}'::jsonb
);

create index questions_lesson_id_idx on questions (lesson_id);

create table question_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  "order" integer not null default 0,
  text text not null,
  is_correct boolean not null default false,
  feedback text
);

create index question_choices_question_id_idx on question_choices (question_id);

alter table questions enable row level security;
alter table question_choices enable row level security;

create policy "org members manage own questions" on questions
  for all using (
    exists (
      select 1 from lessons l join sections s on s.id = l.section_id join courses c on c.id = s.course_id
      where l.id = questions.lesson_id and c.org_id = current_org_id()
    )
  ) with check (
    exists (
      select 1 from lessons l join sections s on s.id = l.section_id join courses c on c.id = s.course_id
      where l.id = questions.lesson_id and c.org_id = current_org_id()
    )
  );
create policy "anyone reads questions of published courses" on questions
  for select using (
    exists (
      select 1 from lessons l join sections s on s.id = l.section_id join courses c on c.id = s.course_id
      where l.id = questions.lesson_id and c.status = 'PUBLISHED'
    )
  );

create policy "org members manage own question choices" on question_choices
  for all using (
    exists (
      select 1 from questions q
      join lessons l on l.id = q.lesson_id
      join sections s on s.id = l.section_id
      join courses c on c.id = s.course_id
      where q.id = question_choices.question_id and c.org_id = current_org_id()
    )
  ) with check (
    exists (
      select 1 from questions q
      join lessons l on l.id = q.lesson_id
      join sections s on s.id = l.section_id
      join courses c on c.id = s.course_id
      where q.id = question_choices.question_id and c.org_id = current_org_id()
    )
  );
create policy "anyone reads question choices of published courses" on question_choices
  for select using (
    exists (
      select 1 from questions q
      join lessons l on l.id = q.lesson_id
      join sections s on s.id = l.section_id
      join courses c on c.id = s.course_id
      where q.id = question_choices.question_id and c.status = 'PUBLISHED'
    )
  );
