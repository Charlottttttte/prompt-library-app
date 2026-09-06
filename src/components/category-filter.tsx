"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/db/schema";

type Props = {
  categories: (Category & { promptCount: number })[];
  activeIds: string[];
};

/**
 * Filter chips. Selecting several narrows to prompts carrying *all* of them,
 * which matches how tags are normally used to drill down.
 */
export function CategoryFilter({ categories, activeIds }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (categories.length === 0) return null;

  const toggle = (id: string) => {
    const next = new URLSearchParams(params.toString());
    const selected = new Set(activeIds);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);

    if (selected.size > 0) next.set("categoryIds", [...selected].join(","));
    else next.delete("categoryIds");

    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted">Tags</span>
      {categories.map((category) => {
        const active = activeIds.includes(category.id);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => toggle(category.id)}
            aria-pressed={active}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
              active
                ? "border-accent bg-accent text-white"
                : "border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            {category.name}
            <span className="ml-1 opacity-60 tabular-nums">
              {category.promptCount}
            </span>
          </button>
        );
      })}
      {activeIds.length > 0 && (
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.delete("categoryIds");
            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
          }}
          className="text-xs text-muted underline underline-offset-2 transition hover:text-foreground"
        >
          clear
        </button>
      )}
    </div>
  );
}
