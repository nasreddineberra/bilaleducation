import RouteSkeleton from '@/components/ui/RouteSkeleton'

/**
 * Chargement À FROID du tableau de bord.
 *
 * Ce loader-ci s'affiche AVANT le layout : le temps que la session, le profil,
 * l'établissement et les compteurs répondent, il n'y a ni barre latérale ni
 * en-tête. D'où la silhouette du cadre, dessinée ici — sans elle, l'écran est nu
 * et la page semble repartir de zéro quand le cadre apparaît enfin.
 *
 * Le contenu, lui, est le MÊME squelette que celui de la page demandée
 * (`RouteSkeleton` lit la route) : les deux attentes successives se lisent alors
 * comme une seule montée en charge, et non comme deux redémarrages.
 *
 * En navigation interne, ce loader ne se voit pas : le layout est déjà rendu,
 * seul le squelette de la page s'affiche.
 */
export default function DashboardLoading() {
  return (
    <div className="h-screen overflow-hidden bg-[var(--surface-page)] flex" aria-hidden="true">

      {/* Barre latérale : mêmes largeur et fond que la vraie, pour qu'elle ne
          bouge pas d'un pixel au moment de la relève. */}
      <div className="w-64 shrink-0 flex flex-col gap-4 p-4" style={{ background: 'var(--brand-surface)' }}>
        <div className="h-9 rounded-xl bg-white/10 animate-pulse" />
        <div className="space-y-2 mt-2">
          {Array.from({ length: 5 }).map((_, section) => (
            <div key={section} className="space-y-1.5">
              <div className="h-2 w-20 rounded bg-white/10 animate-pulse" style={{ animationDelay: `${section * 80}ms` }} />
              {Array.from({ length: 3 }).map((_, item) => (
                <div
                  key={item}
                  className="h-7 rounded-lg bg-white/[0.07] animate-pulse"
                  style={{ animationDelay: `${section * 80 + item * 40}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* En-tête : hauteur exacte du vrai (61 px), sinon le contenu sursaute. */}
        <div className="h-[61px] shrink-0 bg-white border-b border-warm-200 flex items-center gap-3 px-6">
          <div className="h-3 w-40 rounded bg-warm-100 animate-pulse" />
          <div className="ml-auto flex items-center gap-2">
            <div className="h-8 w-16 rounded-lg bg-warm-100 animate-pulse" />
            <div className="h-8 w-8 rounded-lg bg-warm-100 animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-warm-100 animate-pulse" />
          </div>
        </div>

        {/* Mêmes marges que `<main>` : le squelette occupe la place du contenu. */}
        <div className="flex-1 px-8 pt-5 pb-4 overflow-hidden">
          <RouteSkeleton />
        </div>
      </div>
    </div>
  )
}
