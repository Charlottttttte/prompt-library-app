import type { NextRequest } from "next/server";
import { handle, jsonError, parseBody } from "@/lib/api";
import { deletePrompt, updatePrompt } from "@/lib/mutations";
import { getPrompt } from "@/lib/queries";
import { updatePromptSchema, uuidSchema } from "@/lib/validation";

async function resolveId(ctx: RouteContext<"/api/prompts/[id]">) {
  const { id } = await ctx.params;
  return uuidSchema.safeParse(id);
}

/** GET /api/prompts/[id] — a prompt with its folder, categories and history. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/prompts/[id]">,
) {
  return handle(async () => {
    const id = await resolveId(ctx);
    if (!id.success) return jsonError("Invalid prompt id", 400);

    const prompt = await getPrompt(id.data);
    if (!prompt) return jsonError("Prompt not found", 404);
    return Response.json({ prompt });
  });
}

/** PATCH /api/prompts/[id] — partial update. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/prompts/[id]">,
) {
  return handle(async () => {
    const id = await resolveId(ctx);
    if (!id.success) return jsonError("Invalid prompt id", 400);

    const body = await parseBody(request, updatePromptSchema);
    if (!body.ok) return body.response;

    const prompt = await updatePrompt(id.data, body.data);
    return Response.json({ prompt });
  });
}

/** DELETE /api/prompts/[id] */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/prompts/[id]">,
) {
  return handle(async () => {
    const id = await resolveId(ctx);
    if (!id.success) return jsonError("Invalid prompt id", 400);

    await deletePrompt(id.data);
    return new Response(null, { status: 204 });
  });
}
