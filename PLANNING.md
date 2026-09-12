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
  divider, continue, and button blocks — covers and exceeds the "at least
  text/image/video/list" bar from the build order), and an `/upgrade` page
  that doubles as the manual tier-flip test tool until Stripe is wired.
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

### 7.2 Theming & branding — M — **done** (core), URL-based media pending §7.3

- ~~Theme editor UI over the `themes` table: color palette, font picker,
  layout choice, block-entrance-animation toggle.~~ Built — `/studio/themes`
  (list/create) and `/studio/themes/[themeId]` (edit), assignable per
  course from the outline page's `ThemeSelector`. Font upload and a stock
  cover-photo library are not built (font choice is currently a fixed list
  of web-safe fonts, no custom upload); logo/cover are URL fields for now,
  same simplification the image block started with, upgraded once §7.3
  lands actual file upload.
- ~~Apply the selected theme when rendering the published course.~~ Built:
  `CourseShell` applies background/text color and body font once on the
  outer wrapper (both are inherited CSS properties, so this themes every
  descendant that doesn't set its own explicit color/font), plus a primary-
  color accent on buttons/active links and the animation toggle on each
  block in `BlockView`. Applying the theme to the **authoring** preview is
  still pending (there's no preview frame yet at all, per §7.4).
- **Found and fixed while wiring this in**: the `themes` table had no
  public-read RLS policy at all — a published course's anonymous visitor
  could never have read its own theme. Same gap pattern as the earlier
  `learner_progress` findings, just simpler to close since a theme *is*
  safely identifiable by a plain "does some published course point at
  this theme.id" `EXISTS` check (no unverifiable-token problem here,
  unlike anon_token) — fixed in migration `0007`, verified against a real
  Postgres instance: an anonymous role can read a theme attached to a
  published course, but not one that exists only in draft/unpublished form.

### 7.3 Media storage & uploads — M — **done, but unverified** (see caveat)

- ~~Audio block~~ Built as a separate pass, URL-based like Video (verified
  the same way as everything else — build/lint/DB-tested).
- ~~Supabase Storage bucket, org-scoped by path prefix.~~ Built: a single
  public `media` bucket (migration `0008`), RLS on `storage.objects`
  mirroring the `org_id` scoping every other table already has, applied to
  a stub of the `storage` schema and confirmed the policy logic actually
  works — an org can upload into its own path prefix, not another org's.
- ~~Replace URL-only image/video blocks with real upload widgets~~ Built:
  a reusable `<FileUpload>` component, wired into the image, video, and
  audio blocks (alongside the existing URL field, not instead of it), the
  theme editor's logo field, and a **newly surfaced course cover-image
  field** (`courses.cover_image_url` was already migrated and used by
  `duplicateCourse`, but had no UI at all until now — another small gap
  found in passing, same pattern as Continue/Button/Audio).
- **Important caveat, unlike every other migration/feature in this repo:
  the actual file-upload path has NOT been run against a real Supabase
  Storage service.** This sandbox has no Docker daemon, and Storage (the
  service that actually stores and serves bytes, not just the
  `storage.objects` metadata row) only runs via the Docker-based local
  stack or a hosted project. What *was* verified: the RLS policy logic
  against a hand-built stub of the `storage` schema (org-scoped
  insert/update/delete correctly allowed/denied), and that the app builds,
  lints, and doesn't crash at runtime with the upload UI present. What
  was *not* verified: an actual `supabase.storage.upload()` call
  succeeding, `getPublicUrl()` returning a working URL, or the bucket
  actually being created correctly by `insert into storage.buckets`
  (Storage may have its own bucket-creation API/expectations beyond a
  plain table insert — this follows the commonly-documented pattern but
  needs a real `supabase start` to confirm). **Test this before relying on
  it** — upload a real image through `/studio` against a local Supabase
  instance and confirm it renders back on the published course.
- Not built: image cropping, in-browser audio recording, custom font
  upload, per-tier storage limits (FREE vs PRO/MAXPRO quotas), and a
  stock cover-photo library.

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
  toggle.

#### 7.4.1 Continue and Button blocks — **done**

~~The spec explicitly calls out a Continue block (hides further content
until the learner interacts with it) and a Button block (custom
navigation) as required structural block types, alongside Divider. Only
Divider was built in the original Block Lesson editor pass.~~ Fixed:

- Both added to the Block Lesson editor's add-block menu and config forms
  — Continue takes a button label; Button takes a label plus a target
  (next lesson, a specific lesson picked from the rest of the course, or
  an arbitrary URL).
- The public renderer's `BlockView` actually implements the gating: blocks
  are split into segments at each Continue block, and only the segments
  up to the last one the learner has clicked are rendered — not just
  stored config with no runtime behavior. Verified the edge cases don't
  crash (no Continue block at all, one as the very last block, an empty
  lesson).
- This is real, if basic, branching: a Button block targeting a specific
  lesson lets an author route learners out of strict top-to-bottom order,
  which is what the spec's "custom navigation/branching" line asked for,
  short of a full scenario/branching editor (still out of scope).

### 7.5 SCORM export for Moodle (build order step 5) — XL — **done** (core)

Unlike Storage (§7.3), this turned out to be fully testable here: it's
pure data transformation and zip assembly, no live backend required. Built
and verified more rigorously than almost anything else in this repo —
details below.

- ~~Package course content as static HTML/CSS/JS, self-contained.~~ Built
  as a small vanilla-JS runtime (`lib/scorm/player.ts` generates
  `index.html`/`styles.css`/`player.js`) — no React/Next runtime bundled,
  deliberately reimplemented rather than reusing the §7.4 renderer's React
  components, since a SCORM package has to run standalone with no server.
  Renders all 10 block types and both quiz question modes
  (multiple_choice/multiple_response), including Continue-block gating.
- ~~`imsmanifest.xml` + the SCORM 1.2 JS runtime adapter.~~ Built
  (`lib/scorm/manifest.ts`, `lib/scorm/scormApiAdapter.ts`) — single-SCO,
  the standard `findAPI` window-tree-walk, and a harmless in-memory
  fallback when no LMS API is present (so the same package also just runs
  standalone in a browser).
- ~~Map to `cmi.core.lesson_status`/`score.raw`/`session_time`; resume via
  compact `cmi.suspend_data`.~~ Built. Format documented in
  `lib/scorm/suspendData.ts`: `v1:<lessonIndex>:<statusChars>:<quizScores>`
  — compact enough to stay far under the 4096-char limit even for large
  courses. Deliberately **does not** track in-progress answers within a
  quiz attempt (the spec's fuller "answered-question IDs" resume
  fidelity) — a learner who leaves mid-quiz restarts that lesson's quiz.
  `cmi.core.exit` is set to `"suspend"` for both `incomplete` *and*
  `failed` overall status (not just `incomplete`) — a failed quiz still
  has a Retry button, so the session isn't actually finished; found via
  testing, not assumed.
- ~~Server-side validation gate before download.~~ Built
  (`lib/scorm/validate.ts`, via `fast-xml-parser`): confirms well-formed
  XML, the required SCORM 1.2 elements, `scormtype="sco"`, and that every
  file the manifest references actually exists in the package — the route
  handler returns a 422 with specific errors instead of a broken zip.
- ~~Post-download Moodle checklist.~~ Built into `ScormExportButton`.
- **Best-effort asset embedding** (`lib/scorm/assets.ts`), not originally
  scoped this precisely but necessary for genuine self-containment: a
  direct file URL (uploaded image/audio/video) is fetched and embedded in
  the zip; a third-party embed URL (YouTube, etc.) has no downloadable
  file at all, so it's left as an external link with a recorded warning
  rather than silently claimed as bundled. Verified with a real network
  fetch (not a mock) — a real image fetched and embedded correctly, a
  YouTube URL correctly left alone with the right warning, and a
  nonexistent domain failing without crashing the export.
- Runs inline in a Next.js Route Handler
  (`/studio/courses/[courseId]/scorm`) rather than the separate Node
  worker service the architecture decision called for — reasonable for
  course sizes in scope so far; extracting it into a standalone worker
  later shouldn't require changing `lib/scorm/*` itself, since the route
  handler is a thin wrapper around `buildScormPackage()`.
- Not built: multi-SCO packaging (single-SCO is the spec's stated
  default), retry limits (a failed quiz can always be retried), a stock
  in-package search, and running the actual output through the real ADL
  SCORM Test Suite (the spec's stronger acceptance criterion, beyond what
  this repo's own validator checks) — that needs the real tool, not
  something reproducible here.

**How this was verified** (materially more than a "looks right" read):
generated the manifest, ran it through the real validator, and confirmed
both that valid input passes and that two deliberately-broken variants
(wrong `scormtype`, a missing referenced file) are correctly rejected;
built a real zip with JSZip and re-opened it to confirm every expected
file round-trips byte-for-byte; executed the *actual generated JS*
(`suspend-data.js`, `scorm-api.js`, `player.js`) via Node's `vm` module
against a hand-built fake DOM and a fake LMS `API` object (not a
reimplementation of the logic) — clicking through a Continue block,
completing a lesson, submitting a correct quiz answer (score 100,
`lesson_status="passed"`, `exit=""`) and an incorrect one (score 0,
`lesson_status="failed"`, `exit="suspend"`), reading every value back out
of the fake LMS's own `LMSSetValue` calls rather than reaching into the
script's internal state. This process caught and fixed one real bug (the
`cmi.core.exit` logic above) before it shipped, and the asset-embedding
path was checked against real network requests, not a mock.

### 7.6 Live Interactive Sessions — Module B (build order step 6) — XL — **core built**

The single largest remaining workstream, and the first genuinely new
schema surface since Foundation. This pass built a real working vertical
slice; a few things explicitly deferred to §7.7/later.

- ~~Schema: `live_sessions`, `live_slides`, `live_responses`,
  `qa_questions`.~~ Built (migration `0009`), plus a `qa_upvotes` table not
  originally called out separately (needed for real upvote-once-per-
  participant semantics) with a trigger keeping `qa_questions.upvotes` in
  sync. RLS here is simpler than `learner_progress`'s was: response data
  has no "read only my own row" requirement — a live poll's whole point is
  that everyone sees the aggregate — so plain RLS (no `SECURITY DEFINER`
  RPC) is correct, not a shortcut. Verified thoroughly against a real
  Postgres instance: join-by-code read, response submission when live and
  unlocked, submission correctly blocked once the presenter locks the
  slide, Q&A submit/upvote, the upvote-count trigger, duplicate-upvote
  rejection, and hidden questions correctly invisible to participants but
  visible to the org (presenter).
- ~~Session builder UI: ordered slide deck.~~ Built for **poll, word
  cloud, open-ended, quiz (with countdown timer + speed-scored
  leaderboard), and Q&A board** — five of the nine slide types the spec
  lists. **Scale, ranking, and the "100-points" allocation slide are not
  built** (same config-jsonb-ready-but-no-UI treatment as fill-blank/
  matching questions earlier); a standalone **reaction overlay** is also
  not built.
- ~~Join flow: `/join/[code]`, QR code, anonymous short-lived session
  tokens.~~ Built, including a real QR image (the `qrcode` package).
  Deliberately a **separate** anonymous-identity mechanism from the
  course-progress anon token in §7.4 (`lib/live/participant.ts`, a
  per-session cookie) — joining two different sessions shouldn't be
  correlatable to the same person, per the spec's anonymity requirement.
- ~~Realtime fan-out via Supabase Realtime.~~ Wired using Postgres Changes
  (`supabase.channel().on('postgres_changes', ...)`), tables added to the
  `supabase_realtime` publication in the migration. **This is the one
  piece of §7.6 that could not be verified here** — same category as
  Storage: the actual Realtime wire service only runs via the Docker-based
  local stack or a hosted project. Schema/RLS/trigger logic and the
  aggregation functions (`lib/live/aggregate.ts` — poll tallying, word-
  cloud weighting, quiz leaderboard ranking) were all verified for real;
  the live WebSocket delivery itself needs a real `supabase start` to
  confirm before trusting it.
- Present mode and participant view are both built in this pass already
  (see §7.7 below for what's still separate) — a full page each
  (`/studio/live/[sessionId]/present`, `/join/[code]/play`), not stubs.
- Not built: the spec's 1,000+ concurrent participant scale target has no
  load test behind it (nothing to load-test without a live deployment),
  and CSV export / session-library reuse (§7.7).

### 7.7 Present mode (build order step 7) — L — **partially built**

- ~~Big-screen view showing the current slide and live results.~~ Built,
  combined with the presenter controls on one page rather than as a
  separate mirrored "audience display" — a real dedicated big-screen-only
  view (no controls visible, meant for a projector) is still a follow-up.
- ~~Presenter control panel: next-slide, lock/unlock voting, Q&A
  moderation queue.~~ Built (`PresentClient`) — next/previous slide,
  lock/unlock, live response counts, and a Q&A moderation panel (mark
  answered/hidden). **Not built**: reset results, skip/reopen a specific
  slide out of order, session pause/resume, and a live participant-count
  indicator (would need Realtime Presence, not just Postgres Changes —
  deferred rather than adding a second realtime mechanism in the same
  pass).
- Not built: post-session results page + CSV export, and session-library
  duplicate/reuse-as-template.

### 7.8 The Bridge — Module C (build order step 8) — M — **core built**

- ~~Add the "Interactive Block" type to the Block Lesson editor~~ Built —
  `BlockEditor.tsx` has a new "Interactive" block type; adding one non-MAXPRO
  shows a locked button linking to `/upgrade?required=MAXPRO` instead of
  `createBlock()` (which itself also `requireTier("MAXPRO")`-gates the
  `interactive` type server-side, not just client-side). Picking a block
  links it to one of the org's `live_sessions` and a `sync`/`async` mode via
  `setInteractiveBlockConfig()`, stored in `interactive_blocks`
  (`0010_bridge.sql` added the FK to `live_sessions` and a public-read
  policy — the table itself was scaffolded back in `0001_init.sql` but had
  no way to read it publicly, same gap pattern as themes in §7.2).
- ~~Sync mode~~ Built, but minimally: the public renderer
  (`InteractiveBlockView.tsx`) shows a "Join the live session →" link to
  `/join/[code]` when the linked session is `live`, or a "check back later"
  message otherwise. It is a join point, not an embedded live view — the
  actual slide/results still only render on the `/join/[code]` and
  `/studio/live/.../present` pages built in §7.6/§7.7.
- ~~Async mode~~ Built for `poll`, `word_cloud`, and `open_ended` slide
  types: the block fetches the linked session's first slide and renders a
  self-paced mini version inline (vote / type a response), then re-fetches
  and shows the aggregate (bar chart for polls, tag list for word
  cloud/open-ended) via the same `lib/live/aggregate.ts` helpers §7.6 uses.
  `quiz` and `qa_board` slides are **not** supported in async embeds yet —
  falls back to "This slide type isn't supported in async course embeds
  yet." Only the session's first slide (`order` ascending) is used; there
  is no way to embed a specific slide out of a multi-slide session.
- Async mode reuses `live_sessions`/`live_slides`/`live_responses`
  as-is rather than a parallel schema — which means an async embed only
  accepts responses while its linked session is `status = 'live'` and
  `locked = false` (the exact same RLS as a live-hosted session, see
  §7.6). There is no distinct "always open" state: an author starts the
  session once and leaves it live to back the embed; ending or locking it
  also stops the embed silently (renders the "not available right now"
  fallback). This is a real limitation worth a follow-up (e.g. a `perpetual`
  flag) but wasn't in scope for this pass.
- A course learner's identity for a Bridge submission comes from
  `lib/learner/session.ts` (course anon-token/user, §7.4's identity
  system), not `lib/live/participant.ts` (the live-session join identity,
  §7.6) — encoded as `user:<id>` for authenticated learners or the bare
  anon token, so one `participant_token` text column serves both identity
  systems without a schema change.
- Both authoring (`setInteractiveBlockConfig`) and the block type itself
  (`createBlock` with `type: "interactive"`) are `requireTier("MAXPRO")`-gated
  server-side, following the same pattern as `/studio/live`.
- **Verified**: `npm run lint` and `npm run build` clean with the Bridge
  changes in place; a dev-server smoke test confirmed no regressions in
  studio/public-course routing. Full RLS/flow test against a real local
  Postgres (migrations 0001–0010 applied in order) confirmed: an anon
  learner can read `interactive_blocks` and the linked `live_sessions`/
  `live_slides` rows while the session is `live`, can submit a
  `live_responses` row and read the aggregate back, that a second
  independent anon participant can also submit (no accidental
  single-response-per-slide constraint), and that flipping the session out
  of `live` makes it unreadable to anon again — exactly the state
  `InteractiveBlockView`'s gating logic depends on. Supabase Realtime
  itself (live WebSocket delivery) remains unverified for the same reason
  as §7.6/§7.7 — no Docker/live Supabase project in this sandbox — but the
  Bridge doesn't depend on Realtime anyway (async mode is submit-and-refetch,
  not subscribed).

### 7.9 Unified analytics dashboard (build order step 9) — M — **built**

- ~~Per course: completion rate, average quiz score, aggregated results
  from any embedded interactive blocks, in one view (MAXPRO only).~~
  Built at `/studio/courses/[courseId]/analytics`, linked from the course
  outline page. Three stat cards (learners started, completion rate,
  average quiz score) computed by pure functions in
  `lib/analytics/compute.ts`, plus a per-interactive-block section
  reusing `lib/live/aggregate.ts` (§7.6) to render each linked session's
  slides: bar chart for polls, weighted tag list for word clouds, a list
  for open-ended text, and a response/correct count for quiz slides.
  `qa_board` slides are summarized from `qa_questions` (sorted by
  upvotes), not from `live_responses` — Q&A answers are stored per-session
  there, not per-slide, unlike every other slide type (see the migration
  0009 comment on that table).
- "Completion rate" = fraction of learners who ever touched the course
  that reached `completed`/`passed` on its **last** lesson (in outline
  order) — not "completed every lesson individually," since sequential
  navigation (§7.4) already implies the latter once the former is true.
  "Average quiz score" = mean of `learner_progress.score` across all
  `QUIZ`-type lessons in the course, across all learners. Both return
  `null` (rendered as "—") rather than `0` when there's no data yet, to
  distinguish "0% completion" from "nobody has started."
- **A real cross-tenant read gap was found and fixed while building this**:
  every studio page keyed by `courseId` (`courses/[courseId]`,
  `.../lessons/[lessonId]`, and this new analytics page) fetched its
  course/lesson by id and relied on RLS alone for tenant isolation — but
  RLS's "anyone reads published courses/sections/lessons/blocks" policies
  (needed for the public `/c/[slug]` renderer) aren't scoped to the owning
  org the way the write policies are, and `requireTierOrRedirect` only
  checks the *caller's own* org's tier, never that they own *this*
  course. Net effect: once a course was published, any other org's
  authenticated user could open its studio pages read-only (including,
  for the new analytics page, its linked live session's poll/word-cloud/
  Q&A data — already public-by-design per §7.8 — though critically
  `learner_progress` itself stayed correctly isolated throughout, since
  it has no public-read policy). Fixed with a new
  `lib/auth/requireCourseAccess.ts` helper (fetches the course, 404s
  unless `course.org_id === session.org.id`) applied to all three pages;
  the lesson editor additionally now confirms the lesson's own section
  actually belongs to the URL's `courseId` rather than trusting it, since
  `lessonId` alone is just as reachable across orgs via the same public-
  read RLS policies. Verified end-to-end against a real local Postgres:
  confirmed a same-org (non-owner) teammate can read
  `learner_progress`/`interactive_blocks`/`live_sessions`/`live_slides`/
  `live_responses` for the course, and separately confirmed the exact row
  RLS was letting a *different* org's session read (proving the fix's
  `course.org_id !== session.org.id` check actually fires against real
  data, not just reasoned about). `lib/analytics/compute.ts`'s pure
  functions were also executed directly (via `tsx`, not re-implemented in
  the test) against edge cases: no learners yet, a learner who stalled
  before the last lesson, a `failed` status on the last lesson (must not
  count as a finisher), and in-progress quiz attempts with a null score
  (must not skew the average).

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

