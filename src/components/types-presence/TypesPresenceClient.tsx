'use client'

import { useState } from 'react'
import { Pencil, Trash2, X, Check, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { FloatInput, FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresenceType {
  id:             string
  label:          string
  code:           string
  color:          string
  is_active:      boolean
  is_absence:     boolean
  order_index:    number
  school_year_id: string
  /** Type systeme : 'absence' | 'cours' | 'activite' | null. Reserve = non supprimable/recodable. */
  reserved_kind:  string | null
}

interface YearRef { id: string; label: string }

interface Props {
  initialTypes: PresenceType[]
  currentYear:  { id: string; label: string; start_date: string | null; end_date: string | null }
  previousYear: YearRef | null
}

// ─── Palette couleurs ─────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  { hex: '#ef4444', name: 'Rouge'    },
  { hex: '#f97316', name: 'Orange'   },
  { hex: '#eab308', name: 'Jaune'    },
  { hex: '#22c55e', name: 'Vert'     },
  { hex: '#10b981', name: 'Émeraude' },
  { hex: '#06b6d4', name: 'Cyan'     },
  { hex: '#3b82f6', name: 'Bleu'     },
  { hex: '#6366f1', name: 'Indigo'   },
  { hex: '#8b5cf6', name: 'Violet'   },
  { hex: '#ec4899', name: 'Rose'     },
  { hex: '#6b7280', name: 'Gris'     },
  { hex: '#92400e', name: 'Marron'    },
]

const EMPTY_ROW = { label: '', code: '', color: '', is_active: true, is_absence: false }

// ─── Composant ────────────────────────────────────────────────────────────────

export default function TypesPresenceClient({ initialTypes, currentYear, previousYear }: Props) {
  const supabase = createClient()

  const [rows,            setRows]            = useState<PresenceType[]>(initialTypes)
  const [editing,         setEditing]         = useState<Partial<PresenceType> | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving,          setSaving]          = useState(false)
  const [copying,         setCopying]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const startAdd = () => {
    setEditing({ ...EMPTY_ROW })
    setConfirmDeleteId(null)
    setError(null)
  }

  const startEdit = (row: PresenceType) => {
    setEditing({ ...row })
    setConfirmDeleteId(null)
    setError(null)
  }

  const cancel = () => {
    setEditing(null)
    setError(null)
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!editing?.label?.trim()) {
      setError('Le libellé est obligatoire.')
      return
    }
    if (!editing?.code?.trim() || editing.code.trim().length !== 3) {
      setError('Le code doit contenir exactement 3 caractères.')
      return
    }
    if (!editing?.color) {
      setError('Veuillez choisir une couleur.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      label:       editing.label.trim(),
      code:        editing.code.trim().toUpperCase().replace(/\s+/g, '_'),
      color:       editing.color ?? COLOR_PALETTE[6].hex,
      is_active:   editing.is_active ?? true,
      is_absence:  editing.is_absence ?? false,
      order_index: editing.order_index ?? rows.length,
    }

    if (editing.id) {
      const { error: err } = await supabase
        .from('presence_types')
        .update(payload)
        .eq('id', editing.id)

      if (err) {
        setError(err.message.includes('unique') ? 'Ce code est déjà utilisé.' : err.message)
        setSaving(false)
        return
      }
      setRows(rows.map(r => r.id === editing.id ? { ...r, ...payload } : r))
    } else {
      const { data, error: err } = await supabase
        .from('presence_types')
        .insert({ ...payload, school_year_id: currentYear.id })
        .select()
        .single()

      if (err) {
        setError(err.message.includes('unique') ? 'Ce code est déjà utilisé.' : err.message)
        setSaving(false)
        return
      }
      setRows([...rows, data as PresenceType])
    }

    setSaving(false)
    setEditing(null)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const remove = async (id: string) => {
    setSaving(true)
    setError(null)

    // Contrôle : type réellement utilisé dans une saisie de temps de l'année en cours ?
    // Portée = établissement (RLS) + année en cours (bornes de dates ci-dessous).
    // Un taux horaire simplement paramétré (mais non utilisé) ne bloque PAS la suppression.
    const row = rows.find(r => r.id === id)
    if (row && currentYear.start_date && currentYear.end_date) {
      const { count } = await supabase
        .from('staff_time_entries')
        .select('id', { count: 'exact', head: true })
        .eq('entry_type', row.code)
        .gte('entry_date', currentYear.start_date)
        .lte('entry_date', currentYear.end_date)

      if (count && count > 0) {
        setError(`Ce type est utilisé dans ${count} saisie(s) de l'année en cours et ne peut pas être supprimé.`)
        setConfirmDeleteId(null)
        setSaving(false)
        return
      }
    }

    // Supprimer d'abord le taux horaire éventuel (paramétré mais non utilisé),
    // sinon la contrainte FK presence_type_rates bloquerait la suppression du type.
    const { error: rateErr } = await supabase
      .from('presence_type_rates')
      .delete()
      .eq('presence_type_id', id)

    if (rateErr) {
      setError('Erreur lors de la suppression du taux horaire associé.')
      setSaving(false)
      return
    }

    const { error: err } = await supabase
      .from('presence_types')
      .delete()
      .eq('id', id)

    if (err) {
      setError(err.code === '23503'
        ? 'Ce type est référencé ailleurs et ne peut pas être supprimé.'
        : err.message)
      setSaving(false)
      return
    }
    setRows(rows.filter(r => r.id !== id))
    setConfirmDeleteId(null)
    setSaving(false)
  }

  // ── Copie depuis l'année précédente ────────────────────────────────────────

  const copyFromPreviousYear = async () => {
    if (!previousYear || copying) return
    setCopying(true)
    setError(null)

    const { data: prevTypes, error: e1 } = await supabase
      .from('presence_types')
      .select('label, code, color, is_active, is_absence, order_index, reserved_kind')
      .eq('school_year_id', previousYear.id)
      .order('order_index')

    if (e1) { setError(e1.message); setCopying(false); return }

    const existingCodes = new Set(rows.map(r => r.code))
    const toInsert = (prevTypes ?? [])
      .filter((t: any) => !existingCodes.has(t.code))
      .map((t: any) => ({ ...t, school_year_id: currentYear.id }))

    if (toInsert.length === 0) {
      setError(`Rien à copier : tous les types de ${previousYear.label} sont déjà présents.`)
      setCopying(false)
      return
    }

    const { data: inserted, error: e2 } = await supabase
      .from('presence_types')
      .insert(toInsert)
      .select()

    if (e2) { setError(e2.message); setCopying(false); return }

    setRows([...rows, ...((inserted ?? []) as PresenceType[])])
    setCopying(false)
  }

  // ── JSX ligne édition (inline pour éviter la perte de focus) ───────────────

  // Couleurs déjà utilisées par d'autres types (hors ligne en cours d'édition)
  const takenColors = new Set(rows.filter(r => r.id !== editing?.id).map(r => r.color))

  const editingRow = editing && (
    <tr className="bg-primary-50/30">
      <td className="px-4 py-3">
        {editing.color ? (
          <span
            className="inline-block w-5 h-5 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: editing.color }}
          />
        ) : (
          <span
            className="inline-block w-5 h-5 rounded-full border-2 border-dashed border-warm-300"
            aria-label="Aucune couleur sélectionnée"
          />
        )}
      </td>
      <td className="px-4 py-3">
        <div className="w-2/3">
          <FloatInput
            label="Libellé"
            required
            compact
            locked={!!editing.reserved_kind}
            value={editing.label ?? ''}
            onChange={e => setEditing({ ...editing, label: e.target.value.toUpperCase() })}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="w-2/3">
          <FloatInput
            label="Code (3 car.)"
            required
            compact
            maxLength={3}
            locked={!!editing.reserved_kind}
            value={editing.code ?? ''}
            onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase().slice(0, 3) })}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Couleur du type">
          {COLOR_PALETTE.map(c => {
            const taken = takenColors.has(c.hex) && editing.color !== c.hex
            const selected = editing.color === c.hex
            const name = taken ? `${c.name} (déjà utilisé)` : c.name
            return (
              <Tooltip key={c.hex} content={name}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={name}
                  onClick={() => !taken && setEditing({ ...editing, color: c.hex })}
                  disabled={taken}
                  className={clsx(
                    'w-5 h-5 rounded-full transition-all border-2 outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/60 focus-visible:ring-offset-1',
                    selected && 'border-secondary-700 scale-110 shadow',
                    !selected && !taken && 'border-transparent hover:scale-105',
                    taken && 'cursor-not-allowed border-transparent',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              </Tooltip>
            )
          })}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs text-secondary-700">
          <input
            type="checkbox"
            checked={editing.is_active ?? true}
            disabled={!!editing.reserved_kind}
            onChange={e => setEditing({ ...editing, is_active: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-warm-300 accent-primary-500 disabled:opacity-50"
          />
          Actif
        </label>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Tooltip content="Valider">
            <FloatButton
              type="button"
              variant="submit"
              onClick={save}
              disabled={saving || !editing.label?.trim() || (editing.code?.trim().length ?? 0) !== 3 || !editing.color}
              aria-label="Valider"
            >
              <Check size={13} />
            </FloatButton>
          </Tooltip>
          <Tooltip content="Annuler">
            <FloatButton type="button" variant="secondary" onClick={cancel} disabled={saving} aria-label="Annuler">
              <X size={13} />
            </FloatButton>
          </Tooltip>
        </div>
      </td>
    </tr>
  )

  // Absence en tête, puis ordre_index
  const sortedRows = [...rows].sort((a, b) => {
    const aAbs = a.is_absence ? 0 : 1
    const bAbs = b.is_absence ? 0 : 1
    if (aAbs !== bAbs) return aAbs - bAbs
    return a.order_index - b.order_index
  })

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-warm-500">Année <span className="font-semibold text-secondary-700">{currentYear.label}</span></p>
        {!editing && (
          <div className="flex items-center gap-2">
            {previousYear && (
              <FloatButton type="button" variant="secondary" onClick={copyFromPreviousYear} disabled={copying}>
                {copying ? 'Copie…' : `Copier depuis ${previousYear.label}`}
              </FloatButton>
            )}
            <FloatButton type="button" variant="submit" onClick={startAdd}>
              Ajouter
            </FloatButton>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="flex items-center gap-2 text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-2.5">
          <X size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="flex items-start gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-600">
          <Info size={13} className="mt-0.5 shrink-0 text-blue-400" />
          <span>
            Les types <strong>ABSENCE</strong>, <strong>COURS</strong> et <strong>ACTIVITÉ</strong> sont <strong>réservés</strong> au
            bon fonctionnement de l'application (gestion des absences, validation des présences depuis l'emploi du temps).
            Ils sont reconduits automatiquement chaque année et ne peuvent être ni supprimés ni désactivés ; leur libellé et
            leur code sont verrouillés. Seule leur <strong>couleur</strong> est modifiable.
          </span>
        </div>
        <table className="w-full text-xs" aria-label="Types de présence">
          <thead>
            <tr className="border-b border-warm-100 bg-warm-50">
              <th className="list-th w-10"></th>
              <th className="list-th">Libellé</th>
              <th className="list-th">Code</th>
              <th className="list-th text-center">Statut</th>
              <th className="list-th w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-50">

            {sortedRows.map(row =>
              editing?.id === row.id ? (
                editingRow
              ) : (
                <tr
                  key={row.id}
                  className={clsx(
                    'hover:bg-warm-50/50 transition-colors',
                    !row.is_active && 'opacity-50'
                  )}
                >
                  <td className="list-td">
                    <span
                      className="inline-block w-5 h-5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: row.color }}
                    />
                  </td>
                  <td className="list-td"><span className="list-name text-secondary-800">{row.label}</span></td>
                  <td className="list-td">
                    <code className="text-xs bg-warm-100 text-warm-700 px-2 py-0.5 rounded-md font-mono">
                      {row.code}
                    </code>
                  </td>
                  <td className="list-td text-center">
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      row.is_active
                        ? 'bg-success-50 text-success-700'
                        : 'bg-warm-100 text-warm-500'
                    )}>
                      {row.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="list-td">
                    {row.reserved_kind ? (
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content="Type réservé : reconduit chaque année, non supprimable, libellé et code verrouillés (l'emploi du temps s'y rattache). Seule la couleur est modifiable.">
                          <span className="text-[10px] text-warm-500 italic">Réservé</span>
                        </Tooltip>
                        <Tooltip content="Modifier la couleur">
                          <button
                            onClick={() => startEdit(row)}
                            disabled={!!editing}
                            aria-label={`Modifier la couleur de ${row.label}`}
                            className={clsx(
                              'p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
                              editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-secondary-700 hover:bg-warm-100'
                            )}
                          >
                            <Pencil size={15} />
                          </button>
                        </Tooltip>
                      </div>
                    ) : confirmDeleteId === row.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => remove(row.id)}
                          disabled={saving}
                          className="text-xs text-danger-600 hover:text-danger-700 font-medium rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-danger-400/60"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-warm-500 hover:text-warm-700 rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-warm-400/50"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content="Modifier">
                          <button
                            onClick={() => startEdit(row)}
                            disabled={!!editing}
                            aria-label={`Modifier ${row.label}`}
                            className={clsx(
                              'p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
                              editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-secondary-700 hover:bg-warm-100'
                            )}
                          >
                            <Pencil size={15} />
                          </button>
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <button
                            onClick={() => setConfirmDeleteId(row.id)}
                            disabled={!!editing}
                            aria-label={`Supprimer ${row.label}`}
                            className={clsx(
                              'p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-danger-400/60',
                              editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-danger-600 hover:bg-danger-50'
                            )}
                          >
                            <Trash2 size={15} />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                  </td>
                </tr>
              )
            )}

            {/* Nouvelle saisie : ligne en bas */}
            {editing && !editing.id && editingRow}

            {sortedRows.length === 0 && !editing && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-warm-400">
                  Aucun type de présence configuré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
