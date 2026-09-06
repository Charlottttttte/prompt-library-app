import type { NextRequest } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { createCategory } from "@/lib/mutations";
import { listCategories } from "@/lib/queries";
import { createCategorySchema } from "@/lib/validation";

/** GET /api/categories — all categories with how many prompts use each. */
export async function GET() {
  return handle(async () => {
    const items = await listCategories();
    return Response.json({ categories: items });
  });
}

/** POST /api/categories */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await parseBody(request, createCategorySchema);
    if (!body.ok) return body.response;

    const category = await createCategory(body.data);
    return Response.json({ category }, { status: 201 });
  });
}
