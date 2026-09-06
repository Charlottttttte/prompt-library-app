import { notFound } from "next/navigation";
import { updatePromptAction } from "@/app/actions";
import { PromptForm } from "@/components/prompt-form";
import { flattenFolderOptions } from "@/lib/folder-options";
import { getFolderTree, getPrompt, listCategories } from "@/lib/queries";
import { uuidSchema } from "@/lib/validation";

export default async function EditPromptPage(
  props: PageProps<"/prompts/[id]/edit">,
) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const [prompt, { tree }, categories] = await Promise.all([
    getPrompt(id),
    getFolderTree(),
    listCategories(),
  ]);
  if (!prompt) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Edit prompt</h1>
        <p className="mt-0.5 text-sm text-muted">
          Changing the prompt text saves a new version — nothing is overwritten.
        </p>
      </header>

      <PromptForm
        action={updatePromptAction}
        folderOptions={flattenFolderOptions(tree)}
        categories={categories}
        submitLabel="Save changes"
        cancelHref={`/prompts/${prompt.id}`}
        initial={{
          id: prompt.id,
          title: prompt.title,
          content: prompt.content,
          notes: prompt.notes,
          folderId: prompt.folderId,
          categoryIds: prompt.categories.map((c) => c.id),
        }}
      />
    </div>
  );
}
