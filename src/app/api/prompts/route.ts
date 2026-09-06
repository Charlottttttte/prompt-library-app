import type { NextRequest } from "next/server";
import { handle, jsonError, parseBody } from "@/lib/api";
import { createPrompt } from "@/lib/mutations";
import { listPrompts } from "@/lib/queries";
import { createPromptSchema, promptFilterSchema } from "@/lib/validation";

/**
 * GET /api/prompts?q=&folderId=&categoryIds=a,b
 * Lists prompts, newest-updated first.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const params = request.nextUrl.searchParams;
    const parsed = promptFilterSchema.safeParse({
      q: params.get("q") ?? undefined,
      folderId: params.get("folderId") ?? undefined,
      categoryIds:
        params.get("categoryIds")?.split(",").filter(Boolean) ?? undefined,
    });
    if (!parsed.success) return jsonError("Invalid filter parameters", 400);

    const results = await listPrompts(parsed.data);
    return Response.json({ prompts: results });
  });
}

/** POST /api/prompts — create a prompt. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await parseBody(request, createPromptSchema);
    if (!body.ok) return body.response;

    const prompt = await createPrompt(body.data);
    return Response.json({ prompt }, { status: 201 });
  });
}
