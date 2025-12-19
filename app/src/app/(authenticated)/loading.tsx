export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-[var(--bg-surface)] rounded" />
        <div className="h-4 w-72 bg-[var(--bg-surface)] rounded" />
      </div>

      {/* Content skeleton */}
      <div className="grid gap-4">
        <div className="h-32 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]" />
        <div className="h-64 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]" />
      </div>
    </div>
  );
}
