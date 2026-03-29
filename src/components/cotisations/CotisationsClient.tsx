'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import type { CotisationType } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  currentYear: { id: string; label: string } | null
  cotisationTypes: CotisationType[]
  classesWithoutCount: number
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
  id: null, label: '', amount: '', registration_fee: '0', sibling_discount: '0', sibling_discount_same_type: false, max_installments: '1', is_adult: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function CotisationsClient({ currentYear, cotisationTypes: initial, classesWithoutCount, hourlyRates: initialRates }: Props & { hourlyRates?: any }) {
  const router   = useRouter()
  const toast    = useToast()
  const supabase = createClient()

  const [rows, setRows]                       = useState<CotisationType[]>(initial)
  const [editing, setEditing]                 = useState<EditingRow | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving]                   = useState(false)

  // Taux horaires
  const [rateCours, setRateCours]       = useState(initialRates?.rate_cours?.toString() ?? '')
  const [rateActivite, setRateActivite] = useState(initialRates?.rate_activite?.toString() ?? '')
  const [rateMenage, setRateMenage]     = useState(initialRates?.rate_menage?.toString() ?? '')
  const [rateSaving, setRateSaving]     = useState(false)
  const [rateSuccess, setRateSuccess]   = useState<string | null>(null)

  // ── Pas d'année en cours ──────────────────────────────────────────────────

  if (!currentYear) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle size={36} className="text-warm-400" />
        <p className="text-sm text-warm-500">Aucune annee scolaire en cours. Configurez-en une avant de parametrer les cotisations.</p>
        <Link href="/dashboard/annee-scolaire" className="btn btn-primary text-sm">
          Configurer l'annee scolaire
        </Link>
      </div>
    )
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const startAdd = () => {
    setEditing({ ...EMPTY_ROW })
    setConfirmDeleteId(null)
  }

  const startEdit = (row: CotisationType) => {
    setEditing({
      id:                         row.id,
      label:                      row.label,
      amount:                     String(row.amount),
      registration_fee:           String(row.registration_fee),
      sibling_discount:           String(row.sibling_discount),
      sibling_discount_same_type: row.sibling_discount_same_type ?? false,
      max_installments:           String(row.max_installments),
      is_adult:                   row.is_adult ?? false,
    })
    setConfirmDeleteId(null)
  }

  const cancel = () => {
    setEditing(null)
  }

  const save = async () => {
    if (!editing) return
    const label            = editing.label.trim()
    const amount           = parseFloat(editing.amount)
    const registrationFee  = parseFloat(editing.registration_fee) || 0
    const siblingDiscount  = parseFloat(editing.sibling_discount) || 0
    const maxInst          = parseInt(editing.max_installments, 10)

    if (!label)                       { toast.error('Le libelle est obligatoire.'); return }
    if (isNaN(amount) || amount < 0)  { toast.error('La cotisation annuelle doit etre un nombre positif.'); return }
    if (registrationFee < 0)          { toast.error('Les frais de dossier ne peuvent pas etre negatifs.'); return }
    if (siblingDiscount < 0)          { toast.error('La reduction fratrie ne peut pas etre negative.'); return }
    if (isNaN(maxInst) || maxInst < 1){ toast.error('Le nombre d\'echeances doit etre au moins 1.'); return }

    const duplicate = rows.find(r => r.label.toLowerCase() === label.toLowerCase() && r.id !== editing.id)
    if (duplicate) { toast.error(`Le type "${label}" existe deja.`); return }

    setSaving(true)

    const payload = {
      label,
      amount,
      registration_fee:           registrationFee,
      sibling_discount:           siblingDiscount,
      sibling_discount_same_type: editing.sibling_discount_same_type,
      max_installments:           maxInst,
      is_adult:                   editing.is_adult,
    }

    try {
      if (editing.id) {
        const { error: err } = await supabase
          .from('cotisation_types')
          .update(payload)
          .eq('id', editing.id)
        if (err) throw err
        setRows(prev => prev.map(r => r.id === editing.id ? { ...r, ...payload } : r))
        toast.success('Type mis à jour.')
      } else {
        const nextIndex = rows.length > 0 ? Math.max(...rows.map(r => r.order_index)) + 1 : 0
        const { data, error: err } = await supabase
          .from('cotisation_types')
          .insert({
            ...payload,
            school_year_id:   currentYear.id,
            order_index:      nextIndex,
          })
          .select()
          .single()
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

  // ── Bloc d'edition (inline JSX, pas un sous-composant) ─────────────────

  const editForm = editing && (
    <div className="card p-5 space-y-4 border-2 border-primary-200 bg-primary-50/20">
      <h3 className="text-sm font-semibold text-secondary-800">
        {editing.id ? 'Modifier le type' : 'Nouveau type de cotisation'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Label */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-medium text-warm-500 mb-1">Type de scolarite</label>
          <input
            autoFocus
            className="input text-sm"
            placeholder="Ex: Maternelle"
            value={editing.label}
            onChange={e => setEditing({ ...editing, label: e.target.value })}
          />
          <label className="flex items-center gap-1.5 mt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={editing.is_adult}
              onChange={e => setEditing({ ...editing, is_adult: e.target.checked })}
              className="accent-primary-600 w-3.5 h-3.5 flex-shrink-0"
            />
            <span className="text-xs text-secondary-600">Cours adultes</span>
            <span title="Les classes de ce type seront réservées aux parents / tuteurs adultes (affectation pédagogique adultes).">
              <Info size={11} className="text-warm-300 flex-shrink-0" />
            </span>
          </label>
        </div>

        {/* Cotisation annuelle */}
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Cotisation annuelle</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              className="input text-sm pr-8"
              placeholder="0"
              value={editing.amount}
              onChange={e => setEditing({ ...editing, amount: e.target.value })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warm-400">EUR</span>
          </div>
        </div>

        {/* Frais de dossier */}
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Frais de dossier</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              className="input text-sm pr-8"
              placeholder="0"
              value={editing.registration_fee}
              onChange={e => setEditing({ ...editing, registration_fee: e.target.value })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warm-400">EUR</span>
          </div>
        </div>

        {/* Reduction fratrie */}
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Reduction fratrie</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              className="input text-sm pr-8"
              placeholder="0"
              value={editing.sibling_discount}
              onChange={e => setEditing({ ...editing, sibling_discount: e.target.value })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warm-400">EUR</span>
          </div>
          <label className="flex items-center gap-1.5 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editing.sibling_discount_same_type}
                onChange={e => setEditing({ ...editing, sibling_discount_same_type: e.target.checked })}
                className="accent-amber-500 w-3.5 h-3.5 flex-shrink-0"
              />
              <span className="text-xs text-secondary-600">Même type uniquement</span>
              <span title="Coché : la réduction ne s'applique qu'entre enfants du même type de scolarité. Décoché : dès le 2e enfant, tous types confondus.">
                <Info size={11} className="text-warm-300 flex-shrink-0" />
              </span>
            </label>
        </div>

        {/* Max echeances */}
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Max echeances</label>
          <input
            type="number"
            min="1"
            max="12"
            className="input text-sm"
            value={editing.max_installments}
            onChange={e => setEditing({ ...editing, max_installments: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="btn btn-primary text-sm flex items-center gap-1.5"
        >
          <Check size={14} />
          {saving ? 'Enregistrement...' : editing.id ? 'Enregistrer' : 'Ajouter'}
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="btn btn-secondary text-sm"
        >
          Annuler
        </button>
      </div>
    </div>
  )

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* En-tete */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-warm-500">
            Annee scolaire : <span className="font-medium text-secondary-700">{currentYear.label}</span>
          </p>
        </div>

        {!editing && (
          <button onClick={startAdd} className="btn btn-primary text-sm flex items-center gap-1.5">
            <Plus size={15} />
            Ajouter un type
          </button>
        )}
      </div>

      {/* Formulaire d'edition (au-dessus du tableau) */}
      {editForm}

      {/* Tableau lecture */}
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-warm-100 bg-warm-50/60">
              <th className="px-4 py-2.5 text-xs font-semibold text-warm-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Cotisation</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Frais dossier</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Reduc. fratrie</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-warm-500 uppercase tracking-wider text-center">Echeances</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.id}
                className={clsx(
                  'border-b border-warm-100 transition-colors',
                  editing?.id === row.id ? 'bg-primary-50/40' : 'hover:bg-warm-50/40'
                )}
              >
                <td className="px-4 py-2.5 text-sm font-medium text-secondary-800">
                  <span className="inline-flex items-center gap-2">
                    {row.label}
                    {row.is_adult && (
                      <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">Adultes</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm text-secondary-700 text-right tabular-nums">{fmtEur(row.amount)}</td>
                <td className="px-4 py-2.5 text-sm text-secondary-700 text-right tabular-nums">
                  {row.registration_fee > 0 ? fmtEur(row.registration_fee) : <span className="text-warm-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-sm text-secondary-700 text-right tabular-nums">
                  {row.sibling_discount > 0 ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      -{fmtEur(row.sibling_discount)}
                      <span
                        className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-medium', row.sibling_discount_same_type ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}
                        title={row.sibling_discount_same_type ? 'Meme type uniquement' : 'Tous types confondus'}
                      >
                        {row.sibling_discount_same_type ? '= type' : 'tous'}
                      </span>
                    </span>
                  ) : <span className="text-warm-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-sm text-warm-500 text-center">
                  {row.max_installments === 1 ? 'Comptant' : `Jusqu'a ${row.max_installments}x`}
                </td>
                <td className="px-4 py-2.5">
                  {confirmDeleteId === row.id ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => remove(row.id)}
                        disabled={saving}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-warm-400 hover:text-warm-600"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(row)}
                        disabled={!!editing}
                        className={clsx(
                          'p-1.5 rounded-lg transition-colors',
                          editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-secondary-700 hover:bg-warm-100'
                        )}
                        title="Modifier"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(row.id) }}
                        disabled={!!editing}
                        className={clsx(
                          'p-1.5 rounded-lg transition-colors',
                          editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-red-600 hover:bg-red-50'
                        )}
                        title="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {rows.length === 0 && !editing && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-warm-400">
                  Aucun type de cotisation configure pour cette annee.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Compteur classes sans affectation */}
      {classesWithoutCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>
            <strong>{classesWithoutCount}</strong> classe{classesWithoutCount > 1 ? 's' : ''} sans type de cotisation affecte.
          </span>
          <Link href="/dashboard/classes" className="ml-auto text-xs font-medium text-amber-800 hover:underline">
            Voir les classes
          </Link>
        </div>
      )}

      {/* ── Taux horaires ────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-warm-100 bg-warm-50">
          <h2 className="text-sm font-bold text-secondary-800">Taux horaires — {currentYear.label}</h2>
          <p className="text-xs text-warm-400 mt-0.5">Utilises pour le calcul du cout dans le temps de presence</p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Cours</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rateCours}
                  onChange={e => setRateCours(e.target.value)}
                  className="input text-sm py-1.5 pr-10 w-full"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warm-400">/h</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Activite scolaire</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rateActivite}
                  onChange={e => setRateActivite(e.target.value)}
                  className="input text-sm py-1.5 pr-10 w-full"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warm-400">/h</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Menage</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rateMenage}
                  onChange={e => setRateMenage(e.target.value)}
                  className="input text-sm py-1.5 pr-10 w-full"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warm-400">/h</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              disabled={rateSaving}
              onClick={async () => {
                setRateSaving(true)
                setRateSuccess(null)
                const payload = {
                  school_year_id: currentYear.id,
                  rate_cours: parseFloat(rateCours) || 0,
                  rate_activite: parseFloat(rateActivite) || 0,
                  rate_menage: parseFloat(rateMenage) || 0,
                }
                const { error: err } = initialRates?.id
                  ? await supabase.from('staff_hourly_rates').update(payload).eq('id', initialRates.id)
                  : await supabase.from('staff_hourly_rates').insert(payload)
                setRateSaving(false)
                if (err) { toast.error(err.message); return }
                setRateSuccess('Taux horaires enregistres')
                router.refresh()
                setTimeout(() => setRateSuccess(null), 3000)
              }}
              className="btn-primary text-xs px-4 py-1.5"
            >
              {rateSaving ? 'Enregistrement...' : 'Enregistrer les taux'}
            </button>
            {rateSuccess && (
              <span className="flex items-center gap-1 text-xs text-success-600">
                <CheckCircle2 size={14} /> {rateSuccess}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
