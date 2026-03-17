export function SkeletonCard() {
  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-white animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
        </div>
        <div className="flex-1 flex flex-col items-center space-y-2">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-px w-32 bg-gray-200" />
          <div className="h-3 w-14 bg-gray-200 rounded" />
        </div>
        <div className="flex flex-col items-end space-y-2">
          <div className="h-7 w-16 bg-gray-200 rounded" />
          <div className="h-3 w-10 bg-gray-200 rounded" />
          <div className="h-6 w-16 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonResults() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
