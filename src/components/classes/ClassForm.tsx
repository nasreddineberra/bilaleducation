'use client'

import { normalizeNom } from '@/lib/normalize-name'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Trash2, BookOpen, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { verifierEcriture, verifierEcritureLot } from '@/lib/supabase/ecriture'
import { logAudit } from '@/lib/audit'
import { useToast } from '@/lib/toast-context'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FormModal from '@/components/ui/FormModal'
import { Puce } from '@/components/dashboard/tdb'
import Tooltip from '@/components/ui/Tooltip'
import { FloatInput, FloatSelect, FloatTextarea, FloatButton, SwitchOuiNon } from '@/components/ui/FloatFields'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { intitulePropre, LIBELLE_TYPE_CRENEAU, NOM_ACTIVITE_MAX } from '@/lib/edt/intitule'
import type { Class, SchoolYear, Teacher, CotisationType, VacationPeriod } from '@/types/database'
import { accord, pluriel } from '@/lib/texte/pluriel'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignmentData {
  teacher_id: string
  teacher_name: string
  is_main_teacher: boolean
  subject: string
  effective_from: string | null
  effective_until: string | null
}

type TeacherOption = Pick<Teacher, 'id' | 'first_name' | 'last_name' | 'employee_number' | 'is_active'>

interface RoomOption {
  id: string
  name: string
  capacity: number | null
  room_type?: string
}

interface SlotRow {
  id: string
  /** Jamais NULL pour un creneau recurrent (0 cas en base au 30/10). */
  day_of_week: number | null
  start_time: string
  end_time: string
  effective_from: string | null
  effective_until: string | null
  slot_type: TypeCreneau
  unite_enseignement_id: string | null
  libelle: string | null
  room_id: string | null
}

type TypeCreneau = 'cours' | 'activite'

/** Unite d'enseignement du referentiel : la matiere d'un cours. */
interface MatiereOption { id: string; nom_fr: string }

interface SlotDraft {
  id?:             string   // undefined = nouveau
  day_of_week:     string   // nom du jour
  start_time:      string
  end_time:        string
  effective_from:  string
  effective_until: string   // '' = ouvert
  // Le type se choisit a la creation puis ne change plus (il decide du code de
  // presence des validations) ; matiere d'un cours, nom d'une activite : facultatifs.
  slot_type:             TypeCreneau
  unite_enseignement_id: string   // '' = aucune
  libelle:               string
  room_id:               string   // salle du creneau ('' = aucune), si la classe n'a pas de salle unique
}

interface ClassFormProps {
  cls?: Class
  initialAssignments?: AssignmentData[]
  schoolYears: SchoolYear[]
  teachers: TeacherOption[]
  cotisationTypes?: CotisationType[]
  rooms?: RoomOption[]
  backHref?: string
  currentSchoolYear?: { id: string; start_date: string | null; end_date: string | null; vacations: VacationPeriod[] | null } | null
  existingSlots?: SlotRow[]
  matieres?: MatiereOption[]
  weekStartDay?: number   // 0=Dimanche, 1=Lundi, 6=Samedi
  workingDays?: number    // 5 ou 7
  /** Seances remplacees ou annulees (Absences enseignants), du jour et a venir. */
  seancesRemplacees?: SeanceRemplacee[]
}

export interface SeanceRemplacee {
  absenceId: string
  slotId: string
  date: string
  start: string
  end: string
  decision: 'remplacee' | 'annulee'
  /** `NOM Prenom` du remplacant. */
  remplacant: string | null
}

type TeachingMode = 'single' | 'multi'

