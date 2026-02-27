export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      {/* Header skeleton */}
      <div className="px-4 pt-6 pb-2">
        <div className="h-7 w-36 bg-surface-raised rounded" />
        <div className="mt-2 h-4 w-52 bg-surface-raised rounded" />
      </div>

      {/* Search bar skeleton */}
      <div className="px-4 pt-4 pb-3">
        <div className="h-12 w-full bg-surface-raised rounded-xl" />
      </div>

      {/* Song card skeletons */}
      <div className="px-4 flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl bg-surface-raised px-4 py-3 min-h-[60px]"
          >
            <div className="flex-1">
              <div className="h-5 w-40 bg-surface-hover rounded" />
              <div className="mt-1.5 h-3.5 w-24 bg-surface-hover rounded" />
            </div>
            <div className="w-10 h-10 flex items-center justify-center">
              <div className="w-5 h-5 bg-surface-hover rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