### 7.12 Roles/RBAC completeness — S/M — **team invites + reviewer role built**

- ~~Team invite flow~~ Built: `/studio/team` (ORG_ADMIN only, linked from
  the studio nav for admins) lists org members and lets an admin generate
  a shareable invite link for the Author/Trainer/Reviewer roles. There's
  no outbound email in this build — the admin copies the link and sends
  it themselves, same "no real external service in the sandbox, so make
  the manual path first-class" approach as `/upgrade`'s tier switcher.
  `/signup?invite=<token>` shows "Join `<org>` as `<role>`" instead of the
  org-name field, and the sign-up trigger (`handle_new_auth_user`,
  migration `0011_invites.sql`) joins the inviting org with that role
  instead of minting a new one when a valid `invite_token` rides along in
  the new auth user's metadata. An invalid, expired, or already-accepted
  token falls back to the original "create your own org" behavior rather
  than blocking sign-up outright.
- New `org_invites` table: RLS restricts all direct access to same-org
  `ORG_ADMIN`s only (`for all`, no public-read policy) — a token lookup
  instead goes through a `get_invite_by_token()` `SECURITY DEFINER` RPC
  that returns only the one matching row's org name/role/validity, so
  there's no `using (true)`-style policy that would let anyone enumerate
  every org's pending invites via a bare table scan.
