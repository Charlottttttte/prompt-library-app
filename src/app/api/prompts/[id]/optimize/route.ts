import type { NextRequest } from "next/server";
import { handle, jsonError, parseBody } from "@/lib/api";
import { OptimizerError, optimizePrompt } from "@/lib/optimize";
import { getPrompt } from "@/lib/queries";
import { optimizePromptSchema, uuidSchema } from "@/lib/validation";

/**
 * POST /api/prompts/[id]/optimize
 *
 * Returns a suggested rewrite. Deliberately does NOT save it — the caller
 * reviews the suggestion and accepts it with a normal PATCH, so an unwanted
 * rewrite never silently replaces what the author wrote.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/prompts/[id]/optimize">,
) {
  return handle(async () => {
    const { id } = await ctx.params;
    if (!uuidSchema.safeParse(id).success) {
      return jsonError("Invalid prompt id", 400);
    }

    const prompt = await getPrompt(id);
    if (!prompt) return jsonError("Prompt not found", 404);

    // The body is optional: with no body we optimize the prompt as saved.
    let instructions: string | undefined;
    if (request.headers.get("content-length") !== "0") {
      const body = await parseBody(
        request,
        optimizePromptSchema.partial({ content: true }),
      );
      if (body.ok) instructions = body.data.instructions;
    }

    try {
      const result = await optimizePrompt(prompt.content, instructions);
      return Response.json({
        original: prompt.content,
        ...result,
      });
    } catch (error) {
      if (error instanceof OptimizerError) {
        return jsonError(error.message, error.status, {
          needsSetup: error.needsSetup,
        });
      }
      throw error;
    }
  });
}
