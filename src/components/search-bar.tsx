"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { inputStyles } from "./ui";

export function SearchBar({ initialQuery }: { initialQuery: string }) {
  const [value, setValue] = useState(initialQuery);
  const [syncedQuery, setSyncedQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // When the query changes from elsewhere — the back button, or a "clear
  // filters" link — adopt it. Adjusting state during render is React's
  // recommended way to do this; an effect here would cause a cascading render.
  if (initialQuery !== syncedQuery) {
    setSyncedQuery(initialQuery);
    setValue(initialQuery);
  }

  useEffect(() => {
    if (value === initialQuery) return;

    // Debounce so a burst of keystrokes issues one query, not one per letter.
    const timeout = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [value, initialQuery, params, pathname, router]);

  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search prompts by title or content…"
        aria-label="Search prompts"
        className={inputStyles}
      />
      {isPending && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
          searching…
        </span>
      )}
    </div>
  );
}
