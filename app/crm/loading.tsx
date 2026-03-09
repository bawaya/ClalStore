export default function CRMLoading() {
  return (
    <div className="flex-1 p-6 space-y-6" dir="rtl">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-surface-elevated rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-surface-elevated rounded animate-pulse" />
          <div className="h-8 w-24 bg-surface-elevated rounded animate-pulse" />
        </div>
      </div>

      {/* Alert cards skeleton */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-card rounded-card border border-surface-border p-4 min-w-[160px] space-y-2">
            <div className="h-3 w-16 bg-surface-elevated rounded animate-pulse" />
            <div className="h-6 w-10 bg-surface-elevated rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
        <div className="bg-surface-card rounded-card border border-surface-border p-4 space-y-3">
          <div className="h-5 w-32 bg-surface-elevated rounded animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-elevated animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-3/4 bg-surface-elevated rounded animate-pulse" />
                <div className="h-2 w-1/2 bg-surface-elevated rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-surface-card rounded-card border border-surface-border p-4 space-y-3">
          <div className="h-5 w-32 bg-surface-elevated rounded animate-pulse" />
          <div className="h-48 bg-surface-elevated rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
