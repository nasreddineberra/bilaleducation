import { formatDateFr } from '@/lib/dates'

/**
 * Colonne « Console éditeur » de la fiche école : ce que l'éditeur a fait chez ce
 * client. Pour l'instant les interventions de support (`support_interventions`,
 * table serveur uniquement : l'école ne la voit pas et ne peut pas la purger).
 *
 * Bornée en hauteur (`.list-scroll`) : la fiche ne doit jamais défiler.
 */
export interface Intervention {
  id: string
  super_admin_email: string | null
  opened_at: string
  closed_at: string | null
  closed_reason: string | null
}

const heure = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

// Valeurs stockees -> libelles : on n'affiche jamais un identifiant de base.
const MOTIF: Record<string, string> = { manuelle: 'sortie manuelle', expiration: 'expirée (4 h)' }

function duree(debut: string, fin: string): string {
  const min = Math.max(0, Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 60000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

export default function ConsoleEditeur({ interventions }: { interventions: Intervention[] }) {
  return (
    <div className="card p-3 space-y-2">
      <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Console éditeur</h2>

      <div className="flex items-center justify-between">
        <h3 className="stat-label">Interventions de support</h3>
        <span className="text-xs text-warm-700 tabular-nums">{interventions.length}</span>
      </div>

      {interventions.length === 0 ? (
        <p className="text-xs text-warm-700">Aucune intervention.</p>
      ) : (
        <ul className="max-h-[32rem] overflow-y-auto list-scroll divide-y divide-warm-50 border border-warm-100 rounded-lg">
          {interventions.map(i => (
            <li key={i.id} className="px-3 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-secondary-800 whitespace-nowrap">
                  {formatDateFr(i.opened_at)} · {heure(i.opened_at)}
                </span>
                {i.closed_at
                  ? <span className="text-warm-700 whitespace-nowrap tabular-nums">{duree(i.opened_at, i.closed_at)}</span>
                  : <span className="text-amber-700 font-semibold whitespace-nowrap">En cours</span>}
              </div>
              <div className="text-warm-700 truncate">
                {i.super_admin_email ?? '·'}
                {i.closed_reason ? ` · ${MOTIF[i.closed_reason] ?? ''}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
