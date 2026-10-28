'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import { estTypeSaisissable } from '@/lib/temps-presence/saisie'
import type { VacationPeriod, JourFerie } from '@/types/database'
import { FloatInput, FloatSelect, FloatTextarea, FloatButton } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import type { TimeEntry } from './TempsPresenceClient'

interface PresenceType {
  id: string
  label: string
  code: string
  color: string
  is_absence: boolean
  /** `cours` | `activite` | `absence` pour les types RESERVES, sinon null. */
  reserved_kind?: string | null
}

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface Props {
  date: string
  entry: TimeEntry | null
  currentUserId: string
  canManage: boolean
  staffList: StaffMember[]
  presenceTypes: PresenceType[]
  existingEntries: TimeEntry[]
  onClose: () => void
  onSaved: () => void
  /** Vacances et jours feries : une saisie un jour ferme est signalee. */
  vacations?: VacationPeriod[]
  feries?: JourFerie[]
}

/**
 * Saisie d'heures dans Temps de presence.
 *
 * ── L'ABSENCE D'UN ENSEIGNANT NE SE SAISIT PLUS ICI (lot 3b-1, 28/10) ──────
 *
 * Elle avait sa place ici (type absence, creneaux manques, remplacant par
 * creneau, heures du remplacant ecrites aussitot). Elle passe par la page
 * « Absences enseignants », seul chemin des absences et des remplacements
 * (docs/CONCEPTION-PLANNING-ABSENCES.md) ; les heures d'un remplacant viennent
 * de la VALIDATION de la seance dans l'emploi du temps. Le type absence n'est
 * donc plus propose, ni la case « En remplacement de », ni les types cours et
 * activite (une heure de seance se valide dans l'EDT). Pour le reste du
 * personnel, ne pas travailler un jour ne se declare pas : on ne saisit pas
 * d'heures.
 *
 * Une saisie existante qui porte un remplacement (ecrite par une validation)
 * le GARDE quand on la modifie : la modale ne l'efface pas.
 */
