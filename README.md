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

See `apps/web/README.md` for setup (Supabase project, env vars, running the
dev server).

## Stack

Next.js + TypeScript + Tailwind, Supabase (Postgres + Auth + Realtime +
Storage, Row-Level-Security for multi-tenant isolation), with a Node worker
service planned for SCORM packaging and LLM calls once those phases start.
