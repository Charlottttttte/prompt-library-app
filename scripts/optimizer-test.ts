/**
 * Unit tests for the optimizer's response parsing — the part that has to cope
 * with whatever shape the model actually returns.
 *   npx tsx scripts/optimizer-test.ts
 */
import {
  OptimizerError,
  parseOptimizerResponse,
} from "../src/lib/optimize-parse";

let pass = 0;
let fail = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    pass++;
  } catch (error) {
    console.log(`  ✗ ${label} — ${(error as Error).message}`);
    fail++;
  }
}

function assertEqual(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}

function assertThrows(fn: () => void, what: string) {
  try {
    fn();
  } catch (error) {
    if (error instanceof OptimizerError) return;
    throw new Error(`${what}: threw the wrong error type`);
  }
  throw new Error(`${what}: expected a throw`);
}

console.log("Optimizer response parsing\n");

check("parses a plain JSON object", () => {
  const result = parseOptimizerResponse(
    '{"optimized":"Better prompt","changes":["Tightened the ask"]}',
  );
  assertEqual(result.optimized, "Better prompt", "optimized");
  assertEqual(result.changes, ["Tightened the ask"], "changes");
});

check("parses JSON inside a ```json fence", () => {
  const result = parseOptimizerResponse(
    '```json\n{"optimized":"Fenced","changes":[]}\n```',
  );
  assertEqual(result.optimized, "Fenced", "optimized");
});

check("parses JSON inside a bare ``` fence", () => {
  const result = parseOptimizerResponse('```\n{"optimized":"Bare","changes":[]}\n```');
  assertEqual(result.optimized, "Bare", "optimized");
});

check("recovers when the model adds prose around the JSON", () => {
  const result = parseOptimizerResponse(
    'Sure! Here you go:\n{"optimized":"Padded","changes":["x"]}\nHope that helps.',
  );
  assertEqual(result.optimized, "Padded", "optimized");
});

check("preserves multi-line content and placeholders", () => {
  const raw = JSON.stringify({
    optimized: "Line one\nLine two with {{topic}}",
    changes: ["Kept the placeholder"],
  });
  const result = parseOptimizerResponse(raw);
  assertEqual(
    result.optimized,
    "Line one\nLine two with {{topic}}",
    "optimized",
  );
});

check("tolerates a missing changes array", () => {
  const result = parseOptimizerResponse('{"optimized":"No changes listed"}');
  assertEqual(result.changes, [], "changes");
});

check("drops non-string entries from changes", () => {
  const result = parseOptimizerResponse(
    '{"optimized":"x","changes":["kept",42,null,"also kept"]}',
  );
  assertEqual(result.changes, ["kept", "also kept"], "changes");
});

check("rejects a response with no JSON at all", () => {
  assertThrows(
    () => parseOptimizerResponse("I'm sorry, I can't do that."),
    "no JSON",
  );
});

check("rejects an empty optimized field", () => {
  assertThrows(
    () => parseOptimizerResponse('{"optimized":"   ","changes":[]}'),
    "empty rewrite",
  );
});

check("rejects a JSON array at the top level", () => {
  assertThrows(() => parseOptimizerResponse('["not","an","object"]'), "array");
});

check("rejects a missing optimized field", () => {
  assertThrows(
    () => parseOptimizerResponse('{"changes":["did things"]}'),
    "missing field",
  );
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
