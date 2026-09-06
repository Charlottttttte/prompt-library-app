/**
 * Browser smoke test — loads the key screens, exercises the interactive paths,
 * and fails on any console error or bad response. Requires the dev server.
 *   node scripts/ui-check.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = "/tmp/ui-shots";
mkdirSync(SHOTS, { recursive: true });

let pass = 0;
let fail = 0;
const problems = [];

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

// Use the Chromium already present in this environment rather than letting
// Playwright download a build matched to its own version.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

async function goto(path) {
  const response = await page.goto(`${BASE}${path}`, {
    waitUntil: "networkidle",
  });
  return response?.status() ?? 0;
}

console.log(`Browser check against ${BASE}\n`);

// --- Library view ----------------------------------------------------------
console.log("Library view");
check("GET / returns 200", (await goto("/")) === 200);
check(
  "shows all four seeded prompts",
  (await page.locator("main ul > li").count()) === 4,
);
check(
  "folder tree renders",
  (await page.getByRole("navigation", { name: "Folders" }).count()) === 1,
);
const folderNav = page.getByRole("navigation", { name: "Folders" });
check(
  "nested folder is visible",
  await folderNav.getByRole("link", { name: "Blog posts" }).isVisible(),
);
await page.screenshot({ path: `${SHOTS}/01-library.png`, fullPage: true });

// --- Search ----------------------------------------------------------------
console.log("\nSearch");
await page.getByLabel("Search prompts").fill("cold email");
await page.waitForFunction(
  () => document.querySelectorAll("main ul > li").length === 1,
  null,
  { timeout: 5000 },
);
check("search narrows the list to one match", true);
check(
  "search term lands in the URL",
  new URL(page.url()).searchParams.get("q") === "cold email",
);
await page.screenshot({ path: `${SHOTS}/02-search.png`, fullPage: true });

await page.getByLabel("Search prompts").fill("zzzznomatch");
await page.waitForFunction(
  () => document.body.innerText.includes("Nothing matches those filters"),
  null,
  { timeout: 5000 },
);
check("empty search shows an empty state", true);

// --- Folder filter ---------------------------------------------------------
console.log("\nFolder filter");
await goto("/");
await page
  .getByRole("navigation", { name: "Folders" })
  .getByRole("link", { name: "Writing", exact: true })
  .click();
// Client-side navigation doesn't change the load state, so wait on the DOM.
await page.getByRole("heading", { name: "Writing" }).waitFor({ timeout: 10000 });
const inWriting = await page.locator("main ul > li").count();
check(
  "selecting a folder includes its subfolders",
  inWriting === 2,
  `got ${inWriting}`,
);

// --- Tag filter ------------------------------------------------------------
console.log("\nTag filter");
await goto("/");
await page.getByRole("button", { name: /^marketing/ }).click();
await page.waitForFunction(
  () => document.querySelectorAll("main ul > li").length === 2,
  null,
  { timeout: 10000 },
);
const tagged = await page.locator("main ul > li").count();
check("tag chip filters the list", tagged === 2, `got ${tagged}`);
await page.screenshot({ path: `${SHOTS}/03-tag-filter.png`, fullPage: true });

// --- Create a prompt -------------------------------------------------------
console.log("\nCreate");
check("GET /prompts/new returns 200", (await goto("/prompts/new")) === 200);
await page.getByLabel("Title").fill("Playwright test prompt");
await page.getByLabel("Prompt", { exact: true }).fill(
  "A prompt created by the browser check.",
);
await page.getByLabel("New tags").fill("automated");
await page.screenshot({ path: `${SHOTS}/04-new-form.png`, fullPage: true });
await page.getByRole("button", { name: "Save prompt" }).click();
await page.waitForURL(/\/prompts\/[0-9a-f-]{36}$/, { timeout: 15000 });
check("saving redirects to the new prompt's detail page", true);
check(
  "detail page shows the title",
  await page.getByRole("heading", { name: "Playwright test prompt" }).isVisible(),
);
check(
  "a tag typed as free text was created and attached",
  await page.getByText("automated").first().isVisible(),
);
const detailUrl = page.url();
await page.screenshot({ path: `${SHOTS}/05-detail.png`, fullPage: true });

// --- Validation ------------------------------------------------------------
console.log("\nValidation");
await goto("/prompts/new");
await page.getByLabel("Title").fill("Missing body");
await page.getByLabel("Title").press("Enter");
await page.waitForTimeout(500);
check(
  "submitting without prompt text stays on the form",
  page.url().includes("/prompts/new"),
);

// --- Copy to clipboard -----------------------------------------------------
console.log("\nCopy");
await page.goto(detailUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Copy prompt" }).click();
await page.waitForTimeout(300);
const clipboard = await page.evaluate(() => navigator.clipboard.readText());
check(
  "copy button puts the prompt on the clipboard",
  clipboard === "A prompt created by the browser check.",
  `clipboard was ${JSON.stringify(clipboard)}`,
);

// --- Optimize (no API key configured) --------------------------------------
console.log("\nOptimize");
check(
  "optimize panel is on the detail page",
  await page.getByRole("heading", { name: "Optimize with AI" }).isVisible(),
);
await page.getByRole("button", { name: "Optimize", exact: true }).click();
// Scope to the panel's own message — the Next dev overlay also exposes alerts.
const optimizeMessage = page
  .locator("section")
  .filter({ hasText: "Optimize with AI" })
  .getByRole("alert");
await optimizeMessage.waitFor({ timeout: 30000 });
const optimizeText = await optimizeMessage.innerText();
check(
  "without a key it says so instead of failing silently",
  optimizeText.includes("OPENAI_API_KEY"),
  JSON.stringify(optimizeText.slice(0, 80)),
);
await page.screenshot({ path: `${SHOTS}/08-optimize.png`, fullPage: true });

// --- Edit creates a version ------------------------------------------------
console.log("\nEdit and version history");
await page.getByRole("link", { name: "Edit" }).click();
await page.waitForLoadState("networkidle");
await page.getByLabel("Prompt", { exact: true }).fill(
  "An edited prompt, which should create a second version.",
);
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(/\/prompts\/[0-9a-f-]{36}$/, { timeout: 15000 });
check(
  "editing the text records a version",
  await page.getByText("Version history").isVisible(),
);
check(
  "history shows the previous text",
  await page
    .getByText("A prompt created by the browser check.")
    .first()
    .isVisible(),
);
await page.screenshot({ path: `${SHOTS}/06-history.png`, fullPage: true });

// --- Restore ---------------------------------------------------------------
await page.getByRole("button", { name: "Restore" }).first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);
const restored = await page.locator("article > section pre").first().innerText();
check(
  "restoring an old version brings its text back",
  restored.trim() === "A prompt created by the browser check.",
  `saw ${JSON.stringify(restored.slice(0, 60))}`,
);

// --- Delete ----------------------------------------------------------------
console.log("\nDelete");
page.once("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "Delete" }).click();
await page.waitForURL(`${BASE}/`, { timeout: 15000 });
check("deleting returns to the library", true);
// The library streams behind a loading boundary — wait for the real list.
await page.waitForFunction(
  () => document.querySelectorAll("main ul > li").length > 0,
  null,
  { timeout: 10000 },
);
const remaining = await page.locator("main ul > li").count();
check("the deleted prompt is gone", remaining === 4, `got ${remaining}`);

// --- 404 -------------------------------------------------------------------
console.log("\nNot found");
check(
  "unknown prompt id 404s",
  (await goto("/prompts/00000000-0000-4000-8000-000000000000")) === 404,
);

// --- Mobile layout ---------------------------------------------------------
console.log("\nResponsive");
const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${BASE}/`, { waitUntil: "networkidle" });
const scrollsSideways = await mobile.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth + 1,
);
check("no horizontal scroll at 390px wide", !scrollsSideways);
await mobile.screenshot({ path: `${SHOTS}/07-mobile.png`, fullPage: true });
await mobile.close();

// --- Console ---------------------------------------------------------------
console.log("\nConsole");
// The 404 and 501 probes above are deliberate; the browser logs them anyway.
const expected = [
  "the server responded with a status of 404",
  "the server responded with a status of 501",
];
const realErrors = consoleErrors.filter(
  (e) => !expected.some((allowed) => e.includes(allowed)),
);
check("no console errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

await browser.close();

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Screenshots in ${SHOTS}`);
if (problems.length) console.log(problems.join("\n"));
process.exit(fail === 0 ? 0 : 1);