- **Verified** against a real local Postgres end-to-end: an `ORG_ADMIN`
  can create an invite; a non-admin `AUTHOR` in the same org is rejected
  by RLS; a different org's `ORG_ADMIN` can neither see nor delete the
  invite; `anon` can resolve a valid token (and gets zero rows for a
  bogus one) via the RPC; signing up with the token joins the correct
  org+role and marks the invite accepted; re-using that now-accepted
  token, a garbage token, and an expired token (confirmed `valid: false`
  via the RPC first) all fall back cleanly to a brand-new org rather than
  erroring or double-joining.
- ~~Reviewer/Stakeholder read-only preview links with commenting~~ Built:
  a new `requireEditTier()` guard (layered on top of `requireTier`, not
  merged into it — `requireTier` itself stays permissive of REVIEWER,
  since a read like viewing a tier-gated page or exporting a SCORM
  package isn't something a reviewer needs blocked from) now gates every
  actual content-mutating Server Action (course/section/lesson/block
  CRUD, quiz editing, themes, live session control) and throws
  `ReadOnlyRoleError` for the REVIEWER role. The course editor page
  itself redirects a REVIEWER to a new purpose-built
  `/studio/courses/[courseId]/review` page instead of showing them a
  half-disabled editor — a read-only outline (no drag/edit/delete) plus a
  `CommentsPanel`. Comments (`course_comments`, migration
  `0012_comments.sql`) are course-level threads any org member can post
  to and mark resolved (feedback is a team conversation, not
  reviewer-exclusive), though only the original author can delete their
  own comment; the same panel is also embedded at the bottom of the main
  editor page so authors see and can resolve feedback without switching
  views.
- RLS on `course_comments` scopes everything to same-org members via
  `current_org_id()`, `with check (author_id = auth.uid())` on insert
  blocks forging a comment as someone else, and — since the app only
  ever needs to flip `resolved`, comments being otherwise immutable once
  posted — a column-level grant (`revoke update ... ; grant update
  (resolved) ...`) narrows UPDATE to that one column at the database
  layer, overriding migration `0004`'s blanket per-table grant so a
  client can't bypass the UI and rewrite comment text directly.
- **Verified** against a real local Postgres: a REVIEWER can post a
  comment but not forge one under another user's id; an AUTHOR in the
  same org can see and resolve the REVIEWER's comment but can't delete it
  or edit its text via a direct column update (`permission denied`,
  confirming the column grant actually works, not just the RLS policy);
  the REVIEWER can delete their own comment; a different org can neither
  read nor post into the thread at all. A dev-server smoke test also
  confirmed the new `/studio/team`, `/studio/courses/[id]/review`, and
  invite-aware `/signup` routes compile and respond correctly (redirects
  for unauthenticated studio pages, 200s for the public signup page even
  with a garbage invite token) with no server errors.
- Not built: per-lesson/per-block comment threads (course-level only, for
  now); Super Admin console — cross-org platform management, still
  lowest priority, internal/operator surface, not customer-facing.

### 7.13 Accessibility — WCAG 2.1 AA — cross-cutting, continuous + M final audit — **first pass done**

- ~~Full keyboard navigation~~ Fixed: every drag-and-drop reorder surface
  (course outline's sections/lessons, block editor, quiz editor, live
  session slide editor — 5 `useSensors()` call sites) only had
  `PointerSensor`, making them entirely unreorderable without a mouse —
  a hard WCAG 2.1.1 failure. All five now also register `KeyboardSensor`
  (`sortableKeyboardCoordinates`). Every drag handle was also a `<span>`
  (not natively focusable/keyboard-activatable), several icon-only
  (just the "⠿" glyph, no accessible name at all) — all converted to
  real `<button type="button">`s with a descriptive `aria-label`
  ("Drag to reorder lesson: {title}", etc.).
- ~~Screen-reader compatibility~~ Partially addressed: the learner-facing
  quiz (`QuizRunner.tsx`) had answer-choice text as a sibling `<span>` next
  to its radio/checkbox, not associated via a `<label>`, and no
  `<fieldset>/<legend>` grouping each question's options — a screen
  reader announced neither what a given input was for nor which question
  it belonged to. Fixed with a `<fieldset><legend>{prompt}</legend>` per
  question and `<label>` wrapping each choice. The equivalent author-side
  answer-key editor (`QuizEditor.tsx`) got an `aria-label` on the
  correct-answer toggle but not the full `fieldset`/`legend` treatment
  (the prompt there is an editable `<textarea>`, awkward as a `<legend>`)
  — left as a follow-up. Six standalone pages/branches
  (`/`, `/login`, `/signup`, the course password gate, `/upgrade`,
  `/join/[code]` and its "not live" branch, `/join/[code]/play`) had no
  `<main>` landmark at all — found via a real axe-core scan (see below),
  not just code reading — and now do.
- ~~Alt-text fields on every image block~~ Already existed
  (`BlockEditor.tsx`'s image fields include an alt-text input, correctly
  read by the public renderer) — no change needed here.
- ~~Caption/transcript support on video/audio~~ Built: both blocks now
  have a transcript textarea in the studio editor
  (`content.transcript`), rendered as a collapsible `<details>/<summary>`
  "Transcript" section under the player on the public course renderer.
  Deliberately a plain-text transcript, not synced WebVTT captions —
  matching the "Audio as URL-only" precedent of picking the pragmatic,
  buildable version of a requirement over the fuller spec when there's no
  file-hosting/authoring infra to back the fuller version yet.
- ~~Enforced color-contrast in the theme editor~~ Built: a WCAG
  contrast-ratio utility (`lib/theme/contrast.ts`, unit-tested) computes
  text-on-background (needs 4.5:1) and primary-on-background (needs 3:1,
  the "large text/UI component" threshold, since primary colors buttons/
  links) live as an author edits a theme's colors, with a prominent
  `role="alert"` warning — not a blocked save, since an author mid-way
  through picking a palette shouldn't be locked out of saving unrelated
  changes over one still-unfinished color pair, but the gap can't be
  missed either.
- **Verified two ways**: unit tests for the contrast math and a real
  axe-core scan (`npm run test:a11y`, via Playwright against the
  pre-installed Chromium) of every page reachable without a live backend
  — `/`, `/login`, `/signup` (with and without a bogus invite token), and
  `/join/[code]` for a nonexistent code — all pass with zero violations
  after the `<main>`-landmark fixes above. This is real, tool-verified
  confirmation, not a code-reading claim, for the pages it can reach;
  everything behind `requireTierOrRedirect`/auth (the actual studio
  editor, the public course renderer with real content, live session
  present/play views) still can't be scanned this way without a working
  local Supabase project (same Docker limitation as everywhere else in
  this build) and remains unaudited beyond the manual code-level fixes
  above.
- Not built: a dedicated final audit pass against real authenticated
  content once a real Supabase project exists (see §7.14); a "decorative
  image" toggle (an author currently can't explicitly mark `alt=""` as
  intentional vs. just forgetting); the author-side quiz editor's
  fieldset/legend grouping (noted above).
