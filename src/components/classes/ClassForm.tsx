'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { X, Trash2, BookOpen, Pencil, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import { useToast } from '@/lib/toast-context'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Tooltip from '@/components/ui/Tooltip'
import { FloatInput, FloatSelect, FloatTextarea, FloatButton } from '@/components/ui/FloatFields'
import type { Class, SchoolYear, Teacher, CotisationType, VacationPeriod } from '@/types/database'

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
}

interface SlotRow {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  effective_from: string | null
  effective_until: string | null
}

interface SlotDraft {
  id?:             string   // undefined = nouveau
  day_of_week:     string   // nom du jour
  start_time:      string
  end_time:        string
  effective_from:  string
  effective_until: string   // '' = ouvert
}

interface ClassFormProps {
  cls?: Class
  initialAssignments?: AssignmentData[]
  schoolYears: SchoolYear[]
  teachers: TeacherOption[]
  cotisationTypes?: CotisationType[]
  rooms?: RoomOption[]
  backHref?: string
  currentSchoolYear?: { id: string; start_date: string | null; end_date: string | null; vacations: VacationPeriod[] } | null
  existingSlots?: SlotRow[]
  weekStartDay?: number   // 0=Dimanche, 1=Lundi, 6=Samedi
  workingDays?: number    // 5 ou 7
}

type TeachingMode = 'single' | 'multi' | ''

