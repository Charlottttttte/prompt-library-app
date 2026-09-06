"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Category } from "@/db/schema";
import type { FormState } from "@/app/actions";
import {
  FieldError,
  Label,
  buttonStyles,
  inputStyles,
} from "./ui";

export type FolderOption = { id: string; label: string };

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  folderOptions: FolderOption[];
  categories: Category[];
  submitLabel: string;
  cancelHref: string;
  initial?: {
    id?: string;
    title?: string;
    content?: string;
    notes?: string | null;
    folderId?: string | null;
    categoryIds?: string[];
  };
};

export function PromptForm({
  action,
  folderOptions,
  categories,
  submitLabel,
  cancelHref,
  initial,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  const selected = new Set(initial?.categoryIds ?? []);

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </div>
      )}

      <div>
        <Label htmlFor="title">Title</Label>
        <input
          id="title"
          name="title"
          defaultValue={initial?.title}
          placeholder="e.g. Blog post outline"
          required
          maxLength={200}
          className={inputStyles}
        />
        <FieldError message={state?.fields?.title} />
      </div>

      <div>
        <Label htmlFor="content" hint="the text you'll copy and reuse">
          Prompt
        </Label>
        <textarea
          id="content"
          name="content"
          defaultValue={initial?.content}
          placeholder="Write the prompt here. Use {{placeholders}} for the parts you swap out each time."
          required
          rows={14}
          aria-describedby="content-hint"
          className={`${inputStyles} resize-y font-mono leading-relaxed`}
        />
        <FieldError message={state?.fields?.content} />
      </div>

      <div>
        <Label htmlFor="notes" hint="optional">
          Notes
        </Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          placeholder="When to reach for this prompt, what works well, what to watch out for."
          rows={3}
          aria-describedby="notes-hint"
          className={`${inputStyles} resize-y`}
        />
        <FieldError message={state?.fields?.notes} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="folderId">Folder</Label>
          <select
            id="folderId"
            name="folderId"
            defaultValue={initial?.folderId ?? "root"}
            className={inputStyles}
          >
            <option value="root">No folder (root)</option>
            {folderOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="newCategories" hint="comma separated">
            New tags
          </Label>
          <input
            id="newCategories"
            name="newCategories"
            placeholder="marketing, drafting"
            aria-describedby="newCategories-hint"
            className={inputStyles}
          />
        </div>
      </div>

      {categories.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Existing tags</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  defaultChecked={selected.has(category.id)}
                  className="accent-accent"
                />
                {category.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className={buttonStyles.primary}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className={buttonStyles.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
