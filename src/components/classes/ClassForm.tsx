'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Plus, Trash2, UserCheck, BookOpen, Pencil, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import { useToast } from '@/lib/toast-context'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { FloatInput, FloatSelect, FloatTextarea, FloatButton, FloatRadioCard } from '@/components/ui/FloatFields'
import type { Class, SchoolYear, Teacher, CotisationType, VacationPeriod } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignmentData {
  teacher_id: string
  teacher_name: string
  is_main_teacher: boolean
  subject: string
}

interface UEOption {
  id: string
  nom_fr: string
  nom_ar: string | null
  code: string | null
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
  ues: UEOption[]
  cotisationTypes?: CotisationType[]
  rooms?: RoomOption[]
  backHref?: string
  currentSchoolYear?: { id: string; start_date: string | null; end_date: string | null; vacations: VacationPeriod[] } | null
  existingSlots?: SlotRow[]
  weekStartDay?: number
}

type FormData = {
  name:               string
  level:              string
  room_number:        string
  room_id:            string
  max_students:       string
  description:        string
  cotisation_type_id: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const
const DAY_NAME_TO_JS: Record<string, number> = {
  Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 0,
}
const DAY_NUM_TO_NAME: Record<number, string> = {
  0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi',
}
function dayNameToNum(name: string): number { return DAY_NAME_TO_JS[name] ?? -1 }

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
  ues,
  cotisationTypes = [],
  rooms = [],
  backHref = '/dashboard/classes',
  currentSchoolYear,
  existingSlots = [],
  weekStartDay = 1,
}: ClassFormProps) {
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
  const [addIsMain,    setAddIsMain]    = useState(true)
  const [addSubject,   setAddSubject]   = useState('')

  const hasMain           = assignments.some(a => a.is_main_teacher)
  const assignedIds       = new Set(assignments.map(a => a.teacher_id))
  const availableTeachers = teachers.filter(t => !assignedIds.has(t.id))

  const openAddRow = () => {
    setAddIsMain(!hasMain)
    setAddTeacherId('')
    setAddSubject('')
    setShowAddRow(true)
  }

  const handleAddAssignment = () => {
    if (!addTeacherId) return
    const teacher = teachers.find(t => t.id === addTeacherId)
    if (!teacher) return
    let subject = ''
    if (!addIsMain) {
      const ue = ues.find(u => u.id === addSubject)
      if (!ue) return
      subject = ue.code ? `${ue.code} — ${ue.nom_fr}` : ue.nom_fr
    }
    setAssignments(prev => [...prev, {
      teacher_id:      addTeacherId,
      teacher_name:    `${teacher.last_name} ${teacher.first_name}`,
      is_main_teacher: addIsMain,
      subject,
    }])
    setShowAddRow(false)
  }

  const handleRemoveAssignment = (teacher_id: string) =>
    setAssignments(prev => prev.filter(a => a.teacher_id !== teacher_id))

  // ── Slot handlers ─────────────────────────────────────────────────────────
  const handleSaveSlot = (draft: SlotDraft) => {
    const others = editingSlotIdx !== null
      ? slots.filter((_, i) => i !== editingSlotIdx)
      : slots
    const conflict = others.find(s => slotsOverlap(s, draft))
    if (conflict) {
      setSlotOverlapErr(
        `Chevauchement avec le créneau ${conflict.day_of_week} ${conflict.start_time}–${conflict.end_time} (${conflict.effective_from ? fmtDate(conflict.effective_from) : '…'} → ${conflict.effective_until ? fmtDate(conflict.effective_until) : 'ouvert'})`
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
    const label = `${slot.day_of_week} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`
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
  const vAssignments = assignments.length === 0
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
        const { error: e } = await supabase.from('class_teachers').insert(
          assignments.map(a => ({
            class_id:        classId,
            teacher_id:      a.teacher_id,
            is_main_teacher: a.is_main_teacher,
            subject:         a.subject || null,
          }))
        )
        if (e) throw e
      }

      // Réconciliation slots EDT
      const mainTeacher = assignments.find(a => a.is_main_teacher)

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
        logAudit(supabase, { action: 'UPDATE', entityType: 'schedule_slots', entityId: slot.id, description: `Modification créneau ${slot.day_of_week} ${slot.start_time}–${slot.end_time} pour ${form.name.trim()}` })
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
          logAudit(supabase, { action: 'INSERT', entityType: 'schedule_slots', description: `Nouveau créneau ${slot.day_of_week} ${slot.start_time}–${slot.end_time} pour ${form.name.trim()} à partir du ${slot.effective_from || '?'}` })
        }
      }

      if (isEditing) {
        initialForm.current      = { ...form }
        initialAssignStr.current = JSON.stringify(assignments)
        initialSlotsStr.current  = JSON.stringify(slots)
        setDeletedSlotIds([])
        toast.success('Classe enregistrée avec succès.')
        router.refresh()
      } else {
        router.push(backHref)
        router.refresh()
      }
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} noValidate className="space-y-2 max-w-5xl">

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">

        {/* ── Colonne gauche — Informations générales ── */}
        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Informations générales</h2>

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
            value={currentYear ? `${currentYear.label} (en cours)` : '—'}
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

        {/* ── Colonne droite — Affectations enseignants ── */}
        <div className="card p-4 space-y-3 flex flex-col">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Affectations enseignants <span className="text-red-400">*</span>
          </h2>

          {assignments.length > 0 ? (
            <div className="border border-warm-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-warm-50 border-b border-warm-100">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Enseignant</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Matière</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-50">
                  {assignments.map(a => (
                    <tr key={a.teacher_id} className="hover:bg-warm-50/40">
                      <td className="px-3 py-2 font-medium text-secondary-800 whitespace-nowrap">{a.teacher_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {a.is_main_teacher ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium">
                            <UserCheck size={11} /> Prof. principal
                          </span>
                        ) : (
                          <span className="text-xs text-secondary-500">Par matière</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-secondary-500 text-xs">
                        {a.subject || <span className="text-warm-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(a.teacher_id)}
                          className="p-1 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={clsx(
              'flex items-center gap-2 text-sm rounded-xl px-4 py-3',
              touched.has('assignments') && vAssignments
                ? 'text-red-600 bg-red-50 border border-red-200'
                : 'text-warm-400 bg-warm-50'
            )}>
              <BookOpen size={14} />
              {touched.has('assignments') && vAssignments
                ? 'Au moins un enseignant doit être affecté.'
                : 'Aucun enseignant affecté.'}
            </div>
          )}

          {showAddRow ? (
            <div className="bg-warm-50 border border-warm-200 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Nouvelle affectation</p>

              <FloatSelect label="Enseignant" value={addTeacherId} onChange={e => setAddTeacherId(e.target.value)}>
                <option value="" />
                {availableTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
                ))}
              </FloatSelect>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Type</span>
                <div className="flex gap-2">
                  <FloatRadioCard name="addType" value="main" checked={addIsMain} onChange={() => !hasMain && setAddIsMain(true)}>
                    <span className={clsx('flex items-center gap-1.5', hasMain && 'opacity-40')}>
                      <UserCheck size={13} className="text-primary-500 flex-shrink-0" /> Prof. principal
                    </span>
                  </FloatRadioCard>
                  <FloatRadioCard name="addType" value="subject" checked={!addIsMain} onChange={() => setAddIsMain(false)}>
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={13} className="text-secondary-400 flex-shrink-0" /> Par matière
                    </span>
                  </FloatRadioCard>
                </div>
                {hasMain && addIsMain && <p className="text-xs text-warm-400 italic">Un prof. principal est déjà affecté.</p>}
              </div>

              {!addIsMain && (
                ues.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Aucune UE disponible. Créez d&apos;abord des Unités d&apos;Enseignement dans la section Cours.
                  </p>
                ) : (
                  <FloatSelect label="Unité d'Enseignement" value={addSubject} onChange={e => setAddSubject(e.target.value)}>
                    <option value="" />
                    {ues.map(ue => (
                      <option key={ue.id} value={ue.id}>{ue.code ? `${ue.code} — ` : ''}{ue.nom_fr}</option>
                    ))}
                  </FloatSelect>
                )
              )}

              <div className="flex gap-2 justify-end pt-1">
                <FloatButton type="button" variant="secondary" onClick={() => setShowAddRow(false)}>Annuler</FloatButton>
                <FloatButton
                  type="button" variant="submit"
                  onClick={handleAddAssignment}
                  disabled={!addTeacherId || (!addIsMain && (!addSubject || ues.length === 0))}
                >
                  Valider
                </FloatButton>
              </div>
            </div>
          ) : (
            availableTeachers.length > 0 && (
              <button
                type="button" onClick={openAddRow}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 transition-colors self-start"
              >
                <Plus size={14} /> Ajouter une affectation
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Planning EDT ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Planning EDT</h2>
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
              <Plus size={12} /> Ajouter
            </FloatButton>
          )}
        </div>

        {/* Tableau des créneaux */}
        {slots.length > 0 && (
          <div className="border border-warm-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50 border-b border-warm-100 text-[10px] font-semibold text-warm-500 uppercase tracking-wider">
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
                        {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                      </td>
                      <td className="px-3 py-2 text-secondary-600 text-xs whitespace-nowrap">
                        {slot.effective_from ? fmtDate(slot.effective_from) : <span className="text-warm-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-secondary-600 text-xs whitespace-nowrap">
                        {slot.effective_until ? fmtDate(slot.effective_until) : <span className="text-warm-400 italic">ouvert</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button" onClick={() => handleEditSlot(idx)}
                            className="p-1 text-warm-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button" onClick={() => handleDeleteSlot(idx)}
                            className="p-1 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={12} />
                          </button>
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
          <div className="flex items-center gap-2 text-sm text-warm-400 bg-warm-50 rounded-xl px-4 py-3">
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
  onSave,
  onCancel,
}: {
  open: boolean
  initial?: SlotDraft
  currentSchoolYear?: { start_date: string | null; end_date: string | null } | null
  onSave: (slot: SlotDraft) => void
  onCancel: () => void
}) {
  const [dayOfWeek,      setDayOfWeek]      = useState(initial?.day_of_week     ?? '')
  const [startTime,      setStartTime]      = useState(initial?.start_time      ?? '')
  const [endTime,        setEndTime]        = useState(initial?.end_time        ?? '')
  const [effectiveFrom,  setEffectiveFrom]  = useState(initial?.effective_from  ?? '')
  const [effectiveUntil, setEffectiveUntil] = useState(initial?.effective_until ?? '')
  const [err,            setErr]            = useState<string | null>(null)

  // Fermer sur Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
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
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-primary-500" />
            <h3 className="text-sm font-bold text-secondary-800">
              {initial ? 'Modifier le créneau' : 'Nouveau créneau'}
            </h3>
          </div>
          <button type="button" onClick={onCancel} className="p-1 rounded-lg hover:bg-warm-100 text-warm-400">
            <Plus size={16} className="rotate-45" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          <div className="grid grid-cols-3 gap-3">
            <FloatSelect label="Jour" required value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
              <option value="" />
              {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map(d => (
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
              <p className="text-xs text-warm-500">
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