- Best treated as a standing requirement on every new UI PR going
  forward, per the original plan — this pass fixed everything findable
  without a live backend, not a one-time "done."

### 7.14 Testing & production readiness — M, ongoing — **automated test suite added**

- ~~No automated tests exist yet~~ Two suites now exist, both runnable
  from `apps/web`:
  - `npm test` (Vitest): pure-logic unit tests for
    `lib/analytics/compute.ts`, `lib/live/aggregate.ts`,
    `lib/course/order.ts`, and the SCORM package's
    `lib/scorm/manifest.ts`/`validate.ts`/`suspendData.ts` — the last one
    actually executes the *generated* JS via Node's `vm` module rather
    than re-implementing the encode/decode logic in the test, matching
    the same methodology used to build it. 31 tests, all passing.
  - `npm run test:db` (`supabase/tests/run.sh`): applies every migration
    to a fresh throwaway local Postgres (stubbing the parts of Supabase's
    `auth`/`storage` schemas RLS depends on, in `supabase/tests/00_stub.sql`)
    and runs self-asserting SQL test cases (`supabase/tests/cases/*.sql`)
    covering every RLS/RPC fix made this build: grants + the
    `get_learner_progress`/`submit_learner_progress` RPCs (§7.4), theme
    public-read + media storage object RLS (§7.2/§7.3), live session
    status/lock-gated read+write RLS and the Bridge's `interactive_blocks`
    public-read policy (§7.6/§7.8), team invites end-to-end including the
    sign-up trigger (§7.12), and course comments' RLS + column-level grant
    (§7.12). This formalizes checks that had previously been re-derived by
    hand, from scratch, every session — a real regression (verified by
    deliberately breaking an assertion and a `WHERE` clause during
    development) now fails loudly with a clear message instead of relying
    on a human re-reading `psql` output. There's still no Docker in this
    repo's dev/CI sandbox, so this is a plain-`psql` harness rather than
    `supabase start` + pgTAP — see the stub file's own comments for
    exactly what it fakes and why (and the parts of §7.3/§7.6/§7.8 that
    remain genuinely unverified regardless — real Storage uploads and
    real Realtime WebSocket delivery — since no amount of RLS testing
    substitutes for those services actually running).
