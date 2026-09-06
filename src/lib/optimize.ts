import "server-only";
import { OptimizerError, parseOptimizerResponse } from "./optimize-parse";

export { OptimizerError, parseOptimizerResponse };

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/** Override with OPTIMIZER_MODEL if you want a cheaper or stronger model. */
export const OPTIMIZER_MODEL = process.env.OPTIMIZER_MODEL ?? "claude-sonnet-5";

export type OptimizeResult = {
  optimized: string;
  changes: string[];
  model: string;
};

const SYSTEM_PROMPT = `You improve prompts that people save and reuse.

Rewrite the prompt you are given so it produces more reliable results. Focus on:
- Stating the task and the desired output format explicitly
- Replacing vague adjectives with checkable criteria
- Adding the context a model needs but the original left implicit
- Cutting filler, flattery, and instructions that don't change the output

Hard rules:
- Preserve every {{placeholder}} exactly as written, and don't invent new ones.
- Keep the author's intent and domain. Do not broaden or narrow the task.
- Keep roughly the original language and register. If the prompt is in Chinese, stay in Chinese.
- If the prompt is already strong, make minimal changes and say so.

Respond with JSON only, no prose around it, in exactly this shape:
{"optimized": "the rewritten prompt", "changes": ["short description of each change"]}`;

export async function optimizePrompt(
  content: string,
  instructions?: string,
): Promise<OptimizeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new OptimizerError(
      "No ANTHROPIC_API_KEY is set, so prompts can't be optimized yet. Add one to .env.local and restart the server.",
      501,
      true,
    );
  }

  const userMessage = instructions
    ? `Rewrite this prompt. Extra instruction from the author: ${instructions}\n\n---\n${content}`
    : `Rewrite this prompt:\n\n---\n${content}`;

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: OPTIMIZER_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      // Don't leave a form spinning forever if the API stalls.
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new OptimizerError("The optimizer timed out. Try again.", 504);
    }
    throw new OptimizerError("Couldn't reach the model API", 502);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new OptimizerError(
        "The model API rejected the API key. Check ANTHROPIC_API_KEY.",
        401,
        true,
      );
    }
    if (response.status === 429) {
      throw new OptimizerError(
        "Rate limited by the model API. Try again shortly.",
        429,
      );
    }
    throw new OptimizerError(`The model API returned ${response.status}`, 502);
  }

  const payload = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = (payload.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");

  if (!text.trim()) {
    throw new OptimizerError("The model returned an empty response");
  }

  return { ...parseOptimizerResponse(text), model: OPTIMIZER_MODEL };
}
