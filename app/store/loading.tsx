export default function StoreLoading() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#111114] text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 26%)",
      }}
    >
      <div className="h-24 animate-pulse border-b border-[#24242b] bg-[linear-gradient(180deg,#151519_0%,#101014_100%)]" />

      <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-6">
        <div className="mb-6 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
          <div className="mb-4 h-6 w-28 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-white/[0.05]" />
          <div className="mt-4 h-4 w-full animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-24 animate-pulse rounded-full border border-[#2f2f38] bg-white/[0.04]"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[26px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.22)]"
            >
              <div className="aspect-[4/4.2] animate-pulse rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_58%),#141419]" />
              <div className="mt-4 h-3 w-1/3 animate-pulse rounded-full bg-white/[0.05]" />
              <div className="mt-3 h-5 w-4/5 animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded-xl bg-white/[0.04]" />
              <div className="mt-4 h-10 w-full animate-pulse rounded-full bg-[#ff3351]/16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
