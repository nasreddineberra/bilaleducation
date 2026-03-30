'use client'

import { useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import {
  ArrowLeft, CalendarDays, BookOpenText, Pencil,
  ClipboardList, BookOpen, Lightbulb, FileText,
  Eye, CheckCircle2, Circle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FloatButton } from '@/components/ui/FloatFields'

interface Props {
  journal: any
  homeworks: any[]
  homeworkStatuses: any[]
  classStudents: { id: string; first_name: string; last_name: string }[]
  role: string
  canEdit: boolean
  parentId: string | null
  parentStudentIds: string[]
}

const HW_TYPE: Record<string, { label: string; color: string; icon: any }> = {
  exercice: { label: 'Exercice', color: 'bg-blue-100 text-blue-700', icon: ClipboardList },
  lecon:    { label: 'Lecon',    color: 'bg-green-100 text-green-700', icon: BookOpen },
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

export default function CahierTexteDetail({
  journal, homeworks, homeworkStatuses: initialStatuses,
  classStudents, role, canEdit, parentId, parentStudentIds,
}: Props) {
  const [statuses, setStatuses] = useState<any[]>(initialStatuses)
  const isParent = role === 'parent'
  const canViewTracking = ['enseignant', 'direction', 'responsable_pedagogique', 'admin'].includes(role)

  const toggleStatus = async (homeworkId: string, studentId: string, field: 'is_seen' | 'is_done') => {
    if (!parentId) return
    const supabase = createClient()

    const existing = statuses.find(s => s.homework_id === homeworkId && s.student_id === studentId)

    if (existing) {
      const newVal = !existing[field]
      const updates: any = { [field]: newVal }
      if (field === 'is_seen') updates.seen_at = newVal ? new Date().toISOString() : null
      if (field === 'is_done') updates.done_at = newVal ? new Date().toISOString() : null

      await supabase.from('homework_status').update(updates).eq('id', existing.id)
      setStatuses(prev => prev.map(s => s.id === existing.id ? { ...s, ...updates } : s))
    } else {
      const newStatus: any = {
        homework_id: homeworkId,
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

  const teacherLabel = journal.teachers
    ? `${journal.teachers.civilite ? journal.teachers.civilite + ' ' : ''}${journal.teachers.first_name} ${journal.teachers.last_name}`
    : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/cahier-texte" className="btn btn-ghost p-2">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-secondary-800">{journal.title}</h1>
            <div className="flex items-center gap-2 text-xs text-warm-500 mt-0.5">
              <CalendarDays size={12} />
              <span>{formatDate(journal.session_date)}</span>
              <span className="px-1.5 py-0.5 rounded bg-secondary-100 text-secondary-700 font-bold">
                {journal.classes?.name}
              </span>
              {journal.subject && (
                <span className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-600 font-bold">
                  {journal.subject}
                </span>
              )}
              <span>{teacherLabel}</span>
            </div>
          </div>
        </div>
        {canEdit && (
          <Link href={`/dashboard/cahier-texte/${journal.id}/edit`}>
            <FloatButton variant="edit" type="button">
              <Pencil size={14} /> Modifier
            </FloatButton>
          </Link>
        )}
      </div>

      {/* Contenu de la séance */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <BookOpenText size={14} className="text-primary-500" />
          Contenu de la seance
        </h2>
        <div
          className="prose prose-sm max-w-none text-warm-700"
          dangerouslySetInnerHTML={{ __html: journal.content_html }}
        />
      </div>

      {/* Devoirs */}
      {homeworks.length > 0 && homeworks.map((hw: any) => {
        const typeInfo = HW_TYPE[hw.homework_type] ?? HW_TYPE.autre
        const TypeIcon = typeInfo.icon
        const isPast = new Date(hw.due_date) < new Date(new Date().toDateString())

        // Stats for teachers
        const hwStatuses = statuses.filter(s => s.homework_id === hw.id)
        const seenCount = hwStatuses.filter(s => s.is_seen).length
        const doneCount = hwStatuses.filter(s => s.is_done).length
        const totalStudents = classStudents.length

        return (
          <div key={hw.id} className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide flex items-center gap-1.5">
                <ClipboardList size={14} className="text-primary-500" />
                Devoir
              </h2>
              <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold', typeInfo.color)}>
                <TypeIcon size={12} />
                {typeInfo.label}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-warm-800">{hw.title}</h3>
              <div className={clsx('text-sm font-medium', isPast ? 'text-warm-400' : 'text-red-600')}>
                A rendre le {formatDate(hw.due_date)}
              </div>
              {hw.description_html && (
                <div
                  className="prose prose-sm max-w-none text-warm-700"
                  dangerouslySetInnerHTML={{ __html: hw.description_html }}
                />
              )}
            </div>

            {/* Parent: checkboxes par enfant */}
            {isParent && parentStudentIds.length > 0 && (
              <div className="border-t border-warm-200 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-warm-500 uppercase">Suivi</h4>
                {parentStudentIds.map(studentId => {
                  const st = statuses.find(s => s.homework_id === hw.id && s.student_id === studentId)
                  return (
                    <div key={studentId} className="flex items-center gap-4">
                      <button
                        onClick={() => toggleStatus(hw.id, studentId, 'is_seen')}
                        className={clsx(
                          'flex items-center gap-1.5 text-sm transition-colors',
                          st?.is_seen ? 'text-blue-600' : 'text-warm-400 hover:text-blue-500'
                        )}
                      >
                        {st?.is_seen ? <Eye size={16} /> : <Circle size={16} />}
                        Vu
                      </button>
                      <button
                        onClick={() => toggleStatus(hw.id, studentId, 'is_done')}
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
              <div className="border-t border-warm-200 pt-3 space-y-3">
                <div className="flex items-center gap-4">
                  <h4 className="text-xs font-bold text-warm-500 uppercase">Suivi des familles</h4>
                  <span className="text-xs text-warm-400">
                    {seenCount}/{totalStudents} vus — {doneCount}/{totalStudents} effectues
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
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
                                <span className="text-blue-600 text-xs" title={formatShortDate(st.seen_at)}>
                                  <Eye size={14} className="inline" />
                                </span>
                              ) : (
                                <span className="text-warm-300">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-4 text-center">
                              {st?.is_done ? (
                                <span className="text-green-600 text-xs" title={formatShortDate(st.done_at)}>
                                  <CheckCircle2 size={14} className="inline" />
                                </span>
                              ) : (
                                <span className="text-warm-300">—</span>
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
          </div>
        )
      })}
    </div>
  )
}
