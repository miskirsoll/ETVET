-- ETVET foundation schema: organizations, users, subscription tiers,
-- and the course-authoring structure (Course -> Section -> Lesson -> Block).
-- Tenant isolation is enforced with Row Level Security scoped by org_id,
-- as a second line of defense behind the requireTier()/RBAC checks in the
-- API layer (see apps/web/lib/auth/requireTier.ts).

create extension if not exists "pgcrypto";

create type subscription_tier as enum ('FREE', 'PRO', 'MAXPRO');
create type org_role as enum ('SUPER_ADMIN', 'ORG_ADMIN', 'AUTHOR', 'TRAINER', 'LEARNER', 'REVIEWER');
create type lesson_type as enum ('BLOCK', 'QUIZ');
create type course_status as enum ('DRAFT', 'PUBLISHED');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subscription_tier subscription_tier not null default 'FREE',
  created_at timestamptz not null default now()
);

-- One row per authenticated person, keyed to Supabase auth.users.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  role org_role not null default 'AUTHOR',
  display_name text,
  created_at timestamptz not null default now()
);

create index users_org_id_idx on users (org_id);

-- Resolves the calling user's org, used by every RLS policy below.
-- security definer + a fixed search_path so it can read `users` even
-- though RLS on `users` itself would otherwise block a plain subquery.
create function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from users where id = auth.uid()
$$;

create table themes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null default 'Default',
  colors jsonb not null default '{}'::jsonb,
  fonts jsonb not null default '{}'::jsonb,
  logo_url text,
  layout_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  owner_id uuid not null references users (id),
  title text not null,
  cover_image_url text,
  theme_id uuid references themes (id),
  nav_settings jsonb not null default '{"sidebar": "visible", "navigation": "free"}'::jsonb,
  status course_status not null default 'DRAFT',
  publish_slug text unique,
  publish_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_org_id_idx on courses (org_id);

create table sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  title text not null,
  "order" integer not null default 0
);

create index sections_course_id_idx on sections (course_id);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections (id) on delete cascade,
  type lesson_type not null default 'BLOCK',
  title text not null,
  icon text,
  "order" integer not null default 0
);

create index lessons_section_id_idx on lessons (section_id);

create table blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  type text not null,
  "order" integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb
);

create index blocks_lesson_id_idx on blocks (lesson_id);

-- Bridges a block to a Live Session (Module C, MAXPRO only). Left in the
-- schema now so later migrations only need to add the live_sessions side.
create table interactive_blocks (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null unique references blocks (id) on delete cascade,
  live_session_id uuid,
  mode text not null default 'async' check (mode in ('sync', 'async'))
);

create table learner_progress (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  lesson_id uuid references lessons (id) on delete cascade,
  user_id uuid references users (id),
  anon_token text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'passed', 'failed')),
  score numeric,
  time_spent_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint learner_progress_identity check (user_id is not null or anon_token is not null)
);

create index learner_progress_course_id_idx on learner_progress (course_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  actor_id uuid references users (id),
  action text not null,
  entity text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: every tenant-scoped table is readable/writable only
-- by members of the same organization.
alter table organizations enable row level security;
alter table users enable row level security;
alter table themes enable row level security;
alter table courses enable row level security;
alter table sections enable row level security;
alter table lessons enable row level security;
alter table blocks enable row level security;
alter table interactive_blocks enable row level security;
alter table learner_progress enable row level security;
alter table audit_logs enable row level security;

create policy "org members read own org" on organizations
  for select using (id = current_org_id());
create policy "org members read own org users" on users
  for select using (org_id = current_org_id());

create policy "org members manage own themes" on themes
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy "org members manage own courses" on courses
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
-- Published courses are readable by anyone (learner portal / public link),
-- gated in the app layer by publish_password when set.
create policy "anyone reads published courses" on courses
  for select using (status = 'PUBLISHED');

create policy "org members manage own sections" on sections
  for all using (
    exists (select 1 from courses c where c.id = sections.course_id and c.org_id = current_org_id())
  ) with check (
    exists (select 1 from courses c where c.id = sections.course_id and c.org_id = current_org_id())
  );
create policy "anyone reads sections of published courses" on sections
  for select using (
    exists (select 1 from courses c where c.id = sections.course_id and c.status = 'PUBLISHED')
  );

create policy "org members manage own lessons" on lessons
  for all using (
    exists (
      select 1 from sections s join courses c on c.id = s.course_id
      where s.id = lessons.section_id and c.org_id = current_org_id()
    )
  ) with check (
    exists (
      select 1 from sections s join courses c on c.id = s.course_id
      where s.id = lessons.section_id and c.org_id = current_org_id()
    )
  );
create policy "anyone reads lessons of published courses" on lessons
  for select using (
    exists (
      select 1 from sections s join courses c on c.id = s.course_id
      where s.id = lessons.section_id and c.status = 'PUBLISHED'
    )
  );

create policy "org members manage own blocks" on blocks
  for all using (
    exists (
      select 1 from lessons l join sections s on s.id = l.section_id join courses c on c.id = s.course_id
      where l.id = blocks.lesson_id and c.org_id = current_org_id()
    )
  ) with check (
    exists (
      select 1 from lessons l join sections s on s.id = l.section_id join courses c on c.id = s.course_id
      where l.id = blocks.lesson_id and c.org_id = current_org_id()
    )
  );
create policy "anyone reads blocks of published courses" on blocks
  for select using (
    exists (
      select 1 from lessons l join sections s on s.id = l.section_id join courses c on c.id = s.course_id
      where l.id = blocks.lesson_id and c.status = 'PUBLISHED'
    )
  );

create policy "org members manage own interactive blocks" on interactive_blocks
  for all using (
    exists (
      select 1 from blocks b
      join lessons l on l.id = b.lesson_id
      join sections s on s.id = l.section_id
      join courses c on c.id = s.course_id
      where b.id = interactive_blocks.block_id and c.org_id = current_org_id()
    )
  ) with check (
    exists (
      select 1 from blocks b
      join lessons l on l.id = b.lesson_id
      join sections s on s.id = l.section_id
      join courses c on c.id = s.course_id
      where b.id = interactive_blocks.block_id and c.org_id = current_org_id()
    )
  );

create policy "org members read own learner progress" on learner_progress
  for select using (
    exists (select 1 from courses c where c.id = learner_progress.course_id and c.org_id = current_org_id())
  );
create policy "learners write own progress" on learner_progress
  for insert with check (user_id = auth.uid() or user_id is null);
create policy "learners update own progress" on learner_progress
  for update using (user_id = auth.uid() or user_id is null);

create policy "org members read own audit log" on audit_logs
  for select using (org_id = current_org_id());
