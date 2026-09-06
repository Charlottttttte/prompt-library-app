/**
 * Pure parsing for the optimizer's response — no network, no server-only
 * imports, so it can be unit tested directly.
 */

export class OptimizerError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
    /** True when the fix is configuration, not a transient failure. */
    readonly needsSetup = false,
  ) {
    super(message);
    this.name = "OptimizerError";
  }
}

/** Pull the JSON object out of a response that may be fenced or padded. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the outermost braces, in case the model added a stray line.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new OptimizerError("The model didn't return usable JSON");
    }
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      throw new OptimizerError("The model didn't return usable JSON");
    }
  }
}

export function parseOptimizerResponse(text: string): {
  optimized: string;
  changes: string[];
} {
  const parsed = extractJson(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new OptimizerError("The model didn't return usable JSON");
  }

  const { optimized, changes } = parsed as Record<string, unknown>;
  if (typeof optimized !== "string" || optimized.trim() === "") {
    throw new OptimizerError("The model returned an empty rewrite");
  }

  return {
    optimized: optimized.trim(),
    changes: Array.isArray(changes)
      ? changes.filter((c): c is string => typeof c === "string")
      : [],
  };
}
