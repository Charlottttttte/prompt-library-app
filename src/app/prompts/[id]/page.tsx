import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePromptAction, revertVersionAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { DeleteButton } from "@/components/delete-button";
import { OptimizePanel } from "@/components/optimize-panel";
import { CategoryBadge, buttonStyles, formatDate } from "@/components/ui";
import { folderPath } from "@/lib/folder-options";
import { getFolderTree, getPrompt } from "@/lib/queries";
import { uuidSchema } from "@/lib/validation";

export async function generateMetadata(props: PageProps<"/prompts/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) return { title: "Prompt Library" };
  const prompt = await getPrompt(id);
  return { title: prompt ? `${prompt.title} · Prompt Library` : "Not found" };
}

export default async function PromptDetailPage(
  props: PageProps<"/prompts/[id]">,
) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const [prompt, { tree }] = await Promise.all([getPrompt(id), getFolderTree()]);
  if (!prompt) notFound();

  const path = prompt.folderId ? folderPath(tree, prompt.folderId) : null;
  // The newest version always mirrors the prompt's current content, so the
  // entries below it are the history worth offering as a revert.
  const history = prompt.versions.slice(1);

  return (
    <article className="max-w-3xl space-y-6">
      <header className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs text-muted">
          <Link href="/" className="transition hover:text-foreground">
            Library
          </Link>
          <span aria-hidden>/</span>
          <span>{path ? path.join(" / ") : "No folder"}</span>
        </nav>

        <h1 className="text-2xl font-semibold leading-tight">{prompt.title}</h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>Updated {formatDate(prompt.updatedAt)}</span>
          <span aria-hidden>·</span>
          <span>
            {prompt.versions.length} version
            {prompt.versions.length === 1 ? "" : "s"}
          </span>
        </div>

        {prompt.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {prompt.categories.map((category) => (
              <CategoryBadge
                key={category.id}
                name={category.name}
                color={category.color}
              />
            ))}
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={prompt.content} />
        <Link
          href={`/prompts/${prompt.id}/edit`}
          className={buttonStyles.secondary}
        >
          Edit
        </Link>
        <DeleteButton
          action={deletePromptAction}
          id={prompt.id}
          label="Delete"
          confirmMessage={`Delete "${prompt.title}"? This also removes its version history and can't be undone.`}
        />
      </div>

      <section>
        <h2 className="sr-only">Prompt text</h2>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface p-4 font-mono text-sm leading-relaxed">
          {prompt.content}
        </pre>
      </section>

      <OptimizePanel promptId={prompt.id} />

      {prompt.notes && (
        <section>
          <h2 className="mb-1.5 text-sm font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted">
            {prompt.notes}
          </p>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Version history</h2>
          <ul className="space-y-2">
            {history.map((version, index) => (
              <li
                key={version.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="font-medium text-foreground">
                    v{history.length - index}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{formatDate(version.createdAt)}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {version.source === "optimized"
                      ? `AI rewrite${version.model ? ` (${version.model})` : ""}`
                      : "Manual edit"}
                  </span>
                </div>

                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-surface p-2.5 font-mono text-xs leading-relaxed text-muted">
                  {version.content}
                </pre>

                <div className="mt-2 flex gap-2">
                  <CopyButton
                    text={version.content}
                    label="Copy this version"
                    variant="secondary"
                  />
                  <form action={revertVersionAction}>
                    <input
                      type="hidden"
                      name="promptId"
                      value={prompt.id}
                    />
                    <input
                      type="hidden"
                      name="versionId"
                      value={version.id}
                    />
                    <button type="submit" className={buttonStyles.secondary}>
                      Restore
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
