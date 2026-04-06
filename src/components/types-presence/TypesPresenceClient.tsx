'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { FloatInput, FloatButton } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresenceType {
  id:          string
  label:       string
  code:        string
  color:       string
  is_active:   boolean
  order_index: number
}

interface Props {
  initialTypes: PresenceType[]
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
  { hex: '#1f2937', name: 'Sombre'   },
]

const EMPTY_ROW = { label: '', code: '', color: COLOR_PALETTE[6].hex, is_active: true }

// ─── Composant ────────────────────────────────────────────────────────────────

export default function TypesPresenceClient({ initialTypes }: Props) {
  const supabase = createClient()

  const [rows,            setRows]            = useState<PresenceType[]>(initialTypes)
  const [editing,         setEditing]         = useState<Partial<PresenceType> | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving,          setSaving]          = useState(false)
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
    if (!editing?.code?.trim() || editing.code.trim().length < 3) {
      setError('Le code doit contenir au moins 3 caractères.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      label:       editing.label.trim(),
      code:        editing.code.trim().toUpperCase().replace(/\s+/g, '_'),
      color:       editing.color ?? COLOR_PALETTE[6].hex,
      is_active:   editing.is_active ?? true,
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
        .insert(payload)
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

    // Vérifier si le type est utilisé dans les saisies de temps de l'année en cours
    const row = rows.find(r => r.id === id)
    if (row) {
      const { data: currentYear } = await supabase
        .from('school_years')
        .select('start_date, end_date')
        .eq('is_current', true)
        .maybeSingle()

      if (currentYear?.start_date && currentYear?.end_date) {
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
    }

    const { error: err } = await supabase
      .from('presence_types')
      .delete()
      .eq('id', id)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }
    setRows(rows.filter(r => r.id !== id))
    setConfirmDeleteId(null)
    setSaving(false)
  }

  // ── JSX ligne édition (inline pour éviter la perte de focus) ───────────────

  const editingRow = editing && (
    <tr className="bg-primary-50/30">
      <td className="px-4 py-3">
        <span
          className="inline-block w-5 h-5 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: editing.color ?? COLOR_PALETTE[6].hex }}
        />
      </td>
      <td className="px-4 py-3">
        <FloatInput
          label="Libellé"
          required
          compact
          value={editing.label ?? ''}
          onChange={e => setEditing({ ...editing, label: e.target.value })}
        />
      </td>
      <td className="px-4 py-3">
        <FloatInput
          label="Code (min. 3 car.)"
          required
          compact
          value={editing.code ?? ''}
          onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
        />
      </td>
      <td className="px-4 py-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {COLOR_PALETTE.map(c => (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                onClick={() => setEditing({ ...editing, color: c.hex })}
                className={clsx(
                  'w-5 h-5 rounded-full transition-all border-2',
                  editing.color === c.hex
                    ? 'border-secondary-700 scale-110 shadow'
                    : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          <label className="flex items-center justify-center gap-1.5 cursor-pointer select-none text-xs text-secondary-700">
            <input
              type="checkbox"
              checked={editing.is_active ?? true}
              onChange={e => setEditing({ ...editing, is_active: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-warm-300 accent-primary-500"
            />
            Actif
          </label>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <FloatButton
            type="button"
            variant="submit"
            onClick={save}
            disabled={saving || !editing.label?.trim() || (editing.code?.trim().length ?? 0) < 3}
            title="Valider"
          >
            <Check size={13} />
          </FloatButton>
          <FloatButton type="button" variant="secondary" onClick={cancel} disabled={saving}>
            <X size={13} />
          </FloatButton>
        </div>
      </td>
    </tr>
  )

  return (
    <div className="space-y-4">

      {!editing && (
        <div className="flex justify-end">
          <FloatButton type="button" variant="submit" onClick={startAdd}>
            <Plus size={15} /> Ajouter
          </FloatButton>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-xl px-4 py-2.5">
          <X size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-warm-100 bg-warm-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide">Libellé</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide">Code</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-warm-500 uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-50">

            {rows.map(row =>
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
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-5 h-5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: row.color }}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-secondary-800">{row.label}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-warm-100 text-warm-700 px-2 py-0.5 rounded-md font-mono">
                      {row.code}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      row.is_active
                        ? 'bg-success-50 text-success-700'
                        : 'bg-warm-100 text-warm-500'
                    )}>
                      {row.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {confirmDeleteId === row.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => remove(row.id)}
                          disabled={saving}
                          className="text-xs text-danger-600 hover:text-danger-700 font-medium"
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
                          onClick={() => setConfirmDeleteId(row.id)}
                          disabled={!!editing}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            editing ? 'text-warm-300 cursor-not-allowed' : 'text-warm-400 hover:text-danger-600 hover:bg-danger-50'
                          )}
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            )}

            {/* Nouvelle saisie : ligne en bas */}
            {editing && !editing.id && editingRow}

            {rows.length === 0 && !editing && (
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