type FormData = {
  name:               string
  level:              string
  room_id:            string
  max_students:       string
  description:        string
  cotisation_type_id: string
  teaching_mode:      TeachingMode
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAME_TO_JS: Record<string, number> = {
  Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 0,
}
const DAY_NUM_TO_NAME: Record<number, string> = {
  0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi',
}
function dayNameToNum(name: string): number { return DAY_NAME_TO_JS[name] ?? -1 }

// Liste ordonnée des jours selon le paramétrage établissement
// (1er jour de la semaine + nombre de jours travaillés). Même logique que l'EDT.
function buildWorkingDayNames(weekStartDay: number, workingDays: number): string[] {
  const order: number[] = []
  for (let i = 0; i < 7; i++) order.push((weekStartDay + i) % 7)
  const days = workingDays >= 7 ? order : order.slice(0, workingDays)
  return days.map(n => DAY_NUM_TO_NAME[n])
}

/** Date du jour en `AAAA-MM-JJ` LOCAL : `toISOString` bascule en UTC et rend la
 *  veille entre minuit et 2 h (heure de Paris). */
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Intitule affiche d'un creneau en saisie (`intitulePropre`, matiere lue dans la liste). */
function intituleBrouillon(s: SlotDraft, matieres: MatiereOption[]): string | null {
  return intitulePropre({
    slot_type: s.slot_type,
    libelle: s.libelle,
    unites_enseignement: matieres.find(m => m.id === s.unite_enseignement_id) ?? null,
  })
}

/** Chacun sa place (CHECK en base) : matiere d'un cours, nom d'une activite. */
function intituleEnBase(s: SlotDraft) {
  return {
    unite_enseignement_id: s.slot_type === 'cours' ? (s.unite_enseignement_id || null) : null,
    libelle:               s.slot_type === 'activite' ? (s.libelle.trim() || null) : null,
  }
}

function slotsOverlap(a: SlotDraft, b: SlotDraft): boolean {
  if (a.day_of_week !== b.day_of_week) return false
  // Dates qui se chevauchent
  const aFrom  = a.effective_from  || '0000-01-01'
  const aUntil = a.effective_until || '9999-12-31'
  const bFrom  = b.effective_from  || '0000-01-01'
  const bUntil = b.effective_until || '9999-12-31'
  if (!(aFrom <= bUntil && bFrom <= aUntil)) return false
  // Horaires qui se chevauchent
  return a.start_time < b.end_time && b.start_time < a.end_time
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ClassForm({
  cls,
  initialAssignments = [],
  schoolYears,
  teachers,
  cotisationTypes = [],
  rooms = [],
  backHref = '/dashboard/classes',
  currentSchoolYear,
  existingSlots = [],
  matieres = [],
  weekStartDay = 1,
  workingDays = 5,
  seancesRemplacees = [],
}: ClassFormProps) {
  const workingDayNames = buildWorkingDayNames(weekStartDay, workingDays)
  const router    = useRouter()
  const toast     = useToast()
  const isEditing = !!cls
  // SALLE (decision du 27/10) : « meme salle pour tous les creneaux » (salle de la
  // classe) ou salle choisie creneau par creneau. Deduit de la classe : une salle
  // de classe renseignee = salle unique. L'EDT en deduit la salle de chaque seance.
  // Classe nouvelle : salle creneau par creneau par defaut (decision du 27/10).
  const [salleUnique, setSalleUnique] = useState(!!cls?.room_id)
  const salleUniqueInitiale = useRef(salleUnique)

  const currentYear = schoolYears.find(y => y.is_current) ?? schoolYears[0]

  const [form, setForm] = useState<FormData>({
    name:               cls?.name               ?? '',
    level:              cls?.level              ?? '',
    room_id:            cls?.room_id            ?? '',
    max_students:       String(cls?.max_students ?? 30),
    description:        cls?.description        ?? '',
    cotisation_type_id: cls?.cotisation_type_id ?? '',
    teaching_mode:      'single', // V1 : mode Secondaire non géré, toutes les classes sont en Primaire
  })

  // ── Slots EDT ─────────────────────────────────────────────────────────────
  const initialSlotDrafts: SlotDraft[] = existingSlots.map(s => ({
    id:              s.id,
    day_of_week:     (s.day_of_week != null ? DAY_NUM_TO_NAME[s.day_of_week] : undefined) ?? 'Lundi',
    start_time:      (s.start_time  ?? '').slice(0, 5),
    end_time:        (s.end_time    ?? '').slice(0, 5),
    effective_from:  (s.effective_from  ?? '').slice(0, 10),
    effective_until: (s.effective_until ?? '').slice(0, 10),
    slot_type:             s.slot_type,
    unite_enseignement_id: s.unite_enseignement_id ?? '',
    libelle:               s.libelle ?? '',
    room_id:               s.room_id ?? '',
  }))
  const [slots,          setSlots]          = useState<SlotDraft[]>(initialSlotDrafts)
  const [deletedSlotIds, setDeletedSlotIds] = useState<string[]>([])
  const [editingSlotIdx, setEditingSlotIdx] = useState<number | null>(null)
  const [showSlotForm,   setShowSlotForm]   = useState(false)
  const [slotOverlapErr, setSlotOverlapErr] = useState<string | null>(null)

  // ── Affectations ─────────────────────────────────────────────────────────
  const initialForm      = useRef<FormData>({ ...form })
  const initialAssignStr = useRef(JSON.stringify(initialAssignments))
  const initialSlotsStr  = useRef(JSON.stringify(initialSlotDrafts))

  const [touched,        setTouched]        = useState<Set<string>>(new Set())
  const [isSubmitting,   setIsSubmitting]   = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; title?: string; variant?: 'danger' | 'warning'; onConfirm: () => void } | null>(null)

  const [assignments,  setAssignments]  = useState<AssignmentData[]>(initialAssignments)
  const [showAddRow,   setShowAddRow]   = useState(false)
  const [addTeacherId, setAddTeacherId] = useState('')
  const [titulaireFrom, setTitulaireFrom] = useState('')
  const [editRow,       setEditRow]       = useState<{ idx: number; from: string; until: string } | null>(null)
  const [pendingAssignAction, setPendingAssignAction] = useState<{
    type: 'delete'
    idx: number
    effectiveDate: string
    applyFn: (date: string) => void
    message: string
  } | null>(null)

  const hasActiveMain     = assignments.some(a => !a.effective_until && a.is_main_teacher)
  // Un titulaire a deja existe (meme clos) : un nouveau titulaire est date, au lieu
  // de prendre la place de « 1re affectation = debut d'annee ».
  const hasAnyMain        = assignments.some(a => a.is_main_teacher)
  // N'exclut que les enseignants avec une affectation ACTIVE (titulaire actif ou
  // remplacement en cours) — ceux qui ne sont qu'en historique restent sélectionnables.
  const activeAssignedIds = new Set(
    assignments
      .filter(a => a.is_main_teacher
        ? !a.effective_until
        : (!a.effective_until || a.effective_until > todayISO()))
      .map(a => a.teacher_id)
  )
  const availableTeachers = teachers.filter(t => !activeAssignedIds.has(t.id))


  // ── Titulaire ──────────────────────────────────────────────────────────────
  const openTitulairePanel = () => {
    setAddTeacherId('')
    setTitulaireFrom(todayISO())
    setShowAddRow(true)
  }
  // Affecter (1re fois) ou changer le titulaire. Changement en cours d'année :
  // l'ancien titulaire est clôturé à la date choisie (trace historique conservée).
  const applyTitulaire = () => {
    const teacher = teachers.find(t => t.id === addTeacherId)
    if (!teacher) return
    const date = titulaireFrom || todayISO()
    setAssignments(prev => {
      const updated = hasActiveMain
        ? prev.map(a => (a.is_main_teacher && !a.effective_until) ? { ...a, effective_until: date } : a)
        : prev
      return [...updated, {
        teacher_id:      addTeacherId,
        teacher_name:    `${teacher.last_name} ${teacher.first_name}`,
        is_main_teacher: true,
        subject:         '',
        effective_from:  hasAnyMain ? date : null,   // 1re affectation = début d'année (null)
        effective_until: null,
      }]
    })
    setShowAddRow(false)
  }

  // Retirer le titulaire : la classe peut rester SANS titulaire. L'affectation est
  // cloturee (historique conserve) ; les creneaux de l'EDT ne sont PAS clotures, ils
  // passent « sans enseignant » a l'enregistrement et reprennent un titulaire des
  // qu'on en affecte un autre.
  const openRemoveTitulaire = (realIdx: number) => {
    const a = assignments[realIdx]
    setPendingAssignAction({
      type: 'delete', idx: realIdx, effectiveDate: todayISO(),
      applyFn: (date: string) => {
        setAssignments(prev => prev.map((x, i) => i === realIdx ? { ...x, effective_until: date } : x))
      },
      message: `Indiquez le dernier jour de "${a.teacher_name}" comme titulaire (inclus). La classe n'aura plus de titulaire ; ses créneaux resteront au planning, sans enseignant.`,
    })
  }

  const removeAssignmentAt = (idx: number) =>
    setAssignments(prev => prev.filter((_, i) => i !== idx))
  // Toute suppression est confirmée.
  const confirmRemoveAssignment = (idx: number) => {
    const a = assignments[idx]
    setPendingConfirm({
      title: 'Supprimer l\'affectation',
      message: `Supprimer "${a.teacher_name}" (ancien titulaire) ? Cette affectation sera définitivement retirée.`,
      variant: 'danger',
      onConfirm: () => removeAssignmentAt(idx),
    })
  }

  // ── Correction (niveau B) : éditer les dates d'une ligne d'historique ───────
  const openEditRow = (idx: number) => {
    const a = assignments[idx]
    setEditRow({ idx, from: a.effective_from ?? '', until: a.effective_until ?? '' })
  }
  const applyEditRow = () => {
    if (!editRow) return
    if (editRow.from && editRow.until && editRow.until < editRow.from) return
    setAssignments(prev => prev.map((a, i) => i === editRow.idx
      ? { ...a, effective_from: editRow.from || null, effective_until: editRow.until || null }
      : a))
    setEditRow(null)
  }

  // ── Salle : unique ou par creneau ─────────────────────────────────────────
  const changerModeSalle = (unique: boolean) => {
    if (unique === salleUnique) return
    if (!unique) {
      // Unique -> par creneau : chaque creneau part de l'ancienne salle de la classe.
      setSlots(prev => prev.map(s => (s.room_id ? s : { ...s, room_id: form.room_id })))
      set('room_id', '')
      setSalleUnique(false)
      return
    }
    const avecSalle = slots.filter(s => s.room_id).length
    const appliquer = () => {
      setSlots(prev => prev.map(s => ({ ...s, room_id: '' })))
      setSalleUnique(true)
    }
    if (avecSalle === 0) { appliquer(); return }
    setPendingConfirm({
      title: 'Même salle pour tous les créneaux',
      message: `Les salles choisies pour ${pluriel(avecSalle, 'créneau', 'créneaux')} seront remplacées par la salle de la classe.`,
      variant: 'warning',
      onConfirm: appliquer,
    })
  }
  const sallesDeCours = rooms.filter(r => r.room_type === 'salle_cours')

  // ── Slot handlers ─────────────────────────────────────────────────────────
  const handleSaveSlot = (draft: SlotDraft) => {
    const others = editingSlotIdx !== null
      ? slots.filter((_, i) => i !== editingSlotIdx)
      : slots
    const conflict = others.find(s => slotsOverlap(s, draft))
    if (conflict) {
      setSlotOverlapErr(
        `Chevauchement avec le créneau ${conflict.day_of_week} ${conflict.start_time}-${conflict.end_time} (${conflict.effective_from ? fmtDate(conflict.effective_from) : '…'} → ${conflict.effective_until ? fmtDate(conflict.effective_until) : 'ouvert'})`
      )
      return
    }
    setSlotOverlapErr(null)
    if (editingSlotIdx !== null) {
      setSlots(prev => prev.map((s, i) => i === editingSlotIdx ? draft : s))
      setEditingSlotIdx(null)
    } else {
      setSlots(prev => [...prev, draft])
    }
    setShowSlotForm(false)
  }

  const handleEditSlot = (idx: number) => {
    setEditingSlotIdx(idx)
    setSlotOverlapErr(null)
    setShowSlotForm(true)
  }

  const handleDeleteSlot = (idx: number) => {
    const slot = slots[idx]
    const label = `${slot.day_of_week} ${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`
    setPendingConfirm({
      title: 'Supprimer le créneau',
      message: `Confirmer la suppression du créneau ${label} ?`,
      variant: 'danger',
      onConfirm: () => {
        if (slot.id) setDeletedSlotIds(prev => [...prev, slot.id!])
        setSlots(prev => prev.filter((_, i) => i !== idx))
      },
    })
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const vName        = form.name.trim().length < 2
  const vCotisation  = !form.cotisation_type_id
  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const vCapacity    = !!(selectedRoom?.capacity && parseInt(form.max_students, 10) > selectedRoom.capacity)
  // Salle unique : obligatoire (le mode se deduit de sa presence ; vide, la fiche
  // rouvrirait « creneau par creneau »).
  const vSalle       = salleUnique && !form.room_id
  const isFormValid  = !vName && !vCotisation && !vCapacity && !vSalle
  const invalid = (field: string, bad: boolean) => touched.has(field) && bad
  const touch = (field: string) => setTouched(prev => new Set([...prev, field]))
  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const isUnchanged = isEditing
    && (Object.keys(form) as (keyof FormData)[]).every(k => form[k] === initialForm.current[k])
    && JSON.stringify(assignments) === initialAssignStr.current
    && JSON.stringify(slots) === initialSlotsStr.current
    && deletedSlotIds.length === 0
    && salleUnique === salleUniqueInitiale.current

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(Object.keys(form)))
    if (!isFormValid) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // Nom UNIQUE PAR ANNEE (casse et accents ignores) : le meme nom redevient
      // possible l'annee suivante. Meme normalisation que l'index en base
      // `idx_classes_unique_name_per_year`, qui reste la vraie garantie.
      const { data: same } = await supabase
        .from('classes')
        .select('id, name')
        .eq('academic_year', currentYear?.label ?? '')
      if (same?.find(c => c.id !== cls?.id && normalizeNom(c.name) === normalizeNom(form.name))) {
        toast.error(`Une classe "${form.name.trim()}" existe déjà pour cette année.`)
        setIsSubmitting(false)
        return
      }

      // Dériver le créneau de référence depuis le slot actif (sans effective_until ou le plus récent)
      const today = todayISO()
      const activeSlot = slots.find(s => !s.effective_until || s.effective_until >= today)
        ?? slots[slots.length - 1]

      const payload = {
        name:          form.name.trim(),
        level:         form.level.trim(),
        teaching_mode: form.teaching_mode,
        academic_year: currentYear?.label ?? null,
        room_id:       salleUnique ? (form.room_id || null) : null,
        max_students:  parseInt(form.max_students, 10) || 30,
        description:   form.description.trim() || null,
        cotisation_type_id: form.cotisation_type_id || null,
        // Référence créneau principal
        day_of_week:   activeSlot ? activeSlot.day_of_week : null,
        start_time:    activeSlot ? activeSlot.start_time  : null,
        end_time:      activeSlot ? activeSlot.end_time    : null,
      }

      let classId: string
      if (isEditing) {
        verifierEcriture(
          await supabase.from('classes').update(payload).eq('id', cls.id).select('id'),
          'Cette classe',
        )
        classId = cls.id
      } else {
        const { data, error } = await supabase.from('classes').insert(payload).select('id').single()
        if (error) throw error
        classId = data.id
      }

      // Affectations
      verifierEcritureLot(
        await supabase.from('class_teachers').delete().eq('class_id', classId),
        'Les affectations',
      )
      if (assignments.length > 0) {
        const rows = assignments
          // Une affectation sans enseignant n'a pas de sens (colonne NOT NULL) :
          // une ligne qui n'a qu'une matiere faisait echouer TOUT l'enregistrement,
          // apres l'effacement des affectations existantes.
          .filter(a => a.teacher_id)
          .map(a => ({
            class_id:        classId,
            teacher_id:      a.teacher_id,
            is_main_teacher: a.is_main_teacher,
            subject:         a.subject || null,
            effective_from:  a.effective_from || null,
            effective_until: a.effective_until || null,
          }))
        if (rows.length > 0) {
          const { error: e } = await supabase.from('class_teachers').insert(rows)
          if (e) throw e
        }
      }

      // ── Le titulaire n'est plus recopie sur les creneaux (lot 5, 29/10) ──
      // Qui assure une seance se DEDUIT a la date (`lib/edt/seance.ts`) : un
      // changement de titulaire ne touche pas le planning, et la fin d'une
      // affectation ne clot aucun creneau (ils appartiennent a la classe).
      if (isEditing) {
        const newMain = assignments.find(a => !a.effective_until && a.is_main_teacher)
        const oldMain = initialAssignments.find(a => !a.effective_until && a.is_main_teacher)
        if (newMain && newMain.teacher_id !== oldMain?.teacher_id) {
          // Le cahier de texte de la classe suit le titulaire : séances et devoirs
          // rédigés par les ANCIENS TITULAIRES de cette classe passent au nouveau.
          // Seule cette classe est concernée. Le
          // droit d'écriture est celui de la base (admin, direction, resp. pédago) ;
          // pour un autre rôle la mise à jour touche zéro ligne, sans erreur.
          const anciens = [...new Set(assignments
            .filter(a => a.is_main_teacher && a.teacher_id && a.teacher_id !== newMain.teacher_id)
            .map(a => a.teacher_id as string))]
          if (anciens.length > 0) {
            let seances = 0, devoirs = 0
            for (const [table, nom] of [['class_journal', 'séances'], ['homework', 'devoirs']] as const) {
              const res = await supabase
                .from(table)
                .update({ teacher_id: newMain.teacher_id })
                .eq('class_id', classId)
                .in('teacher_id', anciens)
                .select('id')
              verifierEcritureLot(res, `Le transfert des ${nom} du cahier de texte`)
              if (table === 'class_journal') seances = res.data?.length ?? 0
              else devoirs = res.data?.length ?? 0
            }
            if (seances + devoirs > 0) {
              logAudit(supabase, {
                action: 'UPDATE',
                entityType: 'class_journal',
                description: `Cahier de texte de ${form.name.trim()} : ${pluriel(seances, 'séance')} et ${pluriel(devoirs, 'devoir')} ${accord(seances + devoirs, 'transféré')} à ${newMain.teacher_name}`,
              })
            }
          }
        }
      }

      // Réconciliation slots EDT

      // 1. Supprimer les slots retirés
      for (const slotId of deletedSlotIds) {
        verifierEcritureLot(
          await supabase.from('schedule_exceptions').delete().eq('schedule_slot_id', slotId),
          'Les exceptions du creneau',
        )
        verifierEcriture(
          await supabase.from('schedule_slots').delete().eq('id', slotId).select('id'),
          'Ce creneau',
        )
        logAudit(supabase, { action: 'DELETE', entityType: 'schedule_slots', entityId: slotId, description: `Suppression créneau EDT pour ${form.name.trim()}` })
      }

      // 2. Mettre à jour les slots modifiés
      const initialById = Object.fromEntries(initialSlotDrafts.map(s => [s.id, s]))
      for (const slot of slots.filter(s => s.id)) {
        const orig = initialById[slot.id!]
        const changed = !orig
          || slot.day_of_week    !== orig.day_of_week
          || slot.start_time     !== orig.start_time
          || slot.end_time       !== orig.end_time
          || slot.effective_from !== orig.effective_from
          || slot.effective_until !== orig.effective_until
          || slot.unite_enseignement_id !== orig.unite_enseignement_id
          || slot.libelle !== orig.libelle
          || slot.room_id !== orig.room_id
        if (!changed) continue
        verifierEcriture(
          await supabase.from('schedule_slots').update({
            day_of_week:     dayNameToNum(slot.day_of_week),
            start_time:      slot.start_time,
            end_time:        slot.end_time,
            effective_from:  slot.effective_from  || null,
            effective_until: slot.effective_until || null,
            ...intituleEnBase(slot),
            room_id:         salleUnique ? null : (slot.room_id || null),
          }).eq('id', slot.id!).select('id'),
          'Ce creneau',
        )
        logAudit(supabase, { action: 'UPDATE', entityType: 'schedule_slots', entityId: slot.id, description: `Modification créneau ${slot.day_of_week} ${slot.start_time}-${slot.end_time} pour ${form.name.trim()}` })
      }

      // 3. Insérer les nouveaux slots
      if (currentSchoolYear?.id) {
        for (const slot of slots.filter(s => !s.id)) {
          const { error: slotErr } = await supabase.from('schedule_slots').insert({
            class_id:        classId,
            school_year_id:  currentSchoolYear.id,
            is_recurring:    true,
            day_of_week:     dayNameToNum(slot.day_of_week),
            slot_date:       null,
            start_time:      slot.start_time,
            end_time:        slot.end_time,
            slot_type:       slot.slot_type,
            ...intituleEnBase(slot),
            // Salle unique : portee par la classe (deduite) ; sinon celle du creneau.
            room_id:         salleUnique ? null : (slot.room_id || null),
            is_active:       true,
            effective_from:  slot.effective_from  || null,
            effective_until: slot.effective_until || null,
          })
          if (slotErr) throw slotErr
          logAudit(supabase, { action: 'INSERT', entityType: 'schedule_slots', description: `Nouveau créneau ${slot.day_of_week} ${slot.start_time}-${slot.end_time} pour ${form.name.trim()} à partir du ${slot.effective_from || '?'}` })
        }
      }

      toast.success(isEditing ? 'Classe modifiée avec succès.' : 'Classe créée avec succès.')
      router.push(backHref)
      router.refresh()
    } catch (err) {
      // Doublon refuse par la base (enregistrement simultane, ou controle contourne).
      if (String((err as { message?: string })?.message ?? '').includes('idx_classes_unique_name_per_year')) {
        toast.error(`Une classe "${form.name.trim()}" existe déjà pour cette année.`)
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} noValidate className="space-y-2 max-w-5xl">

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.5fr] gap-2">

        {/* ── Colonne gauche — Informations générales ── */}
        <div className="card p-4 [--encadre-pad:1rem] space-y-3">
          <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">Informations générales</h2>

          <FloatInput
            label="Nom de la classe"
            required
            value={form.name}
            onChange={e => set('name', e.target.value.toUpperCase())}
            onBlur={() => touch('name')}
            error={invalid('name', vName) ? 'Minimum 2 caractères.' : undefined}
          />
          <FloatInput
            label="Niveau"
            value={form.level}
            onChange={e => set('level', e.target.value)}
          />
          <FloatInput
            label="Année scolaire"
            value={currentYear ? `${currentYear.label} (en cours)` : '·'}
            locked
            onChange={() => {}}
          />

          <SwitchOuiNon label="Même salle pour tous les créneaux" checked={salleUnique} onChange={changerModeSalle} />

          <div className="grid grid-cols-2 gap-3">
            {salleUnique && <FloatSelect
              label="Salle de la classe"
              required
              value={form.room_id}
              onBlur={() => touch('room_id')}
              error={invalid('room_id', vSalle) ? 'La salle est obligatoire.' : undefined}
              onChange={e => {
                const roomId = e.target.value
                set('room_id', roomId)
                if (roomId) {
                  const room = rooms.find(r => r.id === roomId)
                  if (room?.capacity && parseInt(form.max_students, 10) > room.capacity)
                    set('max_students', String(room.capacity))
                }
              }}
            >
              <option value="" />
              {/* Salles de COURS seulement (decision du 27/10) ; la salle deja
                  rattachee reste proposee pour s'afficher. */}
              {rooms.filter(r => r.room_type === 'salle_cours' || r.id === form.room_id).map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.capacity ? ` (${r.capacity} places)` : ''}
                </option>
              ))}
            </FloatSelect>}
            <FloatInput
              label="Capacité max"
              type="number"
              min={1}
              max={selectedRoom?.capacity || 999}
              value={form.max_students}
              onChange={e => set('max_students', e.target.value)}
              error={vCapacity ? `Max ${selectedRoom?.capacity} (capacité salle)` : undefined}
            />
          </div>

          <FloatSelect
            label="Type de cotisation"
            required
            value={form.cotisation_type_id}
            onChange={e => set('cotisation_type_id', e.target.value)}
            onBlur={() => touch('cotisation_type_id')}
            error={invalid('cotisation_type_id', vCotisation) ? 'Le type de cotisation est obligatoire.' : undefined}
          >
            <option value="" />
            {cotisationTypes.map(ct => (
              <option key={ct.id} value={ct.id}>{ct.label}</option>
            ))}
          </FloatSelect>

          <FloatTextarea
            label="Description"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            placeholder="Remarques, spécificités de la classe..."
          />

        </div>

        {/* ── Colonne droite — Enseignant ── */}
        <div className="card p-4 [--encadre-pad:1rem] space-y-4 flex flex-col">
          <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">
            Enseignant
          </h2>

          {(() => {
            const byEndDesc = (x: AssignmentData, y: AssignmentData) => (y.effective_until ?? '').localeCompare(x.effective_until ?? '')
            const titulaires = assignments.filter(a => a.is_main_teacher)
            const activeTit  = titulaires.find(a => !a.effective_until)
            const formerTits = titulaires.filter(a => a.effective_until).sort(byEndDesc)

            return <>
              {/* ── Titulaire ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="section-title">Titulaire</h3>
                  {!showAddRow && (
                    <span className="flex items-center gap-3">
                      {activeTit && (
                        <button type="button" onClick={() => openRemoveTitulaire(assignments.indexOf(activeTit))}
                          className="text-xs font-medium text-red-700 hover:text-red-800 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">
                          Retirer
                        </button>
                      )}
                      <button type="button" onClick={openTitulairePanel}
                        className="text-xs font-medium text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:text-[var(--brand-surface-2)] dark:hover:text-[var(--brand-accent)] transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]">
                        {activeTit ? 'Changer' : 'Affecter un titulaire'}
                      </button>
                    </span>
                  )}
                </div>

                {activeTit ? (
                  <div className="border border-warm-100 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="font-medium text-secondary-800">{activeTit.teacher_name}</span>
                    {activeTit.effective_from && (
                      <span className="text-[10px] text-warm-700">depuis le {fmtDate(activeTit.effective_from)}</span>
                    )}
                  </div>
                ) : (
                  !showAddRow && (
                    <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 text-red-700 bg-red-50 border border-red-200">
                      <BookOpen size={14} />
                      Sans titulaire.
                    </div>
                  )
                )}

                {showAddRow && (
                  <div className="bg-warm-50 border border-warm-200 rounded-xl p-3 space-y-3">
                    <FloatSelect label="Enseignant" value={addTeacherId} onChange={e => setAddTeacherId(e.target.value)}>
                      <option value="" />
                      {availableTeachers.map(t => (<option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>))}
                    </FloatSelect>
                    {hasAnyMain && (
                      <FloatInput label="À compter du" type="date" value={titulaireFrom} onChange={e => setTitulaireFrom(e.target.value)} />
                    )}
                    <div className="flex gap-2 justify-end pt-1">
                      <FloatButton type="button" variant="secondary" onClick={() => setShowAddRow(false)}>Annuler</FloatButton>
                      <FloatButton type="button" variant="submit" onClick={applyTitulaire} disabled={!addTeacherId}>Valider</FloatButton>
                    </div>
                  </div>
                )}

                {formerTits.length > 0 && (
                  <div className="space-y-0.5 pt-0.5">
                    {formerTits.map(a => {
                      const realIdx = assignments.indexOf(a)
                      return (
                        <div key={`ft-${realIdx}`} className="group flex items-center justify-between text-[11px] text-warm-700 pl-3 pr-1">
                          <span>Ancien titulaire : <span className="text-secondary-500">{a.teacher_name}</span></span>
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <span>{a.effective_from ? `du ${fmtDate(a.effective_from)}` : 'depuis le début'}{a.effective_until ? ` au ${fmtDate(a.effective_until)}` : ''}</span>
                            <Tooltip content="Corriger les dates">
                              <button type="button" onClick={() => openEditRow(realIdx)} aria-label={`Corriger les dates de ${a.teacher_name}`}
                                className="p-1 text-warm-700 hover:text-[var(--brand-surface)] dark:hover:text-[var(--brand-accent)] rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]">
                                <Pencil size={12} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Supprimer">
                              <button type="button" onClick={() => confirmRemoveAssignment(realIdx)} aria-label={`Supprimer ${a.teacher_name}`}
                                className="p-1 text-warm-700 hover:text-red-700 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
                                <Trash2 size={12} />
                              </button>
                            </Tooltip>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Remplacements de l'année (liste complète, en lecture : lots 3-4 de la conception) ── */}
              <div className="space-y-1.5 pt-3 border-t border-warm-100">
                <h3 className="section-title">Remplacements{currentYear ? ` · ${currentYear.label}` : ''}</h3>

                {seancesRemplacees.length > 0 ? (
                  // Seances remplacees ou annulees pour une absence du titulaire,
                  // du jour et a venir (lot 4) : EN LECTURE, la ligne ouvre la
                  // fiche de l'absence, seul ecran qui les decide.
                  <div className="liste max-h-[12rem] overflow-y-auto list-scroll">
                    <table className="w-full text-xs" aria-label="Séances remplacées ou annulées">
                      <tbody className="divide-y divide-warm-50">
                        {seancesRemplacees.map(s => (
                          <tr key={`${s.absenceId}|${s.slotId}|${s.date}`} className="cursor-pointer"
                            onClick={() => router.push(`/dashboard/absences-enseignants/${s.absenceId}`)}>
                            <td className="list-td px-3 whitespace-nowrap text-secondary-700">{fmtDate(s.date)}</td>
                            <td className="list-td px-2 whitespace-nowrap tabular-nums text-warm-700">{s.start}-{s.end}</td>
                            <td className="list-td px-3">
                              {s.decision === 'annulee'
                                ? <span className="font-medium text-red-700">Annulée</span>
                                : <span className="text-secondary-700">Remplacée par {s.remplacant ?? '·'}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-warm-700">Aucun remplacement.</span>
                    {/* Un remplacement se declare par l'absence du titulaire (lot 3). */}
                    {hasActiveMain && (
                      <Link href="/dashboard/absences-enseignants"
                        className="text-sm font-medium text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:text-[var(--brand-surface-2)] dark:hover:text-[var(--brand-accent)] transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]">
                        Absences enseignants
                      </Link>
                    )}
                  </div>
                )}
              </div>

            </>
          })()}
        </div>
      </div>

      {/* ── Planning EDT ── */}
      <div className="card p-4 [--encadre-pad:1rem] space-y-3">
        <div className="encadre-titre justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest">Planning EDT</h2>
            {slots.length > 0 && (
              <Puce ton="ok">{slots.length} créneau{slots.length > 1 ? 'x' : ''}</Puce>
            )}
          </div>
          {!showSlotForm && (
            <FloatButton
              type="button" variant="submit"
              size="mini"
              onClick={() => { setEditingSlotIdx(null); setSlotOverlapErr(null); setShowSlotForm(true) }}
            >
              Ajouter
            </FloatButton>
          )}
        </div>

        {/* Tableau des créneaux */}
        {slots.length > 0 && (
          <div className="liste">
            <table className="w-full text-xs" aria-label="Créneaux de la classe">
              <thead>
                <tr className="liste-entete border-b border-[var(--card-border)]">
                  <th className="list-th text-left">Jour</th>
                  <th className="list-th text-left">Horaire</th>
                  <th className="list-th text-left">Type</th>
                  <th className="list-th text-left">Intitulé</th>
                  {!salleUnique && <th className="list-th text-left">Salle</th>}
                  <th className="list-th text-left">Du</th>
                  <th className="list-th text-left">Au</th>
                  <th className="list-th w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {slots.map((slot, idx) => {
                  const today = todayISO()
                  const isActive = !slot.effective_until || slot.effective_until >= today
                  return (
                    // Creneau actif : barre des actifs (`.ligne-active`), comme un eleve actif.
                    <tr key={idx} className={clsx(isActive && 'ligne-active')}>
                      <td className="list-td font-medium text-secondary-800 whitespace-nowrap">
                        {slot.day_of_week}
                      </td>
                      <td className="list-td text-secondary-700 whitespace-nowrap tabular-nums">
                        {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}
                      </td>
                      <td className="list-td whitespace-nowrap">
                        {/* Couleurs de categorie de l'emploi du temps */}
                        <span className={clsx('inline-block rounded-full border px-2 py-px text-[10px] font-semibold', slot.slot_type === 'activite' ? 'edt-slot-activite' : 'edt-slot-cours')}>
                          {LIBELLE_TYPE_CRENEAU[slot.slot_type]}
                        </span>
                      </td>
                      <td className="list-td text-secondary-700">
                        {intituleBrouillon(slot, matieres) ?? <span className="text-warm-700">·</span>}
                      </td>
                      {!salleUnique && (
                        <td className="list-td text-secondary-700 whitespace-nowrap">
                          {rooms.find(r => r.id === slot.room_id)?.name ?? <span className="text-warm-700">·</span>}
                        </td>
                      )}
                      <td className="list-td text-secondary-700 whitespace-nowrap tabular-nums">
                        {slot.effective_from ? fmtDate(slot.effective_from) : <span className="text-warm-700">·</span>}
                      </td>
                      <td className="list-td text-secondary-700 whitespace-nowrap tabular-nums">
                        {slot.effective_until ? fmtDate(slot.effective_until) : <span className="text-warm-700 italic">ouvert</span>}
                      </td>
                      <td className="list-td">
                        <div className="flex items-center gap-1 justify-end">
                          <Tooltip content="Modifier">
                            <button
                              type="button" onClick={() => handleEditSlot(idx)}
                              aria-label={`Modifier le créneau ${slot.day_of_week} ${slot.start_time.slice(0, 5)}`}
                              className="p-1 text-warm-700 hover:text-[var(--brand-surface)] dark:hover:text-[var(--brand-accent)] hover:bg-[var(--brand-tint)] rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-focus)]"
                            >
                              <Pencil size={12} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Supprimer">
                            <button
                              type="button" onClick={() => handleDeleteSlot(idx)}
                              aria-label={`Supprimer le créneau ${slot.day_of_week} ${slot.start_time.slice(0, 5)}`}
                              className="p-1 text-warm-700 hover:text-red-700 hover:bg-red-50 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                            >
                              <Trash2 size={12} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {slots.length === 0 && (
          <p className="text-xs text-warm-700 italic">Aucun créneau déployé dans l&apos;emploi du temps.</p>
        )}

        {/* Erreur chevauchement */}
        {slotOverlapErr && (
          <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{slotOverlapErr}</p>
        )}

        {/* Modal ajout/édition de créneau */}
        <SlotFormModal
          key={showSlotForm ? (editingSlotIdx ?? 'new') : 'closed'}
          open={showSlotForm}
          initial={editingSlotIdx !== null ? slots[editingSlotIdx] : undefined}
          currentSchoolYear={currentSchoolYear}
          days={workingDayNames}
          matieres={matieres}
          salles={salleUnique ? null : sallesDeCours}
          onSave={handleSaveSlot}
          onCancel={() => { setShowSlotForm(false); setEditingSlotIdx(null); setSlotOverlapErr(null) }}
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-red-700"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton type="button" variant="secondary" onClick={() => router.push(backHref)} disabled={isSubmitting}>
          Annuler
        </FloatButton>
        <FloatButton
          type="submit"
          variant={isEditing ? 'edit' : 'submit'}
          disabled={!isFormValid || isSubmitting || isUnchanged}
          loading={isSubmitting}
        >
          {isEditing ? 'Modifier' : 'Valider'}
        </FloatButton>
      </div>

    </form>

    {/* Modale confirmation modification/suppression affectation en cours d'annee */}
    {/* Pas d'Echap (FormModal) : cette modale porte un selecteur de date de cloture. */}
    {pendingAssignAction && (
      <FormModal
        title={pendingAssignAction.type === 'delete' ? 'Confirmer la clôture' : 'Confirmer la modification'}
        onClose={() => setPendingAssignAction(null)}
        maxWidth="max-w-sm"
        footer={<>
          <div className="flex-1" />
          <FloatButton type="button" variant="secondary" onClick={() => setPendingAssignAction(null)}>Annuler</FloatButton>
          <FloatButton
            type="button"
            variant={pendingAssignAction.type === 'delete' ? 'danger' : 'submit'}
            onClick={() => {
              pendingAssignAction.applyFn(pendingAssignAction.effectiveDate)
              setPendingAssignAction(null)
            }}
            disabled={!pendingAssignAction.effectiveDate}
          >
            Confirmer
          </FloatButton>
        </>}
      >
        <p className="text-sm text-warm-700">{pendingAssignAction.message}</p>
        <FloatInput
          label="Date d'effet"
          type="date"
          required
          value={pendingAssignAction.effectiveDate}
          min={todayISO()}
          max={currentSchoolYear?.end_date ?? undefined}
          onChange={e => setPendingAssignAction(prev => prev ? { ...prev, effectiveDate: e.target.value } : null)}
        />
      </FormModal>
    )}

    {/* Modale correction des dates (historique / ancien titulaire) */}
    {editRow && (
      <FormModal
        title="Corriger les dates"
        onClose={() => setEditRow(null)}
        maxWidth="max-w-sm"
        footer={<>
          <div className="flex-1" />
          <FloatButton type="button" variant="secondary" onClick={() => setEditRow(null)}>Annuler</FloatButton>
          <FloatButton type="button" variant="submit" onClick={applyEditRow}
            disabled={!!editRow.from && !!editRow.until && editRow.until < editRow.from}>
            Valider
          </FloatButton>
        </>}
      >
        <div className="grid grid-cols-2 gap-3">
          <FloatInput label="Du" type="date" value={editRow.from} onChange={e => setEditRow(prev => prev ? { ...prev, from: e.target.value } : null)} />
          <FloatInput label="Au" type="date" value={editRow.until} onChange={e => setEditRow(prev => prev ? { ...prev, until: e.target.value } : null)} />
        </div>
      </FormModal>
    )}

    <ConfirmModal
      open={!!pendingConfirm}
      message={pendingConfirm?.message ?? ''}
      title={pendingConfirm?.title}
      variant={pendingConfirm?.variant ?? 'warning'}
      onConfirm={() => { pendingConfirm?.onConfirm(); setPendingConfirm(null) }}
      onCancel={() => setPendingConfirm(null)}
    />
  </>
  )
}

// ─── SlotFormModal ────────────────────────────────────────────────────────────

function SlotFormModal({
  open,
  initial,
  currentSchoolYear,
  days,
  matieres,
  salles,
  onSave,
  onCancel,
}: {
  open: boolean
  initial?: SlotDraft
  currentSchoolYear?: { start_date: string | null; end_date: string | null } | null
  days: string[]
  matieres: MatiereOption[]
  /** Salles de cours, quand la salle se choisit creneau par creneau ; `null` = salle unique de la classe. */
  salles: RoomOption[] | null
  onSave: (slot: SlotDraft) => void
  onCancel: () => void
}) {
  // Inclure le jour du créneau existant même s'il est hors jours travaillés (édition)
  const dayOptions = initial?.day_of_week && !days.includes(initial.day_of_week)
    ? [initial.day_of_week, ...days]
    : days
  const [dayOfWeek,      setDayOfWeek]      = useState(initial?.day_of_week     ?? '')
  const [startTime,      setStartTime]      = useState(initial?.start_time      ?? '')
  const [endTime,        setEndTime]        = useState(initial?.end_time        ?? '')
  const [effectiveFrom,  setEffectiveFrom]  = useState(initial?.effective_from  ?? '')
  const [effectiveUntil, setEffectiveUntil] = useState(initial?.effective_until ?? '')
  const [slotType,       setSlotType]       = useState<TypeCreneau>(initial?.slot_type ?? 'cours')
  const [ueId,           setUeId]           = useState(initial?.unite_enseignement_id ?? '')
  const [libelle,        setLibelle]        = useState(initial?.libelle ?? '')
  const [roomId,         setRoomId]         = useState(initial?.room_id ?? '')
  const [err,            setErr]            = useState<string | null>(null)
  // Pas de fermeture sur Echap (FormModal) : on saisit ici des dates d'effet,
  // une touche reflexe ne doit pas faire perdre la saisie.

  if (!open) return null

  const isUnchanged = !!initial
    && dayOfWeek     === initial.day_of_week
    && startTime     === initial.start_time
    && endTime       === initial.end_time
    && effectiveFrom === initial.effective_from
    && effectiveUntil === initial.effective_until
    && ueId === initial.unite_enseignement_id
    && libelle.trim() === initial.libelle
    && roomId === initial.room_id

  const canSave = !!dayOfWeek && !!startTime && !!endTime && endTime > startTime && !!effectiveFrom && !isUnchanged

  const handleSave = () => {
    if (!dayOfWeek || !startTime || !endTime || !effectiveFrom) {
      setErr('Jour, horaires et date de début sont obligatoires.'); return
    }
    if (endTime <= startTime) {
      setErr("L'heure de fin doit être postérieure à l'heure de début."); return
    }
    if (effectiveUntil && effectiveUntil <= effectiveFrom) {
      setErr('La date de fin doit être postérieure à la date de début.')
      return
    }
    setErr(null)
    onSave({
      id: initial?.id, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime,
      effective_from: effectiveFrom, effective_until: effectiveUntil,
      slot_type: slotType,
      unite_enseignement_id: slotType === 'cours' ? ueId : '',
      libelle: slotType === 'activite' ? libelle.trim() : '',
      room_id: salles ? roomId : '',
    })
  }

  return (
    <FormModal
      title={initial ? 'Modifier le créneau' : 'Nouveau créneau'}
      onClose={onCancel}
      footer={<>
        <div className="flex-1" />
        <FloatButton type="button" variant="secondary" onClick={onCancel}>Annuler</FloatButton>
        <FloatButton type="button" variant={initial ? 'edit' : 'submit'} onClick={handleSave} disabled={!canSave}>
          {initial ? 'Modifier' : 'Valider'}
        </FloatButton>
      </>}
    >
          {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          {/* Type : choisi a la creation, fige ensuite (comme dans l'emploi du temps). */}
          <div>
            <span className="text-xs font-semibold text-warm-700 uppercase tracking-wide">Type</span>
            <div className="mt-1">
              {initial ? (
                <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-medium border border-warm-200 bg-[var(--champ-verrou)] text-warm-400 cursor-default">
                  {LIBELLE_TYPE_CRENEAU[slotType]}
                </span>
              ) : (
                <FiltreSwitch
                  ariaLabel="Type de créneau"
                  actif={slotType}
                  onChange={v => setSlotType(v as TypeCreneau)}
                  options={[{ valeur: 'cours', libelle: 'Cours' }, { valeur: 'activite', libelle: 'Activité' }]}
                />
              )}
            </div>
          </div>

          {slotType === 'cours' ? (
            <FloatSelect label="Matière" value={ueId} onChange={e => setUeId(e.target.value)}>
              <option value=""></option>
              {matieres.map(m => <option key={m.id} value={m.id}>{m.nom_fr}</option>)}
            </FloatSelect>
          ) : (
            <FloatInput
              label="Nom de l'activité"
              value={libelle}
              maxLength={NOM_ACTIVITE_MAX}
              onChange={e => setLibelle(e.target.value)}
            />
          )}

          {salles && (
            <FloatSelect label="Salle" value={roomId} onChange={e => setRoomId(e.target.value)}>
              <option value=""></option>
              {salles.map(r => (
                <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` (${r.capacity} places)` : ''}</option>
              ))}
            </FloatSelect>
          )}

          <div className="grid grid-cols-3 gap-3">
            <FloatSelect label="Jour" required value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
              <option value="" />
              {dayOptions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </FloatSelect>
            <FloatInput
              label="Début"
              type="time"
              required
              value={startTime}
              onChange={e => { setStartTime(e.target.value); if (endTime && endTime <= e.target.value) setEndTime('') }}
              locked={!dayOfWeek}
            />
            <FloatInput
              label="Fin"
              type="time"
              required
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              locked={!dayOfWeek || !startTime}
            />
          </div>

          {startTime && endTime && endTime > startTime && (() => {
            const [sh, sm] = startTime.split(':').map(Number)
            const [eh, em] = endTime.split(':').map(Number)
            const diff = (eh * 60 + em) - (sh * 60 + sm)
            const h = Math.floor(diff / 60)
            const m = diff % 60
            return (
              <p className="text-xs text-warm-700">
                Durée : <span className="font-semibold text-secondary-700">
                  {h > 0 ? `${h}h` : ''}{m > 0 ? `${m < 10 && h > 0 ? '0' : ''}${m}min` : ''}
                </span>
              </p>
            )
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FloatInput
                label="À partir du"
                type="date"
                required
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                min={currentSchoolYear?.start_date?.slice(0, 10) ?? undefined}
                max={currentSchoolYear?.end_date?.slice(0, 10)   ?? undefined}
              />
              {currentSchoolYear?.start_date && (
                <button
                  type="button"
                  onClick={() => setEffectiveFrom((currentSchoolYear.start_date ?? '').slice(0, 10))}
                  className="text-[10px] text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:text-[var(--brand-surface-2)] dark:hover:text-[var(--brand-accent)] hover:underline transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                >
                  Rentrée ({fmtDate((currentSchoolYear.start_date ?? '').slice(0, 10))})
                </button>
              )}
            </div>
            <div className="space-y-1">
              <FloatInput
                label="Jusqu'au (optionnel)"
                type="date"
                value={effectiveUntil}
                onChange={e => setEffectiveUntil(e.target.value)}
                min={effectiveFrom || currentSchoolYear?.start_date?.slice(0, 10) || undefined}
                max={currentSchoolYear?.end_date?.slice(0, 10) ?? undefined}
              />
              {currentSchoolYear?.end_date && (
                <button
                  type="button"
                  onClick={() => setEffectiveUntil((currentSchoolYear.end_date ?? '').slice(0, 10))}
                  className="text-[10px] text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:text-[var(--brand-surface-2)] dark:hover:text-[var(--brand-accent)] hover:underline transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                >
                  Fin d'année ({fmtDate((currentSchoolYear.end_date ?? '').slice(0, 10))})
                </button>
              )}
            </div>
          </div>
    </FormModal>
  )
}
