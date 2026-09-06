import type { ReactNode } from "react";

/** Shared class strings so buttons and inputs stay consistent across pages. */
export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40",
  ghost:
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted transition hover:bg-surface hover:text-foreground",
};

export const inputStyles =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>;
}

/**
 * The hint sits outside the <label> and is wired up with aria-describedby, so
 * the field's accessible name stays just "Prompt" rather than "Prompt the text
 * you'll copy and reuse" — a name is for identifying the field, a description
 * for explaining it. Pair with aria-describedby={`${id}-hint`} on the input.
 */
export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline gap-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {children}
      </label>
      {hint && (
        <span id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

export function CategoryBadge({
  name,
  color,
}: {
  name: string;
  color?: string | null;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted"
      style={color ? { borderColor: color, color } : undefined}
    >
      {name}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
