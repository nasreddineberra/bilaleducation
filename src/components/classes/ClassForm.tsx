'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Plus, Trash2, UserCheck, BookOpen, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Class, SchoolYear, Teacher, CotisationType } from '@/types/database'

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

interface ClassFormProps {
  cls?: Class
  initialAssignments?: AssignmentData[]
  schoolYears: SchoolYear[]
  teachers: TeacherOption[]
  ues: UEOption[]
  cotisationTypes?: CotisationType[]
  rooms?: RoomOption[]
  backHref?: string
}

type FormData = {
  name:               string
  level:              string
  room_number:        string
  room_id:            string
  max_students:       string
  description:        string
  day_of_week:        string
  start_time:         string
  end_time:           string
  cotisation_type_id: string
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
}: ClassFormProps) {
  const router    = useRouter()
  const isEditing = !!cls

  // Année en cours (read-only)
  const currentYear = schoolYears.find(y => y.is_current) ?? schoolYears[0]

  const [form, setForm] = useState<FormData>({
    name:         cls?.name         ?? '',
    level:        cls?.level        ?? '',
    room_number:  cls?.room_number  ?? '',
    room_id:      cls?.room_id     ?? '',
    max_students: String(cls?.max_students ?? 30),
    description:  cls?.description  ?? '',
    day_of_week:        cls?.day_of_week        ?? '',
    start_time:         cls?.start_time         ?? '',
    end_time:           cls?.end_time           ?? '',
    cotisation_type_id: cls?.cotisation_type_id ?? '',
  })

  const initialForm       = useRef<FormData>({ ...form })
  const initialAssignStr  = useRef(JSON.stringify(initialAssignments))

  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

  // ── Affectations ─────────────────────────────────────────────────────────
  const [assignments,  setAssignments]  = useState<AssignmentData[]>(initialAssignments)
  const [showAddRow,   setShowAddRow]   = useState(false)
  const [addTeacherId, setAddTeacherId] = useState('')
  // true = Prof. principal, false = Par matière
  const [addIsMain,    setAddIsMain]    = useState(true)
  const [addSubject,   setAddSubject]   = useState('')

  const hasMain         = assignments.some(a => a.is_main_teacher)
  const assignedIds     = new Set(assignments.map(a => a.teacher_id))
  const availableTeachers = teachers.filter(t => !assignedIds.has(t.id))

  const openAddRow = () => {
    // Si un prof principal existe déjà, pré-sélectionner "Par matière"
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

  // ── Validation ────────────────────────────────────────────────────────────
  const vName        = form.name.trim().length < 2
  const vCotisation  = !form.cotisation_type_id
  const vAssignments = assignments.length === 0
  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const vCapacity    = !!(selectedRoom?.capacity && parseInt(form.max_students, 10) > selectedRoom.capacity)
  const isFormValid  = !vName && !vCotisation && !vAssignments && !vCapacity
  const invalid = (field: string, bad: boolean) => touched.has(field) && bad
  const cls2    = (field: string, bad: boolean) =>
    bad && touched.has(field) ? 'input input-error' : 'input'
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))
  const set = (field: keyof FormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const isUnchanged = isEditing
    && (Object.keys(form) as (keyof FormData)[]).every(k => form[k] === initialForm.current[k])
    && JSON.stringify(assignments) === initialAssignStr.current

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set([...Object.keys(form), 'assignments']))
    setError(null)
    setSuccess(false)
    if (!isFormValid) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // Vérif doublon nom
      const { data: same } = await supabase
        .from('classes')
        .select('id')
        .ilike('name', form.name.trim())
      if (same?.find(c => c.id !== cls?.id)) {
        setError(`Une classe "${form.name.trim()}" existe déjà.`)
        setIsSubmitting(false)
        return
      }

      const payload = {
        name:          form.name.trim(),
        level:         form.level.trim(),
        academic_year: currentYear?.label      ?? null,
        room_number:   form.room_id ? (rooms.find(r => r.id === form.room_id)?.name ?? null) : (form.room_number.trim() || null),
        room_id:       form.room_id || null,
        max_students:  parseInt(form.max_students, 10) || 30,
        description:   form.description.trim() || null,
        day_of_week:        form.day_of_week        || null,
        start_time:         form.start_time         || null,
        end_time:           form.end_time           || null,
        cotisation_type_id: form.cotisation_type_id || null,
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

      // Affectations : delete all + re-insert
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

      if (isEditing) {
        initialForm.current     = { ...form }
        initialAssignStr.current = JSON.stringify(assignments)
        setSuccess(true)
        router.refresh()
      } else {
        router.push(backHref)
        router.refresh()
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2 max-w-5xl">

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          Classe enregistrée avec succès.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">

        {/* ── Colonne gauche — Informations générales ── */}
        <div className="card p-3 space-y-2">

          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Informations générales
          </h2>

          {/* Nom */}
          <Field
            label={<>Nom de la classe <span className="text-red-400">*</span></>}
            error={invalid('name', vName) ? 'Minimum 2 caractères.' : undefined}
          >
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value.toUpperCase())}
              onBlur={() => touch('name')}
              className={cls2('name', vName)}
            />
          </Field>

          {/* Niveau */}
          <Field label="Niveau">
            <input
              type="text"
              value={form.level}
              onChange={e => set('level', e.target.value)}
              className="input"
            />
          </Field>

          {/* Année scolaire — grisée, non modifiable */}
          <Field label="Année scolaire">
            <div className="input bg-warm-100 text-secondary-500 text-sm select-all cursor-default">
              {currentYear?.label ?? '—'}{currentYear ? ' (en cours)' : ''}
            </div>
          </Field>

          {/* Salle + Capacité */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Salle">
              <select
                value={form.room_id}
                onChange={e => {
                  const roomId = e.target.value
                  set('room_id', roomId)
                  // Si la salle a une capacité et que max_students la dépasse, ajuster
                  if (roomId) {
                    const room = rooms.find(r => r.id === roomId)
                    if (room?.capacity && parseInt(form.max_students, 10) > room.capacity) {
                      set('max_students', String(room.capacity))
                    }
                  }
                }}
                className="input"
              >
                <option value="">— Aucune —</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.capacity ? ` (${r.capacity} places)` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Capacité max"
              error={(() => {
                const room = rooms.find(r => r.id === form.room_id)
                const max = parseInt(form.max_students, 10)
                return room?.capacity && max > room.capacity
                  ? `Max ${room.capacity} (capacité salle)`
                  : undefined
              })()}
            >
              <input
                type="number"
                min={1}
                max={(() => { const room = rooms.find(r => r.id === form.room_id); return room?.capacity || 999 })()}
                value={form.max_students}
                onChange={e => set('max_students', e.target.value)}
                className="input"
              />
            </Field>
          </div>

          {/* Type de cotisation */}
          <Field
            label={<>Type de cotisation <span className="text-red-400">*</span></>}
            error={invalid('cotisation_type_id', vCotisation) ? 'Le type de cotisation est obligatoire.' : undefined}
          >
            <select
              value={form.cotisation_type_id}
              onChange={e => set('cotisation_type_id', e.target.value)}
              onBlur={() => touch('cotisation_type_id')}
              className={cls2('cotisation_type_id', vCotisation)}
            >
              <option value="">— Choisir —</option>
              {cotisationTypes.map(ct => (
                <option key={ct.id} value={ct.id}>
                  {ct.label}
                </option>
              ))}
            </select>
          </Field>

          {/* Horaire */}
          <Field label="Jour de la semaine">
            <select
              value={form.day_of_week}
              onChange={e => set('day_of_week', e.target.value)}
              className="input"
            >
              <option value="">—</option>
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>

          {form.day_of_week && (
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Début">
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => set('start_time', e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Fin">
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => set('end_time', e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              {form.start_time && form.end_time && (() => {
                const [sh, sm] = form.start_time.split(':').map(Number)
                const [eh, em] = form.end_time.split(':').map(Number)
                const diff = (eh * 60 + em) - (sh * 60 + sm)
                if (diff <= 0) return null
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
            </div>
          )}

          {/* Description */}
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              className="input resize-none w-full"
              placeholder="Remarques, spécificités de la classe..."
            />
          </Field>

        </div>

        {/* ── Colonne droite — Affectations enseignants ── */}
        <div className="card p-3 space-y-2 flex flex-col">

          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Affectations enseignants <span className="text-red-400">*</span>
          </h2>

          {/* Tableau */}
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
                            <UserCheck size={11} />
                            Prof. principal
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
                          title="Retirer"
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

          {/* Formulaire d'ajout inline */}
          {showAddRow ? (
            <div className="bg-warm-50 border border-warm-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Nouvelle affectation</p>

              {/* Enseignant */}
              <Field label="Enseignant">
                <select
                  value={addTeacherId}
                  onChange={e => setAddTeacherId(e.target.value)}
                  className="input"
                >
                  <option value="">— Choisir —</option>
                  {availableTeachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.last_name} {t.first_name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Type */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Type</span>
                <div className="flex gap-2">
                  <label className={clsx(
                    'flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border text-sm transition-colors flex-1',
                    addIsMain
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-warm-200 hover:bg-warm-100',
                    hasMain && 'opacity-40 cursor-not-allowed'
                  )}>
                    <input
                      type="radio"
                      name="addType"
                      checked={addIsMain}
                      onChange={() => setAddIsMain(true)}
                      disabled={hasMain}
                      className="accent-amber-500"
                    />
                    <UserCheck size={13} className="text-primary-500 flex-shrink-0" />
                    <span>Prof. principal</span>
                  </label>
                  <label className={clsx(
                    'flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border text-sm transition-colors flex-1',
                    !addIsMain
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-warm-200 hover:bg-warm-100'
                  )}>
                    <input
                      type="radio"
                      name="addType"
                      checked={!addIsMain}
                      onChange={() => setAddIsMain(false)}
                      className="accent-amber-500"
                    />
                    <BookOpen size={13} className="text-secondary-400 flex-shrink-0" />
                    <span>Par matière</span>
                  </label>
                </div>
                {hasMain && addIsMain && (
                  <p className="text-xs text-warm-400 italic">Un prof. principal est déjà affecté.</p>
                )}
              </div>

              {/* Matière — liste des UE (uniquement si Par matière) */}
              {!addIsMain && (
                <Field label="Unité d'Enseignement">
                  {ues.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Aucune UE disponible. Créez d&apos;abord des Unités d&apos;Enseignement dans la section Cours.
                    </p>
                  ) : (
                    <select
                      value={addSubject}
                      onChange={e => setAddSubject(e.target.value)}
                      className="input"
                    >
                      <option value="">Choisir</option>
                      {ues.map(ue => (
                        <option key={ue.id} value={ue.id}>
                          {ue.code ? `${ue.code} — ` : ''}{ue.nom_fr}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddRow(false)}
                  className="btn btn-secondary text-sm py-1.5 px-3"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAddAssignment}
                  disabled={!addTeacherId || (!addIsMain && (!addSubject || ues.length === 0))}
                  className="btn btn-primary text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Valider
                </button>
              </div>
            </div>
          ) : (
            availableTeachers.length > 0 && (
              <button
                type="button"
                onClick={openAddRow}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 transition-colors self-start"
              >
                <Plus size={14} />
                Ajouter une affectation
              </button>
            )
          )}

        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="btn btn-secondary"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting || isUnchanged}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? 'Enregistrement...'
            : isEditing ? 'Mettre à jour' : 'Créer la classe'}
        </button>
      </div>

    </form>
  )
}

// ─── Sous-composant ───────────────────────────────────────────────────────────

function Field({ label, error, children }: {
  label: React.ReactNode
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
