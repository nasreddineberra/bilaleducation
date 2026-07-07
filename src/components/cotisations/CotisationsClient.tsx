'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { FloatButton, FloatInput } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import type { CotisationType } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PresenceType {
  id: string
  label: string
  code: string
  color: string
  is_absence: boolean
}

interface PresenceTypeRate {
  presence_type_id: string
  rate: number
}

interface SchoolYear {
  id: string
  label: string
  is_current: boolean
}

interface Props {
  currentYear: { id: string; label: string } | null
  cotisationTypes: CotisationType[]
  classesWithoutCount: number
  presenceTypes: PresenceType[]
  presenceTypeRates: PresenceTypeRate[]
  allYears: SchoolYear[]
  allCotisationTypes: any[]
  allPresenceTypeRates: any[]
}

type EditingRow = {
  id: string | null
  label: string
  amount: string
  registration_fee: string
  sibling_discount: string
  sibling_discount_same_type: boolean
  max_installments: string
  is_adult: boolean
}

const EMPTY_ROW: EditingRow = {
  id: null, label: '', amount: '', registration_fee: '', sibling_discount: '',
  sibling_discount_same_type: false, max_installments: '', is_adult: false,
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// Formate une saisie numérique à 2 décimales (vide autorisé pour la saisie en cours)
function to2(v: string) {
  if (v.trim() === '') return ''
  const n = parseFloat(v)
  return isNaN(n) ? v : n.toFixed(2)
}

// Bulle d'aide accessible (clavier + lecteur d'écran) — remplace les title= natifs
function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip content={text}>
      <button
        type="button"
        aria-label={text}
        className="inline-flex text-warm-400 hover:text-secondary-600 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      >
        <Info size={12} />
      </button>
    </Tooltip>
  )
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function CotisationsClient({
  currentYear, cotisationTypes: initial, classesWithoutCount,
  presenceTypes, presenceTypeRates: initialRates,
  allYears, allCotisationTypes, allPresenceTypeRates,
}: Props) {
  const router   = useRouter()
  const toast    = useToast()
  const supabase = createClient()

  const [rows, setRows]                       = useState<CotisationType[]>(initial)
  const [editing, setEditing]                 = useState<EditingRow | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving]                   = useState(false)

  const [rates, setRates]             = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRates.map(r => [r.presence_type_id, Number(r.rate).toFixed(2)]))
  )
  const [rateSaving, setRateSaving]   = useState(false)
  const [rateSuccess, setRateSuccess] = useState<string | null>(null)

  // Détection de modification des taux (bouton désactivé si rien n'a changé vs BDD)
  const initialRateMap = Object.fromEntries(initialRates.map(r => [r.presence_type_id, Number(r.rate)]))
  const isRatesDirty = presenceTypes.some(pt => {
    if (pt.is_absence) return false
    const current = parseFloat(rates[pt.id] ?? '') || 0
    return current !== (initialRateMap[pt.id] ?? 0)
  })

  // Statut d'enregistrement : un type (hors absence) est « enregistré » s'il a
  // une ligne en base pour l'année. Un type ajouté après coup n'en a pas → manquant.
  const missingRateTypes = presenceTypes.filter(pt => !pt.is_absence && !(pt.id in initialRateMap))
  const allRatesSaved = missingRateTypes.length === 0

  // ── Pas d'année en cours ──────────────────────────────────────────────────

  if (!currentYear) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle size={36} className="text-warm-400" />
        <p className="text-sm text-warm-500">Aucune année scolaire en cours.</p>
      </div>
    )
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const startAdd  = () => { setEditing({ ...EMPTY_ROW }); setConfirmDeleteId(null) }
  const startEdit = (row: CotisationType) => {
    setEditing({
      id: row.id, label: row.label, amount: Number(row.amount).toFixed(2),
      registration_fee: Number(row.registration_fee).toFixed(2), sibling_discount: Number(row.sibling_discount).toFixed(2),
      sibling_discount_same_type: row.sibling_discount_same_type ?? false,
      max_installments: String(row.max_installments), is_adult: row.is_adult ?? false,
    })
    setConfirmDeleteId(null)
  }
  const cancel = () => setEditing(null)

  const save = async () => {
    if (!editing) return
    const label           = editing.label.trim()
    const amount          = parseFloat(editing.amount)
    const registrationFee = parseFloat(editing.registration_fee) || 0
    const siblingDiscount = parseFloat(editing.sibling_discount) || 0
    const maxInst         = parseInt(editing.max_installments, 10)

    if (!label)                        { toast.error('Le libellé est obligatoire.'); return }
    if (isNaN(amount) || amount < 0)   { toast.error('La cotisation annuelle doit être un nombre positif.'); return }
    if (isNaN(maxInst) || maxInst < 1) { toast.error('Le nombre d\'échéances doit être au moins 1.'); return }

    const duplicate = rows.find(r => r.label.toLowerCase() === label.toLowerCase() && r.id !== editing.id)
    if (duplicate) { toast.error(`Le type "${label}" existe déjà.`); return }

    setSaving(true)
    const payload = { label, amount, registration_fee: registrationFee, sibling_discount: siblingDiscount, sibling_discount_same_type: editing.sibling_discount_same_type, max_installments: maxInst, is_adult: editing.is_adult }
    try {
      if (editing.id) {
        const { error: err } = await supabase.from('cotisation_types').update(payload).eq('id', editing.id)
        if (err) throw err
        setRows(prev => prev.map(r => r.id === editing.id ? { ...r, ...payload } : r))
        toast.success('Type mis à jour.')
      } else {
        const nextIndex = rows.length > 0 ? Math.max(...rows.map(r => r.order_index)) + 1 : 0
        const { data, error: err } = await supabase.from('cotisation_types').insert({ ...payload, school_year_id: currentYear.id, order_index: nextIndex }).select().single()
        if (err) throw err
        setRows(prev => [...prev, data as CotisationType])
        toast.success('Type ajouté.')
      }
      setEditing(null)
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setSaving(true)
    try {
      const { error: err } = await supabase.from('cotisation_types').delete().eq('id', id)
      if (err) throw err
      setRows(prev => prev.filter(r => r.id !== id))
      setConfirmDeleteId(null)
      toast.success('Type supprimé.')
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur lors de la suppression.')
    } finally {
      setSaving(false)
    }
  }

  // ── Validité du formulaire (champs obligatoires) ──────────────────────────

  const isFormValid = !!editing
    && editing.label.trim() !== ''
    && editing.amount.trim() !== '' && Number(editing.amount) >= 0
    && editing.max_installments.trim() !== '' && Number(editing.max_installments) >= 1

  // Types de présence : absences en tête de liste
  const sortedPresenceTypes = [...presenceTypes].sort((a, b) => Number(b.is_absence) - Number(a.is_absence))

  // ── Historique ────────────────────────────────────────────────────────────

  const pastYears = allYears.filter(y => y.id !== currentYear.id)

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 lg:h-full min-h-0 lg:overflow-y-auto lg:pr-1">

        {/* ── Encadré 1 : Types de cotisations ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-secondary-800">Types de cotisations — {currentYear.label}</h2>
              <p className="text-xs text-warm-500 mt-0.5">Utilisés pour le calcul du coût dans le financement des cotisations</p>
            </div>
            {!editing && (
              <FloatButton type="button" variant="submit" onClick={startAdd}>
                Ajouter
              </FloatButton>
            )}
          </div>

          <div className="flex flex-row">
          <div className="flex-[2] min-w-0 overflow-x-auto">
          {/* Formulaire d'édition */}
          {editing && (
            <div className="p-4 border-b border-warm-100 bg-primary-50/20 space-y-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="w-48">
                  <FloatInput
                    label="Type de scolarité"
                    required
                    aria-required="true"
                    compact
                    autoFocus
                    value={editing.label}
                    onChange={e => setEditing({ ...editing, label: e.target.value.toUpperCase() })}
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={editing.is_adult} onChange={e => setEditing({ ...editing, is_adult: e.target.checked })} className="accent-primary-600 w-3.5 h-3.5" />
                      <span className="text-xs text-secondary-600">Cours adultes</span>
                    </label>
                    <InfoHint text="Les classes de ce type seront réservées aux adultes." />
                  </div>
                </div>
                <div className="w-32">
                  <div className="relative">
                    <FloatInput
                      label="Côtis. annuelle"
                      required
                      aria-required="true"
                      compact
                      type="number" min="0" step="10"
                      className="pr-7"
                      value={editing.amount}
                      onChange={e => setEditing({ ...editing, amount: e.target.value })}
                      onBlur={e => setEditing(ed => ed ? { ...ed, amount: to2(e.target.value) } : ed)}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-warm-400">€</span>
                  </div>
                </div>
                <div className="w-32">
                  <div className="relative">
                    <FloatInput
                      label="Frais de dossier"
                      compact
                      type="number" min="0" step="10"
                      className="pr-7"
                      value={editing.registration_fee}
                      onChange={e => setEditing({ ...editing, registration_fee: e.target.value })}
                      onBlur={e => setEditing(ed => ed ? { ...ed, registration_fee: to2(e.target.value) } : ed)}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-warm-400">€</span>
                  </div>
                </div>
                <div className="w-32">
                  <div className="relative">
                    <FloatInput
                      label="Réduc. fratrie"
                      compact
                      type="number" min="0" step="10"
                      className="pr-7"
                      value={editing.sibling_discount}
                      onChange={e => setEditing({ ...editing, sibling_discount: e.target.value })}
                      onBlur={e => setEditing(ed => ed ? { ...ed, sibling_discount: to2(e.target.value) } : ed)}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-warm-400">€</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={editing.sibling_discount_same_type} onChange={e => setEditing({ ...editing, sibling_discount_same_type: e.target.checked })} className="accent-amber-500 w-3.5 h-3.5" />
                      <span className="text-xs text-secondary-600">Même type</span>
                    </label>
                    <InfoHint text="Réduction entre enfants du même type uniquement." />
                  </div>
                </div>
                <div className="w-32">
                  <FloatInput
                    label="Max échéances"
                    required
                    aria-required="true"
                    compact
                    type="number" min="1" max="12"
                    value={editing.max_installments}
                    onChange={e => setEditing({ ...editing, max_installments: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <FloatButton type="button" variant="submit" onClick={save} disabled={saving || !isFormValid}>
                    {saving ? 'Enregistrement...' : editing.id ? 'Enregistrer' : 'Ajouter'}
                  </FloatButton>
                  <FloatButton type="button" variant="secondary" onClick={cancel} disabled={saving}>Annuler</FloatButton>
                </div>
              </div>
              <span className="block text-xs text-warm-400"><span className="font-semibold text-red-400">*</span> champs obligatoires</span>
            </div>
          )}

          <table className="w-full text-left text-xs" aria-label={`Types de cotisations — ${currentYear.label}`}>
            <thead>
              <tr className="border-b border-warm-100">
                <th className="list-th">Type</th>
                <th className="list-th text-right">Cotisation</th>
                <th className="list-th text-right">Dossier</th>
                <th className="list-th text-right">Fratrie</th>
                <th className="list-th text-center">Échéances</th>
                <th className="list-th w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {rows.map(row => (
                <tr key={row.id} className={clsx('transition-colors', editing?.id === row.id ? 'bg-primary-50/40' : 'hover:bg-warm-50/50')}>
                  <td className="list-td">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="list-name text-secondary-800">{row.label}</span>
                      {row.is_adult && <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">Adultes</span>}
                    </span>
                  </td>
                  <td className="list-td text-right text-secondary-700 tabular-nums">{fmtEur(row.amount)}</td>
                  <td className="list-td text-right text-secondary-700 tabular-nums">{row.registration_fee > 0 ? fmtEur(row.registration_fee) : <span className="text-warm-300">—</span>}</td>
                  <td className="list-td text-right text-secondary-700 tabular-nums">
                    {row.sibling_discount > 0 ? (
                      <span className="inline-flex items-center gap-1 justify-end">
                        -{fmtEur(row.sibling_discount)}
                        <span className={clsx('text-[10px] px-1 py-0.5 rounded-full font-medium', row.sibling_discount_same_type ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                          {row.sibling_discount_same_type ? '=type' : 'tous'}
                        </span>
                      </span>
                    ) : <span className="text-warm-300">—</span>}
                  </td>
                  <td className="list-td text-center text-warm-500">{row.max_installments === 1 ? 'Comptant' : `${row.max_installments}x`}</td>
                  <td className="list-td">
                    {confirmDeleteId === row.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => remove(row.id)} disabled={saving} className="text-[11px] text-red-600 hover:text-red-700 font-medium rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">Confirmer</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] text-warm-500 hover:text-warm-700 rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-warm-400/50">Annuler</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-0.5">
                        <Tooltip content="Modifier">
                          <button onClick={() => startEdit(row)} disabled={!!editing} aria-label={`Modifier ${row.label}`} className={clsx('p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50', editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-secondary-700 hover:bg-warm-100')}><Pencil size={13} /></button>
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <button onClick={() => setConfirmDeleteId(row.id)} disabled={!!editing} aria-label={`Supprimer ${row.label}`} className={clsx('p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50', editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-red-600 hover:bg-red-50')}><Trash2 size={13} /></button>
                        </Tooltip>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !editing && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-warm-400">Aucun type configuré pour cette année.</td></tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Historique des cotisations */}
          <div className="flex-1 min-w-0 border-l border-warm-100 bg-warm-50/30 overflow-x-auto">
            <div className="px-4 py-1.5 border-b border-warm-100">
              <h3 className="text-[11px] leading-4 font-semibold text-warm-500 uppercase tracking-wider">Historique</h3>
            </div>
            {pastYears.length === 0 ? (
              <p className="px-4 py-8 text-xs text-warm-400 text-center italic">Aucun historique disponible.</p>
            ) : (
              <table className="w-full text-left text-[11px]" aria-label="Historique des types de cotisations">
                <thead>
                  <tr className="border-b border-warm-100 text-[10px] uppercase tracking-wide text-warm-400">
                    <th className="px-2 py-1 font-semibold">Type</th>
                    <th className="px-2 py-1 font-semibold text-right">Cotis.</th>
                    <th className="px-2 py-1 font-semibold text-right">Dossier</th>
                    <th className="px-2 py-1 font-semibold text-right">Fratrie</th>
                    <th className="px-2 py-1 font-semibold text-center">Éch.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-50">
                  {pastYears.map(year => {
                    const yearCotisations = allCotisationTypes.filter((c: any) => c.school_year_id === year.id)
                    return (
                      <Fragment key={year.id}>
                        <tr className="bg-warm-100/50">
                          <td colSpan={5} className="px-2 py-1 text-[11px] font-bold text-secondary-700">{year.label}</td>
                        </tr>
                        {yearCotisations.length > 0 ? yearCotisations.map((c: any) => (
                          <tr key={c.id}>
                            <td className="px-2 py-1 text-secondary-800 whitespace-nowrap">{c.label}{c.is_adult ? <span className="ml-1 text-violet-600 font-semibold">·A</span> : null}</td>
                            <td className="px-2 py-1 text-right text-secondary-700 tabular-nums whitespace-nowrap">{fmtEur(c.amount)}</td>
                            <td className="px-2 py-1 text-right text-secondary-700 tabular-nums whitespace-nowrap">{c.registration_fee > 0 ? fmtEur(c.registration_fee) : <span className="text-warm-300">—</span>}</td>
                            <td className="px-2 py-1 text-right text-secondary-700 tabular-nums whitespace-nowrap">{c.sibling_discount > 0 ? `-${fmtEur(c.sibling_discount)}` : <span className="text-warm-300">—</span>}</td>
                            <td className="px-2 py-1 text-center text-warm-500 whitespace-nowrap">{c.max_installments === 1 ? 'Comptant' : `${c.max_installments}x`}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={5} className="px-2 py-2 text-center text-[11px] text-warm-300 italic">Aucune donnée</td></tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          </div>

          {classesWithoutCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-200 px-3 py-2">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span><strong>{classesWithoutCount}</strong> classe{classesWithoutCount > 1 ? 's' : ''} sans type de cotisation.</span>
              <Link href="/dashboard/classes" className="ml-auto font-medium text-amber-800 hover:underline">Voir les classes</Link>
            </div>
          )}
        </div>

        {/* ── Encadré 2 : Taux horaires ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-warm-100 bg-warm-50">
            <h2 className="text-sm font-bold text-secondary-800">Taux horaires généralisés — {currentYear.label}</h2>
            <p className="text-xs text-warm-500 mt-0.5">Utilisés pour le calcul du coût dans le temps de présence</p>
          </div>

          {/* Bandeau de statut : tous les taux enregistrés / manquants / modifiés */}
          {presenceTypes.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className={clsx(
                'flex items-center gap-2 text-xs px-4 py-2 border-b',
                !allRatesSaved
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : isRatesDirty
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-success-50 border-success-100 text-success-600'
              )}
            >
              {!allRatesSaved ? (
                <>
                  <AlertTriangle size={13} className="flex-shrink-0" />
                  <span>
                    <strong>{missingRateTypes.length}</strong> type{missingRateTypes.length > 1 ? 's' : ''} de présence sans taux enregistré{missingRateTypes.length > 1 ? 's' : ''} : {missingRateTypes.map(t => t.label).join(', ')}.
                  </span>
                </>
              ) : isRatesDirty ? (
                <>
                  <Info size={13} className="flex-shrink-0" />
                  <span>Modifications non enregistrées.</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} className="flex-shrink-0" />
                  <span>Tous les taux sont enregistrés.</span>
                </>
              )}
            </div>
          )}

          <div className="flex flex-row">
          <div className="p-3 flex-[2] min-w-0">
            {presenceTypes.length === 0 ? (
              <p className="text-sm text-warm-400 italic">
                Aucun type de présence configuré.{' '}
                <Link href="/dashboard/types-presence" className="text-primary-600 hover:underline">Configurer</Link>
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start gap-2">
                  {sortedPresenceTypes.map(pt => {
                    const isMissing = !pt.is_absence && !(pt.id in initialRateMap)
                    return (
                    <div key={pt.id} className="w-32">
                      <label htmlFor={`rate-${pt.id}`} className={clsx('flex items-center gap-1 text-xs font-medium mb-1 truncate', isMissing ? 'text-amber-600' : 'text-warm-500')}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pt.color }} />
                        <span className="truncate">{pt.label}</span>
                        {isMissing && <AlertTriangle size={11} className="text-amber-500 flex-shrink-0 ml-auto" />}
                      </label>
                      <div className="relative">
                        <input
                          id={`rate-${pt.id}`}
                          aria-label={pt.is_absence ? `Taux horaire ${pt.label} (non facturé)` : `Taux horaire ${pt.label}${isMissing ? ' (non enregistré)' : ''}`}
                          type="number" step="0.10" min="0"
                          value={pt.is_absence ? '0.00' : (rates[pt.id] ?? '')}
                          onChange={e => setRates(prev => ({ ...prev, [pt.id]: e.target.value }))}
                          onBlur={e => setRates(prev => ({ ...prev, [pt.id]: to2(e.target.value) }))}
                          disabled={pt.is_absence}
                          title={pt.is_absence ? 'Une absence n\'est jamais facturée' : undefined}
                          className={clsx('input text-sm pr-8 w-full disabled:bg-warm-100 disabled:text-warm-400 disabled:cursor-not-allowed', isMissing && 'border-amber-400 bg-amber-50/40')}
                          placeholder="0"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-warm-400">/h</span>
                      </div>
                    </div>
                    )
                  })}
                  <div className="flex items-center gap-2 pt-[1.35rem]">
                      <FloatButton type="button" variant="submit" disabled={rateSaving || (!isRatesDirty && allRatesSaved)} onClick={async () => {
                        setRateSaving(true); setRateSuccess(null)
                        const upserts = presenceTypes.map(pt => ({ school_year_id: currentYear.id, presence_type_id: pt.id, rate: pt.is_absence ? 0 : (parseFloat(rates[pt.id] ?? '0') || 0) }))
                        const { error: err } = await supabase.from('presence_type_rates').upsert(upserts, { onConflict: 'etablissement_id,school_year_id,presence_type_id' })
                        setRateSaving(false)
                        if (err) { toast.error(err.message); return }
                        setRateSuccess('Taux enregistrés')
                        router.refresh()
                        setTimeout(() => setRateSuccess(null), 3000)
                      }}>
                        {rateSaving ? 'Enregistrement...' : 'Enregistrer'}
                      </FloatButton>
                      <span role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-success-600">
                        {rateSuccess && <><CheckCircle2 size={13} /> {rateSuccess}</>}
                      </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Historique des taux horaires */}
          <div className="flex-1 min-w-0 border-l border-warm-100 bg-warm-50/30 overflow-x-auto">
            <div className="px-4 py-1.5 border-b border-warm-100">
              <h3 className="text-[11px] leading-4 font-semibold text-warm-500 uppercase tracking-wider">Historique</h3>
            </div>
            {pastYears.length === 0 ? (
              <p className="px-4 py-8 text-xs text-warm-400 text-center italic">Aucun historique disponible.</p>
            ) : (
              <div className="divide-y divide-warm-100">
                {pastYears.map(year => {
                  const yearRates: any[] = allPresenceTypeRates.filter((r: any) => r.school_year_id === year.id)
                  return (
                    <div key={year.id} className="px-3 py-2">
                      <p className="text-[11px] font-bold text-secondary-700 mb-1">{year.label}</p>
                      {yearRates.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {yearRates.map((r: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-1.5 text-[11px] min-w-0">
                              <span className="flex items-center gap-1 text-secondary-800 min-w-0">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.presence_types?.color }} />
                                <span className="truncate">{r.presence_types?.label}</span>
                              </span>
                              <span className="text-warm-500 tabular-nums flex-shrink-0">{fmtEur(r.rate)}/h</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-[11px] text-warm-300 italic">Aucune donnée</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </div>
        </div>

    </div>
  )
}
