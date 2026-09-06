import "server-only";
import { z } from "zod";
import { MutationError } from "./mutations";
import { fieldErrors } from "./validation";

export function jsonError(message: string, status: number, extra?: object) {
  return Response.json({ error: message, ...extra }, { status });
}

/**
 * Parse a JSON request body against a schema, returning either the typed data
 * or a ready-to-return 400 with per-field messages.
 */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: Response }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError("Request body must be valid JSON", 400),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError("Validation failed", 400, {
        fields: fieldErrors(result.error),
      }),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Run a handler, translating known rule violations into their intended status
 * codes and anything unexpected into a 500 (logged, never leaked to the client).
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof MutationError) {
      return jsonError(error.message, error.status);
    }
    console.error("Unhandled API error:", error);
    return jsonError("Something went wrong", 500);
  }
}
