// Composant skeleton réutilisable pour les pages à tableau

function SkeletonLine({ width = 'w-full', height = 'h-3' }: { width?: string; height?: string }) {
  return (
    <div className={`${height} ${width} rounded bg-warm-100 animate-pulse`} />
  )
}

// Skeleton pour une page liste avec stats + barre de recherche + tableau
export function SkeletonListPage({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Stat cards */}
      <div className="flex items-center gap-3 flex-wrap">
        {[80, 60, 72].map((w, i) => (
          <div key={i} className="card px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-10 rounded bg-warm-100 animate-pulse" />
            <div className={`h-3 w-${w === 80 ? '16' : w === 60 ? '12' : '14'} rounded bg-warm-100 animate-pulse`} />
          </div>
        ))}
        <div className="flex-1" />
        {/* Barre recherche */}
        <div className="h-9 w-64 rounded-xl bg-warm-100 animate-pulse" />
        {/* Bouton ajout */}
        <div className="h-9 w-36 rounded-xl bg-warm-100 animate-pulse" />
      </div>

      {/* Tableau */}
      <div className="card p-0 overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-warm-100">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="flex-1 h-3 rounded bg-warm-100 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        {/* Lignes */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex items-center gap-4 px-4 py-3 border-b border-warm-50 last:border-0"
            style={{ animationDelay: `${rowIdx * 40}ms` }}
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-warm-100 animate-pulse flex-shrink-0" />
            {/* Colonnes */}
            {Array.from({ length: cols - 1 }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="flex-1 h-3 rounded bg-warm-100 animate-pulse"
                style={{
                  maxWidth: colIdx === 0 ? '200px' : colIdx === cols - 2 ? '80px' : '140px',
                  animationDelay: `${rowIdx * 40 + colIdx * 30}ms`,
                }}
              />
            ))}
            {/* Actions */}
            <div className="flex gap-1 ml-auto">
              <div className="w-7 h-7 rounded-lg bg-warm-100 animate-pulse" />
              <div className="w-7 h-7 rounded-lg bg-warm-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Skeleton pour une page fiche (formulaire)
export function SkeletonFormPage({ sections = 2 }: { sections?: number }) {
  return (
    <div className="space-y-4 max-w-2xl animate-fade-in">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="card p-4 space-y-4">
          <div className="h-3 w-32 rounded bg-warm-100 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, f) => (
              <div key={f} className="space-y-1.5">
                <div className="h-2.5 w-20 rounded bg-warm-100 animate-pulse" />
                <div className="h-9 w-full rounded-xl bg-warm-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-1">
        <div className="h-9 w-24 rounded-xl bg-warm-100 animate-pulse" />
        <div className="h-9 w-32 rounded-xl bg-warm-100 animate-pulse" />
      </div>
    </div>
  )
}

// Spinner simple (conservé pour compatibilité)
export default function SkeletonTable({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return <SkeletonListPage rows={rows} cols={cols} />
}
