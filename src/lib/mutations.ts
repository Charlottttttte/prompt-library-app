import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  folders,
  promptCategories,
  promptVersions,
  prompts,
  type Category,
  type Folder,
  type Prompt,
  type PromptVersionSource,
} from "@/db/schema";
import { getFolderSubtreeIds } from "./queries";
import type {
  CreateCategoryInput,
  CreateFolderInput,
  CreatePromptInput,
  UpdateCategoryInput,
  UpdateFolderInput,
  UpdatePromptInput,
} from "./validation";

/** Thrown for rule violations the caller should surface as a 4xx, not a 500. */
export class MutationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "MutationError";
  }
}

/* -------------------------------------------------------------------------- */
/* Prompts                                                                     */
/* -------------------------------------------------------------------------- */

async function assertFolderExists(folderId: string | null | undefined) {
  if (!folderId) return;
  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
  });
  if (!folder) throw new MutationError("That folder no longer exists", 404);
}

async function setPromptCategories(promptId: string, categoryIds: string[]) {
  await db
    .delete(promptCategories)
    .where(eq(promptCategories.promptId, promptId));
  if (categoryIds.length === 0) return;

  const unique = [...new Set(categoryIds)];
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(inArray(categories.id, unique));
  if (existing.length !== unique.length) {
    throw new MutationError("One or more categories no longer exist", 404);
  }

  await db
    .insert(promptCategories)
    .values(unique.map((categoryId) => ({ promptId, categoryId })));
}

export async function createPrompt(input: CreatePromptInput): Promise<Prompt> {
  await assertFolderExists(input.folderId);

  const [prompt] = await db
    .insert(prompts)
    .values({
      title: input.title,
      content: input.content,
      notes: input.notes,
      folderId: input.folderId,
    })
    .returning();

  await setPromptCategories(prompt.id, input.categoryIds);
  await db.insert(promptVersions).values({
    promptId: prompt.id,
    content: prompt.content,
    source: "manual",
  });

  return prompt;
}

export async function updatePrompt(
  id: string,
  input: UpdatePromptInput,
  /** Marks the resulting version as an accepted AI rewrite. */
  versionSource: PromptVersionSource = "manual",
  model?: string,
): Promise<Prompt> {
  const current = await db.query.prompts.findFirst({
    where: eq(prompts.id, id),
  });
  if (!current) throw new MutationError("Prompt not found", 404);

  if (input.folderId !== undefined) await assertFolderExists(input.folderId);

  const [updated] = await db
    .update(prompts)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.folderId !== undefined && { folderId: input.folderId }),
      updatedAt: new Date(),
    })
    .where(eq(prompts.id, id))
    .returning();

  if (input.categoryIds !== undefined) {
    await setPromptCategories(id, input.categoryIds);
  }

  // Only record a version when the text actually changed — renaming a prompt
  // or retagging it shouldn't clutter the history.
  if (input.content !== undefined && input.content !== current.content) {
    await db.insert(promptVersions).values({
      promptId: id,
      content: input.content,
      source: versionSource,
      model: model ?? null,
    });
  }

  return updated;
}

export async function deletePrompt(id: string): Promise<void> {
  const deleted = await db
    .delete(prompts)
    .where(eq(prompts.id, id))
    .returning({ id: prompts.id });
  if (deleted.length === 0) throw new MutationError("Prompt not found", 404);
}

/** Restore an earlier version, recording the restore as a new version. */
export async function revertPromptToVersion(
  promptId: string,
  versionId: string,
): Promise<Prompt> {
  const version = await db.query.promptVersions.findFirst({
    where: and(
      eq(promptVersions.id, versionId),
      eq(promptVersions.promptId, promptId),
    ),
  });
  if (!version) throw new MutationError("Version not found", 404);
  return updatePrompt(promptId, { content: version.content }, "manual");
}

/* -------------------------------------------------------------------------- */
/* Folders                                                                     */
/* -------------------------------------------------------------------------- */

export async function createFolder(input: CreateFolderInput): Promise<Folder> {
  if (input.parentId) {
    const parent = await db.query.folders.findFirst({
      where: eq(folders.id, input.parentId),
    });
    if (!parent) throw new MutationError("Parent folder not found", 404);
  }
  const [folder] = await db
    .insert(folders)
    .values({ name: input.name, parentId: input.parentId })
    .returning();
  return folder;
}

export async function updateFolder(
  id: string,
  input: UpdateFolderInput,
): Promise<Folder> {
  const current = await db.query.folders.findFirst({
    where: eq(folders.id, id),
  });
  if (!current) throw new MutationError("Folder not found", 404);

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === id) {
      throw new MutationError("A folder can't be its own parent");
    }
    // Moving a folder into its own descendant would orphan the whole subtree
    // into a cycle that no tree walk can escape.
    const subtree = await getFolderSubtreeIds(id);
    if (subtree.includes(input.parentId)) {
      throw new MutationError("A folder can't be moved inside itself");
    }
    const parent = await db.query.folders.findFirst({
      where: eq(folders.id, input.parentId),
    });
    if (!parent) throw new MutationError("Parent folder not found", 404);
  }

  const [updated] = await db
    .update(folders)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
      updatedAt: new Date(),
    })
    .where(eq(folders.id, id))
    .returning();
  return updated;
}

/**
 * Deleting a folder cascades to its subfolders, but never to prompts: the
 * schema sets their `folderId` to null so they resurface at the root.
 */
export async function deleteFolder(id: string): Promise<void> {
  const deleted = await db
    .delete(folders)
    .where(eq(folders.id, id))
    .returning({ id: folders.id });
  if (deleted.length === 0) throw new MutationError("Folder not found", 404);
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  const existing = await db.query.categories.findFirst({
    where: eq(categories.name, input.name),
  });
  if (existing) throw new MutationError("That category already exists", 409);

  const [category] = await db
    .insert(categories)
    .values({ name: input.name, color: input.color })
    .returning();
  return category;
}

/** Get a category by name, creating it if it doesn't exist yet. */
export async function findOrCreateCategory(name: string): Promise<Category> {
  const trimmed = name.trim();
  const existing = await db.query.categories.findFirst({
    where: eq(categories.name, trimmed),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(categories)
    .values({ name: trimmed })
    .onConflictDoNothing()
    .returning();
  // Lost a race with a concurrent insert — read the winner back.
  if (!created) {
    const winner = await db.query.categories.findFirst({
      where: eq(categories.name, trimmed),
    });
    if (!winner) throw new MutationError("Could not create category", 500);
    return winner;
  }
  return created;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  const [updated] = await db
    .update(categories)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.color !== undefined && { color: input.color }),
    })
    .where(eq(categories.id, id))
    .returning();
  if (!updated) throw new MutationError("Category not found", 404);
  return updated;
}

export async function deleteCategory(id: string): Promise<void> {
  const deleted = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  if (deleted.length === 0) throw new MutationError("Category not found", 404);
}
