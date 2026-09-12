# Running ETVET locally on Windows

Commands below are for **PowerShell** (open it from the Start Menu, not
`cmd.exe`). This is the Windows-specific version of `LOCAL_DEV.md` — same
end result, exact commands for this OS.

## 1. Install prerequisites

Run these one at a time. Each opens its own installer/progress; let it
finish before running the next.

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
winget install --id Docker.DockerDesktop -e --source winget
```

- If `winget` isn't recognized, install "App Installer" from the Microsoft
  Store, then retry — or download installers manually from
  [git-scm.com](https://git-scm.com), [nodejs.org](https://nodejs.org)
  (LTS), and [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).
- Docker Desktop needs WSL2. If the installer says it's enabling
  "Virtual Machine Platform" / WSL2 and asks to restart, restart, then
  launch Docker Desktop again to let it finish setup.
- **Launch Docker Desktop** from the Start Menu and wait until the whale
  icon in the system tray stops animating (it's running, not just open).
  Nothing below works until it's actually running.
- Close and reopen PowerShell after installing, so `git`/`node`/`npm` are
  on PATH.

Verify everything installed:

```powershell
git --version
node --version
npm --version
docker --version
```

## 2. Clone the repo

```powershell
cd $HOME
git clone https://github.com/miskirsoll/ETVET.git
cd ETVET
git checkout claude/etvet-planning-questions-non32c
```

## 3. Start local Supabase

Run this from the **repo root** (`ETVET\`, where `supabase\config.toml`
lives) — not from `apps\web`.

```powershell
npx supabase start
```

`npx` runs the Supabase CLI without a global install (Supabase's own npm
package blocks `npm install -g supabase` on Windows and tells you to use
this instead). First run downloads several Docker images and can take a
few minutes; it also applies every migration in `supabase\migrations\` to
a fresh local Postgres automatically.

When it finishes, it prints a block like this — **copy the API URL and
anon key**, you need them next:

```
         API URL: http://127.0.0.1:54321
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
        anon key: eyJ...
service_role key: eyJ...
```

Studio URL is a local web UI for browsing tables/auth users — open it in
your browser any time to check what the app is doing to the database.

If you edit a migration file, or just want a clean database:

```powershell
npx supabase db reset
```

## 4. Configure the web app

```powershell
cd apps\web
Copy-Item .env.local.example .env.local
notepad .env.local
```

In Notepad, set the two values to what `supabase start` printed, then
save and close:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   (the anon key, not the service_role key)
```

## 5. Install and run

Still inside `apps\web`:

```powershell
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

## 6. Try the golden path

1. **Sign up** at `/signup` (org name, email, password). Local Supabase
   Auth has email confirmation off by default, so you're signed in
   immediately. Check Studio (`Table Editor` → `organizations` /
   `users`) to see the org that was auto-created for you as `ORG_ADMIN`.
2. You land on `/studio` — create a course, open it, add a section, add a
   Block lesson, add a few blocks (text, image, video, list...), drag to
   reorder. Add a Quiz lesson too — it shows a "coming in the next
   milestone" placeholder, which is expected for now.
3. Visit `/studio/live` — on the FREE tier this should show up **visibly
   but locked**, with an "Upgrade to MAXPRO" button, not hidden.
4. Go to `/upgrade`, switch to MAXPRO, revisit `/studio/live` — it should
   now show the unlocked placeholder. That's the tier-gating loop working
   end to end.
5. Optional: sign up a second account with a different org name in an
   incognito/private window, create a course there, and confirm the first
   account's `/studio` never shows it — that's tenant isolation (Row Level
   Security) working.

## 7. Stopping

```powershell
# In the npm run dev terminal:
Ctrl+C

# Back in the repo root:
cd ..\..
npx supabase stop
```

`npx supabase stop --no-backup` also wipes the local database if you want
a clean slate next time, instead of `db reset`.

## Common issues

| Symptom | Fix |
|---|---|
| `npx supabase start` fails immediately / connection errors | Docker Desktop isn't running yet — open it from the Start Menu and wait for the whale icon to settle, then retry. |
| Windows Firewall prompt when starting Supabase/Next.js | Allow access — these are local-only ports, not exposed to the internet. |
| `npm run dev` can't find env vars / Supabase calls fail | Confirm you edited `apps\web\.env.local` (not `.env.local.example`) and used the **anon key**, not the service_role key. |
| Port already in use (3000, 54321-54324) | Something else is using it — stop that process, or run `npm run dev -- -p 3001` for a different Next.js port. |

Sources for the Supabase CLI-on-Windows install behavior above:
- [supabase/cli issue #4496 — npm global install unsupported](https://github.com/supabase/cli/issues/4496)
- [Supabase CLI docs — Local Development](https://supabase.com/docs/guides/local-development/cli/getting-started)
