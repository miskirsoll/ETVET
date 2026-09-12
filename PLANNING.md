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

## 2. Decisions (confirmed)

Backend: **Supabase + Node worker**. Frontend: **Next.js App Router**. First
PR scope: **Foundation (org/user schema, `subscription_tier`, auth,
`requireTier()` guard, tier-flip test tool) + Course CRUD** (Course → Section
→ Lesson structure and a basic Block Lesson editor: text/heading, image,
video, list blocks). Reasoning for each recorded below.

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

## 6. Status

Step 1 (Foundation) and step 2 (Course structure) are scaffolded:

- `apps/web` — Next.js 16 App Router app. Auth (`/login`, `/signup`, sign
  out), `getSession()`/`requireTier()`/`requireRole()` guards, a course
  dashboard, a drag-and-drop outline editor (sections/lessons), a Block
  Lesson editor (heading, text, statement, quote, list, image, video,
  divider blocks — covers and exceeds the "at least text/image/video/list"
  bar from the build order), and an `/upgrade` page that doubles as the
  manual tier-flip test tool until Stripe is wired.
- `supabase/migrations/` — `organizations`/`users`/`subscription_tier`,
  the course structure tables, RLS policies scoped by `org_id`, and a
  sign-up trigger that gives every new user their own FREE-tier
  organization.
- `/studio/live` demonstrates the MAXPRO-gate UX pattern (`<LockedFeature>`:
  visible, disabled, "Upgrade to MAXPRO" CTA) ahead of Live Sessions itself
  being built, so the gate is provably wired before step 6.

