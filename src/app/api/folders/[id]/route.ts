import type { NextRequest } from "next/server";
import { handle, jsonError, parseBody } from "@/lib/api";
import { deleteFolder, updateFolder } from "@/lib/mutations";
import { updateFolderSchema, uuidSchema } from "@/lib/validation";

async function resolveId(ctx: RouteContext<"/api/folders/[id]">) {
  const { id } = await ctx.params;
  return uuidSchema.safeParse(id);
}

/** PATCH /api/folders/[id] — rename, or move under a different parent. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/folders/[id]">,
) {
  return handle(async () => {
    const id = await resolveId(ctx);
    if (!id.success) return jsonError("Invalid folder id", 400);

    const body = await parseBody(request, updateFolderSchema);
    if (!body.ok) return body.response;

    const folder = await updateFolder(id.data, body.data);
    return Response.json({ folder });
  });
}

/**
 * DELETE /api/folders/[id] — removes the folder and its subfolders. Prompts
 * inside are moved to the root rather than deleted.
 */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/folders/[id]">,
) {
  return handle(async () => {
    const id = await resolveId(ctx);
    if (!id.success) return jsonError("Invalid folder id", 400);

    await deleteFolder(id.data);
    return new Response(null, { status: 204 });
  });
}
