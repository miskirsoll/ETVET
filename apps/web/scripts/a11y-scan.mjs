#!/usr/bin/env node
// Runs an axe-core accessibility scan against the pages that render
// without a live Supabase backend (everything auth-gated just redirects
// to /login without one, and there's no Docker in this dev/CI sandbox to
// run a real Supabase project against -- see supabase/tests/ for how the
// DB-only parts get exercised instead). Start `npm run dev` with a
// placeholder .env.local first (see LOCAL_DEV.md), then:
//
//   node scripts/a11y-scan.mjs [baseUrl]
//
// Exits non-zero if axe reports any violation, so this can gate a PR the
// same way `npm test`/`npm run test:db` do once a real backend makes more
// pages reachable.

import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const paths = ["/", "/login", "/signup", "/signup?invite=nonexistent-token", "/join/NONEXISTENT"];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let failed = false;

for (const path of paths) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  const results = await new AxeBuilder({ page }).analyze();
  await context.close();

  if (results.violations.length === 0) {
    console.log(`OK    ${path} -- no violations`);
    continue;
  }

  failed = true;
  console.log(`FAIL  ${path} -- ${results.violations.length} violation(s)`);
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    console.log(`    ${v.helpUrl}`);
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
