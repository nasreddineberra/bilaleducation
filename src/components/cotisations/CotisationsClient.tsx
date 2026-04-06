'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, Trash2, X, Check, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { FloatButton } from '@/components/ui/FloatFields'
import type { CotisationType } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PresenceType {
  id: string
  label: string
  code: string
  color: string
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
  id: null, label: '', amount: '', registration_fee: '0', sibling_discount: '0',
  sibling_discount_same_type: false, max_installments: '1', is_adult: false,
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
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
    Object.fromEntries(initialRates.map(r => [r.presence_type_id, r.rate.toString()]))
  )
  const [rateSaving, setRateSaving]   = useState(false)
  const [rateSuccess, setRateSuccess] = useState<string | null>(null)

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
      id: row.id, label: row.label, amount: String(row.amount),
      registration_fee: String(row.registration_fee), sibling_discount: String(row.sibling_discount),
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

  // ── Historique ────────────────────────────────────────────────────────────

  const pastYears = allYears.filter(y => y.id !== currentYear.id)

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-4 h-full min-h-0">

      {/* ── Colonne gauche : saisie année en cours ── */}
      <div className="flex flex-col gap-4 flex-1 min-w-0 overflow-y-auto pr-1">

        {/* ── Encadré 1 : Types de cotisations ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-secondary-800">Types de cotisations — {currentYear.label}</h2>
              <p className="text-xs text-warm-400 mt-0.5">Utilisés pour le calcul du coût dans le financement des cotisations</p>
            </div>
            {!editing && (
              <FloatButton type="button" variant="submit" onClick={startAdd}>
                <Plus size={15} /> Ajouter
              </FloatButton>
            )}
          </div>

          {/* Formulaire d'édition */}
          {editing && (
            <div className="p-4 border-b border-warm-100 bg-primary-50/20 space-y-3">
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-warm-500 mb-1">Type de scolarité</label>
                  <input autoFocus className="input text-sm" placeholder="Ex: Maternelle" value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} />
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={editing.is_adult} onChange={e => setEditing({ ...editing, is_adult: e.target.checked })} className="accent-primary-600 w-3.5 h-3.5" />
                    <span className="text-xs text-secondary-600">Cours adultes</span>
                    <span title="Les classes de ce type seront réservées aux adultes."><Info size={11} className="text-warm-300" /></span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-500 mb-1">Cotisation annuelle</label>
                  <div className="relative">
                    <input type="number" min="0" step="0.01" className="input text-sm pr-10" placeholder="0" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-warm-400">EUR</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-500 mb-1">Frais de dossier</label>
                  <div className="relative">
                    <input type="number" min="0" step="0.01" className="input text-sm pr-10" placeholder="0" value={editing.registration_fee} onChange={e => setEditing({ ...editing, registration_fee: e.target.value })} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-warm-400">EUR</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-500 mb-1">Réduction fratrie</label>
                  <div className="relative">
                    <input type="number" min="0" step="0.01" className="input text-sm pr-10" placeholder="0" value={editing.sibling_discount} onChange={e => setEditing({ ...editing, sibling_discount: e.target.value })} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-warm-400">EUR</span>
                  </div>
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={editing.sibling_discount_same_type} onChange={e => setEditing({ ...editing, sibling_discount_same_type: e.target.checked })} className="accent-amber-500 w-3.5 h-3.5" />
                    <span className="text-xs text-secondary-600">Même type</span>
                    <span title="Réduction entre enfants du même type uniquement."><Info size={11} className="text-warm-300" /></span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-500 mb-1">Max échéances</label>
                  <input type="number" min="1" max="12" className="input text-sm" value={editing.max_installments} onChange={e => setEditing({ ...editing, max_installments: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FloatButton type="button" variant="submit" onClick={save} disabled={saving}>
                  <Check size={13} /> {saving ? 'Enregistrement...' : editing.id ? 'Enregistrer' : 'Ajouter'}
                </FloatButton>
                <FloatButton type="button" variant="secondary" onClick={cancel} disabled={saving}>Annuler</FloatButton>
              </div>
            </div>
          )}

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-warm-100 bg-warm-50/60">
                <th className="px-3 py-2 font-semibold text-warm-500 uppercase tracking-wider">Type</th>
                <th className="px-3 py-2 font-semibold text-warm-500 uppercase tracking-wider text-right">Cotisation</th>
                <th className="px-3 py-2 font-semibold text-warm-500 uppercase tracking-wider text-right">Dossier</th>
                <th className="px-3 py-2 font-semibold text-warm-500 uppercase tracking-wider text-right">Fratrie</th>
                <th className="px-3 py-2 font-semibold text-warm-500 uppercase tracking-wider text-center">Échéances</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className={clsx('border-b border-warm-100 transition-colors', editing?.id === row.id ? 'bg-primary-50/40' : 'hover:bg-warm-50/40')}>
                  <td className="px-3 py-2 font-medium text-secondary-800">
                    <span className="inline-flex items-center gap-1.5">
                      {row.label}
                      {row.is_adult && <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">Adultes</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-secondary-700 text-right tabular-nums">{fmtEur(row.amount)}</td>
                  <td className="px-3 py-2 text-secondary-700 text-right tabular-nums">{row.registration_fee > 0 ? fmtEur(row.registration_fee) : <span className="text-warm-300">—</span>}</td>
                  <td className="px-3 py-2 text-secondary-700 text-right tabular-nums">
                    {row.sibling_discount > 0 ? (
                      <span className="inline-flex items-center gap-1 justify-end">
                        -{fmtEur(row.sibling_discount)}
                        <span className={clsx('text-[10px] px-1 py-0.5 rounded-full font-medium', row.sibling_discount_same_type ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                          {row.sibling_discount_same_type ? '=type' : 'tous'}
                        </span>
                      </span>
                    ) : <span className="text-warm-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-warm-500 text-center">{row.max_installments === 1 ? 'Comptant' : `${row.max_installments}x`}</td>
                  <td className="px-3 py-2">
                    {confirmDeleteId === row.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => remove(row.id)} disabled={saving} className="text-[11px] text-red-600 hover:text-red-700 font-medium">Confirmer</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] text-warm-400 hover:text-warm-600">Annuler</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => startEdit(row)} disabled={!!editing} className={clsx('p-1.5 rounded-lg transition-colors', editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-secondary-700 hover:bg-warm-100')} title="Modifier"><Pencil size={13} /></button>
                        <button onClick={() => setConfirmDeleteId(row.id)} disabled={!!editing} className={clsx('p-1.5 rounded-lg transition-colors', editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-red-600 hover:bg-red-50')} title="Supprimer"><Trash2 size={13} /></button>
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
            <h2 className="text-sm font-bold text-secondary-800">Taux horaires — {currentYear.label}</h2>
            <p className="text-xs text-warm-400 mt-0.5">Utilisés pour le calcul du coût dans le temps de présence</p>
          </div>
          <div className="p-3">
            {presenceTypes.length === 0 ? (
              <p className="text-sm text-warm-400 italic">
                Aucun type de présence configuré.{' '}
                <Link href="/dashboard/types-presence" className="text-primary-600 hover:underline">Configurer</Link>
              </p>
            ) : (
              <>
                <div className="grid grid-cols-8 gap-2">
                  {presenceTypes.map(pt => (
                    <div key={pt.id}>
                      <label className="flex items-center gap-1 text-[10px] font-bold text-warm-500 uppercase tracking-wide truncate">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pt.color }} />
                        <span className="truncate">{pt.label}</span>
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="number" step="0.01" min="0"
                          value={rates[pt.id] ?? ''}
                          onChange={e => setRates(prev => ({ ...prev, [pt.id]: e.target.value }))}
                          className="input text-xs py-1 pr-6 w-full"
                          placeholder="0"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-warm-400">/h</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <FloatButton type="button" variant="submit" disabled={rateSaving} onClick={async () => {
                    setRateSaving(true); setRateSuccess(null)
                    const upserts = presenceTypes.map(pt => ({ school_year_id: currentYear.id, presence_type_id: pt.id, rate: parseFloat(rates[pt.id] ?? '0') || 0 }))
                    const { error: err } = await supabase.from('presence_type_rates').upsert(upserts, { onConflict: 'etablissement_id,school_year_id,presence_type_id' })
                    setRateSaving(false)
                    if (err) { toast.error(err.message); return }
                    setRateSuccess('Taux enregistrés')
                    router.refresh()
                    setTimeout(() => setRateSuccess(null), 3000)
                  }}>
                    {rateSaving ? 'Enregistrement...' : 'Enregistrer les taux'}
                  </FloatButton>
                  {rateSuccess && <span className="flex items-center gap-1 text-xs text-success-600"><CheckCircle2 size={13} /> {rateSuccess}</span>}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ── Colonne droite : historique ── */}
      <div className="w-72 flex-shrink-0 card overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-warm-100 bg-warm-50 flex-shrink-0">
          <h2 className="text-sm font-bold text-secondary-800">Historique</h2>
          <p className="text-xs text-warm-400 mt-0.5">Toutes les années scolaires</p>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-warm-100">
          {pastYears.length === 0 ? (
            <p className="px-4 py-8 text-xs text-warm-400 text-center italic">Aucun historique disponible.</p>
          ) : pastYears.map(year => {
            const yearCotisations = allCotisationTypes.filter((c: any) => c.school_year_id === year.id)
            const yearRates: any[] = allPresenceTypeRates.filter((r: any) => r.school_year_id === year.id)
            return (
              <div key={year.id} className="px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-secondary-700">{year.label}</p>

                {/* Cotisations */}
                {yearCotisations.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold text-warm-400 uppercase tracking-wide">Cotisations</p>
                    {yearCotisations.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-secondary-700 truncate">{c.label}{c.is_adult ? ' ·A' : ''}</span>
                        <span className="text-warm-500 tabular-nums flex-shrink-0">{fmtEur(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Taux */}
                {yearRates.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold text-warm-400 uppercase tracking-wide">Taux horaires</p>
                    {yearRates.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1 text-secondary-700 truncate">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.presence_types?.color }} />
                          {r.presence_types?.label}
                        </span>
                        <span className="text-warm-500 tabular-nums flex-shrink-0">{fmtEur(r.rate)}/h</span>
                      </div>
                    ))}
                  </div>
                )}

                {yearCotisations.length === 0 && yearRates.length === 0 && (
                  <p className="text-[11px] text-warm-300 italic">Aucune donnée</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
