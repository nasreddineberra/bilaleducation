'use client'

import { useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import {
  ArrowLeft, CalendarDays,
  ClipboardList, BookOpen, Lightbulb, FileText,
  Eye, CheckCircle2, Circle,
} from 'lucide-react'
import { sanitize } from '@/lib/security/sanitize'
import { createClient } from '@/lib/supabase/client'
import { FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import DevoirForm from './DevoirForm'

interface Props {
  homework: any
  homeworkStatuses: any[]
  classStudents: { id: string; first_name: string; last_name: string }[]
  role: string
  canEdit: boolean
  parentId: string | null
  parentStudentIds: string[]
  subjects: string[]
  etablissementId: string
}

const HW_TYPE: Record<string, { label: string; color: string; icon: any }> = {
  exercice: { label: 'Exercice', color: 'bg-blue-100 text-blue-700', icon: ClipboardList },
  lecon:    { label: 'Leçon',    color: 'bg-green-100 text-green-700', icon: BookOpen },
  expose:   { label: 'Expose',   color: 'bg-purple-100 text-purple-700', icon: Lightbulb },
  autre:    { label: 'Autre',    color: 'bg-warm-100 text-warm-600', icon: FileText },
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatShortDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function DevoirDetail({
  homework, homeworkStatuses: initialStatuses,
  classStudents, role, canEdit, parentId, parentStudentIds, subjects, etablissementId,
}: Props) {
  const [statuses, setStatuses] = useState<any[]>(initialStatuses)
  const [showEdit, setShowEdit] = useState(false)
  const isParent = role === 'parent'
  const canViewTracking = ['enseignant', 'direction', 'responsable_pedagogique', 'admin'].includes(role)

  const toggleStatus = async (studentId: string, field: 'is_seen' | 'is_done') => {
    if (!parentId) return
    const supabase = createClient()

    const existing = statuses.find(s => s.homework_id === homework.id && s.student_id === studentId)

    if (existing) {
      const newVal = !existing[field]
      const updates: any = { [field]: newVal }
      if (field === 'is_seen') updates.seen_at = newVal ? new Date().toISOString() : null
      if (field === 'is_done') updates.done_at = newVal ? new Date().toISOString() : null

      await supabase.from('homework_status').update(updates).eq('id', existing.id)
      setStatuses(prev => prev.map(s => s.id === existing.id ? { ...s, ...updates } : s))
    } else {
      const newStatus: any = {
        homework_id: homework.id,
        student_id: studentId,
        parent_id: parentId,
        is_seen: field === 'is_seen',
        seen_at: field === 'is_seen' ? new Date().toISOString() : null,
        is_done: field === 'is_done',
        done_at: field === 'is_done' ? new Date().toISOString() : null,
      }

      const { data } = await supabase.from('homework_status').insert(newStatus).select('id').single()
      if (data) setStatuses(prev => [...prev, { ...newStatus, id: data.id }])
    }
  }

  const teacherLabel = homework.teachers
    ? `${homework.teachers.civilite ? homework.teachers.civilite + ' ' : ''}${homework.teachers.first_name} ${homework.teachers.last_name}`
    : ''

  const typeInfo = HW_TYPE[homework.homework_type] ?? HW_TYPE.autre
  const TypeIcon = typeInfo.icon
  const isPast = new Date(homework.due_date) < new Date(new Date().toDateString())

  const hwStatuses = statuses.filter(s => s.homework_id === homework.id)
  const seenCount = hwStatuses.filter(s => s.is_seen).length
  const doneCount = hwStatuses.filter(s => s.is_done).length
  const totalStudents = classStudents.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/cahier-texte?class=${homework.class_id}`} aria-label="Retour au cahier de texte" className="btn btn-ghost p-2">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-secondary-800">{homework.title}</h1>
            <div className="flex items-center gap-2 text-xs text-warm-500 mt-0.5">
              <CalendarDays size={12} />
              <span className={clsx('font-medium', isPast ? 'text-warm-400' : 'text-red-600')}>
                A rendre le {formatDate(homework.due_date)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-secondary-100 text-secondary-700 font-bold">
                {homework.classes?.name}
              </span>
              {homework.subject && homework.subject !== 'General' && (
                <span className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-600 font-bold">
                  {homework.subject}
                </span>
              )}
              <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold', typeInfo.color)}>
                <TypeIcon size={11} />
                {typeInfo.label}
              </span>
              <span>{teacherLabel}</span>
            </div>
          </div>
        </div>
        {canEdit && (
          <FloatButton variant="edit" type="button" onClick={() => setShowEdit(true)}>
            Modifier
          </FloatButton>
        )}
      </div>

      {/* Consignes */}
      {homework.description_html && sanitize(homework.description_html).trim() && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ClipboardList size={14} className="text-primary-500" />
            Consignes
          </h2>
          <div
            className="prose prose-sm max-w-none text-warm-700"
            dangerouslySetInnerHTML={{ __html: sanitize(homework.description_html) }}
          />
        </div>
      )}

      {/* Parent: suivi par enfant */}
      {isParent && parentStudentIds.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Suivi</h2>
          {parentStudentIds.map(studentId => {
            const st = statuses.find(s => s.homework_id === homework.id && s.student_id === studentId)
            const student = classStudents.find(s => s.id === studentId)
            return (
              <div key={studentId} className="flex items-center gap-4">
                {student && (
                  <span className="text-sm text-warm-700 w-40 truncate">{student.last_name} {student.first_name}</span>
                )}
                <button
                  onClick={() => toggleStatus(studentId, 'is_seen')}
                  aria-pressed={!!st?.is_seen}
                  className={clsx(
                    'flex items-center gap-1.5 text-sm transition-colors',
                    st?.is_seen ? 'text-blue-600' : 'text-warm-400 hover:text-blue-500'
                  )}
                >
                  {st?.is_seen ? <Eye size={16} /> : <Circle size={16} />}
                  Vu
                </button>
                <button
                  onClick={() => toggleStatus(studentId, 'is_done')}
                  aria-pressed={!!st?.is_done}
                  className={clsx(
                    'flex items-center gap-1.5 text-sm transition-colors',
                    st?.is_done ? 'text-green-600' : 'text-warm-400 hover:text-green-500'
                  )}
                >
                  {st?.is_done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  Effectue
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Teacher/staff: tableau récapitulatif */}
      {canViewTracking && classStudents.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Suivi des familles</h2>
            <span className="text-xs text-warm-400">
              {seenCount}/{totalStudents} vus · {doneCount}/{totalStudents} effectues
            </span>
          </div>
          <div className="overflow-x-auto">
            <table aria-label="Suivi des familles (vu / effectué) par élève" className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-warm-500 border-b border-warm-200">
                  <th className="pb-2 pr-4">Eleve</th>
                  <th className="pb-2 px-4 text-center">Vu</th>
                  <th className="pb-2 px-4 text-center">Effectue</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map(student => {
                  const st = hwStatuses.find(s => s.student_id === student.id)
                  return (
                    <tr key={student.id} className="border-b border-warm-100">
                      <td className="py-1.5 pr-4 text-warm-700">
                        {student.last_name} {student.first_name}
                      </td>
                      <td className="py-1.5 px-4 text-center">
                        {st?.is_seen ? (
                          <Tooltip content={`Vu le ${formatShortDate(st.seen_at)}`}>
                            <span className="text-blue-600 text-xs" aria-label={`Vu le ${formatShortDate(st.seen_at)}`}>
                              <Eye size={14} className="inline" />
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-warm-300" aria-label="Non vu">·</span>
                        )}
                      </td>
                      <td className="py-1.5 px-4 text-center">
                        {st?.is_done ? (
                          <Tooltip content={`Effectué le ${formatShortDate(st.done_at)}`}>
                            <span className="text-green-600 text-xs" aria-label={`Effectué le ${formatShortDate(st.done_at)}`}>
                              <CheckCircle2 size={14} className="inline" />
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-warm-300" aria-label="Non effectué">·</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEdit && (
        <DevoirForm
          etablissementId={etablissementId}
          classId={homework.class_id}
          className={homework.classes?.name ?? ''}
          teacherId={homework.teacher_id}
          teacherLabel={teacherLabel}
          subjects={subjects}
          onClose={() => setShowEdit(false)}
          onSaved={() => setShowEdit(false)}
          initialData={{
            id: homework.id,
            subject: homework.subject,
            title: homework.title,
            homework_type: homework.homework_type,
            due_date: (homework.due_date ?? '').slice(0, 10),
            description_html: homework.description_html,
          }}
        />
      )}
    </div>
  )
}