type FormData = {
  name:               string
  level:              string
  room_number:        string
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

function todayISO() { return new Date().toISOString().slice(0, 10) }

function isYearActive(sy: { start_date: string | null; end_date: string | null } | null | undefined): boolean {
  if (!sy?.start_date || !sy?.end_date) return false
  const today = todayISO()
  return today >= sy.start_date && today <= sy.end_date
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  weekStartDay = 1,
  workingDays = 5,
}: ClassFormProps) {
  const workingDayNames = buildWorkingDayNames(weekStartDay, workingDays)
  const router    = useRouter()
  const toast     = useToast()
  const isEditing = !!cls

  const currentYear = schoolYears.find(y => y.is_current) ?? schoolYears[0]

  const [form, setForm] = useState<FormData>({
    name:               cls?.name               ?? '',
    level:              cls?.level              ?? '',
    room_number:        cls?.room_number        ?? '',
    room_id:            cls?.room_id            ?? '',
    max_students:       String(cls?.max_students ?? 30),
    description:        cls?.description        ?? '',
    cotisation_type_id: cls?.cotisation_type_id ?? '',
    teaching_mode:      'single', // V1 : mode Secondaire non géré, toutes les classes sont en Primaire
  })

  // ── Slots EDT ─────────────────────────────────────────────────────────────
  const initialSlotDrafts: SlotDraft[] = existingSlots.map(s => ({
    id:              s.id,
    day_of_week:     DAY_NUM_TO_NAME[s.day_of_week] ?? 'Lundi',
    start_time:      (s.start_time  ?? '').slice(0, 5),
    end_time:        (s.end_time    ?? '').slice(0, 5),
    effective_from:  (s.effective_from  ?? '').slice(0, 10),
    effective_until: (s.effective_until ?? '').slice(0, 10),
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
  // Remplaçant (affectation temporaire, is_main_teacher = false)
  const [showAddSub,   setShowAddSub]   = useState(false)
  const [subTeacherId, setSubTeacherId] = useState('')
  const [subFrom,      setSubFrom]      = useState('')
  const [subUntil,     setSubUntil]     = useState('')
  const [subErr,       setSubErr]       = useState<string | null>(null)
  const [titulaireFrom, setTitulaireFrom] = useState('')
  const [editRow,       setEditRow]       = useState<{ idx: number; from: string; until: string } | null>(null)
  const [pendingAssignAction, setPendingAssignAction] = useState<{
    type: 'delete'
    idx: number
    effectiveDate: string
    applyFn: (date: string) => void
    message: string
  } | null>(null)

  const yearActive        = isYearActive(currentSchoolYear)
  const hasActiveMain     = assignments.some(a => !a.effective_until && a.is_main_teacher)
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

  // Accessibilité modale « clôture/modification d'affectation »
  const assignModalRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!pendingAssignAction) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPendingAssignAction(null) }
    document.addEventListener('keydown', handler)
    assignModalRef.current?.focus()
    return () => document.removeEventListener('keydown', handler)
  }, [pendingAssignAction])

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
        effective_from:  hasActiveMain ? date : null,   // 1re affectation = début d'année (null)
        effective_until: null,
      }]
    })
    setShowAddRow(false)
  }

  const handleRemoveAssignment = (teacher_id: string) =>
    setAssignments(prev => prev.filter(a => a.teacher_id !== teacher_id))
  const removeAssignmentAt = (idx: number) =>
    setAssignments(prev => prev.filter((_, i) => i !== idx))
  // Toute suppression est confirmée.
  const confirmRemoveAssignment = (idx: number) => {
    const a = assignments[idx]
    setPendingConfirm({
      title: 'Supprimer l\'affectation',
      message: `Supprimer "${a.teacher_name}" (${a.is_main_teacher ? 'ancien titulaire' : 'remplaçant'}) ? Cette affectation sera définitivement retirée.`,
      variant: 'danger',
      onConfirm: () => removeAssignmentAt(idx),
    })
  }

  // ── Remplaçant : affectation temporaire (is_main_teacher = false) ──────────
  const openAddSub = () => {
    setSubTeacherId('')
    setSubFrom(todayISO())
    setSubUntil('')
    setSubErr(null)
    setShowAddSub(true)
  }
  // Chevauchement de deux périodes (null = borne ouverte)
  const periodsOverlap = (aFrom: string | null, aUntil: string | null, bFrom: string | null, bUntil: string | null) => {
    const af = aFrom || '0000-01-01', au = aUntil || '9999-12-31'
    const bf = bFrom || '0000-01-01', bu = bUntil || '9999-12-31'
    return af <= bu && bf <= au
  }
  const addSubstitute = () => {
    const teacher = teachers.find(t => t.id === subTeacherId)
    if (!teacher || !subFrom) return
    if (subUntil && subUntil < subFrom) {
      setSubErr('La date de fin doit être postérieure à la date de début.')
      return
    }
    // Un seul remplaçant à la fois : refuser le chevauchement avec un remplaçant existant.
    const conflict = assignments.find(a =>
      !a.is_main_teacher && periodsOverlap(subFrom, subUntil || null, a.effective_from, a.effective_until)
    )
    if (conflict) {
      setSubErr(`Un remplaçant (${conflict.teacher_name}) couvre déjà cette période. Terminez-le d'abord ou ajustez les dates.`)
      return
    }
    setSubErr(null)
    setAssignments(prev => [
      ...prev,
      {
        teacher_id:      subTeacherId,
        teacher_name:    `${teacher.last_name} ${teacher.first_name}`,
        is_main_teacher: false,
        subject:         '',
        effective_from:  subFrom || null,
        effective_until: subUntil || null,   // null = remplacement ouvert (retour inconnu)
      },
    ])
    setShowAddSub(false)
  }
  // Terminer un remplacement (retour de l'enseignant) : pose effective_until,
  // conserve la ligne → bascule en historique. Réutilise la modale de clôture.
  const openEndSub = (realIdx: number) => {
    const a = assignments[realIdx]
    setPendingAssignAction({
      type: 'delete', idx: realIdx, effectiveDate: todayISO(),
      applyFn: (date: string) => {
        setAssignments(prev => prev.map((x, i) => i === realIdx ? { ...x, effective_until: date } : x))
      },
      message: `Indiquez le dernier jour de remplacement de "${a.teacher_name}" (inclus). Il passera en historique le lendemain.`,
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
  const vAssignments = !hasActiveMain
  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const vCapacity    = !!(selectedRoom?.capacity && parseInt(form.max_students, 10) > selectedRoom.capacity)
  const isFormValid  = !vName && !vCotisation && !vAssignments && !vCapacity
  const invalid = (field: string, bad: boolean) => touched.has(field) && bad
  const touch = (field: string) => setTouched(prev => new Set([...prev, field]))
  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const isUnchanged = isEditing
    && (Object.keys(form) as (keyof FormData)[]).every(k => form[k] === initialForm.current[k])
    && JSON.stringify(assignments) === initialAssignStr.current
    && JSON.stringify(slots) === initialSlotsStr.current
    && deletedSlotIds.length === 0

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set([...Object.keys(form), 'assignments']))
    if (!isFormValid) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()

      const { data: same } = await supabase
        .from('classes')
        .select('id')
        .ilike('name', form.name.trim())
      if (same?.find(c => c.id !== cls?.id)) {
        toast.error(`Une classe "${form.name.trim()}" existe déjà.`)
        setIsSubmitting(false)
        return
      }

      // Dériver le créneau de référence depuis le slot actif (sans effective_until ou le plus récent)
      const today = new Date().toISOString().split('T')[0]
      const activeSlot = slots.find(s => !s.effective_until || s.effective_until >= today)
        ?? slots[slots.length - 1]

      const payload = {
        name:          form.name.trim(),
        level:         form.level.trim(),
        teaching_mode: form.teaching_mode,
        academic_year: currentYear?.label ?? null,
        room_number:   form.room_id
          ? (rooms.find(r => r.id === form.room_id)?.name ?? null)
          : (form.room_number.trim() || null),
        room_id:       form.room_id || null,
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
        const { error } = await supabase.from('classes').update(payload).eq('id', cls.id)
        if (error) throw error
        classId = cls.id
      } else {
        const { data, error } = await supabase.from('classes').insert(payload).select('id').single()
        if (error) throw error
        classId = data.id
      }

      // Affectations
      await supabase.from('class_teachers').delete().eq('class_id', classId)
      if (assignments.length > 0) {
        const rows = assignments
          .filter(a => a.teacher_id || a.subject) // ignorer les lignes vides
          .map(a => ({
            class_id:        classId,
            teacher_id:      a.teacher_id || null,
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

      // Cloturer les slots EDT des affectations cloturees en cours d'annee
      if (currentSchoolYear?.id) {
        const closedAssignments = assignments.filter(a => a.effective_until && a.teacher_id)
        for (const ca of closedAssignments) {
          await supabase
            .from('schedule_slots')
            .update({ effective_until: ca.effective_until })
            .eq('class_id', classId)
            .eq('teacher_id', ca.teacher_id)
            .eq('school_year_id', currentSchoolYear.id)
            .eq('is_recurring', true)
            .is('effective_until', null)
        }
      }

      // ── Cascade enseignant principal → slots EDT ─────────────────────
      // Si le prof principal actif a changé, on réaffecte tous les créneaux.
      if (isEditing) {
        const newMain = assignments.find(a => !a.effective_until && a.is_main_teacher)
        const oldMain = initialAssignments.find(a => !a.effective_until && a.is_main_teacher)
        if (newMain && newMain.teacher_id !== oldMain?.teacher_id) {
          await supabase
            .from('schedule_slots')
            .update({ teacher_id: newMain.teacher_id })
            .eq('class_id', classId)
            .eq('is_active', true)
          logAudit(supabase, {
            action: 'UPDATE',
            entityType: 'schedule_slots',
            description: `Cascade : tous les créneaux de ${form.name.trim()} affectés à ${newMain.teacher_name}`,
          })
        }
      }

      // Réconciliation slots EDT
      const mainTeacher = assignments.find(a => !a.effective_until && a.is_main_teacher)

      // 1. Supprimer les slots retirés
      for (const slotId of deletedSlotIds) {
        await supabase.from('schedule_exceptions').delete().eq('schedule_slot_id', slotId)
        await supabase.from('schedule_slots').delete().eq('id', slotId)
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
        if (!changed) continue
        await supabase.from('schedule_slots').update({
          day_of_week:     dayNameToNum(slot.day_of_week),
          start_time:      slot.start_time,
          end_time:        slot.end_time,
          effective_from:  slot.effective_from  || null,
          effective_until: slot.effective_until || null,
        }).eq('id', slot.id!)
        logAudit(supabase, { action: 'UPDATE', entityType: 'schedule_slots', entityId: slot.id, description: `Modification créneau ${slot.day_of_week} ${slot.start_time}-${slot.end_time} pour ${form.name.trim()}` })
      }

      // 3. Insérer les nouveaux slots
      if (currentSchoolYear?.id) {
        for (const slot of slots.filter(s => !s.id)) {
          const { error: slotErr } = await supabase.from('schedule_slots').insert({
            class_id:        classId,
            teacher_id:      mainTeacher?.teacher_id || null,
            school_year_id:  currentSchoolYear.id,
            is_recurring:    true,
            day_of_week:     dayNameToNum(slot.day_of_week),
            slot_date:       null,
            start_time:      slot.start_time,
            end_time:        slot.end_time,
            slot_type:       'cours',
            room_id:         form.room_id || null,
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
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} noValidate className="space-y-2 max-w-5xl">

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.5fr] gap-2">

        {/* ── Colonne gauche — Informations générales ── */}
        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Informations générales</h2>

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

          <div className="grid grid-cols-2 gap-3">
            <FloatSelect
              label="Salle"
              value={form.room_id}
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
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.capacity ? ` (${r.capacity} places)` : ''}
                </option>
              ))}
            </FloatSelect>
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
        <div className="card p-4 space-y-4 flex flex-col">
          <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">
            Enseignant <span className="text-red-400">*</span>
          </h2>

          {(() => {
            const today = todayISO()
            const byEndDesc = (x: AssignmentData, y: AssignmentData) => (y.effective_until ?? '').localeCompare(x.effective_until ?? '')
            const titulaires = assignments.filter(a => a.is_main_teacher)
            const activeTit  = titulaires.find(a => !a.effective_until)
            const formerTits = titulaires.filter(a => a.effective_until).sort(byEndDesc)
            const subs       = assignments.filter(a => !a.is_main_teacher)
            // Convention « inclus » : effective_until = dernier jour de remplacement.
            const currentSub = subs.find(a => !a.effective_until || a.effective_until >= today)
            const pastSubs   = subs.filter(a => a.effective_until && a.effective_until < today).sort(byEndDesc)

            return <>
              {/* ── Titulaire ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-warm-700 uppercase tracking-wide">Titulaire</h3>
                  {!showAddRow && (
                    <button type="button" onClick={openTitulairePanel}
                      className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
                      {activeTit ? 'Changer' : 'Affecter un titulaire'}
                    </button>
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
                    <div className={clsx('flex items-center gap-2 text-sm rounded-xl px-3 py-2',
                      touched.has('assignments') && vAssignments
                        ? 'text-red-600 bg-red-50 border border-red-200'
                        : 'text-warm-700 bg-warm-50')}>
                      <BookOpen size={14} />
                      {touched.has('assignments') && vAssignments ? 'Un titulaire est requis.' : 'Aucun titulaire affecté.'}
                    </div>
                  )
                )}

                {showAddRow && (
                  <div className="bg-warm-50 border border-warm-200 rounded-xl p-3 space-y-3">
                    <FloatSelect label="Enseignant" value={addTeacherId} onChange={e => setAddTeacherId(e.target.value)}>
                      <option value="" />
                      {availableTeachers.map(t => (<option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>))}
                    </FloatSelect>
                    {hasActiveMain && (
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
                            <span>{a.effective_from ? fmtDate(a.effective_from) : 'Début'} · {a.effective_until ? fmtDate(a.effective_until) : ''}</span>
                            <Tooltip content="Corriger les dates">
                              <button type="button" onClick={() => openEditRow(realIdx)} aria-label={`Corriger les dates de ${a.teacher_name}`}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-warm-700 hover:text-primary-600 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40">
                                <Pencil size={11} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Supprimer">
                              <button type="button" onClick={() => confirmRemoveAssignment(realIdx)} aria-label={`Supprimer ${a.teacher_name}`}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-warm-700 hover:text-red-500 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
                                <Trash2 size={11} />
                              </button>
                            </Tooltip>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Remplacement en cours ── */}
              <div className="space-y-1.5 pt-3 border-t border-warm-100">
                <h3 className="text-[11px] font-bold text-warm-700 uppercase tracking-wide">Remplacement en cours</h3>

                {currentSub ? (() => {
                  const realIdx = assignments.indexOf(currentSub)
                  const started = !currentSub.effective_from || currentSub.effective_from <= today
                  const endLabel = currentSub.effective_until ? fmtDate(currentSub.effective_until) : (started ? 'en cours' : 'à venir')
                  return (
                    <div className="border border-warm-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-medium text-secondary-800 whitespace-nowrap">{currentSub.teacher_name}</span>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-[10px] text-warm-700">
                          {currentSub.effective_from ? fmtDate(currentSub.effective_from) : 'Début'} → {endLabel}
                        </span>
                        {started && (
                          <Tooltip content="Terminer le remplacement">
                            <button type="button" onClick={() => openEndSub(realIdx)} aria-label={`Terminer le remplacement de ${currentSub.teacher_name}`}
                              className="text-xs font-medium text-primary-600 hover:text-primary-800 px-2 py-0.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
                              Terminer
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip content="Retirer (erreur de saisie)">
                          <button type="button" onClick={() => confirmRemoveAssignment(realIdx)} aria-label={`Retirer ${currentSub.teacher_name}`}
                            className="p-1 text-warm-700 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50">
                            <Trash2 size={13} />
                          </button>
                        </Tooltip>
                      </span>
                    </div>
                  )
                })() : showAddSub ? (
                  <div className="bg-warm-50 border border-warm-200 rounded-xl p-3 space-y-3">
                    <FloatSelect label="Enseignant" value={subTeacherId} onChange={e => setSubTeacherId(e.target.value)}>
                      <option value="" />
                      {availableTeachers.map(t => (<option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>))}
                    </FloatSelect>
                    <div className="grid grid-cols-2 gap-2">
                      <FloatInput label="Du" type="date" value={subFrom} onChange={e => setSubFrom(e.target.value)} />
                      <FloatInput label="Au" type="date" value={subUntil} onChange={e => setSubUntil(e.target.value)} />
                    </div>
                    <p className="text-[11px] text-warm-700">Laisser « Au » vide si la date de retour n'est pas connue (remplacement ouvert).</p>
                    {subErr && <p role="alert" className="text-xs text-red-600">{subErr}</p>}
                    <div className="flex gap-2 justify-end pt-1">
                      <FloatButton type="button" variant="secondary" onClick={() => setShowAddSub(false)}>Annuler</FloatButton>
                      <FloatButton type="button" variant="submit" onClick={addSubstitute} disabled={!subTeacherId || !subFrom}>Valider</FloatButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-warm-700">Aucun remplacement en cours.</span>
                    {hasActiveMain && (
                      <button type="button" onClick={openAddSub}
                        className="text-sm font-medium text-primary-600 hover:text-primary-800 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
                        Déclarer un remplacement
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Historique des remplacements ── */}
              {pastSubs.length > 0 && (
                <div className="pt-3 border-t border-warm-100 space-y-1.5">
                  <h3 className="text-[11px] font-bold text-warm-700 uppercase tracking-wide">
                    Historique des remplacements ({pastSubs.length})
                  </h3>
                  <div className="border border-warm-100 rounded-xl overflow-hidden opacity-70">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-warm-50">
                        {pastSubs.map(a => {
                          const realIdx = assignments.indexOf(a)
                          return (
                            <tr key={`pastsub-${realIdx}`} className="group bg-warm-50/30">
                              <td className="px-3 py-1.5 text-secondary-500 text-xs whitespace-nowrap">{a.teacher_name}</td>
                              <td className="px-3 py-1.5 text-[10px] text-warm-700 whitespace-nowrap text-right">
                                {a.effective_from ? fmtDate(a.effective_from) : 'Début'} · {a.effective_until ? fmtDate(a.effective_until) : ''}
                              </td>
                              <td className="px-2 py-1.5 w-12">
                                <div className="flex items-center gap-1 justify-end">
                                  <Tooltip content="Corriger les dates">
                                    <button type="button" onClick={() => openEditRow(realIdx)} aria-label={`Corriger les dates de ${a.teacher_name}`}
                                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-warm-700 hover:text-primary-600 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40">
                                      <Pencil size={11} />
                                    </button>
                                  </Tooltip>
                                  <Tooltip content="Supprimer">
                                    <button type="button" onClick={() => confirmRemoveAssignment(realIdx)} aria-label={`Supprimer ${a.teacher_name}`}
                                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-warm-700 hover:text-red-500 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
                                      <Trash2 size={11} />
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
                </div>
              )}
            </>
          })()}
        </div>
      </div>

      {/* ── Planning EDT ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Planning EDT</h2>
            {slots.length > 0 && (
              <span className="text-[10px] font-semibold bg-primary-100 text-primary-700 border border-primary-200 px-1.5 py-0.5 rounded-full">
                {slots.length} créneau{slots.length > 1 ? 'x' : ''}
              </span>
            )}
          </div>
          {!showSlotForm && (
            <FloatButton
              type="button" variant="submit"
              className="!px-2.5 !py-1 !text-xs !rounded"
              onClick={() => { setEditingSlotIdx(null); setSlotOverlapErr(null); setShowSlotForm(true) }}
            >
              Ajouter
            </FloatButton>
          )}
        </div>

        {/* Tableau des créneaux */}
        {slots.length > 0 && (
          <div className="border border-warm-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50 border-b border-warm-100 text-[10px] font-semibold text-warm-700 uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Jour</th>
                  <th className="text-left px-3 py-2">Horaire</th>
                  <th className="text-left px-3 py-2">Du</th>
                  <th className="text-left px-3 py-2">Au</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {slots.map((slot, idx) => {
                  const today = new Date().toISOString().split('T')[0]
                  const isActive = !slot.effective_until || slot.effective_until >= today
                  return (
                    <tr key={idx} className={clsx('transition-colors', isActive ? 'bg-primary-50/30 hover:bg-primary-50/50' : 'hover:bg-warm-50/50')}>
                      <td className="px-3 py-2 font-medium text-secondary-800 whitespace-nowrap">
                        {slot.day_of_week}
                        {isActive && <span className="ml-1.5 text-[9px] text-primary-500 font-semibold uppercase">actif</span>}
                      </td>
                      <td className="px-3 py-2 text-secondary-600 whitespace-nowrap font-mono text-xs">
                        {slot.start_time.slice(0, 5)} · {slot.end_time.slice(0, 5)}
                      </td>
                      <td className="px-3 py-2 text-secondary-600 text-xs whitespace-nowrap">
                        {slot.effective_from ? fmtDate(slot.effective_from) : <span className="text-warm-700">·</span>}
                      </td>
                      <td className="px-3 py-2 text-secondary-600 text-xs whitespace-nowrap">
                        {slot.effective_until ? fmtDate(slot.effective_until) : <span className="text-warm-700 italic">ouvert</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <Tooltip content="Modifier">
                            <button
                              type="button" onClick={() => handleEditSlot(idx)}
                              aria-label={`Modifier le créneau ${slot.day_of_week} ${slot.start_time.slice(0, 5)}`}
                              className="p-1 text-warm-700 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                            >
                              <Pencil size={12} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Supprimer">
                            <button
                              type="button" onClick={() => handleDeleteSlot(idx)}
                              aria-label={`Supprimer le créneau ${slot.day_of_week} ${slot.start_time.slice(0, 5)}`}
                              className="p-1 text-warm-700 hover:text-red-500 hover:bg-red-50 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
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
          <div className="flex items-center gap-2 text-sm text-warm-700 bg-warm-50 rounded-xl px-4 py-3">
            <CalendarDays size={14} />
            Aucun créneau déployé dans l'emploi du temps.
          </div>
        )}

        {/* Erreur chevauchement */}
        {slotOverlapErr && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{slotOverlapErr}</p>
        )}

        {/* Modal ajout/édition de créneau */}
        <SlotFormModal
          key={showSlotForm ? (editingSlotIdx ?? 'new') : 'closed'}
          open={showSlotForm}
          initial={editingSlotIdx !== null ? slots[editingSlotIdx] : undefined}
          currentSchoolYear={currentSchoolYear}
          days={workingDayNames}
          onSave={handleSaveSlot}
          onCancel={() => { setShowSlotForm(false); setEditingSlotIdx(null); setSlotOverlapErr(null) }}
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
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
    {pendingAssignAction && (
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30"
        onClick={() => setPendingAssignAction(null)}
      >
        <div
          ref={assignModalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-modal-title"
          tabIndex={-1}
          className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-fade-in outline-none"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
            <h3 id="assign-modal-title" className="text-sm font-bold text-secondary-800">
              {pendingAssignAction.type === 'delete' ? 'Confirmer la cloture' : 'Confirmer la modification'}
            </h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-warm-700">{pendingAssignAction.message}</p>
            <div>
              <label htmlFor="assign-effective-date" className="text-xs font-semibold text-warm-700 uppercase tracking-wide">Date d&apos;effet</label>
              <input
                id="assign-effective-date"
                type="date"
                value={pendingAssignAction.effectiveDate}
                min={todayISO()}
                max={currentSchoolYear?.end_date ?? undefined}
                onChange={e => setPendingAssignAction(prev => prev ? { ...prev, effectiveDate: e.target.value } : null)}
                className="mt-1 w-full text-sm border border-warm-200 rounded-lg px-3 py-2 bg-white text-secondary-800 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-warm-100">
            <button
              type="button"
              onClick={() => setPendingAssignAction(null)}
              className="text-sm text-warm-700 hover:text-secondary-700 px-3 py-1.5 rounded-lg border border-warm-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                pendingAssignAction.applyFn(pendingAssignAction.effectiveDate)
                setPendingAssignAction(null)
              }}
              disabled={!pendingAssignAction.effectiveDate}
              className={clsx(
                'text-sm text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50',
                pendingAssignAction.type === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'
              )}
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modale correction des dates (historique / ancien titulaire) */}
    {editRow && (
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30"
        onClick={() => setEditRow(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-row-title"
          className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-fade-in outline-none"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
            <h3 id="edit-row-title" className="text-sm font-bold text-secondary-800">Corriger les dates</h3>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            <FloatInput label="Du" type="date" value={editRow.from} onChange={e => setEditRow(prev => prev ? { ...prev, from: e.target.value } : null)} />
            <FloatInput label="Au" type="date" value={editRow.until} onChange={e => setEditRow(prev => prev ? { ...prev, until: e.target.value } : null)} />
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-warm-100">
            <FloatButton type="button" variant="secondary" onClick={() => setEditRow(null)}>Annuler</FloatButton>
            <FloatButton type="button" variant="submit" onClick={applyEditRow}
              disabled={!!editRow.from && !!editRow.until && editRow.until < editRow.from}>
              Valider
            </FloatButton>
          </div>
        </div>
      </div>
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
  onSave,
  onCancel,
}: {
  open: boolean
  initial?: SlotDraft
  currentSchoolYear?: { start_date: string | null; end_date: string | null } | null
  days: string[]
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
  const [err,            setErr]            = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fermer sur Escape + focus initial
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const isUnchanged = !!initial
    && dayOfWeek     === initial.day_of_week
    && startTime     === initial.start_time
    && endTime       === initial.end_time
    && effectiveFrom === initial.effective_from
    && effectiveUntil === initial.effective_until

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
    onSave({ id: initial?.id, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, effective_from: effectiveFrom, effective_until: effectiveUntil })
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-modal-title"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-fade-in outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-primary-500" />
            <h3 id="slot-modal-title" className="text-sm font-bold text-secondary-800">
              {initial ? 'Modifier le créneau' : 'Nouveau créneau'}
            </h3>
          </div>
          <button
            type="button" onClick={onCancel}
            aria-label="Fermer"
            className="p-1 rounded-lg hover:bg-warm-100 text-warm-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

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
                  className="text-[10px] text-primary-600 hover:text-primary-800 hover:underline transition-colors"
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
                  className="text-[10px] text-primary-600 hover:text-primary-800 hover:underline transition-colors"
                >
                  Fin d'année ({fmtDate((currentSchoolYear.end_date ?? '').slice(0, 10))})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-warm-100">
          <FloatButton type="button" variant="secondary" onClick={onCancel}>Annuler</FloatButton>
          <FloatButton type="button" variant={initial ? 'edit' : 'submit'} onClick={handleSave} disabled={!canSave}>
            {initial ? 'Modifier' : 'Valider'}
          </FloatButton>
        </div>
      </div>
    </div>
  )
}
