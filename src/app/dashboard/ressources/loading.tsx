export default function Loading() {
  return (
    <div className="h-full overflow-y-auto animate-fade-in p-4">
      <div className="h-6 w-40 bg-warm-200 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <div key={i} className="space-y-3">
            <div className="h-5 w-32 bg-warm-200 rounded animate-pulse" />
            <div className="h-8 bg-warm-100 rounded-lg animate-pulse" />
            {[0, 1, 2].map(j => (
              <div key={j} className="h-14 bg-warm-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
