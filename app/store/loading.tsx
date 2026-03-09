export default function StoreLoading() {
  return (
    <div className="bg-surface-bg min-h-screen" dir="rtl">
      {/* Header skeleton */}
      <div className="h-16 bg-surface-card border-b border-surface-border animate-pulse" />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Hero skeleton */}
        <div className="h-64 bg-surface-elevated rounded-card animate-pulse mb-8" />

        {/* Filter bar skeleton */}
        <div className="flex gap-3 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-20 bg-surface-elevated rounded-chip animate-pulse" />
          ))}
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface-card rounded-card border border-surface-border p-3 space-y-3">
              <div className="aspect-square bg-surface-elevated rounded-lg animate-pulse" />
              <div className="h-4 bg-surface-elevated rounded animate-pulse w-3/4" />
              <div className="h-3 bg-surface-elevated rounded animate-pulse w-1/2" />
              <div className="h-8 bg-surface-elevated rounded-button animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
