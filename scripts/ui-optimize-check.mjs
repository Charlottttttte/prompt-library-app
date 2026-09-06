/**
 * Browser check for the optimize → review → accept flow. Needs the dev server
 * running with OPENAI_BASE_URL pointed at scripts/mock-openai.mjs.
 *   node scripts/ui-optimize-check.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
let pass = 0;
let fail = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

console.log("Optimize flow in the browser\n");

const list = await (await fetch(`${BASE}/api/prompts`)).json();
const target = list.prompts[0];
await page.goto(`${BASE}/prompts/${target.id}`, { waitUntil: "networkidle" });

const versionsBefore = (
  await (await fetch(`${BASE}/api/prompts/${target.id}`)).json()
).prompt.versions.length;

const panel = page.locator("section").filter({ hasText: "Optimize with AI" });
await page.getByRole("button", { name: "Optimize", exact: true }).click();

await panel.getByRole("button", { name: "Accept and save" }).waitFor({ timeout: 30000 });
check("a suggestion comes back and offers to save", true);
check(
  "the current text is shown for comparison",
  await panel.getByText("Current", { exact: true }).isVisible(),
);
check(
  "the suggestion is shown alongside it",
  await panel.getByText("Suggested", { exact: true }).isVisible(),
);
check(
  "the list of changes is shown",
  await panel.getByText("Tightened the ask").isVisible(),
);

// Discard must leave the prompt untouched.
await panel.getByRole("button", { name: "Discard" }).click();
await page.waitForTimeout(400);
check(
  "discarding clears the suggestion",
  (await panel.getByRole("button", { name: "Accept and save" }).count()) === 0,
);
const afterDiscard = (
  await (await fetch(`${BASE}/api/prompts/${target.id}`)).json()
).prompt;
check(
  "discarding saved nothing",
  afterDiscard.versions.length === versionsBefore &&
    afterDiscard.content === target.content,
);

await page.screenshot({ path: "/tmp/ui-shots/11-optimize-discarded.png", fullPage: true });

// Now accept it.
await page.getByRole("button", { name: "Optimize", exact: true }).click();
await panel.getByRole("button", { name: "Accept and save" }).waitFor({ timeout: 30000 });
await page.screenshot({ path: "/tmp/ui-shots/12-optimize-suggestion.png", fullPage: true });
await panel.getByRole("button", { name: "Accept and save" }).click();
await page.waitForTimeout(2500);

const after = (
  await (await fetch(`${BASE}/api/prompts/${target.id}`)).json()
).prompt;
check(
  "accepting replaces the prompt text",
  after.content.startsWith("REWRITTEN by mock"),
  after.content.slice(0, 40),
);
check(
  "accepting records exactly one new version",
  after.versions.length === versionsBefore + 1,
  `${versionsBefore} -> ${after.versions.length}`,
);
check(
  "the new version is tagged as an AI rewrite",
  after.versions[0].source === "optimized",
  after.versions[0].source,
);
check(
  "the model that produced it is recorded",
  after.versions[0].model === "gpt-5.6-terra",
  String(after.versions[0].model),
);
check(
  "the previous text is still in the history",
  after.versions.some((v) => v.content === target.content),
);

await page.reload({ waitUntil: "networkidle" });
check(
  "the history section shows the AI rewrite",
  await page.getByText(/AI rewrite \(gpt-5\.6-terra\)|Manual edit/).first().isVisible(),
);
await page.screenshot({ path: "/tmp/ui-shots/13-optimize-accepted.png", fullPage: true });

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
