import Link from "next/link";
import { Suspense } from "react";
import { CategoryFilter } from "@/components/category-filter";
import { SearchBar } from "@/components/search-bar";
import {
  CategoryBadge,
  EmptyState,
  buttonStyles,
  formatDate,
} from "@/components/ui";
import { folderPath } from "@/lib/folder-options";
import { getFolderTree, listCategories, listPrompts } from "@/lib/queries";

export default async function LibraryPage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;

  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const folderId =
    typeof searchParams.folderId === "string"
      ? searchParams.folderId
      : undefined;
  const categoryIds =
    typeof searchParams.categoryIds === "string"
      ? searchParams.categoryIds.split(",").filter(Boolean)
      : [];

  const [prompts, categories, { tree }] = await Promise.all([
    listPrompts({ q, folderId, categoryIds }),
    listCategories(),
    getFolderTree(),
  ]);

  const path = folderId ? folderPath(tree, folderId) : null;
  const isFiltered = Boolean(q || folderId || categoryIds.length > 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">
          {path ? path.join(" / ") : "All prompts"}
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {prompts.length} prompt{prompts.length === 1 ? "" : "s"}
          {isFiltered ? " matching your filters" : " saved"}
        </p>
      </header>

      <div className="space-y-3">
        <Suspense fallback={<div className="h-10 rounded-md bg-surface" />}>
          <SearchBar initialQuery={q ?? ""} />
        </Suspense>
        <Suspense fallback={null}>
          <CategoryFilter categories={categories} activeIds={categoryIds} />
        </Suspense>
      </div>

      {prompts.length === 0 ? (
        isFiltered ? (
          <EmptyState
            title="Nothing matches those filters"
            description="Try a different search term, or clear the folder and tag filters to see everything."
            action={
              <Link href="/" className={buttonStyles.secondary}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Your library is empty"
            description="Save your first prompt and it'll show up here, ready to search, tag, and reuse."
            action={
              <Link href="/prompts/new" className={buttonStyles.primary}>
                New prompt
              </Link>
            }
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {prompts.map((prompt) => (
            <li key={prompt.id}>
              <Link
                href={`/prompts/${prompt.id}`}
                className="flex h-full flex-col rounded-lg border border-border bg-background p-4 transition hover:border-accent hover:shadow-sm"
              >
                <h2 className="font-medium leading-snug">{prompt.title}</h2>
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted">
                  {prompt.content}
                </p>

                {prompt.categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {prompt.categories.map((category) => (
                      <CategoryBadge
                        key={category.id}
                        name={category.name}
                        color={category.color}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <span>{prompt.folderName ?? "No folder"}</span>
                  <span aria-hidden>·</span>
                  <span>Updated {formatDate(prompt.updatedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
