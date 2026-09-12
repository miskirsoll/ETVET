# ETVET

A web app that integrates content authoring with class interactivity features.

See [`PLANNING.md`](./PLANNING.md) for the full build plan, architecture
decisions, and phased roadmap.

## Structure

```
apps/web/            Next.js 16 (App Router) frontend — course authoring
                      studio today; /studio/live and the Bridge land in
                      later phases per PLANNING.md.
supabase/migrations/  SQL schema: organizations, users, subscription tiers,
                      courses/sections/lessons/blocks, RLS policies.
```

## Getting started

See [`LOCAL_DEV.md`](./LOCAL_DEV.md) (macOS/Linux) or
[`WINDOWS_SETUP.md`](./WINDOWS_SETUP.md) (Windows/PowerShell) to run the
whole stack locally (local Supabase via Docker + the Next.js dev server)
and walk through the tier-gating golden path end to end. `apps/web/README.md`
has quicker reference notes once you're set up.

## Stack

Next.js + TypeScript + Tailwind, Supabase (Postgres + Auth + Realtime +
Storage, Row-Level-Security for multi-tenant isolation), with a Node worker
service planned for SCORM packaging and LLM calls once those phases start.
