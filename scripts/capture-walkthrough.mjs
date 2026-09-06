/**
 * Capture a clean screenshot of every screen, for documentation.
 *   node scripts/capture-walkthrough.mjs [baseUrl]
 * Writes to /tmp/walkthrough. Expects seeded data and, for the optimize shots,
 * the dev server pointed at scripts/mock-openai.mjs.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "/tmp/walkthrough";
mkdirSync(OUT, { recursive: true });

// The Next dev indicator floats over the corner of every page.
const HIDE_DEV_UI = `nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});

async function shot(page, name) {
  await page.addStyleTag({ content: HIDE_DEV_UI });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`  ${name}.png`);
}

async function newPage(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    ...opts,
  });
  return ctx.newPage();
}

console.log("Capturing walkthrough...");

const page = await newPage();

// 1. Library
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await shot(page, "01-library");

// 2. Search
await page.getByLabel("Search prompts").fill("outline");
await page.waitForTimeout(900);
await shot(page, "02-search");

// 3. Tag filter
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^marketing/ }).click();
await page.waitForTimeout(900);
await shot(page, "03-tag-filter");

// 4. Folder selected (includes subfolders)
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page
  .getByRole("navigation", { name: "Folders" })
  .getByRole("link", { name: "Writing", exact: true })
  .click();
await page.waitForTimeout(900);
await shot(page, "04-folder");

// 5. New prompt form
await page.goto(`${BASE}/prompts/new`, { waitUntil: "networkidle" });
await page.getByLabel("Title").fill("Weekly status update");
await page.getByLabel("Prompt", { exact: true }).fill(
  `Write my weekly status update for {{team}}.

Shipped: {{shipped}}
Blocked: {{blocked}}

Three bullets max per section. Lead with impact, not activity. Flag anything that needs a decision.`,
);
await page.getByLabel("New tags").fill("writing, status");
await shot(page, "05-new-prompt");

// 6. Detail view
const list = await (await fetch(`${BASE}/api/prompts`)).json();
const target = list.prompts.find((p) => p.title === "PR review checklist") ?? list.prompts[0];
await page.goto(`${BASE}/prompts/${target.id}`, { waitUntil: "networkidle" });
await shot(page, "06-detail");

// 7. Optimize — side-by-side suggestion
const panel = page.locator("section").filter({ hasText: "Optimize with AI" });
await page.getByRole("button", { name: "Optimize", exact: true }).click();
try {
  await panel
    .getByRole("button", { name: "Accept and save" })
    .waitFor({ timeout: 25000 });
  await shot(page, "07-optimize");

  // 8. Accepted → version history
  await panel.getByRole("button", { name: "Accept and save" }).click();
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "08-version-history");
} catch {
  console.log("  (optimize shots skipped — no mock server running)");
}

// 9. Empty state
await page.goto(`${BASE}/?q=zzzznothinghere`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot(page, "09-empty-state");

// 10. Dark mode
const dark = await newPage({ colorScheme: "dark" });
await dark.goto(`${BASE}/`, { waitUntil: "networkidle" });
await shot(dark, "10-dark");

// 11. Mobile
const mobile = await newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(`${BASE}/`, { waitUntil: "networkidle" });
await shot(mobile, "11-mobile");

await browser.close();
console.log(`\nDone — ${OUT}`);
