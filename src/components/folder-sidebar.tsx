"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import type { FolderTreeNode } from "@/lib/queries";
import {
  createFolderAction,
  deleteFolderAction,
  type FormState,
} from "@/app/actions";
import { buttonStyles, inputStyles } from "./ui";

type Props = {
  tree: FolderTreeNode[];
  rootPromptCount: number;
  totalPromptCount: number;
};

/** Preserve the active search when switching folders. */
function useHrefBuilder() {
  const params = useSearchParams();
  return (folderId: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (folderId) next.set("folderId", folderId);
    else next.delete("folderId");
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  };
}

function FolderRow({
  node,
  depth,
  activeId,
  buildHref,
}: {
  node: FolderTreeNode;
  depth: number;
  activeId: string | null;
  buildHref: (id: string | null) => string;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = activeId === node.id;

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md pr-1 text-sm transition ${
          isActive ? "bg-surface font-medium" : "hover:bg-surface"
        }`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
            className="flex h-6 w-5 shrink-0 items-center justify-center text-muted transition hover:text-foreground"
          >
            <span
              className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              ▸
            </span>
          </button>
        ) : (
          <span className="h-6 w-5 shrink-0" />
        )}

        <Link
          href={buildHref(node.id)}
          className="flex-1 truncate py-1"
          title={node.name}
        >
          {node.name}
        </Link>

        <span className="shrink-0 text-xs text-muted tabular-nums">
          {node.promptCount > 0 ? node.promptCount : ""}
        </span>

        <form action={deleteFolderAction} className="shrink-0">
          <input type="hidden" name="id" value={node.id} />
          <button
            type="submit"
            title="Delete folder (prompts inside move to the root)"
            aria-label={`Delete folder ${node.name}`}
            className="hidden h-5 w-5 items-center justify-center rounded text-muted transition hover:bg-red-50 hover:text-red-600 group-hover:flex dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            ×
          </button>
        </form>
      </div>

      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <FolderRow
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              buildHref={buildHref}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FolderSidebar({
  tree,
  rootPromptCount,
  totalPromptCount,
}: Props) {
  const params = useSearchParams();
  const activeId = params.get("folderId");
  const buildHref = useHrefBuilder();

  const [adding, setAdding] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await createFolderAction(prev, formData);
      if (result?.ok) setAdding(false);
      return result;
    },
    null,
  );

  return (
    <nav aria-label="Folders">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Folders
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded px-1.5 text-sm text-muted transition hover:bg-surface hover:text-foreground"
          aria-label="New folder"
          title="New folder"
        >
          +
        </button>
      </div>

      {adding && (
        <form action={formAction} className="mb-2 flex flex-col gap-1.5">
          <input
            name="name"
            placeholder="Folder name"
            autoFocus
            required
            className={inputStyles}
          />
          {activeId && (
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" name="parentId" value={activeId} />
              Nest inside the selected folder
            </label>
          )}
          {state?.fields?.name && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {state.fields.name}
            </p>
          )}
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={pending}
              className={buttonStyles.primary}
            >
              {pending ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className={buttonStyles.secondary}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-0.5">
        <li>
          <Link
            href={buildHref(null)}
            className={`flex items-center justify-between rounded-md px-2 py-1 text-sm transition ${
              !activeId ? "bg-surface font-medium" : "hover:bg-surface"
            }`}
          >
            <span>All prompts</span>
            <span className="text-xs text-muted tabular-nums">
              {totalPromptCount > 0 ? totalPromptCount : ""}
            </span>
          </Link>
        </li>

        {tree.map((node) => (
          <FolderRow
            key={node.id}
            node={node}
            depth={0}
            activeId={activeId}
            buildHref={buildHref}
          />
        ))}
      </ul>

      {rootPromptCount > 0 && tree.length > 0 && (
        <p className="mt-2 px-2 text-xs text-muted">
          {rootPromptCount} prompt{rootPromptCount === 1 ? "" : "s"} outside any
          folder
        </p>
      )}
    </nav>
  );
}
