# ETVET — Build Plan

Reconciles the product specification (`ETVET_Product_Specification.md`) with the
project brief. The two sources agree on nearly everything; where they diverge,
this doc states which one wins and why. This is a planning document, not a
scaffold — no application code has been written yet.

## 1. What ETVET is

One platform, two experiences, one login:

- **Studio** (PRO + MAXPRO): block-based course authoring, à la Rise 360 —
  Course → Section → Lesson (Block | Quiz) → Block.
- **Live** (MAXPRO only): real-time audience interaction, à la Mentimeter —
  join-by-code sessions with polls, word clouds, quizzes/leaderboards, Q&A,
  reactions.
- **The Bridge** (MAXPRO only, the actual differentiator): a Live slide can be
  dropped into a course lesson as an "Interactive Block," either as a
  synchronous join-point into a live session or an async always-open
  poll/quiz that self-paced learners answer independently, with a unified
  learner profile and cross-module analytics.

Gating is by `subscription_tier` (`FREE | PRO | MAXPRO`) on the organization,
enforced server-side via a `requireTier()` guard on every protected route —
never just hidden in the UI. Both sources are explicit and consistent on this:
build the gating layer before any feature UI.

## 2. Decisions the two sources leave open

Everything below needs an answer before scaffolding starts, because it
determines the shape of the repo, the schema, and the deployment target.
Recommendations are marked, with reasoning — see the questions sent alongside
this plan.

### 2.1 Backend platform: custom Node/TS API vs. Supabase
The spec explicitly offers both ("Node.js/TypeScript API (or Supabase if the
platform is Supabase-based)"). This is the single highest-impact fork:
- **Custom** (NestJS/Express + Prisma + raw Postgres + Socket.IO + S3-compatible
  storage): full control over the `requireTier()` guard, RBAC, and the
  SCORM export pipeline (a batch job that needs real filesystem/zip work —
  awkward inside Supabase Edge Functions). More infra to run yourself.
- **Supabase** (Postgres + Row-Level-Security + Realtime + Storage + Auth):
  much faster to stand up multi-tenant isolation (RLS policies map cleanly
  to `org_id` scoping) and realtime broadcast for Module B. SCORM packaging
  and any heavier AI-orchestration would still need a separate Node worker
  (Supabase Edge Functions run Deno, on a runtime budget too small for zip
  generation), so this ends up as a *hybrid* either way.

**Recommendation:** Supabase for auth/DB/realtime/storage, plus one small
Node/TS worker service for SCORM packaging and LLM calls. This gets Module B's
realtime and Module A's multi-tenant isolation "for free" via Postgres RLS,
while keeping the one genuinely custom piece (SCORM zip + manifest
generation) in a normal Node process where it's easy to test.

### 2.2 Frontend framework
The brief says React + TS + Tailwind; the spec suggests "React (or Next.js)."
The sibling repo in this account (`miskirsPortfolio`) is Next.js (App Router).
**Recommendation:** Next.js (App Router) + TypeScript + Tailwind, one app
shell with two route groups — `/studio/*` (authoring) and `/live/*` +
`/join/[code]` (present/participate) — matching the spec's suggested
`/author` + `/present`/`/join` split. Reuses this account's existing Vercel
deployment pattern.

