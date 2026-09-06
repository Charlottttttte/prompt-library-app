import { createPromptAction } from "@/app/actions";
import { PromptForm } from "@/components/prompt-form";
import { flattenFolderOptions } from "@/lib/folder-options";
import { getFolderTree, listCategories } from "@/lib/queries";

export const metadata = { title: "New prompt · Prompt Library" };

export default async function NewPromptPage(props: PageProps<"/prompts/new">) {
  const searchParams = await props.searchParams;
  const preselectedFolder =
    typeof searchParams.folderId === "string" ? searchParams.folderId : null;

  const [{ tree }, categories] = await Promise.all([
    getFolderTree(),
    listCategories(),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold">New prompt</h1>
        <p className="mt-0.5 text-sm text-muted">
          Save a prompt you want to reuse. You can optimize it with AI later.
        </p>
      </header>

      <PromptForm
        action={createPromptAction}
        folderOptions={flattenFolderOptions(tree)}
        categories={categories}
        submitLabel="Save prompt"
        cancelHref="/"
        initial={{ folderId: preselectedFolder }}
      />
    </div>
  );
}
