import type { NextRequest } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { createFolder } from "@/lib/mutations";
import { getFolderTree } from "@/lib/queries";
import { createFolderSchema } from "@/lib/validation";

/** GET /api/folders — the folder tree with per-folder prompt counts. */
export async function GET() {
  return handle(async () => {
    const { tree, rootPromptCount, totalPromptCount } = await getFolderTree();
    return Response.json({ folders: tree, rootPromptCount, totalPromptCount });
  });
}

/** POST /api/folders — create a folder, optionally nested under a parent. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await parseBody(request, createFolderSchema);
    if (!body.ok) return body.response;

    const folder = await createFolder(body.data);
    return Response.json({ folder }, { status: 201 });
  });
}
