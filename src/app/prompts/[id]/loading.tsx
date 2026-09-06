export default function Loading() {
  return (
    <div
      className="max-w-3xl space-y-6"
      aria-busy="true"
      aria-label="Loading prompt"
    >
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-surface" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-surface" />
        <div className="h-3 w-40 animate-pulse rounded bg-surface" />
      </div>
      <div className="h-9 w-56 animate-pulse rounded-md bg-surface" />
      <div className="h-48 animate-pulse rounded-lg border border-border bg-surface" />
    </div>
  );
}
