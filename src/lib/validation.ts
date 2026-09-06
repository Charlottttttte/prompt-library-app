import { z } from "zod";

/** Trim, then treat an empty string as "not provided". */
const trimmed = z.string().trim();
const optionalText = trimmed
  .transform((v) => (v.length === 0 ? null : v))
  .nullable();

export const uuidSchema = z.uuid("Expected a UUID");

export const createPromptSchema = z.object({
  title: trimmed.min(1, "Title is required").max(200, "Title is too long"),
  content: trimmed.min(1, "Prompt content is required"),
  notes: optionalText.optional().default(null),
  folderId: uuidSchema.nullable().optional().default(null),
  categoryIds: z.array(uuidSchema).optional().default([]),
});

export const updatePromptSchema = createPromptSchema.partial();

export const createFolderSchema = z.object({
  name: trimmed.min(1, "Folder name is required").max(100, "Name is too long"),
  parentId: uuidSchema.nullable().optional().default(null),
});

export const updateFolderSchema = createFolderSchema.partial();

export const createCategorySchema = z.object({
  name: trimmed.min(1, "Category name is required").max(50, "Name is too long"),
  color: optionalText.optional().default(null),
});

export const updateCategorySchema = createCategorySchema.partial();

export const promptFilterSchema = z.object({
  /** Free-text search across title and content. */
  q: trimmed.optional(),
  /** Restrict to a folder. Includes the folder's descendants. */
  folderId: uuidSchema.optional(),
  /** Restrict to prompts carrying ALL of these categories. */
  categoryIds: z.array(uuidSchema).optional().default([]),
});

export const optimizePromptSchema = z.object({
  content: trimmed.min(1, "Nothing to optimize"),
  instructions: trimmed.max(500).optional(),
});

export type CreatePromptInput = z.infer<typeof createPromptSchema>;
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type PromptFilter = z.infer<typeof promptFilterSchema>;

/**
 * Flatten a ZodError into `{ field: message }` so both the API layer and the
 * form UI can render the same validation output.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
