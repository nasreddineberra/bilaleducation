'use client'

import { useState, useCallback, useEffect, useId, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Pencil, Trash2, X, FileText, Upload, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FloatButton, FloatInput, FloatSelect, FloatTextarea } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Tooltip from '@/components/ui/Tooltip'

/** 1re lettre en majuscule a la volee (meme motif que le referentiel des cours). */
const capFirst = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v)

// ─── Repartition par categorie / source ──────────────────────────────────────
// Degrades d'UNE SEULE teinte, ordonnes par montant (le plus gros = le plus
// fonce). Pourquoi pas des couleurs categorielles : elles doivent suivre
// l'ENTITE, jamais son rang — « Loyer » changerait de couleur le jour ou
// « Charges » le depasse. Un degrade ordinal est coherent par construction.
// Valides par scripts/validate_palette.js --ordinal (surface #ffffff) :
// L monotone, ecarts >= 0.06, bout clair >= 2:1, teinte unique.
const RAMP_EXPENSE = ['#7f1d1d', '#b91c1c', '#dc2626', '#f87171']   // rouge : sortie
const RAMP_REVENUE = ['#0a504a', '#0e6b61', '#12887a', '#2ec4ba']   // turquoise : entree
const COLOR_OTHER  = '#d0c6ba'                                       // warm-300 : reliquat, pas une magnitude

const TOP_N = 4   // au-dela, on replie sur « Autres » (plafond de lisibilite)

interface Slice { label: string; amount: number; pct: number; color: string }

/** Top N par montant + « Autres ». Les couleurs suivent le rang DANS le degrade,
 *  ce qui est le propre d'une echelle ordinale (et non d'une identite). */
function buildSlices(rows: { key: string | null; amount: number }[], ramp: string[]): Slice[] {
  const byKey: Record<string, number> = {}
  for (const r of rows) {
    const k = r.key?.trim() || 'Non catégorisé'
    byKey[k] = (byKey[k] ?? 0) + Number(r.amount)
  }
  const total = Object.values(byKey).reduce((s, v) => s + v, 0)
  if (total <= 0) return []

  const sorted = Object.entries(byKey)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)

  const head = sorted.slice(0, TOP_N)
  const rest = sorted.slice(TOP_N).reduce((s, d) => s + d.amount, 0)

  const slices: Slice[] = head.map((d, i) => ({
    ...d, pct: (d.amount / total) * 100, color: ramp[i] ?? ramp[ramp.length - 1],
  }))
  if (rest > 0) slices.push({ label: 'Autres', amount: rest, pct: (rest / total) * 100, color: COLOR_OTHER })
  return slices
}

/** Barre empilee 100 % (5 px) + legende avec %. L'identite n'est jamais portee
 *  par la couleur seule : chaque part est nommee dans la legende. */
