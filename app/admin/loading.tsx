export default function AdminLoading() {
  return (
    <div className="flex-1 p-6 space-y-6" dir="rtl">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-surface-elevated rounded animate-pulse" />
        <div className="h-10 w-32 bg-surface-elevated rounded-button animate-pulse" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-card rounded-card border border-surface-border p-4 space-y-2">
            <div className="h-3 w-20 bg-surface-elevated rounded animate-pulse" />
            <div className="h-7 w-16 bg-surface-elevated rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-surface-card rounded-card border border-surface-border overflow-hidden">
        <div className="h-12 bg-surface-elevated border-b border-surface-border animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-surface-border/50">
            <div className="h-4 flex-1 bg-surface-elevated rounded animate-pulse" />
            <div className="h-4 w-24 bg-surface-elevated rounded animate-pulse" />
            <div className="h-4 w-16 bg-surface-elevated rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
