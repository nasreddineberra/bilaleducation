'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { formatDateFr } from '@/lib/dates'
import { INTERVENTION_MAX_HEURES } from '@/lib/support/duree'
import { FloatButton } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/lib/toast-context'
import { compterPurgeHistorique, purgerHistorique } from '@/app/superadmin/historique-actions'

/**
 * Colonne « Console éditeur » de la fiche école : ce que l'éditeur a fait chez ce
 * client. Deux listes, toutes deux en tables serveur uniquement (l'école ne les
 * voit pas et ne peut pas les purger) :
 *   · Actions : `actions_editeur`, alimentée par chaque action de la console ;
 *   · Interventions de support : `support_interventions`.
 *
 * La colonne s'étire sur la hauteur de la colonne de gauche (voir la page) ; les
 * deux listes se partagent cette hauteur et DÉFILENT chacune à l'intérieur : la
 * fiche ne doit jamais défiler.
 */
export interface Intervention {
  id: string
  super_admin_email: string | null
  opened_at: string
  closed_at: string | null
  closed_reason: string | null
}

export interface ActionEditeur {
  id: string
  super_admin_email: string | null
  description: string
  est_purge: boolean
  created_at: string
}

const heure = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

// Valeurs stockees -> libelles : on n'affiche jamais un identifiant de base.
const MOTIF: Record<string, string> = { manuelle: 'sortie manuelle', expiration: 'expirée' }

// Au-dela de la duree maximale (+ 10 min de marge pour la tache planifiee, qui
// passe toutes les 5 min), l'acces est reste ouvert trop longtemps : signale.
const depasse = (debut: string, fin: string) =>
  new Date(fin).getTime() - new Date(debut).getTime() > (INTERVENTION_MAX_HEURES * 60 + 10) * 60000

function duree(debut: string, fin: string): string {
  const min = Math.max(0, Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 60000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

const LIBELLE_PERIODE: Record<number, string> = { 1: "Plus d'1 mois", 6: 'Plus de 6 mois', 12: 'Plus de 12 mois' }

export default function ConsoleEditeur({ etablissementId, actions, interventions }: {
  etablissementId: string
  actions: ActionEditeur[]
  interventions: Intervention[]
}) {
  const router = useRouter()
  const toast = useToast()

  const [ouverte, setOuverte] = useState(false)
  const [comptes, setComptes] = useState<{ mois: number; actions: number; interventions: number }[] | null>(null)
  const [choix, setChoix] = useState<number | null>(null)
  const [aConfirmer, setAConfirmer] = useState(false)
  const [enCours, setEnCours] = useState(false)

  const ouvrirPurge = async () => {
    setChoix(null)
    setComptes(null)
    setOuverte(true)
    const r = await compterPurgeHistorique(etablissementId)
    if (r.error || !r.comptes) { toast.error(r.error ?? 'Comptage impossible.'); setOuverte(false); return }
    setComptes(r.comptes)
  }

  const selection = comptes?.find(c => c.mois === choix) ?? null

  const purger = async () => {
    if (!choix) return
    setEnCours(true)
    const r = await purgerHistorique(etablissementId, choix)
    setEnCours(false)
    setAConfirmer(false)
    if (r.error) { toast.error(r.error); return }
    setOuverte(false)
    toast.success(`Historique purgé : ${r.actions} action(s), ${r.interventions} intervention(s).`)
    router.refresh()
  }

  return (
    <div className="card p-3 flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Console éditeur</h2>
        <FloatButton type="button" size="mini" variant="secondary" onClick={ouvrirPurge}>Purger</FloatButton>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between">
        <h3 className="stat-label">Actions</h3>
        <span className="text-xs text-warm-700 tabular-nums">{actions.length}</span>
      </div>
      {actions.length === 0 ? (
        <p className="text-xs text-warm-700">Aucune action.</p>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto list-scroll divide-y divide-warm-50 border border-warm-100 rounded-lg">
          {actions.map(a => (
            <li key={a.id} className="px-3 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-secondary-800 whitespace-nowrap">{formatDateFr(a.created_at)} · {heure(a.created_at)}</span>
                <span className="text-warm-700 truncate">{a.super_admin_email ?? '·'}</span>
              </div>
              <div className={clsx(a.est_purge ? 'text-amber-700 font-semibold' : 'text-secondary-700')}>{a.description}</div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Interventions de support ── */}
      <div className="flex items-center justify-between pt-1">
        <h3 className="stat-label">Interventions de support</h3>
        <span className="text-xs text-warm-700 tabular-nums">{interventions.length}</span>
      </div>
      {interventions.length === 0 ? (
        <p className="text-xs text-warm-700">Aucune intervention.</p>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto list-scroll divide-y divide-warm-50 border border-warm-100 rounded-lg">
          {interventions.map(i => (
            <li key={i.id} className="px-3 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-secondary-800 whitespace-nowrap">
                  {formatDateFr(i.opened_at)} · {heure(i.opened_at)}
                </span>
                {i.closed_at
                  ? <span className={clsx('whitespace-nowrap tabular-nums', depasse(i.opened_at, i.closed_at) ? 'text-amber-700 font-semibold' : 'text-warm-700')}>{duree(i.opened_at, i.closed_at)}</span>
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

      {ouverte && (
        <FormModal
          title="Purger l'historique"
          onClose={() => setOuverte(false)}
          footer={
            <>
              <FloatButton type="button" variant="secondary" onClick={() => setOuverte(false)}>Annuler</FloatButton>
              <FloatButton
                type="button"
                variant="danger"
                disabled={!selection || selection.actions + selection.interventions === 0}
                onClick={() => setAConfirmer(true)}
              >
                Purger
              </FloatButton>
            </>
          }
        >
          {!comptes ? (
            <p className="text-sm text-warm-700">Comptage en cours…</p>
          ) : (
            <div role="radiogroup" aria-label="Période à purger" className="space-y-2">
              {comptes.map(c => (
                <label
                  key={c.mois}
                  className={clsx(
                    'flex items-center justify-between gap-3 px-3 py-2 rounded-lg border cursor-pointer text-sm',
                    choix === c.mois ? 'border-[var(--brand-line)] bg-[var(--brand-tint)]' : 'border-warm-200 hover:bg-warm-50',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="periode" checked={choix === c.mois} onChange={() => setChoix(c.mois)} />
                    {LIBELLE_PERIODE[c.mois]}
                  </span>
                  <span className="text-xs text-warm-700 tabular-nums">
                    {c.actions} action{c.actions > 1 ? 's' : ''} · {c.interventions} intervention{c.interventions > 1 ? 's' : ''}
                  </span>
                </label>
              ))}
            </div>
          )}
        </FormModal>
      )}

      {aConfirmer && selection && (
        <ConfirmModal
          title="Confirmer la purge"
          variant="danger"
          confirmLabel="Purger"
          confirmDisabled={enCours}
          message={`Supprimer définitivement ${selection.actions} action(s) et ${selection.interventions} intervention(s) de ${LIBELLE_PERIODE[selection.mois].toLowerCase()} ? Les interventions en cours et les traces des purges précédentes sont conservées. Cette purge sera inscrite à l'historique.`}
          onConfirm={purger}
          onCancel={() => setAConfirmer(false)}
        />
      )}
    </div>
  )
}
