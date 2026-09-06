export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading prompts">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded bg-surface" />
        <div className="h-4 w-24 animate-pulse rounded bg-surface" />
      </div>
      <div className="h-10 animate-pulse rounded-md bg-surface" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
