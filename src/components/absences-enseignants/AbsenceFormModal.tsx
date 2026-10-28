'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FormModal from '@/components/ui/FormModal'
import { FloatButton, FloatCheckbox, FloatInput, FloatSelect } from '@/components/ui/FloatFields'
import { MOTIFS } from '@/lib/absences-enseignants/libelles'
import { horodatageParis } from '@/lib/dates'
import { enregistrerAbsence } from '@/app/dashboard/absences-enseignants/actions'

/**
 * Declarer ou modifier une absence d'enseignant (decision du 28/10) : du
 * date + heure au date + heure, bornes comprises. « Journee entiere » pose
 * 00:00 et 23:59, pour ne pas taper les heures d'une absence d'une ou plusieurs
 * journees. L'enseignant d'une absence ne change pas (verrouille en modification).
 * Apres une declaration, on ouvre la fiche : c'est la qu'on decide des seances.
 */

export interface AbsenceSaisie {
  id: string
  teacherId: string
  debut: string   // AAAA-MM-JJTHH:MM
  fin: string
  motif: string
}

const DEBUT_JOURNEE = '00:00'
const FIN_JOURNEE = '23:59'

export default function AbsenceFormModal({ absence, enseignants, onClose }: {
  absence: AbsenceSaisie | null
  enseignants: { id: string; nom: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const isEdit = !!absence
  const aujourdhui = horodatageParis(new Date()).slice(0, 10)

  const [teacherId, setTeacherId] = useState(absence?.teacherId ?? '')
  const [journeeEntiere, setJourneeEntiere] = useState(
    !absence || (absence.debut.slice(11) === DEBUT_JOURNEE && absence.fin.slice(11) === FIN_JOURNEE),
  )
  const [dateDebut, setDateDebut] = useState(absence?.debut.slice(0, 10) ?? aujourdhui)
  const [heureDebut, setHeureDebut] = useState(absence?.debut.slice(11) ?? '09:00')
  const [dateFin, setDateFin] = useState(absence?.fin.slice(0, 10) ?? aujourdhui)
  const [heureFin, setHeureFin] = useState(absence?.fin.slice(11) ?? '12:00')
  const [motif, setMotif] = useState(absence?.motif ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debut = `${dateDebut}T${journeeEntiere ? DEBUT_JOURNEE : heureDebut}`
  const fin = `${dateFin}T${journeeEntiere ? FIN_JOURNEE : heureFin}`
  const periodeValide = !!dateDebut && !!dateFin && fin > debut
  const isDirty = !isEdit || debut !== absence.debut || fin !== absence.fin || motif !== absence.motif
  const canSave = isDirty && !!teacherId && !!motif && periodeValide

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const r = await enregistrerAbsence({ id: absence?.id ?? null, teacherId, debut, fin, motif })
    setSaving(false)
    if (r.error || !r.id) { setError(r.error ?? 'L’absence n’a pas pu être enregistrée.'); return }
    onClose()
    if (isEdit) router.refresh()
    else router.push(`/dashboard/absences-enseignants/${r.id}`)
  }

  return (
    <FormModal
      title={isEdit ? 'Modifier l’absence' : 'Déclarer une absence'}
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
        <FloatSelect
          label="Enseignant"
          required
          value={teacherId}
          onChange={e => setTeacherId(e.target.value)}
          disabled={isEdit}
        >
          <option value="" disabled hidden />
          {enseignants.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </FloatSelect>

        <FloatCheckbox
          label="Journée entière"
          variant="switch"
          checked={journeeEntiere}
          onChange={setJourneeEntiere}
        />

        <div className="grid grid-cols-2 gap-3">
          <FloatInput label="Du" type="date" required value={dateDebut}
            onChange={e => { setDateDebut(e.target.value); if (dateFin < e.target.value) setDateFin(e.target.value) }} />
          {!journeeEntiere
            ? <FloatInput label="À partir de" type="time" required value={heureDebut} onChange={e => setHeureDebut(e.target.value)} />
            : <div />}
          <FloatInput label="Au" type="date" required value={dateFin} min={dateDebut} onChange={e => setDateFin(e.target.value)} />
          {!journeeEntiere
            ? <FloatInput label="Jusqu’à" type="time" required value={heureFin} onChange={e => setHeureFin(e.target.value)} />
            : <div />}
        </div>
        {!periodeValide && !!dateDebut && !!dateFin && (
          <p role="alert" className="text-xs text-red-700">La fin de l’absence doit suivre son début.</p>
        )}

        <FloatSelect label="Motif" required value={motif} onChange={e => setMotif(e.target.value)}>
          <option value="" disabled hidden />
          {MOTIFS.map(m => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
        </FloatSelect>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </FormModal>
  )
}