Step 3 (Quiz Lesson editor) is also now built: `questions`/`question_choices`
tables (RLS-scoped the same way as the rest of the course structure),
multiple choice + multiple response + true/false question types (fill-blank
and matching are schema-ready via `question_choices`/`config` but have no
editor UI yet, per the plan's "MC + T/F first" ordering), per-question
options with a correct-answer toggle, drag-to-reorder questions, and a
per-lesson settings panel (pass threshold, optional timer, randomize +
draw-a-subset). Verified against a real Postgres instance: the schema
migrates cleanly, the pass-threshold check constraint rejects out-of-range
values, and RLS isolates one org's questions from another's, the same way
it already did for courses.

Not yet built: theming/publish/SCORM (steps 4–5) and everything in Module
B/C (steps 6–9) — see §7 below for the detailed breakdown. Note that
grading/scoring logic has nothing to run against yet, since there's no
learner-facing quiz-taking runtime until §7.4 (the public course renderer)
exists; the quiz editor built here is author-side only, same as the Block
Lesson editor was at this stage.

**§7.4 (public course renderer, preview/publish/progress) is now built**,
ahead of theming/SCORM per the suggested sequencing in §8:

- Publish/unpublish from the course outline page (`PublishPanel`):
  generates a unique `publish_slug` on first publish, optional
  `publish_password`, keeps the same slug across unpublish/republish.
- `/c/[slug]` — public, unauthenticated: password gate when set, a course
  landing page linking to the next incomplete lesson, and
  `/c/[slug]/lessons/[lessonId]` rendering either the Block Lesson (all 8
  block types, read-only) or the Quiz Lesson (interactive, client-side
  randomize/draw-a-subset per §7.1's settings) for that lesson.
- `nav_settings` is enforced both ways: the sidebar (`CourseShell`) hides
  locked lessons under sequential navigation, and the lesson page
  independently redirects a direct deep link to a locked lesson back to
  the right one — the sidebar's own lock/hide logic is a UI convenience,
  not the actual boundary.
- Progress tracking against `learner_progress`: a Block Lesson writes
  `completed` on a "Complete & continue" click; a Quiz Lesson is graded
  **server-side** against the authoritative `is_correct` flags (the client
  only ever submits which choice ids it picked, never a score or a
  pass/fail verdict) and writes `passed`/`failed` + score against
  `pass_threshold`. Anonymous learners get a random token in an httpOnly
  cookie, minted lazily by the first Server Action that needs one.
- **Two real RLS gaps found and fixed while building and testing this**
  (both pre-dated this milestone, in the original Foundation migration —
  see migrations `0004`–`0006` and their own commit messages for the full
  detail): every table was missing the Data API grants entirely (RLS
  restricts a grant, it doesn't imply one — nothing was reachable through
  PostgREST at all before `0004`), and the original insert/update policies
  on `learner_progress` keyed on `user_id is null`, which passed for *any*
  anonymous row rather than the caller's own, since `anon_token` isn't a
  verifiable JWT claim the way `auth.uid()` is. Both are now fixed with
  `SECURITY DEFINER` RPCs (`get_learner_progress`,
  `submit_learner_progress`) that filter by the exact token argument
  inside their own SQL, closing the gap a client-side query filter alone
  can't close. All of this was verified against a real (temporary, local)
  Postgres instance, not assumed from reading the SQL.
- Deliberately deferred from this pass: the desktop/tablet/mobile preview
  frame toggle inside `/studio` (the renderer itself is responsive by
  default — Tailwind, mobile-first — just no author-facing frame-switcher
  UI yet), and tying progress to an authenticated **learner** account
  (there's no learner-signup path distinct from the org-owner signup flow
  yet — anonymous-token tracking is the only path for now, which the spec
  allows: "account optional... recommended but not required").

## 7. Remaining work — detailed

Everything below is what's left to reach the spec's "fully functional"
platform. Grouped by workstream, roughly in build order; sizes are rough
relative effort (S/M/L/XL), not calendar time. **One structural gap not
called out as its own numbered step before:** there is currently no
learner-facing public rendering of a course at all — everything built so
far is the authoring side only. Preview, publish, progress tracking, SCORM
export, and Bridge async mode all depend on that renderer existing, so it's
folded into §7.4 rather than treated as implicit.

### 7.1 Quiz Lesson editor (build order step 3) — L — **done** (editor side)

- ~~Schema: `questions`, `question_choices` (a lesson's own question pool
  doubles as its "bank" — a separate reusable bank table shared across
  lessons is deferred).~~ Built.
- ~~Question types: multiple choice, multiple response, true/false.~~ Built.
  Fill-in-the-blank and matching (drag-to-pair) remain — schema has room
  (`question_choices` + `questions.config` jsonb) but no editor UI yet.
- ~~Pass/fail threshold, optional per-quiz timer, randomize + draw-a-subset
  per attempt.~~ Built. Retry limits and scored-vs-practice mode remain.
- ~~Per-choice correct/incorrect.~~ Built. Per-choice custom feedback text
  has a `feedback` column but no editor field yet.
- Still remaining: a quiz-taking runtime (grading logic + score
  computation) — that's a learner-facing concern and waits on §7.4's
  public renderer, same reasoning as the Block Lesson editor.

### 7.2 Theming & branding — M

- Theme editor UI over the `themes` table (already migrated, never
  surfaced in the UI): color palette, font picker + custom font upload,
  logo upload, cover photo (own upload or a stock library), layout choice,
  block-entrance-animation toggle.
- Apply the selected theme when rendering both the authoring preview and
  the published course.
- Depends on §7.3 for font/logo/cover uploads.

### 7.3 Media storage & uploads — M

- Supabase Storage buckets (images, video, audio, fonts, logos) with
  per-org path scoping and per-tier storage limits (spec: "limited" on
  FREE, "extended" on PRO/MAXPRO).
- Replace the current URL-only image/video blocks with real upload
  widgets; add the image-cropping tool the spec calls out.
- Audio block with upload **and** in-browser recording.
- Extend RLS-equivalent access rules to Storage policies (bucket policies
  mirroring the `org_id` scoping already enforced on the tables).

### 7.4 Preview, publish, and the public learner experience — XL — **done** (core)

The biggest single gap; built ahead of theming/SCORM per §8. See §6 above
for the full rundown, including two real RLS gaps in the *original*
Foundation migration that this work surfaced and fixed.

- ~~Unauthenticated route rendering a published course (`/c/[slug]`,
  password gate via `publish_password`).~~ Built.
- ~~Renders every block type built so far; respects `nav_settings`
  (sidebar visible/hidden/off, free vs. sequential), enforced both in the
  sidebar and independently on direct lesson-URL access.~~ Built.
  In-course search (also part of `nav_settings` in the spec) is not built.
- ~~"Publish" action: flips `status`, generates/persists `publish_slug`,
  sets/clears `publish_password`.~~ Built, from the course outline page.
- ~~Learner progress tracking: per-lesson completion, quiz score, time
  spent, anonymous-token based.~~ Built. Tying progress to an
  *authenticated* learner account is not — there's no learner-signup flow
  distinct from the org-owner signup yet (§7.12).
- ~~Quiz-taking flow from §7.1 plugs in here.~~ Built, graded server-side.
- Still remaining: the theme isn't applied to this renderer yet (§7.2 not
  built), and the desktop/tablet/mobile author-facing preview frame
  toggle. Continue blocks (progressive reveal) still don't exist as a
  block type at all — see §7.4.1 below, a gap in the *original* block
  editor noticed while building this.

#### 7.4.1 Known gap: Continue and Button blocks were never built — S

The spec explicitly calls out a **Continue block** (hides further content
until the learner interacts with it) and a **Button block** (custom
navigation) as required structural block types, alongside Divider. Only
Divider was built in the original Block Lesson editor pass. Worth picking
up alongside whatever touches the block editor next, since the public
renderer now exists to make a Continue block's behavior actually visible.

### 7.5 SCORM export for Moodle (build order step 5) — XL

- The Node worker service from the architecture decision (§2.1,
  `apps/scorm-worker` or similar) doesn't exist yet — this is the one
  piece that doesn't fit cleanly as a Next.js route (real filesystem/zip
  work, needs to run outside the request/response cycle).
