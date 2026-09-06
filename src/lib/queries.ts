import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  folders,
  promptCategories,
  promptVersions,
  prompts,
  type Category,
  type Folder,
} from "@/db/schema";
import type { PromptFilter } from "./validation";

export type PromptListItem = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  folderName: string | null;
  updatedAt: Date;
  categories: Category[];
};

export type FolderTreeNode = Folder & {
  children: FolderTreeNode[];
  /** Prompts directly in this folder (not counting descendants). */
  promptCount: number;
};

/**
 * All descendant folder ids of `folderId`, including the folder itself.
 * Selecting a folder in the sidebar shows everything nested beneath it, which
 * is what a file-tree implies — so this walks the tree in one recursive CTE
 * rather than issuing a query per level.
 */
export async function getFolderSubtreeIds(folderId: string): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE subtree AS (
      SELECT ${folders.id} AS id
      FROM ${folders}
      WHERE ${folders.id} = ${folderId}
      UNION ALL
      SELECT f.id
      FROM ${folders} f
      JOIN subtree s ON f.parent_id = s.id
    )
    SELECT id FROM subtree
  `);
  return rows.map((r) => r.id);
}

export async function listPrompts(
  filter: PromptFilter = { categoryIds: [] },
): Promise<PromptListItem[]> {
  const conditions = [];

  if (filter.q) {
    const pattern = `%${filter.q}%`;
    conditions.push(
      or(ilike(prompts.title, pattern), ilike(prompts.content, pattern)),
    );
  }

  if (filter.folderId) {
    const subtree = await getFolderSubtreeIds(filter.folderId);
    // An unknown folder id must match nothing, not everything.
    if (subtree.length === 0) return [];
    conditions.push(inArray(prompts.folderId, subtree));
  }

  if (filter.categoryIds.length > 0) {
    // Match prompts carrying ALL of the requested categories, not just any.
    const matching = db
      .select({ promptId: promptCategories.promptId })
      .from(promptCategories)
      .where(inArray(promptCategories.categoryId, filter.categoryIds))
      .groupBy(promptCategories.promptId)
      .having(
        sql`count(distinct ${promptCategories.categoryId}) = ${filter.categoryIds.length}`,
      );
    conditions.push(inArray(prompts.id, matching));
  }

  const rows = await db
    .select({
      id: prompts.id,
      title: prompts.title,
      content: prompts.content,
      folderId: prompts.folderId,
      folderName: folders.name,
      updatedAt: prompts.updatedAt,
    })
    .from(prompts)
    .leftJoin(folders, eq(prompts.folderId, folders.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(prompts.updatedAt));

  if (rows.length === 0) return [];

  // One extra round trip for all category links, rather than N+1 per prompt.
  const links = await db
    .select({
      promptId: promptCategories.promptId,
      category: categories,
    })
    .from(promptCategories)
    .innerJoin(categories, eq(promptCategories.categoryId, categories.id))
    .where(
      inArray(
        promptCategories.promptId,
        rows.map((r) => r.id),
      ),
    );

  const byPrompt = new Map<string, Category[]>();
  for (const link of links) {
    const list = byPrompt.get(link.promptId) ?? [];
    list.push(link.category);
    byPrompt.set(link.promptId, list);
  }

  return rows.map((row) => ({
    ...row,
    categories: (byPrompt.get(row.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
}

export async function getPrompt(id: string) {
  const prompt = await db.query.prompts.findFirst({
    where: eq(prompts.id, id),
    with: {
      folder: true,
      promptCategories: { with: { category: true } },
    },
  });
  if (!prompt) return null;

  const versions = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.promptId, id))
    .orderBy(desc(promptVersions.createdAt));

  return {
    ...prompt,
    categories: prompt.promptCategories
      .map((pc) => pc.category)
      .sort((a, b) => a.name.localeCompare(b.name)),
    versions,
  };
}

export type PromptDetail = NonNullable<Awaited<ReturnType<typeof getPrompt>>>;

export async function listFolders(): Promise<Folder[]> {
  return db.select().from(folders).orderBy(folders.name);
}

export async function getFolderTree(): Promise<{
  tree: FolderTreeNode[];
  rootPromptCount: number;
  totalPromptCount: number;
}> {
  const [allFolders, counts, [{ total }]] = await Promise.all([
    listFolders(),
    db
      .select({ folderId: prompts.folderId, count: sql<number>`count(*)::int` })
      .from(prompts)
      .groupBy(prompts.folderId),
    db.select({ total: sql<number>`count(*)::int` }).from(prompts),
  ]);

  const countByFolder = new Map(counts.map((c) => [c.folderId, c.count]));

  const nodes = new Map<string, FolderTreeNode>(
    allFolders.map((f) => [
      f.id,
      { ...f, children: [], promptCount: countByFolder.get(f.id) ?? 0 },
    ]),
  );

  const tree: FolderTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else tree.push(node);
  }

  const sortByName = (a: FolderTreeNode, b: FolderTreeNode) =>
    a.name.localeCompare(b.name);
  const sortRecursive = (list: FolderTreeNode[]) => {
    list.sort(sortByName);
    for (const node of list) sortRecursive(node.children);
  };
  sortRecursive(tree);

  return {
    tree,
    rootPromptCount: countByFolder.get(null) ?? 0,
    totalPromptCount: total,
  };
}

export async function listCategories(): Promise<
  (Category & { promptCount: number })[]
> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      createdAt: categories.createdAt,
      promptCount: sql<number>`count(${promptCategories.promptId})::int`,
    })
    .from(categories)
    .leftJoin(
      promptCategories,
      eq(categories.id, promptCategories.categoryId),
    )
    .groupBy(categories.id)
    .orderBy(categories.name);
  return rows;
}
