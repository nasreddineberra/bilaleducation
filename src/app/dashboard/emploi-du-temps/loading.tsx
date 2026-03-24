export default function EmploiDuTempsLoading() {
  return (
    <div className="h-full animate-fade-in space-y-4 p-4">
      {/* Barre de filtres */}
      <div className="card flex items-center gap-4 p-3">
        <div className="h-9 w-32 rounded-lg bg-warm-100 animate-pulse" />
        <div className="h-9 w-48 rounded-lg bg-warm-100 animate-pulse" />
        <div className="ml-auto h-9 w-40 rounded-lg bg-warm-100 animate-pulse" />
      </div>
      {/* Grille */}
      <div className="card flex-1 p-3">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-warm-50 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
