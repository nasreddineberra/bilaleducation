'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Pencil, Trash2, Users, LogOut, Camera, GraduationCap } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { studentRepository } from '@/lib/database/students'
import { deleteParent, getParentDeleteDeps } from '@/app/dashboard/parents/actions'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { libelleSituation } from '@/lib/parents/situation-familiale'
import type { Parent, Student } from '@/types/database'

interface ParentsTableProps {
  parents: Parent[]
  parentsWithChildren: Set<string>
  parentsWithPAI: Set<string>
}

interface DeleteDeps {
  enfants:        number
  finance:        number
  coursAdultes:   number
  communications: number
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
  const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null)
  const [deps,         setDeps]         = useState<DeleteDeps | null>(null)
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
        const enrollmentMap: Record<string, { className: string; teacherLabel: string | null }> = {}
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
              ? `${mainTeacher.civilite ? mainTeacher.civilite + ' ' : ''}${mainTeacher.last_name} ${mainTeacher.first_name}`
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
      } catch (err) {
        console.error('[ParentsTable] Erreur lors du chargement des enfants:', err)
        setChildrenMap(prev => ({ ...prev, [parentId]: [] }))
      } finally {
        setLoadingChildrenId(null)
      }
    }
  }

  // Ouvre la modale APRÈS avoir compté les dépendances.
  const startDelete = async (parent: Parent) => {
    setDeleteError(null)
    const d = await getParentDeleteDeps(parent.id)
    if (d.erreur) { setDeleteError(d.erreur); return }
    setDeps(d)
    setDeleteTarget(parent)
  }

  const closeDeleteModal = () => { setDeleteTarget(null); setDeps(null) }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    const { error } = await deleteParent(deleteTarget.id)
    setIsDeleting(false)
    if (error) { setDeleteError(error); closeDeleteModal(); return }
    closeDeleteModal()
    router.refresh()
  }

  // Pas de repli « rendre inactif » ici : `parents` n'a pas de colonne
  // `is_active`. Le refus dit donc ce qu'il faut retirer d'abord.
  const hasBlocking = !!deps
    && (deps.enfants + deps.finance + deps.coursAdultes + deps.communications) > 0

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
    } catch (err) {
      console.error('[ParentsTable] Erreur lors du toggle actif de l\'élève:', err)
    } finally {
      setTogglingStudentId(null)
    }
  }

  if (parents.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-warm-700 text-sm">Aucune fiche parents pour le moment</p>
        <p className="text-warm-700 text-xs mt-1">Cliquez sur "Ajouter une fiche" pour commencer</p>
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
              <th className="text-left list-th w-4/12">
                Tuteur 1
              </th>
              <th className="text-left list-th w-4/12">
                Tuteur 2
              </th>
              <th className="text-center list-th w-2/12">
                Situation familiale
              </th>
              <th className="px-4 py-1.5 w-2/12" />
            </tr>
          </thead>

          <tbody className="divide-y divide-warm-50">
            {parents.map((parent) => (
              <Fragment key={parent.id}>

                {/* Ligne principale */}
                <tr
                  onClick={() => router.push(`/dashboard/parents/${parent.id}`)}
                  className="hover:bg-warm-50 transition-colors cursor-pointer"
                >

                  {/* Tuteur 1 */}
                  <td className="list-td">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/parents/${parent.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="list-name text-secondary-800 rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                      >
                        {parent.tutor1_last_name} {parent.tutor1_first_name}
                      </Link>
                      {parent.tutor1_relationship && (
                        <span className="text-xs text-warm-700">
                          {RELATION_LABEL[parent.tutor1_relationship] ?? parent.tutor1_relationship}
                        </span>
                      )}
                      {parent.tutor1_adult_courses && (
                        <Tooltip content="Inscrit aux cours adultes"><GraduationCap size={13} className="text-primary-700 flex-shrink-0" /></Tooltip>
                      )}
                    </div>
                  </td>

                  {/* Tuteur 2 */}
                  <td className="list-td">
                    {parent.tutor2_last_name ? (
                      <div className="flex items-center gap-2">
                        <span className="list-name text-secondary-800">
                          {parent.tutor2_last_name} {parent.tutor2_first_name}
                        </span>
                        {parent.tutor2_relationship && (
                          <span className="text-xs text-warm-700">
                            {RELATION_LABEL[parent.tutor2_relationship] ?? parent.tutor2_relationship}
                          </span>
                        )}
                        {parent.tutor2_adult_courses && (
                          <Tooltip content="Inscrit aux cours adultes"><GraduationCap size={13} className="text-primary-700 flex-shrink-0" /></Tooltip>
                        )}
                      </div>
                    ) : (
                      <span className="text-warm-700 text-xs">·</span>
                    )}
                  </td>

                  {/* Situation familiale */}
                  <td className="list-td text-center">
                    <span className="text-xs text-warm-700">
                      {parent.situation_familiale
                        ? libelleSituation(parent.situation_familiale)
                        : '·'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="list-td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {parentsWithChildren.has(parent.id) && (
                          <button
                            onClick={() => handleToggleChildren(parent.id)}
                            aria-expanded={expandedId === parent.id}
                            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                          >
                            <Users size={13} />
                            Enfants
                            {expandedId === parent.id
                              ? <ChevronDown size={12} />
                              : <ChevronRight size={12} />
                            }
                          </button>
                        )}
                        <Tooltip content="Modifier">
                          <button
                            onClick={() => router.push(`/dashboard/parents/${parent.id}`)}
                            aria-label="Modifier la fiche"
                            className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                          >
                            <Pencil size={14} />
                          </button>
                        </Tooltip>
                        {/* Bouton TOUJOURS actif : le grisé ne connaissait que les
                            enfants, alors qu'un foyer sans enfant peut porter des
                            cotisations ou des cours adultes. La modale, elle, dit
                            tout ce qui est rattaché. */}
                        <Tooltip content="Supprimer la fiche">
                          <button
                            onClick={() => startDelete(parent)}
                            aria-label="Supprimer la fiche"
                            className="p-1.5 text-warm-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </div>
                  </td>
                </tr>

                {/* Ligne enfants (expandable) */}
                {expandedId === parent.id && (
                  <tr className="bg-warm-50">
                    <td colSpan={4} className="px-6 py-2">
                      {loadingChildrenId === parent.id ? (
                        <p className="text-sm text-warm-700">Chargement...</p>
                      ) : childrenMap[parent.id]?.length === 0 ? (
                        <p className="text-sm text-warm-700">Aucun élève rattaché à cette fiche.</p>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {childrenMap[parent.id]?.map(student => {
                            const isEnrolled = !!student.enrollment_class
                            const statusTooltip = isEnrolled
                              ? `Classe : ${student.enrollment_class}${student.enrollment_teacher ? ' · ' + student.enrollment_teacher : ''}`
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
                                    aria-label={
                                      isEnrolled
                                        ? `${student.last_name} ${student.first_name} · inscrit en classe`
                                        : student.is_active
                                          ? `${student.last_name} ${student.first_name} · actif, cliquer pour rendre inactif`
                                          : `${student.last_name} ${student.first_name} · inactif, cliquer pour rendre actif`
                                    }
                                    className="flex-shrink-0 p-1.5 -m-1.5 rounded-full cursor-pointer disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 group/dot"
                                  >
                                    <span className={clsx(
                                      'block w-2.5 h-2.5 rounded-full transition-all ring-2 ring-offset-1',
                                      isEnrolled
                                        ? 'bg-primary-400 ring-primary-200'
                                        : student.is_active
                                          ? 'bg-primary-500 ring-primary-200 group-hover/dot:bg-red-400 group-hover/dot:ring-red-200 group-hover/dot:scale-110'
                                          : 'bg-warm-300 ring-warm-200 group-hover/dot:bg-primary-400 group-hover/dot:ring-primary-200 group-hover/dot:scale-110'
                                    )} />
                                  </button>
                                </Tooltip>

                                <button
                                  onClick={() => router.push(`/dashboard/students/${student.id}?from=parents`)}
                                  aria-label={`Ouvrir la fiche de ${student.last_name} ${student.first_name}`}
                                  className="flex items-center gap-2 hover:opacity-80 transition-opacity rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                                >
                                  <span className="font-mono text-xs text-warm-700">{student.student_number}</span>
                                  <span className={clsx('font-medium', student.is_active ? 'text-secondary-700' : 'text-warm-400')}>
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
                                    <LogOut size={12} className="text-primary-600 flex-shrink-0" />
                                  </Tooltip>
                                )}
                                {student.media_authorization && (
                                  <Tooltip content="Autorisation média accordée">
                                    <Camera size={12} className="text-primary-600 flex-shrink-0" />
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

      {/* Suppression : on ne supprime qu'une fiche VIERGE. */}
      {deleteTarget && deps && (
        <ConfirmModal
          title={hasBlocking
            ? 'Suppression impossible'
            : `Supprimer le foyer "${deleteTarget.tutor1_last_name} ${deleteTarget.tutor1_first_name}" ?`}
          confirmLabel={hasBlocking
            ? 'Suppression impossible'
            : (isDeleting ? 'Suppression...' : 'Supprimer définitivement')}
          confirmColor="red"
          confirmDisabled={isDeleting || hasBlocking}
          onConfirm={confirmDelete}
          onCancel={closeDeleteModal}
        >
          {hasBlocking ? (
            <div className="space-y-3">
              <p className="text-sm text-secondary-700">
                Le foyer <strong>{deleteTarget.tutor1_last_name} {deleteTarget.tutor1_first_name}</strong> ne
                peut pas être supprimé : des données lui sont rattachées.
              </p>
              <ul className="text-sm text-secondary-700 space-y-1 ml-4 list-disc">
                {deps.enfants > 0 && (
                  <li><strong>{deps.enfants}</strong> apprenant{deps.enfants > 1 ? 's' : ''} rattaché{deps.enfants > 1 ? 's' : ''}</li>
                )}
                {deps.finance > 0 && (
                  <li><strong>{deps.finance}</strong> donnée{deps.finance > 1 ? 's' : ''} financière{deps.finance > 1 ? 's' : ''} (cotisations, relances, attestations)</li>
                )}
                {deps.coursAdultes > 0 && (
                  <li><strong>{deps.coursAdultes}</strong> donnée{deps.coursAdultes > 1 ? 's' : ''} de cours adultes (inscriptions, notes, bulletins, assiduité)</li>
                )}
                {deps.communications > 0 && (
                  <li><strong>{deps.communications}</strong> communication{deps.communications > 1 ? 's' : ''} reçue{deps.communications > 1 ? 's' : ''}</li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-secondary-700">
              Aucune donnée n&apos;est rattachée à ce foyer. Sa fiche sera supprimée définitivement.
              Cette action est irréversible.
            </p>
          )}
        </ConfirmModal>
      )}

    </div>
  )
}