- Not built: end-to-end/browser tests (Playwright etc.) — the dev-server
  smoke tests done by hand throughout this build (curl a route, check for
  a 500) are the closest thing so far, and remain manual.
- Production Supabase project (this has only been run against a local
  Supabase instance so far) + Vercel deployment for `apps/web` + hosting
  for the Node worker once §7.5/§7.10 need it.
- ~~Rate limiting on public, unauthenticated endpoints~~ Built: a
  generic `check_rate_limit(key, max_hits, window_seconds)` `SECURITY
  DEFINER` RPC (migration `0013_rate_limits.sql`) does an atomic
  check-and-record against a `rate_limit_hits` table that `anon`/
  `authenticated` have no direct grants on at all — only the function can
  touch it, so there's no way to read others' keys or forge a hit.
  Applied to every public write endpoint with a real abuse/brute-force
  angle: course password verification (10 attempts/10min, keyed by
  IP+slug — the classic brute-force case, and the only one of these with
  no prior identity to key by at all), joining a live session by code (20/
  min, keyed by IP), and every live-session/Bridge response, Q&A
  question, and upvote (keyed by the existing participant/learner token,
  generous limits like 30/min that only bite a scripted flood, not a fast
  human). `lib/rateLimit/check.ts` fails *open* (allows the request) on
  an infra error, deliberately — an abuse check going down shouldn't take
  the feature it protects down with it. Learner-progress writes and
  authenticated studio mutations were deliberately left unlimited: they
  either aren't public-facing spam surfaces or already have a natural
  one-row-per-learner-per-lesson ceiling from the `learner_progress`
  unique index (§7.4). **Verified** against a real local Postgres: exactly
  `max_hits` calls succeed and the next one is rejected, a different key
  is an independent bucket, a `0`-second window never accumulates, and a
  direct `INSERT`/`SELECT` against `rate_limit_hits` as `anon` is rejected
  outright (only the RPC can touch it).
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
