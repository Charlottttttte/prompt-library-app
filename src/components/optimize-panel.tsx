"use client";

import { useState } from "react";
import { acceptOptimizationAction } from "@/app/actions";
import { buttonStyles, inputStyles } from "./ui";

type Suggestion = {
  original: string;
  optimized: string;
  changes: string[];
  model: string;
};

type Props = { promptId: string };

export function OptimizePanel({ promptId }: Props) {
  const [instructions, setInstructions] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<{
    message: string;
    needsSetup: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const response = await fetch(`/api/prompts/${promptId}/optimize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          instructions.trim() ? { instructions: instructions.trim() } : {},
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        setError({
          message: data.error ?? "Optimization failed",
          needsSetup: Boolean(data.needsSetup),
        });
        return;
      }
      setSuggestion(data as Suggestion);
    } catch {
      setError({ message: "Couldn't reach the server", needsSetup: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">Optimize with AI</h2>
      <p className="mt-0.5 text-sm text-muted">
        Get a suggested rewrite. Nothing is saved until you accept it.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Optional: what to focus on, e.g. 'make it shorter'"
          aria-label="Optimization instructions"
          maxLength={500}
          className={inputStyles}
        />
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className={`${buttonStyles.primary} shrink-0`}
        >
          {loading ? "Optimizing…" : "Optimize"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {error.message}
          {error.needsSetup && (
            <p className="mt-1 font-mono text-xs opacity-80">
              OPENAI_API_KEY=sk-…
            </p>
          )}
        </div>
      )}

      {suggestion && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                Current
              </h3>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-muted">
                {suggestion.original}
              </pre>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
                Suggested
              </h3>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-accent bg-surface p-3 font-mono text-xs leading-relaxed">
                {suggestion.optimized}
              </pre>
            </div>
          </div>

          {suggestion.changes.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                What changed
              </h3>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-muted">
                {suggestion.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <form action={acceptOptimizationAction}>
              <input type="hidden" name="id" value={promptId} />
              <input
                type="hidden"
                name="content"
                value={suggestion.optimized}
              />
              <input type="hidden" name="model" value={suggestion.model} />
              <button type="submit" className={buttonStyles.primary}>
                Accept and save
              </button>
            </form>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className={buttonStyles.secondary}
            >
              Discard
            </button>
            <span className="text-xs text-muted">via {suggestion.model}</span>
          </div>
        </div>
      )}
    </section>
  );
}
