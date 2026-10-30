'use client'

import { useState } from 'react'
import { Pencil, Trash2, X, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { deletePresenceType } from '@/app/dashboard/types-presence/actions'
import { FloatInput, FloatButton, SwitchOuiNon } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import { Puce } from '@/components/dashboard/tdb'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FormModal from '@/components/ui/FormModal'

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
      const res = await supabase
        .from('presence_types')
        .update(payload)
        .eq('id', editing.id)
        .select('id')

      if (res.error?.message.includes('unique')) {
        setError('Ce code est déjà utilisé.')
        setSaving(false)
        return
      }
      const echec = erreurEcriture(res, 'Ce type de présence')
      if (echec) { setError(echec); setSaving(false); return }
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

    // Tout le contrôle (type réservé, usage dans les saisies de temps, nettoyage
    // du taux associé) est fait par la server action : lui seul est hors de portée
    // d'un appel direct à l'API, et la base porte en plus un trigger de garde.
    const { error: err } = await deletePresenceType(id)
    if (err) {
      setError(err)
      setConfirmDeleteId(null)
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
      .filter(t => !existingCodes.has(t.code))
      .map(t => ({ ...t, school_year_id: currentYear.id }))

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

  // ── Modale de saisie ───────────────────────────────────────────────────────

  // Couleurs déjà utilisées par d'autres types (hors type en cours d'édition)
  const takenColors = new Set(rows.filter(r => r.id !== editing?.id).map(r => r.color))

  const original   = editing?.id ? rows.find(r => r.id === editing.id) : undefined
  const inchange   = !!original && !!editing
    && editing.label === original.label && editing.code === original.code
    && editing.color === original.color && editing.is_active === original.is_active
  const formValide = !!editing?.label?.trim() && (editing?.code?.trim().length ?? 0) === 3 && !!editing?.color

  // Absence en tête, puis ordre_index
  const sortedRows = [...rows].sort((a, b) => {
    const aAbs = a.is_absence ? 0 : 1
    const bAbs = b.is_absence ? 0 : 1
    if (aAbs !== bAbs) return aAbs - bAbs
    return a.order_index - b.order_index
  })

  return (
    <div className="space-y-4">

      {error && !editing && (
        <div role="alert" aria-live="assertive" className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <X size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="ton-info flex items-start gap-2 rounded-lg px-4 py-2.5 text-xs">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Les types <strong>ABSENCE</strong>, <strong>COURS</strong> et <strong>ACTIVITÉ</strong> sont <strong>réservés</strong> au
            bon fonctionnement de l'application (gestion des absences, validation des présences depuis l'emploi du temps).
            Ils sont reconduits automatiquement chaque année et ne peuvent être ni supprimés ni désactivés ; leur libellé et
            leur code sont verrouillés. Seule leur <strong>couleur</strong> est modifiable.
          </span>
      </div>

      {/* Boutons juste au-dessus du tableau (demande du 21/10) */}
      <div className="space-y-2">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {previousYear && (
          <FloatButton type="button" variant="secondary" onClick={copyFromPreviousYear} disabled={copying}>
            {copying ? 'Copie…' : `Copier depuis ${previousYear.label}`}
          </FloatButton>
        )}
        <FloatButton type="button" variant="submit" onClick={startAdd}>
          Ajouter
        </FloatButton>
      </div>

      <div className="liste">
        <table className="w-full text-xs" aria-label="Types de présence">
          <thead>
            <tr className="liste-entete border-b border-[var(--card-border)]">
              <th className="list-th w-10"></th>
              <th className="list-th">Libellé</th>
              <th className="list-th">Code</th>
              <th className="list-th text-center">Statut</th>
              <th className="list-th w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-50">

            {sortedRows.map(row => (
              <tr
                key={row.id}
                className={clsx(
                  'transition-colors',
                  !row.is_active && 'bg-warm-50'
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
                  <Puce ton={row.is_active ? 'ok' : 'neutre'}>{row.is_active ? 'Actif' : 'Inactif'}</Puce>
                </td>
                <td className="list-td">
                  {row.reserved_kind ? (
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content="Type réservé : reconduit chaque année, non supprimable, libellé et code verrouillés (l'emploi du temps s'y rattache). Seule la couleur est modifiable.">
                        <span><Puce ton="neutre">Réservé</Puce></span>
                      </Tooltip>
                      <Tooltip content="Modifier la couleur">
                        <button
                          onClick={() => startEdit(row)}
                          aria-label={`Modifier la couleur de ${row.label}`}
                          className="p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-focus)] text-warm-700 hover:text-secondary-700 hover:bg-warm-100"
                        >
                          <Pencil size={15} />
                        </button>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content="Modifier">
                        <button
                          onClick={() => startEdit(row)}
                          aria-label={`Modifier ${row.label}`}
                          className="p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-focus)] text-warm-700 hover:text-secondary-700 hover:bg-warm-100"
                        >
                          <Pencil size={15} />
                        </button>
                      </Tooltip>
                      <Tooltip content="Supprimer">
                        <button
                          onClick={() => setConfirmDeleteId(row.id)}
                          aria-label={`Supprimer ${row.label}`}
                          className="p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/60 text-warm-700 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {sortedRows.length === 0 && (
              <tr className="sans-survol">
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-warm-700">
                  Aucun type de présence configuré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {editing && (
        <FormModal
          title={!editing.id ? 'Nouveau type de présence' : editing.reserved_kind ? 'Modifier la couleur' : 'Modifier le type de présence'}
          onClose={cancel}
          footer={<>
            <span className="text-xs text-warm-700"><span className="font-semibold text-red-700">*</span> obligatoire</span>
            <div className="flex-1" />
            <FloatButton type="button" variant="secondary" onClick={cancel} disabled={saving}>Annuler</FloatButton>
            <FloatButton type="button" variant={editing.id ? 'edit' : 'submit'} onClick={save} disabled={saving || !formValide || inchange}>
              {saving ? 'Enregistrement...' : editing.id ? 'Modifier' : 'Créer'}
            </FloatButton>
          </>}
        >
          {error && (
            <p role="alert" className="text-xs text-red-700">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <FloatInput
              label="Libellé"
              required
              compact
              autoFocus={!editing.reserved_kind}
              locked={!!editing.reserved_kind}
              value={editing.label ?? ''}
              onChange={e => setEditing({ ...editing, label: e.target.value.toUpperCase() })}
            />
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
          <div>
            <p className="text-xs font-semibold text-warm-700 uppercase tracking-wide mb-2">
              Couleur <span className="text-red-700">*</span>
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur du type">
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
                        'w-6 h-6 rounded-full transition-all border-2 outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/60 focus-visible:ring-offset-1',
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
          </div>
          <SwitchOuiNon
            label="Actif"
            checked={editing.is_active ?? true}
            disabled={!!editing.reserved_kind}
            onChange={v => setEditing({ ...editing, is_active: v })}
          />
        </FormModal>
      )}

      {confirmDeleteId && (
        <ConfirmModal
          open
          variant="danger"
          confirmColor="red"
          title="Supprimer le type de présence"
          confirmLabel={saving ? 'Suppression…' : 'Supprimer définitivement'}
          confirmDisabled={saving}
          onConfirm={() => remove(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        >
          <p className="text-sm text-warm-700">{rows.find(r => r.id === confirmDeleteId)?.label ?? ''}</p>
        </ConfirmModal>
      )}

    </div>
  )
}
