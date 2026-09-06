import type { NextRequest } from "next/server";
import { handle, jsonError, parseBody } from "@/lib/api";
import { deleteCategory, updateCategory } from "@/lib/mutations";
import { updateCategorySchema, uuidSchema } from "@/lib/validation";

async function resolveId(ctx: RouteContext<"/api/categories/[id]">) {
  const { id } = await ctx.params;
  return uuidSchema.safeParse(id);
}

/** PATCH /api/categories/[id] */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/categories/[id]">,
) {
  return handle(async () => {
    const id = await resolveId(ctx);
    if (!id.success) return jsonError("Invalid category id", 400);

    const body = await parseBody(request, updateCategorySchema);
    if (!body.ok) return body.response;

    const category = await updateCategory(id.data, body.data);
    return Response.json({ category });
  });
}

/** DELETE /api/categories/[id] — also unlinks it from every prompt. */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/categories/[id]">,
) {
  return handle(async () => {
    const id = await resolveId(ctx);
    if (!id.success) return jsonError("Invalid category id", 400);

    await deleteCategory(id.data);
    return new Response(null, { status: 204 });
  });
}