- Package the §7.4 renderer's output as static HTML/CSS/JS/assets,
  self-contained, no calls back to ETVET's servers for content to render.
- `imsmanifest.xml` (SCORM 1.2, single-SCO default) + the
  `LMSInitialize/GetValue/SetValue/Commit/Finish/GetLastError` JS runtime
  adapter.
- Map to `cmi.core.lesson_status`, `cmi.core.score.raw`,
  `cmi.core.session_time`; resume via compact `cmi.suspend_data`
  (lesson/block index + answered-question IDs, not full state, to fit
  under the strict 4096-char limit).
- Server-side manifest/package validation gate before the download is
  served, with a clear error instead of a broken zip on failure.
- Post-download in-app checklist for uploading into Moodle.
- A generic SCORM 2004/xAPI/AICC/cmi5 export for other LMSs is explicitly
  lower priority (build order step 11) — get Moodle's SCORM 1.2 path right
  first.

### 7.6 Live Interactive Sessions — Module B (build order step 6) — XL

The single largest remaining workstream, and the first genuinely new
schema surface since Foundation:

- Schema: `live_sessions`, `live_slides`, `live_responses`,
  `qa_questions` — all referenced in the spec's data model, none migrated
  yet.
- Session builder UI: ordered slide deck, at minimum poll, word cloud,
  open-ended text, scale, ranking, quiz/leaderboard (with countdown timer
  and speed-scored points), Q&A board (optionally anonymous, upvoting,
  moderation), reaction overlay, and the "100 points" allocation slide.
- Join flow: `/join/[code]`, QR code generation, short join code, anonymous
  short-lived session tokens (no account required) — this is the first
  place actual anonymous participation (distinct from anonymous *learner*
  progress in §7.4) enters the schema.
- Realtime fan-out via Supabase Realtime (per the §2.4 decision) so
  responses update the presenter's and participants' screens in
  well under a second, with graceful reconnect on a dropped connection.
- Scale target from the spec: 1,000+ concurrent anonymous participants per
  session — worth a load-test pass before calling this done, since it's
  the platform's one hard real-time scaling requirement.

### 7.7 Present mode (build order step 7) — L

- Big-screen view (cast/projector) showing the current slide and live
  results.
- Presenter-only control panel: response counts, next-slide, lock/unlock
  voting, reset results, skip/reopen a slide, Q&A moderation queue,
  session pause/resume, live participant count.
- Post-session results page per session: per-slide breakdown, CSV export.
- Session library: duplicate/reuse a past session as a template.

### 7.8 The Bridge — Module C (build order step 8) — M

- Add the "Interactive Block" type to the Block Lesson editor (the
  `interactive_blocks` table already exists, bridging a `block_id` to a
  `live_session_id` + `sync`/`async` mode — schema was scaffolded early
  deliberately for this).
- Sync mode: block becomes a join point into a live, presenter-controlled
  session in progress.
- Async mode: block renders the poll/quiz/word-cloud directly inside the
  §7.4 course renderer, self-paced, showing a running aggregate with no
  presenter needed.
- Both gated `requireTier("MAXPRO")`, following the same
  `<LockedFeature>` pattern already used for `/studio/live`.

