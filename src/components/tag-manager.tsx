"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Category } from "@/db/schema";
import {
  deleteCategoryAction,
  recolorCategoryAction,
  renameCategoryAction,
  type FormState,
} from "@/app/actions";
import { buttonStyles, inputStyles } from "./ui";

type Props = {
  categories: (Category & { promptCount: number })[];
};

function DeleteTagButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteCategoryAction}
      className="shrink-0"
      onSubmit={(event) => {
        if (!window.confirm(`Delete tag "${name}"? It'll be unlinked from every prompt.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title="Delete tag"
        aria-label={`Delete tag ${name}`}
        className="hidden h-5 w-5 items-center justify-center rounded text-muted transition hover:bg-red-50 hover:text-red-600 group-hover:flex dark:hover:bg-red-950/40 dark:hover:text-red-400"
      >
        ×
      </button>
    </form>
  );
}

function RecolorSwatch({ id, color }: { id: string; color: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={recolorCategoryAction} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <input
        type="color"
        name="color"
        defaultValue={color ?? "#94a3b8"}
        title="Recolor tag"
        aria-label="Recolor tag"
        onChange={() => formRef.current?.requestSubmit()}
        className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-border"
      />
    </form>
  );
}

function TagRow({ category }: { category: Category & { promptCount: number } }) {
  const [renaming, setRenaming] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await renameCategoryAction(prev, formData);
      if (result?.ok) setRenaming(false);
      return result;
    },
    null,
  );

  if (renaming) {
    return (
      <li>
        <form action={formAction} className="flex flex-col gap-1">
          <input type="hidden" name="id" value={category.id} />
          <div className="flex items-center gap-1">
            <input
              name="name"
              defaultValue={category.name}
              autoFocus
              required
              onKeyDown={(e) => {
                if (e.key === "Escape") setRenaming(false);
              }}
              className={inputStyles}
            />
            <SaveButton />
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className={buttonStyles.secondary}
            >
              Cancel
            </button>
          </div>
          {state?.error && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-1.5 rounded-md py-1 pr-1 text-sm transition hover:bg-surface">
      <RecolorSwatch id={category.id} color={category.color} />
      <button
        type="button"
        onClick={() => setRenaming(true)}
        title="Rename tag"
        aria-label={`Rename tag ${category.name}`}
        className="flex-1 truncate py-0.5 text-left"
      >
        {category.name}
      </button>
      <span className="shrink-0 text-xs text-muted tabular-nums">
        {category.promptCount > 0 ? category.promptCount : ""}
      </span>
      <DeleteTagButton id={category.id} name={category.name} />
    </li>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles.primary}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function TagManager({ categories }: Props) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Tags" className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Tags
      </h2>
      <ul className="space-y-0.5">
        {categories.map((category) => (
          <TagRow key={category.id} category={category} />
        ))}
      </ul>
    </nav>
  );
}
