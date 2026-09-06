import "server-only";
import { OptimizerError, parseOptimizerResponse } from "./optimize-parse";

export { OptimizerError, parseOptimizerResponse };

/**
 * Uses the Chat Completions shape rather than the newer Responses API: both are
 * supported, and this one is also what Azure OpenAI, OpenRouter, and most local
 * servers speak, so OPENAI_BASE_URL can point almost anywhere.
 */
const BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

/** Override with OPTIMIZER_MODEL for a cheaper or stronger model. */
export const OPTIMIZER_MODEL = process.env.OPTIMIZER_MODEL ?? "gpt-5.6-terra";

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

Put the rewritten prompt in "optimized" and one short line per change in "changes".`;

/**
 * Strict structured output: the API enforces this schema, so a malformed or
 * truncated-into-invalid response can't reach the parser. `strict` requires
 * every property listed in `required` and additionalProperties: false.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    optimized: {
      type: "string",
      description: "The rewritten prompt, ready to use as-is.",
    },
    changes: {
      type: "array",
      items: { type: "string" },
      description: "One short description per change made.",
    },
  },
  required: ["optimized", "changes"],
  additionalProperties: false,
} as const;

export async function optimizePrompt(
  content: string,
  instructions?: string,
): Promise<OptimizeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OptimizerError(
      "No OPENAI_API_KEY is set, so prompts can't be optimized yet. Add one to .env.local and restart the server.",
      501,
      true,
    );
  }

  const userMessage = instructions
    ? `Rewrite this prompt. Extra instruction from the author: ${instructions}\n\n---\n${content}`
    : `Rewrite this prompt:\n\n---\n${content}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPTIMIZER_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_completion_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "optimized_prompt",
            schema: RESPONSE_SCHEMA,
            strict: true,
          },
        },
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
        "The model API rejected the API key. Check OPENAI_API_KEY.",
        401,
        true,
      );
    }
    if (response.status === 404) {
      throw new OptimizerError(
        `The model API doesn't recognize "${OPTIMIZER_MODEL}". Set OPTIMIZER_MODEL to one your account can use.`,
        404,
        true,
      );
    }
    if (response.status === 429) {
      throw new OptimizerError(
        "Rate limited by the model API, or you're out of quota. Try again shortly.",
        429,
      );
    }
    throw new OptimizerError(`The model API returned ${response.status}`, 502);
  }

  const payload = (await response.json()) as {
    choices?: {
      finish_reason?: string;
      message?: { content?: string | null; refusal?: string | null };
    }[];
  };

  const choice = payload.choices?.[0];
  if (!choice) {
    throw new OptimizerError("The model returned an empty response");
  }

  // A safety refusal comes back in its own field, with content null.
  if (choice.message?.refusal) {
    throw new OptimizerError(
      `The model declined to rewrite this prompt: ${choice.message.refusal}`,
      422,
    );
  }

  // Hitting the token ceiling truncates mid-JSON; say so rather than letting
  // the parser report vague garbage.
  if (choice.finish_reason === "length") {
    throw new OptimizerError(
      "The rewrite was cut off because the prompt is very long. Try optimizing a shorter section.",
      413,
    );
  }

  const text = choice.message?.content ?? "";
  if (!text.trim()) {
    throw new OptimizerError("The model returned an empty response");
  }

  return { ...parseOptimizerResponse(text), model: OPTIMIZER_MODEL };
}
