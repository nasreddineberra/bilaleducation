'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Pencil, Trash2, Users, LogOut, Camera, GraduationCap } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { studentRepository } from '@/lib/database/students'
import Tooltip from '@/components/ui/Tooltip'
import type { Parent, Student } from '@/types/database'

interface ParentsTableProps {
  parents: Parent[]
  parentsWithChildren: Set<string>
  parentsWithPAI: Set<string>
}

const RELATION_LABEL: Record<string, string> = {
  'père': 'Père',
  'mère': 'Mère',
  'tuteur': 'Tuteur',
  'autre': 'Autre',
}

export default function ParentsTable({ parents, parentsWithChildren, parentsWithPAI }: ParentsTableProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  type StudentWithEnrollment = Student & { enrollment_class?: string | null; enrollment_teacher?: string | null }
  const [childrenMap, setChildrenMap] = useState<Record<string, StudentWithEnrollment[]>>({})
  const [loadingChildrenId, setLoadingChildrenId] = useState<string | null>(null)
  const [togglingStudentId, setTogglingStudentId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleToggleChildren = async (parentId: string) => {
    setDeleteError(null)

    if (expandedId === parentId) {
      setExpandedId(null)
      return
    }

    setExpandedId(parentId)

    if (!childrenMap[parentId]) {
      setLoadingChildrenId(parentId)
      try {
        const children = await studentRepository.getByParent(parentId)
        // Fetch active enrollments with class + main teacher
        const supabase = createClient()
        const studentIds = children.map(c => c.id)
        let enrollmentMap: Record<string, { className: string; teacherLabel: string | null }> = {}
        if (studentIds.length > 0) {
          const { data: enrollments } = await supabase
            .from('enrollments')
            .select('student_id, classes:class_id(name, class_teachers(is_main_teacher, teachers(civilite, first_name, last_name)))')
            .in('student_id', studentIds)
            .eq('status', 'active')
          for (const e of (enrollments ?? []) as any[]) {
            const cls = e.classes
            if (!cls) continue
            const mainTeacher = cls.class_teachers?.find((ct: any) => ct.is_main_teacher)?.teachers
            const teacherLabel = mainTeacher
              ? `${mainTeacher.civilite ? mainTeacher.civilite + ' ' : ''}${mainTeacher.first_name} ${mainTeacher.last_name}`
              : null
            enrollmentMap[e.student_id] = { className: cls.name, teacherLabel }
          }
        }
        const enriched = children.map(c => ({
          ...c,
          enrollment_class: enrollmentMap[c.id]?.className ?? null,
          enrollment_teacher: enrollmentMap[c.id]?.teacherLabel ?? null,
        }))
        setChildrenMap(prev => ({ ...prev, [parentId]: enriched }))
      } catch {
        setChildrenMap(prev => ({ ...prev, [parentId]: [] }))
      } finally {
        setLoadingChildrenId(null)
      }
    }
  }

  const handleDelete = async (parentId: string) => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('parents').delete().eq('id', parentId)

      if (error) {
        if (error.code === '23503') {
          setDeleteError('Impossible de supprimer : des élèves sont rattachés à cette fiche.')
        } else {
          setDeleteError('Une erreur est survenue lors de la suppression.')
        }
        setConfirmDeleteId(null)
        return
      }

      setConfirmDeleteId(null)
      router.refresh()
    } catch {
      setDeleteError('Une erreur est survenue lors de la suppression.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleActive = async (student: StudentWithEnrollment, parentId: string) => {
    if (student.enrollment_class) return // inscrit dans une classe → pas de toggle
    setTogglingStudentId(student.id)
    try {
      const supabase = createClient()
      const newActive = !student.is_active
      await supabase.from('students').update({ is_active: newActive }).eq('id', student.id)
      setChildrenMap(prev => ({
        ...prev,
        [parentId]: prev[parentId].map(s => s.id === student.id ? { ...s, is_active: newActive } : s),
      }))
    } catch {
      // silently fail
    } finally {
      setTogglingStudentId(null)
    }
  }

  if (parents.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-warm-400 text-sm">Aucune fiche parents pour le moment</p>
        <p className="text-warm-300 text-xs mt-1">Cliquez sur "Ajouter une fiche" pour commencer</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {deleteError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {deleteError}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-warm-100">
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-5/12">
                Tuteur 1
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-5/12">
                Tuteur 2
              </th>
              <th className="px-4 py-2 w-2/12" />
            </tr>
          </thead>

          <tbody className="divide-y divide-warm-50">
            {parents.map((parent) => (
              <Fragment key={parent.id}>

                {/* Ligne principale */}
                <tr className="hover:bg-warm-50 transition-colors">

                  {/* Tuteur 1 */}
                  <td className="px-4 py-[3px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-secondary-800">
                        {parent.tutor1_last_name} {parent.tutor1_first_name}
                      </span>
                      {parent.tutor1_relationship && (
                        <span className="text-xs text-warm-400">
                          {RELATION_LABEL[parent.tutor1_relationship] ?? parent.tutor1_relationship}
                        </span>
                      )}
                      {parent.tutor1_adult_courses && (
                        <span title="Inscrit aux cours adultes"><GraduationCap size={13} className="text-primary-500 flex-shrink-0" /></span>
                      )}
                    </div>
                  </td>

                  {/* Tuteur 2 */}
                  <td className="px-4 py-[3px]">
                    {parent.tutor2_last_name ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-secondary-800">
                          {parent.tutor2_last_name} {parent.tutor2_first_name}
                        </span>
                        {parent.tutor2_relationship && (
                          <span className="text-xs text-warm-400">
                            {RELATION_LABEL[parent.tutor2_relationship] ?? parent.tutor2_relationship}
                          </span>
                        )}
                        {parent.tutor2_adult_courses && (
                          <span title="Inscrit aux cours adultes"><GraduationCap size={13} className="text-primary-500 flex-shrink-0" /></span>
                        )}
                      </div>
                    ) : (
                      <span className="text-warm-300 text-sm">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-[3px]">
                    {confirmDeleteId === parent.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-warm-500">Supprimer ?</span>
                        <button
                          onClick={() => handleDelete(parent.id)}
                          disabled={isDeleting}
                          className="text-xs font-medium px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {isDeleting ? '...' : 'Confirmer'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs font-medium px-2.5 py-1 bg-warm-100 text-warm-600 rounded-lg hover:bg-warm-200 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        {parentsWithChildren.has(parent.id) && (
                          <button
                            onClick={() => handleToggleChildren(parent.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                          >
                            <Users size={13} />
                            Enfants
                            {expandedId === parent.id
                              ? <ChevronDown size={12} />
                              : <ChevronRight size={12} />
                            }
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/dashboard/parents/${parent.id}`)}
                          className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        {parentsWithChildren.has(parent.id) ? (
                          <Tooltip content="des enfants sont rattachés à cette fiche" position="top-right" maxWidth="w-40">
                            <span className="p-1.5 text-warm-200 cursor-not-allowed rounded-lg">
                              <Trash2 size={14} />
                            </span>
                          </Tooltip>
                        ) : (
                          <button
                            onClick={() => { setConfirmDeleteId(parent.id); setDeleteError(null) }}
                            className="p-1.5 text-warm-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>

                {/* Ligne enfants (expandable) */}
                {expandedId === parent.id && (
                  <tr className="bg-warm-50">
                    <td colSpan={3} className="px-6 py-2">
                      {loadingChildrenId === parent.id ? (
                        <p className="text-sm text-warm-400">Chargement...</p>
                      ) : childrenMap[parent.id]?.length === 0 ? (
                        <p className="text-sm text-warm-400">Aucun élève rattaché à cette fiche.</p>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {childrenMap[parent.id]?.map(student => {
                            const isEnrolled = !!student.enrollment_class
                            const statusTooltip = isEnrolled
                              ? `Classe : ${student.enrollment_class}${student.enrollment_teacher ? ' — ' + student.enrollment_teacher : ''}`
                              : student.is_active ? 'Cliquer pour rendre inactif' : 'Cliquer pour rendre actif'

                            return (
                              <div
                                key={student.id}
                                className={clsx(
                                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                                  student.has_pai
                                    ? 'bg-red-50 border-red-100'
                                    : student.is_active
                                      ? 'bg-white border-warm-100'
                                      : 'bg-warm-100/70 border-warm-200'
                                )}
                              >
                                {/* Pastille statut cliquable */}
                                <Tooltip content={statusTooltip}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleActive(student, parent.id) }}
                                    disabled={isEnrolled || togglingStudentId === student.id}
                                    className={clsx(
                                      'w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ring-2 ring-offset-1',
                                      isEnrolled
                                        ? 'bg-green-400 ring-green-200 cursor-not-allowed'
                                        : student.is_active
                                          ? 'bg-green-500 ring-green-200 hover:bg-red-400 hover:ring-red-200 hover:scale-110 cursor-pointer'
                                          : 'bg-warm-300 ring-warm-200 hover:bg-green-400 hover:ring-green-200 hover:scale-110 cursor-pointer'
                                    )}
                                  />
                                </Tooltip>

                                <button
                                  onClick={() => router.push(`/dashboard/students/${student.id}?from=parents`)}
                                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                >
                                  <span className="font-mono text-xs text-warm-400">{student.student_number}</span>
                                  <span className={clsx('font-medium', student.is_active ? 'text-secondary-700' : 'text-warm-500')}>
                                    {student.last_name} {student.first_name}
                                  </span>
                                </button>

                                {student.has_pai && (
                                  <Tooltip content="Projet d'Aide Individualisé">
                                    <span className="text-xs font-semibold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">PAI</span>
                                  </Tooltip>
                                )}
                                {student.exit_authorization && (
                                  <Tooltip content="Autorisation de sortie accordée">
                                    <LogOut size={12} className="text-green-500 flex-shrink-0" />
                                  </Tooltip>
                                )}
                                {student.media_authorization && (
                                  <Tooltip content="Autorisation média accordée">
                                    <Camera size={12} className="text-green-500 flex-shrink-0" />
                                  </Tooltip>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}

              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
