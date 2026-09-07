"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MutationError,
  createFolder,
  createPrompt,
  deleteCategory,
  deleteFolder,
  deletePrompt,
  findOrCreateCategory,
  revertPromptToVersion,
  updateCategory,
  updateFolder,
  updatePrompt,
} from "@/lib/mutations";
import {
  createFolderSchema,
  createPromptSchema,
  fieldErrors,
  updatePromptSchema,
} from "@/lib/validation";

export type FormState = {
  ok: boolean;
  error?: string;
  fields?: Record<string, string>;
} | null;

/** Turn any thrown error into form state the UI can render inline. */
function toFormState(error: unknown): FormState {
  if (error instanceof MutationError) return { ok: false, error: error.message };
  console.error("Action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/**
 * Categories arrive two ways: ids of existing ones (checkboxes) and free-text
 * names the user typed. Resolve both into a single list of ids.
 */
async function resolveCategoryIds(formData: FormData): Promise<string[]> {
  const ids = formData.getAll("categoryIds").map(String).filter(Boolean);
  const fresh = String(formData.get("newCategories") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  for (const name of fresh) {
    const category = await findOrCreateCategory(name);
    ids.push(category.id);
  }
  return [...new Set(ids)];
}

function normalizeFolderId(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  return raw === "" || raw === "root" ? null : raw;
}

/* -------------------------------------------------------------------------- */
/* Prompts                                                                     */
/* -------------------------------------------------------------------------- */

export async function createPromptAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let newId: string;
  try {
    const parsed = createPromptSchema.safeParse({
      title: formData.get("title"),
      content: formData.get("content"),
      notes: formData.get("notes"),
      folderId: normalizeFolderId(formData.get("folderId")),
      categoryIds: await resolveCategoryIds(formData),
    });
    if (!parsed.success) {
      return { ok: false, fields: fieldErrors(parsed.error) };
    }

    const prompt = await createPrompt(parsed.data);
    newId = prompt.id;
  } catch (error) {
    return toFormState(error);
  }

  // redirect() throws by design, so it must sit outside the try block.
  revalidatePath("/", "layout");
  redirect(`/prompts/${newId}`);
}

export async function updatePromptAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  try {
    const parsed = updatePromptSchema.safeParse({
      title: formData.get("title"),
      content: formData.get("content"),
      notes: formData.get("notes"),
      folderId: normalizeFolderId(formData.get("folderId")),
      categoryIds: await resolveCategoryIds(formData),
    });
    if (!parsed.success) {
      return { ok: false, fields: fieldErrors(parsed.error) };
    }

    await updatePrompt(id, parsed.data);
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath("/", "layout");
  redirect(`/prompts/${id}`);
}

export async function deletePromptAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await deletePrompt(id);
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Save an AI rewrite the author has reviewed. Recorded as an `optimized`
 * version alongside the model that produced it, so the change is attributable
 * and revertible.
 */
export async function acceptOptimizationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const model = String(formData.get("model") ?? "") || undefined;
  if (!content) throw new MutationError("Nothing to save");

  await updatePrompt(id, { content }, "optimized", model);
  revalidatePath("/", "layout");
  redirect(`/prompts/${id}`);
}

export async function revertVersionAction(formData: FormData) {
  const promptId = String(formData.get("promptId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  await revertPromptToVersion(promptId, versionId);
  revalidatePath("/", "layout");
}

/* -------------------------------------------------------------------------- */
/* Folders                                                                     */
/* -------------------------------------------------------------------------- */

export async function createFolderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const parsed = createFolderSchema.safeParse({
      name: formData.get("name"),
      parentId: normalizeFolderId(formData.get("parentId")),
    });
    if (!parsed.success) {
      return { ok: false, fields: fieldErrors(parsed.error) };
    }
    await createFolder(parsed.data);
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameFolderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "Folder name is required" };
    await updateFolder(id, { name });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteFolderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await deleteFolder(id);
  revalidatePath("/", "layout");
  redirect("/");
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export async function renameCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "Tag name is required" };
    await updateCategory(id, { name });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function recolorCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const color = String(formData.get("color") ?? "").trim() || null;
  await updateCategory(id, { color });
  revalidatePath("/", "layout");
}

export async function deleteCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await deleteCategory(id);
  revalidatePath("/", "layout");
}
