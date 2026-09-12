# Running ETVET locally

This runs the whole stack on your machine — a local Supabase (Postgres +
Auth + Realtime + Storage, via Docker) plus the Next.js dev server. No
hosted Supabase project or internet-facing service required.

I applied both migrations and exercised the sign-up trigger and the
tenant-isolation RLS policies against a real Postgres before writing this
(details at the bottom), so the steps below are verified, not guessed —
Docker itself isn't available in the sandbox this was built in, so the
`supabase start` step is the one part you're running for the first time.

## Prerequisites

- **Node.js 20+** and npm
- **Docker Desktop** (or Docker Engine), running
- **Supabase CLI** — `npm install -g supabase`, or use `npx supabase`
  instead of `supabase` in every command below

## 1. Clone and check out the branch

```bash
git clone https://github.com/miskirsoll/ETVET.git
cd ETVET
git checkout claude/etvet-planning-questions-non32c
```

## 2. Start local Supabase

```bash
supabase start
```

First run pulls several Docker images (Postgres, GoTrue, Realtime, Storage,
Studio, Kong) — a few minutes. It automatically applies every migration in
`supabase/migrations/` to a fresh local Postgres.

When it finishes, it prints a block like:

```
         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: ...
        anon key: eyJ...
service_role key: eyJ...
```

Keep this output — you need the **API URL** and **anon key** next. Studio
URL is a local web UI for browsing the database/auth users, handy for
poking around.

If you ever change a migration file or want a completely clean database:

```bash
supabase db reset
```

## 3. Configure the web app

```bash
cd apps/web
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key supabase start printed>
```

## 4. Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 5. Try the golden path

1. **Sign up** at `/signup` with an org name, email, and password. Local
   Supabase Auth has email confirmation off by default, so you're signed
   in immediately.
   - A database trigger (`0002_signup_trigger.sql`) creates a new FREE-tier
     organization and makes you its `ORG_ADMIN` — you can confirm this in
     Studio (`Table Editor` → `organizations` / `users`), or in
     `Authentication` → `Users`.
2. You land on `/studio` (the course dashboard) — a fresh org has no
   courses yet. Create one.
3. Open the course → add a section, add a Block lesson, add some blocks
   (text/image/video/list/etc.), drag to reorder. Add a Quiz lesson too —
   it shows a "coming in the next milestone" placeholder, which is
   expected; only the outline structure is built for quiz lessons so far.
4. Visit `/studio/live` — since you're on FREE, you should see it
   **visibly present but locked**, with an "Upgrade to MAXPRO" button, not
   simply hidden.
5. Go to `/upgrade`, switch your org to MAXPRO, then revisit
   `/studio/live` — it should now show the unlocked placeholder instead of
   the lock overlay. This is the tier-gating loop end to end.
6. Optional: sign up a second account with a different org name in an
   incognito window, create a course there, and confirm you can't see it
   from the first account's `/studio` — that's the multi-tenant RLS
   isolation working.

## Automated tests

Two separate test suites, from `apps/web`:

```bash
npm test        # vitest -- pure logic: analytics, live-session aggregation,
                 # course ordering, SCORM manifest/suspend-data
npm run test:db  # supabase/tests/run.sh -- RLS/migration behavior against
                 # a throwaway local Postgres (needs `sudo -u postgres psql`
                 # access; see supabase/tests/00_stub.sql for what it stubs)
```

`test:db` drops and recreates a scratch `etvet_test` database each run, so
it's always safe to run against your local Postgres -- it never touches
the `supabase start` database you use for `npm run dev`.

## Stopping

```bash
supabase stop        # stops the local Supabase Docker stack
# Ctrl+C the npm run dev process
```

`supabase stop --no-backup` also wipes the local database if you want a
clean slate next time, instead of using `db reset`.

## What I verified before writing this doc

Docker wasn't available in the environment I built this in, so I couldn't
run `supabase start` myself. Instead I installed plain Postgres, stubbed
just enough of Supabase's `auth` schema (`auth.users`, `auth.uid()`) to
apply both migrations for real, and confirmed:

- Both migration files apply cleanly, in order, with no syntax errors.
- The sign-up trigger actually creates an `organizations` row and a
  `users` row (as `ORG_ADMIN`) when a row is inserted into `auth.users`.
- Row Level Security genuinely blocks cross-org access: querying `courses`
  as a non-superuser `authenticated` role scoped to one org's user only
  returns that org's course, not another org's.

The Next.js app itself (`npm run build`, `npm run lint`, and a dev-server
smoke test of the public routes and the auth redirects) was already
verified in the previous pass — see the git history on this branch.
