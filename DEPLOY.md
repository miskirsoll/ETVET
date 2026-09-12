# Hosting ETVET for free (Vercel + Supabase)

This puts a real, internet-reachable copy of ETVET online at no cost, using
each provider's free tier: **Supabase** (Postgres + Auth + Realtime +
Storage) and **Vercel** (hosts the Next.js app in `apps/web`). Free tiers
are fine for a demo/preview — they pause an inactive Supabase project after
a week and cap usage, but there's no card charge as long as you stay on the
free plan.

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New
   project**.
2. Pick any name/region/database password (save the password somewhere —
   you won't need it for the steps below, but it's your project's DB
   password if you ever need direct `psql` access).
3. Wait ~2 minutes for provisioning.

## 2. Apply the database migrations

The easiest path with no CLI setup:

1. In your Supabase project, open **SQL Editor**.
2. Open each file in `supabase/migrations/` **in order** (`0001_init.sql`,
   `0002_signup_trigger.sql`, … up through the highest-numbered file),
   paste its contents in, and click **Run**. One file, one paste, one run,
   in order — don't skip any or combine them out of order.

(If you have the Supabase CLI installed and prefer it: `supabase link
--project-ref <your-project-ref>` then `supabase db push` applies every
migration file for you in order.)

## 3. Get your project's API credentials

In the Supabase dashboard: **Project Settings → API**. You need two
values:

- **Project URL** (e.g. `https://abcdefgh.supabase.co`)
- **anon / public key** (a long JWT-looking string — NOT the
  `service_role` key, which must never be exposed to the browser)

## 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → sign up (free) with your
   GitHub account.
2. **Add New Project** → import `miskirsoll/ETVET`.
3. Under **Root Directory**, click **Edit** and set it to `apps/web` —
   this repo has no root `package.json`; the Next.js app lives in that
   subfolder.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL from step 3
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon key from step 3
5. Click **Deploy**. First build takes 1-2 minutes.

Vercel gives you a public `https://<something>.vercel.app` URL when it
finishes — that's your live site.

## 5. Try it

Same golden path as local dev (see `LOCAL_DEV.md` §5): sign up an org at
`/signup`, create a course, try `/studio/live`, `/upgrade`, etc. Since this
is a real hosted Supabase project (not local Docker), email confirmation
may be ON by default — if sign-up seems to hang after submitting, check
**Authentication → Providers → Email** in the Supabase dashboard and turn
"Confirm email" off for easy testing, or check the inbox you signed up
with.

## Becoming a Platform Admin (SUPER_ADMIN) on the hosted project

Same as local dev, but run the SQL in the Supabase **SQL Editor** instead
of a local `psql`:

```sql
update users set role = 'SUPER_ADMIN' where id = (
  select id from auth.users where email = 'you@example.com'
);
```

## Keeping it updated

Vercel auto-redeploys whenever the connected branch
(`claude/etvet-planning-questions-non32c`, or whichever branch you point it
at in Project Settings → Git) gets new commits. New migration files need
to be applied to the Supabase project manually (repeat step 2 for just the
new files) — Vercel doesn't touch your database.

## What this doesn't cover

- **Real billing** (§7.11) — Stripe isn't wired up yet; `/upgrade` is
  still the manual tier-switch tool.
- **AI features** (§7.10) — not built yet; needs an LLM API key.
- **A custom domain** — Vercel's free tier supports adding one under
  Project Settings → Domains if you own one; the `.vercel.app` URL works
  fine without it.
- **Realtime/Storage verification** — these were built against the
  documented Supabase API but never exercised against a real Supabase
  project during development (no Docker in that sandbox). This is your
  first chance to actually confirm Live Sessions' realtime updates and
  media uploads work end-to-end — worth checking deliberately once you're
  set up.