function Breakdown({ slices, ariaLabel }: { slices: Slice[]; ariaLabel: string }) {
  if (slices.length === 0) return null
  return (
    <div className="px-2 pb-1.5 pt-1">
      <div className="flex h-[5px] w-full rounded-full overflow-hidden gap-[2px]" role="img" aria-label={ariaLabel}>
        {slices.map(s => (
          <Tooltip key={s.label} content={`${s.label} · ${fmt(s.amount)} · ${Math.round(s.pct)} %`}>
            <span className="block h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${s.pct}%`, background: s.color }} />
          </Tooltip>
        ))}
      </div>
      {/* Libelles en MAJUSCULES via CSS : la donnee reste intacte en base. */}
      <ul className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
        {slices.map(s => (
          <li key={s.label} className="flex items-center gap-1 text-[9px] font-semibold text-warm-700 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: s.color }} aria-hidden="true" />
            {s.label} <span className="tabular-nums">{Math.round(s.pct)} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const BUCKET = 'documents-expenses'
const MAX_DOC_BYTES = 2 * 1024 * 1024   // 2 Mo — aligne sur le bucket (garde serveur)
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

/** Le bucket est PRIVE : on signe le chemin a la consultation (60 s). */
async function openDocument(supabase: ReturnType<typeof createClient>, path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}

/** Coque de modale de saisie, partagee par Depense et Revenu.
 *
 *  Fermeture par X / Annuler / Echap UNIQUEMENT : pas de clic sur le fond, qui
 *  ferait perdre la saisie d'un coup de souris malheureux (meme regle que le
 *  cahier de texte et la saisie de temps de presence).
 *
 *  Portee dans <body> : `animate-fade-in` garde un `transform`, qui deviendrait
 *  le bloc conteneur du `position: fixed` et rognerait la modale. */
function FormModal({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode
}) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100 shrink-0">
          <h2 id={titleId} className="text-base font-bold text-secondary-800">{title}</h2>
          <button
            type="button" onClick={onClose} aria-label="Fermer"
            className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto min-h-0">{children}</div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-warm-100 shrink-0">{footer}</div>
      </div>
    </div>,
    document.body
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string
  expense_date: string
  label: string
  amount: number
  category: string | null
  /** Chemin dans le bucket PRIVE ({etablissement_id}/...) : jamais une URL
   *  publique — le justificatif serait lisible sans authentification. */
  document_path: string | null
  notes: string | null
}

interface Revenue {
  id: string
  revenue_date: string
  label: string
  amount: number
  source_type: string | null
  notes: string | null
}

interface Props {
  yearLabel: string
  schoolYearId: string
  cotisations: {
    totalDue: number
    totalPaid: number
    remaining: number
    familyCount: number
    collectRate: number
  }
  teachingCosts: {
    total: number
    byMonth: { month: string; cost: number }[]
    /** Repartition par type de presence (libelle lisible, pas le code). */
    byType: { label: string; cost: number }[]
    /** Types de presence sans taux : leurs heures ne sont PAS valorisees. */
    unratedTypes: { code: string; hours: number }[]
  }
  initialExpenses: Expense[]
  totalExpenses: number
  initialRevenues: Revenue[]
  totalRevenues: number
}

function fmt(n: number): string {
  // 2 decimales obligatoires partout (regle projet).
  return n.toLocaleString('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR')
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-')
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  return `${months[parseInt(mo) - 1]} ${y}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SyntheseClient({
  yearLabel, schoolYearId, cotisations, teachingCosts,
  initialExpenses, totalExpenses: initTotalExp,
  initialRevenues, totalRevenues: initTotalRev,
}: Props) {
  const supabase = createClient()

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [revenues, setRevenues] = useState<Revenue[]>(initialRevenues)
  const [expenseModal, setExpenseModal] = useState<Expense | 'new' | null>(null)
  const [revenueModal, setRevenueModal] = useState<Revenue | 'new' | null>(null)
  // Cible de suppression : porte la ligne entiere (et non un « etape » global,
  // qui armait une ligne puis supprimait la SUIVANTE sans confirmation).
  const [deleteTarget, setDeleteTarget] = useState<
    { type: 'expense'; row: Expense } | { type: 'revenue'; row: Revenue } | null
  >(null)
  const [deleting, setDeleting] = useState(false)

  const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalRev = revenues.reduce((s, r) => s + Number(r.amount), 0)

  // Cout enseignement : meme degrade rouge que les depenses — convention de la
  // ligne de cartes, rouge = sortie d'argent, turquoise = entree.
  const teachingSlices = useMemo(
    () => buildSlices(teachingCosts.byType.map(t => ({ key: t.label, amount: t.cost })), RAMP_EXPENSE),
    [teachingCosts.byType]
  )

  // Repartitions : derivees de l'etat local, donc a jour apres ajout/suppression.
  const expenseSlices = useMemo(
    () => buildSlices(expenses.map(e => ({ key: e.category, amount: Number(e.amount) })), RAMP_EXPENSE),
    [expenses]
  )
  const revenueSlices = useMemo(
    () => buildSlices(revenues.map(r => ({ key: r.source_type, amount: Number(r.amount) })), RAMP_REVENUE),
    [revenues]
  )

  // Situation financiere
  const situation = cotisations.totalPaid - teachingCosts.total - totalExp + totalRev

  // ── Refresh data ─────────────────────────────────────────────────────────
  const refreshExpenses = useCallback(async () => {
    const { data } = await supabase
      .from('expenses')
      .select('id, expense_date, label, amount, category, document_path, notes')
      .eq('school_year_id', schoolYearId)
      .order('expense_date', { ascending: false })
    setExpenses((data ?? []) as Expense[])
  }, [supabase, schoolYearId])

  const refreshRevenues = useCallback(async () => {
    const { data } = await supabase
      .from('other_revenues')
      .select('id, revenue_date, label, amount, source_type, notes')
      .eq('school_year_id', schoolYearId)
      .order('revenue_date', { ascending: false })
    setRevenues((data ?? []) as Revenue[])
  }, [supabase, schoolYearId])

  // ── Suppression (confirmee) ──────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === 'expense') {
        // Le justificatif part avec la depense : sinon il resterait orphelin
        // dans le bucket, sans plus aucune ligne pour le retrouver.
        const path = deleteTarget.row.document_path
        if (path) await supabase.storage.from(BUCKET).remove([path])
        await supabase.from('expenses').delete().eq('id', deleteTarget.row.id)
        await refreshExpenses()
      } else {
        await supabase.from('other_revenues').delete().eq('id', deleteTarget.row.id)
        await refreshRevenues()
      }
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">

      {/* ── 1. Cotisations ──────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-warm-100 bg-warm-50">
          <h2 className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Cotisations</h2>
        </div>
        <div className="px-3 py-2">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
              <div>
                <p className="stat-label">Facturé</p>
                <p className="text-sm font-bold text-secondary-800">{fmt(cotisations.totalDue)}</p>
              </div>
              <span className="text-[9px] text-warm-700">{cotisations.familyCount} dossiers</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50/30 px-3 py-2">
              <div>
                <p className="stat-label">Encaissé</p>
                <p className="text-sm font-bold text-primary-700">{fmt(cotisations.totalPaid)}</p>
              </div>
              <TrendingUp className="w-4 h-4 text-primary-500" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
              <div>
                <p className="stat-label">Reste à encaisser</p>
                <p className="text-sm font-bold text-orange-700">{fmt(cotisations.remaining)}</p>
              </div>
              <TrendingDown className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
              <div>
                <p className="stat-label">Taux de recouvrement</p>
                <p className="text-sm font-bold text-secondary-800">{cotisations.collectRate} %</p>
              </div>
              <div className="h-1.5 w-14 bg-warm-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${cotisations.collectRate}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row: Enseignement + Depenses + Revenus ─────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Cout enseignement */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-warm-100 bg-warm-50 shrink-0">
            <h2 className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Coût enseignement</h2>
          </div>
          {/* Sans taux, des heures comptaient pour 0 € en silence : le coût
              affiché etait sous-évalué sans aucun signal. */}
          {teachingCosts.unratedTypes.length > 0 && (
            <div role="status" className="flex items-start gap-1.5 px-2 py-1.5 bg-amber-50 border-b border-amber-200">
              <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[10px] text-amber-800 leading-snug">
                {teachingCosts.unratedTypes.map(t => `${t.code} (${t.hours.toLocaleString('fr-FR')} h)`).join(', ')}
                {' '}sans taux : ces heures ne sont pas valorisées.{' '}
                <Link href="/dashboard/types-presence" className="font-semibold underline hover:no-underline">
                  Paramétrer les taux
                </Link>
              </p>
            </div>
          )}
          {/* La liste pousse : le pied (TOTAL + repartition) reste aligne avec
              celui des 2 autres cartes, quel que soit le nombre de lignes. */}
          <div className="flex-1 min-h-0 overflow-y-auto list-scroll">
            {teachingCosts.byMonth.length === 0 ? (
              <p className="text-[10px] text-warm-700 italic text-center py-3">Aucune donnée</p>
            ) : (
              <table className="w-full text-xs" aria-label={`Coût enseignement par mois, année ${yearLabel}`}>
                <tbody className="divide-y divide-warm-50">
                  {teachingCosts.byMonth.map(row => (
                    <tr key={row.month} className="hover:bg-warm-50">
                      <td className="px-2 py-[2px]">
                        <Link
                          href={`/dashboard/temps-presence?month=${row.month}`}
                          className="text-secondary-600 hover:text-secondary-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
                        >
                          {fmtMonth(row.month)}
                        </Link>
                      </td>
                      <td className="px-2 py-[2px] text-right font-medium text-warm-700 tabular-nums">{fmt(row.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="shrink-0 border-t border-warm-200 bg-warm-50">
            <div className="flex items-center justify-between px-2 py-1.5 text-xs font-bold">
              <span className="text-warm-700">TOTAL</span>
              <span className="text-red-600 tabular-nums">{fmt(teachingCosts.total)}</span>
            </div>
            <Breakdown slices={teachingSlices} ariaLabel="Répartition du coût enseignement par type de présence" />
          </div>
        </div>

        {/* Depenses */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-warm-100 bg-warm-50 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Dépenses</h2>
            <FloatButton type="button" variant="submit" onClick={() => setExpenseModal('new')} className="!px-2 !py-0.5 !text-xs !font-medium !rounded">
              Ajouter
            </FloatButton>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto list-scroll">
          {expenses.length === 0 ? (
            <p className="text-[10px] text-warm-700 italic text-center py-3">Aucune dépense</p>
          ) : (
            <table className="w-full text-xs" aria-label={`Dépenses de l'année ${yearLabel}`}>
              <tbody className="divide-y divide-warm-50">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-warm-50">
                    <td className="px-2 py-[2px] text-warm-700 whitespace-nowrap w-0">{fmtDate(e.expense_date)}</td>
                    <td className="px-2 py-[2px] text-left">
                      {e.notes ? (
                        <Tooltip content={e.notes}>
                          <span className="block truncate cursor-help">{e.label}{e.category ? ` (${e.category})` : ''}</span>
                        </Tooltip>
                      ) : (
                        <span className="block truncate">{e.label}{e.category ? ` (${e.category})` : ''}</span>
                      )}
                    </td>
                    <td className="px-2 py-[2px] text-right font-medium text-warm-700 tabular-nums whitespace-nowrap w-0">{fmt(Number(e.amount))}</td>
                    <td className="px-1 py-[2px] w-0">
                      <span className="flex items-center gap-0.5 justify-end">
                        {e.document_path && (
                          <Tooltip content="Voir le justificatif">
                            <button
                              type="button"
                              onClick={() => openDocument(supabase, e.document_path!)}
                              aria-label={`Voir le justificatif de ${e.label}`}
                              className="p-0.5 rounded hover:bg-warm-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            >
                              <FileText size={11} className="text-primary-500" />
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip content="Modifier">
                          <button
                            type="button" onClick={() => setExpenseModal(e)}
                            aria-label={`Modifier la dépense ${e.label}`}
                            className="p-0.5 rounded hover:bg-warm-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                          >
                            <Pencil size={11} className="text-warm-700" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <button
                            type="button" onClick={() => setDeleteTarget({ type: 'expense', row: e })}
                            aria-label={`Supprimer la dépense ${e.label}`}
                            className="p-0.5 rounded hover:bg-warm-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                          >
                            <Trash2 size={11} className="text-warm-700" />
                          </button>
                        </Tooltip>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>

          <div className="shrink-0 border-t border-warm-200 bg-warm-50">
            <div className="flex items-center justify-between px-2 py-1.5 text-xs font-bold">
              <span className="text-warm-700">TOTAL</span>
              <span className="text-red-600 tabular-nums">{fmt(totalExp)}</span>
            </div>
            <Breakdown slices={expenseSlices} ariaLabel="Répartition des dépenses par catégorie" />
          </div>
        </div>

        {/* Revenus autres */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-warm-100 bg-warm-50 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Revenus autres</h2>
            <FloatButton type="button" variant="submit" onClick={() => setRevenueModal('new')} className="!px-2 !py-0.5 !text-xs !font-medium !rounded">
              Ajouter
            </FloatButton>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto list-scroll">
          {revenues.length === 0 ? (
            <p className="text-[10px] text-warm-700 italic text-center py-3">Aucun revenu</p>
          ) : (
            <table className="w-full text-xs" aria-label={`Revenus autres de l'année ${yearLabel}`}>
              <tbody className="divide-y divide-warm-50">
                {revenues.map(r => (
                  <tr key={r.id} className="hover:bg-warm-50">
                    <td className="px-2 py-[2px] text-warm-700 whitespace-nowrap w-0">{fmtDate(r.revenue_date)}</td>
                    <td className="px-2 py-[2px] text-left">
                      {r.notes ? (
                        <Tooltip content={r.notes}>
                          <span className="block truncate cursor-help">{r.label}{r.source_type ? ` (${r.source_type})` : ''}</span>
                        </Tooltip>
                      ) : (
                        <span className="block truncate">{r.label}{r.source_type ? ` (${r.source_type})` : ''}</span>
                      )}
                    </td>
                    <td className="px-2 py-[2px] text-right font-medium text-warm-700 tabular-nums whitespace-nowrap w-0">{fmt(Number(r.amount))}</td>
                    <td className="px-1 py-[2px] w-12">
                      <span className="flex items-center gap-0.5 justify-end">
                        <Tooltip content="Modifier">
                          <button
                            type="button" onClick={() => setRevenueModal(r)}
                            aria-label={`Modifier le revenu ${r.label}`}
                            className="p-0.5 rounded hover:bg-warm-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                          >
                            <Pencil size={11} className="text-warm-700" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <button
                            type="button" onClick={() => setDeleteTarget({ type: 'revenue', row: r })}
                            aria-label={`Supprimer le revenu ${r.label}`}
                            className="p-0.5 rounded hover:bg-warm-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                          >
                            <Trash2 size={11} className="text-warm-700" />
                          </button>
                        </Tooltip>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>

          <div className="shrink-0 border-t border-warm-200 bg-warm-50">
            <div className="flex items-center justify-between px-2 py-1.5 text-xs font-bold">
              <span className="text-warm-700">TOTAL</span>
              <span className="text-primary-600 tabular-nums">{fmt(totalRev)}</span>
            </div>
            <Breakdown slices={revenueSlices} ariaLabel="Répartition des revenus par source" />
          </div>
        </div>
      </div>

      {/* ── 5. Situation financiere — solde uniquement ─────────────────── */}
      <div className={clsx(
        'card flex items-center justify-between px-4 py-3 border-l-4',
        situation >= 0 ? 'border-l-primary-500 bg-primary-50/30' : 'border-l-red-500 bg-red-50/30'
      )}>
        <div className="flex items-center gap-2">
          {situation >= 0
            ? <CheckCircle2 className="w-5 h-5 text-primary-600" />
            : <AlertCircle className="w-5 h-5 text-red-600" />
          }
          <span className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Situation financière</span>
        </div>
        <span className={clsx('text-lg font-bold', situation >= 0 ? 'text-primary-700' : 'text-red-700')}>
          {situation >= 0 ? '+ ' : ''}{fmt(situation)}
        </span>
      </div>

      {/* ── Confirmation de suppression ─────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteTarget}
        title={deleteTarget?.type === 'revenue' ? 'Supprimer ce revenu ?' : 'Supprimer cette dépense ?'}
        confirmLabel="Supprimer"
        variant="danger"
        confirmDisabled={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="text-xs text-secondary-700 space-y-0.5">
            <p><span className="text-warm-700">Libellé :</span> <span className="font-semibold">{deleteTarget.row.label}</span></p>
            <p><span className="text-warm-700">Date :</span> {fmtDate(
              deleteTarget.type === 'expense' ? deleteTarget.row.expense_date : deleteTarget.row.revenue_date
            )}</p>
            <p><span className="text-warm-700">Montant :</span> <span className="font-semibold tabular-nums">{fmt(Number(deleteTarget.row.amount))}</span></p>
            {deleteTarget.type === 'expense' && deleteTarget.row.document_path && (
              <p className="text-warm-700">Le justificatif joint sera également supprimé.</p>
            )}
          </div>
        )}
      </ConfirmModal>

      {/* ── Modale Depense ──────────────────────────────────────────────── */}
      {expenseModal && (
        <ExpenseModal
          entry={expenseModal === 'new' ? null : expenseModal}
          schoolYearId={schoolYearId}
          onClose={() => setExpenseModal(null)}
          onSaved={() => { setExpenseModal(null); refreshExpenses() }}
        />
      )}

      {/* ── Modale Revenu ───────────────────────────────────────────────── */}
      {revenueModal && (
        <RevenueModal
          entry={revenueModal === 'new' ? null : revenueModal}
          schoolYearId={schoolYearId}
          onClose={() => setRevenueModal(null)}
          onSaved={() => { setRevenueModal(null); refreshRevenues() }}
        />
      )}
    </div>
  )
}

// ─── Expense Modal ──────────────────────────────────────────────────────────

function ExpenseModal({ entry, schoolYearId, onClose, onSaved }: {
  entry: Expense | null; schoolYearId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = !!entry

  const initDate     = entry?.expense_date ?? new Date().toISOString().slice(0, 10)
  const initLabel    = entry?.label ?? ''
  const initAmount   = entry ? String(entry.amount) : ''
  const initCategory = entry?.category ?? ''
  const initNotes    = entry?.notes ?? ''
  const initDoc      = entry?.document_path ?? ''

  const [date,         setDate]         = useState(initDate)
  const [label,        setLabel]        = useState(initLabel)
  const [amount,       setAmount]       = useState(initAmount)
  const [category,     setCategory]     = useState(initCategory)
  const [notes,        setNotes]        = useState(initNotes)
  const [documentPath, setDocumentPath] = useState(initDoc)
  const [uploading,    setUploading]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Categorie obligatoire : sans elle, la ventilation des depenses est aveugle.
  const canSubmit = !!date && !!label.trim() && !!amount && parseFloat(amount) > 0 && !!category
  const hasChanges = !isEdit || (
    date !== initDate || label !== initLabel || amount !== initAmount ||
    category !== initCategory || notes !== initNotes || documentPath !== initDoc
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    // Gardes cote client (le bucket les rejoue cote serveur : type + 2 Mo).
    if (!ACCEPTED_MIME.includes(file.type)) {
      setError('Format accepté : PDF, JPEG, PNG ou WEBP.'); return
    }
    if (file.size > MAX_DOC_BYTES) {
      setError('Le justificatif dépasse 2 Mo.'); return
    }

    setUploading(true)
    try {
      // Chemin cloisonne par etablissement : la policy storage l'exige, et sans
      // lui un etablissement pourrait atteindre les justificatifs d'un autre.
      const { data: { user } } = await supabase.auth.getUser()
      const { data: me } = await supabase
        .from('profiles').select('etablissement_id').eq('id', user?.id ?? '').single()
      if (!me?.etablissement_id) { setError('Établissement introuvable.'); return }

      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `${me.etablissement_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file)
      if (uploadErr) { setError(uploadErr.message); return }

      // Le fichier remplace : on retire l'ancien pour ne pas laisser d'orphelin.
      if (documentPath && documentPath !== initDoc) {
        await supabase.storage.from(BUCKET).remove([documentPath])
      }
      setDocumentPath(path)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!label.trim() || !amount || !category) { setError('Libellé, montant et catégorie sont obligatoires.'); return }
    setSaving(true)
    setError(null)

    // Justificatif retire ou remplace : on supprime l'ancien fichier (on stocke
    // desormais un chemin, plus une URL a decouper a la regex).
    if (isEdit && initDoc && initDoc !== documentPath) {
      await supabase.storage.from(BUCKET).remove([initDoc])
    }

    const payload: any = {
      expense_date: date,
      label: label.trim(),
      amount: parseFloat(amount),
      category: category.trim() || null,
      notes: notes.trim() || null,
      document_path: documentPath || null,
    }

    if (!isEdit) {
      payload.school_year_id = schoolYearId
    }

    const { error: err } = isEdit
      ? await supabase.from('expenses').update(payload).eq('id', entry!.id)
      : await supabase.from('expenses').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <FormModal
      title={isEdit ? 'Modifier la dépense' : 'Nouvelle dépense'}
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
          <div className="flex-1" />
          <FloatButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Annuler</FloatButton>
          <FloatButton type="button" variant={isEdit ? 'edit' : 'submit'} onClick={handleSave} disabled={saving || !canSubmit || !hasChanges}>
            {isEdit ? 'Modifier' : 'Valider'}
          </FloatButton>
        </>
      }
    >
      <>
          {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <FloatInput label="Montant (€)" type="number" step="any" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <FloatInput label="Libellé" type="text" placeholder="Description de la dépense" value={label} onChange={e => setLabel(capFirst(e.target.value))} required />
          <FloatSelect label="Catégorie" value={category} onChange={e => setCategory(e.target.value)} required aria-required="true">
            <option value="" disabled hidden></option>
            <option value="Loyer">Loyer · Location des locaux</option>
            <option value="Charges">Charges · Eau, électricité, gaz, internet</option>
            <option value="Maintenance">Maintenance · Entretien, réparations</option>
            <option value="Fournitures">Fournitures · Matériel pédagogique, papeterie</option>
            <option value="Assurance">Assurance · Assurance locaux, RC</option>
            <option value="Déplacements">Déplacements · Transport, frais de route</option>
            <option value="Communication">Communication · Impression, site web, pub</option>
            <option value="Événements">Événements · Sorties, fêtes, cérémonies</option>
            <option value="Alimentation">Alimentation · Goûters, repas</option>
            <option value="Banque">Banque · Frais bancaires</option>
            <option value="Autre">Autre · Divers</option>
          </FloatSelect>
          <FloatTextarea label="Notes" placeholder="Remarque optionnelle..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          <div>
            <label className="block text-xs font-semibold text-warm-700 uppercase tracking-wide mb-1">Document</label>
            <div className="flex items-center gap-2">
              <label className="btn-secondary text-xs px-3 py-1.5 cursor-pointer flex items-center gap-1">
                <Upload size={12} aria-hidden="true" />
                {uploading ? 'Envoi...' : 'Choisir un fichier'}
                <input
                  type="file" className="sr-only" onChange={handleFileUpload} disabled={uploading}
                  accept={ACCEPTED_MIME.join(',')}
                />
              </label>
              {documentPath && (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openDocument(supabase, documentPath)}
                    className="text-xs text-primary-600 underline hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
                  >
                    Voir le justificatif
                  </button>
                  <Tooltip content="Retirer le justificatif">
                    <button
                      type="button" onClick={() => setDocumentPath('')}
                      aria-label="Retirer le justificatif"
                      className="p-0.5 rounded hover:bg-warm-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <X size={12} className="text-red-500" />
                    </button>
                  </Tooltip>
                </span>
              )}
            </div>
          </div>
      </>
    </FormModal>
  )
}

// ─── Revenue Modal ──────────────────────────────────────────────────────────

function RevenueModal({ entry, schoolYearId, onClose, onSaved }: {
  entry: Revenue | null; schoolYearId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = !!entry

  const initDate       = entry?.revenue_date ?? new Date().toISOString().slice(0, 10)
  const initLabel      = entry?.label ?? ''
  const initAmount     = entry ? String(entry.amount) : ''
  const initSourceType = entry?.source_type ?? ''
  const initNotes      = entry?.notes ?? ''

  const [date,       setDate]       = useState(initDate)
  const [label,      setLabel]      = useState(initLabel)
  const [amount,     setAmount]     = useState(initAmount)
  const [sourceType, setSourceType] = useState(initSourceType)
  const [notes,      setNotes]      = useState(initNotes)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Source obligatoire : sans elle, un revenu n'est pas rattachable.
  const canSubmit = !!date && !!label.trim() && !!amount && parseFloat(amount) > 0 && !!sourceType
  const hasChanges = !isEdit || (
    date !== initDate || label !== initLabel || amount !== initAmount ||
    sourceType !== initSourceType || notes !== initNotes
  )

  const handleSave = async () => {
    if (!label.trim() || !amount || !sourceType) { setError('Libellé, montant et source sont obligatoires.'); return }
    setSaving(true)
    setError(null)

    const payload: any = {
      revenue_date: date,
      label: label.trim(),
      amount: parseFloat(amount),
      source_type: sourceType.trim() || null,
      notes: notes.trim() || null,
    }

    if (!isEdit) {
      payload.school_year_id = schoolYearId
    }

    const { error: err } = isEdit
      ? await supabase.from('other_revenues').update(payload).eq('id', entry!.id)
      : await supabase.from('other_revenues').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <FormModal
      title={isEdit ? 'Modifier le revenu' : 'Nouveau revenu'}
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
          <div className="flex-1" />
          <FloatButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Annuler</FloatButton>
          <FloatButton type="button" variant={isEdit ? 'edit' : 'submit'} onClick={handleSave} disabled={saving || !canSubmit || !hasChanges}>
            {isEdit ? 'Modifier' : 'Valider'}
          </FloatButton>
        </>
      }
    >
      <>
          {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <FloatInput label="Montant (€)" type="number" step="any" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <FloatInput label="Libellé" type="text" placeholder="Description du revenu" value={label} onChange={e => setLabel(capFirst(e.target.value))} required />
          <FloatSelect label="Source" value={sourceType} onChange={e => setSourceType(e.target.value)} required aria-required="true">
            <option value="" disabled hidden></option>
            <option value="Don">Don · Dons de particuliers ou entreprises</option>
            <option value="Subvention">Subvention · Aide publique ou associative</option>
            <option value="Événement">Événement · Recettes kermesse, fête, vente</option>
            <option value="Cotisation exceptionnelle">Cotisation exceptionnelle · Contribution ponctuelle</option>
            <option value="Remboursement">Remboursement · Remboursement fournisseur / assurance</option>
            <option value="Partenariat">Partenariat · Sponsoring, mécénat</option>
            <option value="Autre">Autre · Divers</option>
          </FloatSelect>
          <FloatTextarea label="Notes" placeholder="Remarque optionnelle..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </>
    </FormModal>
  )
}