### 7.9 Unified analytics dashboard (build order step 9) — M

- Per course: completion rate, average quiz score, aggregated results
  from any embedded interactive blocks, in one view (MAXPRO only).
- Depends on real data existing in `learner_progress` (§7.4), quiz
  attempts (§7.1), and `live_responses`/interactive blocks (§7.6/§7.8) —
  sequenced last among the feature work for that reason.

### 7.10 AI features (build order step 10) — L

- AI Course Draft: prompt/topic or pasted source → generated outline +
  draft block content, via an LLM API (Claude, per the spec's suggested
  architecture) — runs from the Node worker or a server action with a
  longer timeout budget, not a typical request/response route.
- AI quiz generator from lesson content or a source document.
- AI live-slide generator (mixed poll/quiz/word-cloud deck from a
  prompt/topic/document), and auto-suggesting a relevant slide from an
  adjacent lesson's content (the spec's own "platform-unique bridge"
  feature on the AI side).
- In-course AI tutor chatbot (MAXPRO only), course-content-aware.
- Needs a real Anthropic API key wired into environment config; until
  then these stay unbuilt rather than mocked, since a fake AI response
  would be actively misleading in a demo.

### 7.11 Real payments — M

- Replace the `/upgrade` tier-flip stub with real Stripe Checkout +
  webhook → the webhook sets `subscription_tier` on `organizations`,
  reusing every existing `requireTier()` call site unchanged.
- Needs a live Stripe account/API keys — same "don't fake it" reasoning
  as AI.

### 7.12 Roles/RBAC completeness — S/M

- Team invite flow: right now every sign-up creates a **new** org (by
  design, for a fast solo-user path); there's no way yet to invite a
  teammate into an *existing* org as Author/Trainer/Reviewer. Needed for
  the spec's "team authoring" line and for MAXPRO's Trainer role to
  matter across multiple people.
- Reviewer/Stakeholder role: read-only preview links with commenting
  (spec's "Review-360-style" feedback), not yet touched.
- Super Admin console: cross-org platform management — lowest priority
  of the roles, since it's an internal/operator surface, not customer-facing.

### 7.13 Accessibility — WCAG 2.1 AA — cross-cutting, continuous + M final audit

- Full keyboard navigation, screen-reader compatibility, alt-text fields
  on every image block, caption/transcript support on video/audio,
  enforced color-contrast in the theme editor (§7.2).
- Best treated as a standing requirement on every new UI PR rather than
  a single step, plus one dedicated audit pass before calling any tier
  "launch ready."

### 7.14 Testing & production readiness — M, ongoing

- No automated tests exist yet (unit or e2e) — worth introducing
  alongside §7.1/§7.4 rather than after, given how much RLS/tier-gating
  logic already exists to regress against.
- Production Supabase project (this has only been run against a local
  Supabase instance so far) + Vercel deployment for `apps/web` + hosting
  for the Node worker once §7.5/§7.10 need it.
- Rate limiting on public, unauthenticated endpoints (`/join/[code]`,
  published course links) given the anonymous-participation requirement.
- Email confirmation flow: currently whatever Supabase Auth's project
  default is; worth an explicit decision once this leaves local dev.

### 7.15 Polish / stretch (build order step 11) — after everything above

Generic SCORM 2004/xAPI/AICC/cmi5 export for non-Moodle LMSs,
white-labeling/custom domain, localization/translation (including
AI-assisted translation from §7.10), full accessibility certification.

## 8. Suggested sequencing

Respecting the dependencies above, in one straight line:

1. §7.1 Quiz editor → 2. §7.4 Public renderer + preview/publish/progress
(unlocks the most downstream work) → 3. §7.2 Theming + §7.3 Media uploads
(can run in parallel with each other, both need §7.4's renderer to show
results in) → 4. §7.5 SCORM export (closes out Module A / PRO tier being
complete) → 5. §7.6 Live Sessions → 6. §7.7 Present mode → 7. §7.8 The
Bridge → 8. §7.9 Unified analytics → 9. §7.10 AI features + §7.11 Payments
(both gated on real API keys, can slot in whenever those are available) →
10. §7.12 Roles/RBAC completeness → 11. §7.15 Polish.

§7.13 (accessibility) and §7.14 (testing/production readiness) run
alongside all of the above rather than waiting for a dedicated slot.