Note: `miskirsPortfolio/AGENTS.md` carries a repo-local warning about a
non-standard Next.js build in *that* repo specifically ("read
`node_modules/next/dist/docs/` before writing any code"). That instruction is
scoped to the portfolio repo's own `node_modules` and has no bearing on a
fresh `ETVET` install, which will pull whatever Next.js version we pin in its
own `package.json`.

### 2.3 Repo topology
`ETVET` is currently a single empty repo. **Recommendation:** monorepo inside
it — `apps/web` (Next.js), `apps/scorm-worker` (Node service for SCORM +
AI-orchestration jobs), `packages/db` (Prisma/SQL schema + generated types
shared by both), using npm/pnpm workspaces. Avoids splitting into multiple
GitHub repos this session doesn't have access to provision.

### 2.4 Realtime provider
Spec allows Socket.IO, Supabase Realtime, Pusher, Firebase, or PartyKit, and
calls this "the single highest-risk technical component." If §2.1 lands on
Supabase, its Realtime (Postgres CDC + broadcast channels) covers Module B's
poll/word-cloud/leaderboard fan-out without running a separate WebSocket
server — recommended default given the hybrid architecture above.

### 2.5 Payments and AI — depth for the first milestone
Both sources agree these can be stubbed for the earliest phases (spec Phase 1
ships with "MAXPRO features stubbed"; the brief says "stub Stripe checkout if
payments aren't in scope yet, but keep `subscription_tier` wired"). Treat
Stripe and the Claude API as **wired but test-mode/mocked** until real API
keys are supplied — not a blocker for scaffolding.

## 3. Reconciled build order

Both sources' phasing agree closely. Merged sequence, each step left in a
demoable state:

1. **Foundation** — org/user schema, `subscription_tier` field, auth
   (email/password + JWT, or Supabase Auth), `requireTier()` middleware +
   route guard, a way to manually flip a test user between PRO/MAXPRO.
2. **Course structure** — Course → Section → Lesson CRUD, drag-and-drop
   outline editor, Block Lesson editor with text/heading, image, video, and
   list blocks (the minimum block set both sources call out first).
3. **Quiz Lesson editor** — multiple choice + true/false first, remaining
   question types (multiple response, fill-in-the-blank, matching) after.
4. **Theming, responsive preview, publish-to-link, learner progress** —
   anonymous-token or account-linked progress tracking; this is the point
   PRO becomes a genuinely usable product on its own.
5. **SCORM-for-Moodle export** — pulled forward per both sources' explicit
   note that Moodle compatibility is launch-critical, not a late extra:
   SCORM 1.2, single-SCO default, `imsmanifest.xml` + JS runtime adapter
   (`LMSInitialize/GetValue/SetValue/Commit/Finish/GetLastError`), resume via
   compact `cmi.suspend_data` (index-based, not full state, to survive the
   4096-char limit), score/status mapped to the Moodle gradebook, and a
   server-side manifest validation gate before the download is allowed.
6. **Live Session builder (MAXPRO)** — poll, word cloud, quiz/leaderboard
   slide types; `/join/[code]` + QR flow with anonymous session tokens;
   realtime result broadcast.
7. **Present mode** — big-screen view + presenter control panel, Q&A board
   with moderation, emoji reaction overlay.
8. **The Bridge** — Interactive Block type in the lesson editor, sync mode
   (join point into a live session) and async mode (persistent
   poll/quiz with running aggregate), both MAXPRO-gated.
9. **Unified analytics dashboard** — completion, quiz scores, and embedded
   interactive-block results per course, in one view.
10. **AI features** — course-draft generator, AI quiz generator, AI
    live-slide generator, in-course AI tutor (MAXPRO only), via an LLM API.
11. **Polish / stretch** — generic SCORM 2004/xAPI/cmi5 export for non-Moodle
    LMSs, white-labeling, localization, accessibility audit (WCAG 2.1 AA).

## 4. Core schema (from spec §7, unchanged — both sources agree)

`organizations`, `users`, `courses`, `sections`, `lessons`, `blocks`,
`interactive_blocks` (bridges a block to a `live_session` + sync/async mode),
`question_banks`/`questions`/`question_choices`, `themes`, `live_sessions`,
`live_slides`, `live_responses`, `enrollments`/`learner_progress`,
`qa_questions`, `subscriptions`, `audit_logs`. Every tenant-scoped table
carries `org_id`; if §2.1 lands on Supabase, RLS policies enforce isolation
at the database layer as a second line of defense behind the API-layer
`requireTier()`/RBAC checks — the spec is explicit that tenant isolation must
not rely on the frontend alone.

## 5. Roles (spec §6, brief §5 — spec's list is a strict superset)

Super Admin (platform-wide, spec only — brief omits it but doesn't contradict
it) → Org Admin → Author/Instructor (PRO) → Trainer (MAXPRO) →
Learner/Participant → Reviewer/Stakeholder (read-only feedback links, spec
only). Building all six from the start costs little once RBAC middleware
exists, so keep the full set rather than trimming to the brief's five.

## 6. What this plan deliberately does not do yet

No code, schema migrations, or package.json has been written. Scaffolding
starts once the questions accompanying this plan are answered — the answers
change the monorepo layout, the ORM choice, and whether the first PR includes
a `supabase/` directory or a `docker-compose.yml` for local Postgres.