export default function TimeEntryModal({ date, entry, currentUserId, canManage, staffList, presenceTypes, existingEntries, onClose, onSaved, vacations = [], feries = [] }: Props) {
  const supabase = createClient()
  const isEdit = !!entry

  // Jour de fermeture : on AVERTIT sans interdire. Une permanence pendant les
  // vacances ou une reunion un jour ferie existent ; bloquer priverait d'un cas
  // reel sans laisser de contournement, alors qu'un avertissement ignore ne
  // coute rien.
  const fermeture = jourFerme(date, vacations, feries)

  // Ne se saisissent plus ici : l'absence, le cours et l'activite (regle unique
  // `lib/temps-presence/saisie`). Restent les types libres de l'ecole.
  const typesSaisissables = presenceTypes.filter(estTypeSaisissable)
  const defaultType = entry?.entry_type ?? ''

  const [profileId, setProfileId] = useState(entry?.profile_id ?? (canManage ? '' : currentUserId))
  const [entryType, setEntryType] = useState<string>(defaultType)
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? '12:00')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fermeture volontairement limitee a X / Annuler (FormModal : ni clic hors
  // modale ni Echap) pour ne pas perdre une saisie en cours.

  const isDirty = !isEdit || (
    profileId !== (entry?.profile_id ?? currentUserId) ||
    entryType !== defaultType ||
    startTime !== (entry?.start_time?.slice(0, 5) ?? '09:00') ||
    endTime !== (entry?.end_time?.slice(0, 5) ?? '12:00') ||
    notes !== (entry?.notes ?? '')
  )

  const canSave = isDirty
    && (!canManage || !!profileId)
    && !!entryType
    && !!startTime && !!endTime

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm)
    if (durationMinutes <= 0) {
      setError('L\'heure de fin doit être supérieure à l\'heure de début')
      setSaving(false)
      return
    }

    // Vérification chevauchement de créneaux pour la même personne
    const overlap = existingEntries.find(e => {
      if (e.profile_id !== profileId) return false
      if (isEdit && e.id === entry!.id) return false
      if (!e.start_time || !e.end_time) return false
      return startTime < e.end_time.slice(0, 5) && endTime > e.start_time.slice(0, 5)
    })
    if (overlap) {
      const s = staffList.find(st => st.id === profileId)
      const name = s ? `${s.last_name} ${s.first_name}` : 'Cette personne'
      setError(`${name} a déjà un créneau de ${overlap.start_time?.slice(0, 5)} à ${overlap.end_time?.slice(0, 5)} ce jour. Les créneaux ne peuvent pas se chevaucher.`)
      setSaving(false)
      return
    }

    const ligne = {
      profile_id: profileId,
      entry_date: date,
      entry_type: entryType,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      // Remplacement CONSERVE tel qu'il a ete ecrit (validation d'une seance).
      is_replacement: entry?.is_replacement ?? false,
      replaced_profile_id: entry?.replaced_profile_id ?? null,
      absence_reason: null,
      notes: notes || null,
      recorded_by: currentUserId,
    }

    const echec = isEdit
      ? erreurEcriture(
          await supabase.from('staff_time_entries').update(ligne).eq('id', entry!.id).select('id'),
          'Cette saisie',
        )
      : (await supabase.from('staff_time_entries').insert(ligne)).error?.message ?? null

    if (echec) { setSaving(false); setError(echec); return }

    setSaving(false)
    onSaved()
  }

  return (
    <FormModal
      title={isEdit ? 'Modifier la saisie' : 'Nouvelle saisie'}
      onClose={onClose}
      footer={<>
        <span className="text-xs text-red-700"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton variant="secondary" type="button" onClick={onClose}>Annuler</FloatButton>
        <FloatButton
          variant={isEdit ? 'edit' : 'submit'}
          type="button"
          onClick={handleSave}
          loading={saving}
          disabled={!canSave}
        >
          {isEdit ? 'Modifier' : 'Valider'}
        </FloatButton>
      </>}
    >
        <div className="space-y-4">
          {fermeture && (
            <p
              role="status"
              className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5"
            >
              {fermeture.titre}{fermeture.label ? ` · ${fermeture.label}` : ''}
            </p>
          )}

          <p className="text-xs text-warm-700 capitalize">{dateLabel}</p>

          {/* Type */}
          <div className="relative border border-warm-300 rounded-lg px-3 pt-6 pb-2.5">
            <span className="absolute top-1.5 left-3 text-[10px] font-semibold tracking-wide uppercase text-warm-700 pointer-events-none select-none">Type<span className="text-red-700 ml-0.5">*</span></span>
            {/* Grille 2 colonnes : tous les boutons de largeur identique, label
                sur une ligne (le flex-wrap etirait les rangees differemment et
                faisait deborder les libelles longs comme « ADMINISTRATIF »). */}
            <div className="grid grid-cols-2 gap-2">
              {typesSaisissables.map(pt => {
                const selected = entryType.toUpperCase() === pt.code.toUpperCase()
                return (
                  <label key={pt.id} className="block">
                    <input
                      type="radio"
                      name="entry_type"
                      value={pt.code}
                      checked={selected}
                      onChange={() => setEntryType(pt.code)}
                      className="sr-only"
                    />
                    <span
                      className={`block text-center text-xs font-semibold py-1.5 px-2 rounded-md border cursor-pointer transition-all truncate ${!selected ? 'bg-white border-warm-300 text-warm-700 hover:border-warm-400' : ''}`}
                      style={selected ? { backgroundColor: pt.color, color: '#fff', borderColor: pt.color } : undefined}
                    >
                      {pt.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Membre */}
          {canManage ? (
            <FloatSelect
              label="Membre équipe"
              required
              disabled={!entryType}
              value={profileId}
              onChange={e => setProfileId(e.target.value)}
            >
              <option value=""></option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
              ))}
            </FloatSelect>
          ) : (
            <p className="text-xs text-warm-700">
              <span className="font-bold">{staffList.find(s => s.id === currentUserId)?.last_name} {staffList.find(s => s.id === currentUserId)?.first_name}</span>
            </p>
          )}

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput
              label="Début"
              required
              type="time"
              value={startTime}
              onChange={e => {
                setStartTime(e.target.value)
                if (endTime && e.target.value && endTime <= e.target.value) setEndTime('')
              }}
            />
            <FloatInput
              label="Fin"
              required
              type="time"
              value={endTime}
              onChange={e => { if (!startTime || e.target.value > startTime) setEndTime(e.target.value) }}
              min={startTime || undefined}
              disabled={!startTime}
            />
          </div>

          {/* Notes */}
          <FloatTextarea
            label="Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Commentaire optionnel..."
          />

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
    </FormModal>
  )
}
