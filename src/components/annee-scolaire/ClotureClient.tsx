'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clsx } from 'clsx'
import { CheckCircle2, Lock, Circle, X } from 'lucide-react'
import { FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { CLOSURE_STEPS } from '@/lib/closure/steps'
import { startClosure, closeStep, reopenStep, runAudit } from '@/app/dashboard/annee-scolaire/cloture/actions'

interface StepRow {
  id: string
  step_key: string
  order_index: number
  status: 'pending' | 'warnings' | 'closed'
  anomalies_count: number
  recap_json: any
}

interface Props {
  yearLabel: string | null
  closure: { id: string; status: 'in_progress' | 'closed' } | null
  steps: StepRow[]
}

export default function ClotureClient({ yearLabel, closure, steps }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmStart, setConfirmStart] = useState(false)
  const [openDetail, setOpenDetail] = useState<string | null>(null) // détail affiché en modale (fermeture par X uniquement)

  const run = async (key: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(key); setError(null)
    try {
      const res = await fn()
      if (res?.error) { setError(res.error); return }
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue pendant le traitement.')
    } finally {
      setBusy(null) // toujours réinitialisé → l'interface ne reste jamais bloquée
    }
  }

  // ── Aucune année en cours ──────────────────────────────────────────────────
  if (!yearLabel) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-warm-700">Aucune année scolaire en cours. Définissez l’année en cours avant de lancer une clôture.</p>
      </div>
    )
  }

  // ── Clôture pas encore démarrée ────────────────────────────────────────────
  if (!closure) {
    return (
      <div className="card p-6 space-y-3 max-w-2xl">
        <h2 className="text-base font-bold text-secondary-800">Clôture de l’année {yearLabel}</h2>
        <p className="text-sm text-warm-700">
          L’assistant vous guide, étape par étape, dans la vérification des données avant de clôturer l’année et d’archiver
          les données des participants. Chaque étape s’audite et se clôture ; on ne passe à la suivante qu’une fois la
          précédente clôturée.
        </p>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <FloatButton type="button" variant="submit" loading={busy === 'start'} disabled={busy !== null} onClick={() => { setError(null); setConfirmStart(true) }}>
          {busy === 'start' ? 'Démarrage…' : `Démarrer la clôture de ${yearLabel}`}
        </FloatButton>

        {confirmStart && (
          <ConfirmModal
            title={`Démarrer la clôture de ${yearLabel}`}
            confirmLabel="Démarrer la clôture"
            cancelLabel="Annuler"
            confirmVariant="submit"
            onCancel={() => setConfirmStart(false)}
            onConfirm={() => { setConfirmStart(false); run('start', startClosure) }}
          >
            <div className="space-y-2 text-left">
              <p className="text-xs text-warm-700">
                La procédure vérifie vos données <strong>module par module</strong>. Chaque étape s’audite puis se
                clôture ; on ne passe à la suivante qu’une fois la précédente clôturée. Voici ce que vérifie chaque audit :
              </p>
              <ol className="space-y-1.5 list-decimal pl-4 max-h-[45vh] overflow-y-auto list-scroll pr-1">
                {CLOSURE_STEPS.map(s => (
                  <li key={s.key}>
                    <span className="text-xs font-semibold text-secondary-800">{s.label}</span>
                    {s.blocking
                      ? <span className="ml-1.5 text-[9px] font-bold uppercase bg-secondary-100 text-secondary-700 px-1 py-0.5 rounded">bloquant</span>
                      : <span className="ml-1.5 text-[9px] font-bold uppercase bg-warm-100 text-warm-700 px-1 py-0.5 rounded">avertissement</span>}
                    <p className="text-[11px] text-warm-700 mt-0.5">{s.description}</p>
                  </li>
                ))}
              </ol>
              <p className="text-[11px] text-warm-700">
                Les étapes <strong>bloquantes</strong> exigent zéro anomalie ; les <strong>avertissements</strong> sont
                acquittables. À la fin, les données des participants seront <strong>archivées</strong> (historique année après année).
              </p>
            </div>
          </ConfirmModal>
        )}
      </div>
    )
  }

  // ── Stepper ────────────────────────────────────────────────────────────────
  const byKey = new Map(steps.map(s => [s.step_key, s]))
  const rows = CLOSURE_STEPS.map(def => ({ def, row: byKey.get(def.key) }))
  const closedCount = steps.filter(s => s.status === 'closed').length
  const allClosed = closure.status === 'closed'

  // Détail affiché en modale.
  const detailRow = openDetail ? rows.find(r => r.def.key === openDetail) : null
  const detailItems: any[] = detailRow?.row?.recap_json?.items ?? []

  return (
    <div className="space-y-3">
      {/* Bandeau */}
      <div className="card p-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-secondary-800">Clôture de l’année {yearLabel}</h2>
          <p className="text-xs text-warm-700 mt-0.5">
            {closedCount}/{CLOSURE_STEPS.length} étapes clôturées · statut {allClosed ? 'année clôturée' : 'en cours'}
          </p>
        </div>
        <div className="w-40 h-2 rounded-full bg-warm-100 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${(closedCount / CLOSURE_STEPS.length) * 100}%` }} />
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-red-600 px-1">{error}</p>}

      {/* Étapes */}
      <ol className="space-y-2">
        {rows.map(({ def, row }, i) => {
          const status = row?.status ?? 'pending'
          const isClosed = status === 'closed'
          const prevClosed = i === 0 || rows[i - 1].row?.status === 'closed'
          const locked = !prevClosed && !isClosed

          const recap = row?.recap_json?.auditedAt ? row.recap_json : null
          const audited = !!recap
          const anomalies = row?.anomalies_count ?? 0
          const items: any[] = recap?.items ?? []
          const auditKey = `audit-${def.key}`
          const blockingLeft = def.blocking && anomalies > 0

          // Clôture : audit requis ; les anomalies bloquantes empêchent la clôture.
          const closeDisabled = locked || busy !== null || !audited || blockingLeft
          const closeReason = !audited ? 'Lancez l’audit avant de clôturer.'
            : blockingLeft ? `Résolvez les ${anomalies} anomalie(s) bloquante(s) avant de clôturer.`
            : null
          const closeLabel = anomalies > 0 && !def.blocking ? `Clôturer (${anomalies} avert.)` : 'Clôturer l’étape'

          return (
            <li key={def.key} className={clsx('card p-3', locked && 'opacity-60')}>
              <div className="flex items-start gap-3">
                {/* Pastille statut */}
                <div className="mt-0.5 flex-shrink-0">
                  {isClosed
                    ? <CheckCircle2 size={18} className="text-primary-600" />
                    : locked
                      ? <Lock size={16} className="text-warm-700" />
                      : <Circle size={16} className="text-amber-500" />}
                </div>

                {/* Contenu */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-warm-700 tabular-nums">{def.order}.</span>
                    <span className="text-sm font-bold text-secondary-800">{def.label}</span>
                    {def.blocking
                      ? <span className="text-[10px] font-bold uppercase bg-secondary-100 text-secondary-700 px-1.5 py-0.5 rounded">Bloquant</span>
                      : <span className="text-[10px] font-bold uppercase bg-warm-100 text-warm-700 px-1.5 py-0.5 rounded">Avertissement</span>}
                    {isClosed && <span className="text-[10px] font-bold uppercase bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">Clôturée</span>}
                    {audited && !isClosed && anomalies > 0 && (
                      <span className={clsx('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', def.blocking ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}>
                        {anomalies} anomalie{anomalies > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-warm-700 mt-0.5">{def.description}</p>

                  {/* Récap d'audit */}
                  {audited ? (
                    <div className="mt-1.5">
                      <p className={clsx('text-[11px] font-medium', anomalies === 0 ? 'text-primary-700' : def.blocking ? 'text-red-600' : 'text-orange-700')}>
                        {recap.summary}
                      </p>
                      {items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenDetail(def.key)}
                          className="mt-1 text-[11px] text-primary-600 cursor-pointer hover:text-primary-700 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
                        >
                          Voir le détail{recap.anomalies > items.length ? ` (${items.length} sur ${recap.anomalies})` : ` (${items.length})`}
                        </button>
                      )}
                    </div>
                  ) : (!locked && !isClosed && (
                    <p className="text-[11px] text-warm-700 italic mt-1">Lancez l’audit pour vérifier cette étape.</p>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {!isClosed && (
                    <FloatButton type="button" variant="secondary" loading={busy === auditKey} disabled={locked || busy !== null}
                      onClick={() => run(auditKey, () => runAudit(closure.id, def.key))} className="!py-1.5 text-xs">
                      {busy === auditKey ? 'Audit…' : audited ? 'Réauditer' : 'Auditer'}
                    </FloatButton>
                  )}
                  {isClosed ? (
                    <FloatButton type="button" variant="secondary" loading={busy === def.key} disabled={busy !== null}
                      onClick={() => run(def.key, () => reopenStep(closure.id, def.key))} className="!py-1.5 text-xs">
                      Rouvrir
                    </FloatButton>
                  ) : closeReason ? (
                    <Tooltip content={closeReason}>
                      <span><FloatButton type="button" variant="submit" disabled className="!py-1.5 text-xs">{closeLabel}</FloatButton></span>
                    </Tooltip>
                  ) : (
                    <FloatButton type="button" variant="submit" loading={busy === def.key} disabled={busy !== null}
                      onClick={() => run(def.key, () => closeStep(closure.id, def.key))} className="!py-1.5 text-xs">
                      {closeLabel}
                    </FloatButton>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Fin : prêt à archiver (Phase 3) */}
      {allClosed && (
        <div className="card p-4 flex items-center justify-between border-primary-200 bg-primary-50/40">
          <div>
            <h3 className="text-sm font-bold text-secondary-800">Toutes les étapes sont clôturées</h3>
            <p className="text-xs text-warm-700 mt-0.5">L’archivage des données (Phase 3) sera disponible ici.</p>
          </div>
          <Tooltip content="Archivage disponible en Phase 3.">
            <span><FloatButton type="button" variant="submit" disabled>Archiver l’année</FloatButton></span>
          </Tooltip>
        </div>
      )}

      {/* Modale de détail des anomalies (portée dans <body> pour éviter d'allonger la page) */}
      {openDetail && detailRow && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40">
          <div role="dialog" aria-modal="true" aria-label={`Détail — ${detailRow.def.label}`}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
            <div className="px-5 py-3 border-b border-warm-100 flex items-start justify-between gap-3 flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-secondary-800">{detailRow.def.label}</h3>
                <p className="text-xs text-warm-700 mt-0.5">{detailRow.row?.recap_json?.summary}</p>
              </div>
              <button type="button" onClick={() => setOpenDetail(null)} aria-label="Fermer"
                className="p-1 rounded-lg hover:bg-warm-100 text-warm-700 flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                <X size={16} />
              </button>
            </div>
            <ul className="p-4 space-y-1 overflow-y-auto list-scroll min-h-0">
              {detailItems.map((it: any, j: number) => (
                <li key={j} className="text-xs text-warm-700 flex items-center gap-2">
                  {it.classInfo && !it.className
                    ? <Tooltip content={it.classInfo} maxWidth="max-w-none">
                        <span className="font-medium text-secondary-800 flex-shrink-0 cursor-help underline decoration-dotted decoration-warm-300 underline-offset-2">{it.label}</span>
                      </Tooltip>
                    : <span className="font-medium text-secondary-800 flex-shrink-0">{it.label}</span>}
                  {it.className && (it.classInfo
                    ? <Tooltip content={it.classInfo} maxWidth="max-w-none">
                        <span className="flex-shrink-0 cursor-help underline decoration-dotted decoration-warm-300 underline-offset-2">{it.className}</span>
                      </Tooltip>
                    : <span className="flex-shrink-0">{it.className}</span>)}
                  {it.detail && <span className="text-warm-700 truncate">· {it.detail}</span>}
                  {it.href && <Link href={it.href} className="ml-auto text-primary-600 hover:text-primary-700 flex-shrink-0">corriger</Link>}
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
