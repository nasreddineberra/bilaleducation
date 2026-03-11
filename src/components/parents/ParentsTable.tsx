'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Pencil, Trash2, Users, LogOut, Camera, GraduationCap } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { studentRepository } from '@/lib/database/students'
import type { Parent, Student } from '@/types/database'

interface ParentsTableProps {
  parents: Parent[]
  parentsWithChildren: Set<string>
  parentsWithPAI: Set<string>
}

function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="relative group/tip inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium bg-secondary-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity z-20 shadow-md">
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-secondary-800" />
      </span>
    </span>
  )
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
  const [childrenMap, setChildrenMap] = useState<Record<string, Student[]>>({})
  const [loadingChildrenId, setLoadingChildrenId] = useState<string | null>(null)
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
        setChildrenMap(prev => ({ ...prev, [parentId]: children }))
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
                        <button
                          onClick={() => { setConfirmDeleteId(parent.id); setDeleteError(null) }}
                          className="p-1.5 text-warm-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
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
                          {childrenMap[parent.id]?.map(student => (
                            <button
                              key={student.id}
                              onClick={() => router.push(`/dashboard/students/${student.id}?from=parents`)}
                              className={clsx(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                                student.has_pai
                                  ? 'bg-red-50 border-red-100 hover:bg-red-100/70 hover:border-red-200'
                                  : student.is_active
                                    ? 'bg-white border-warm-100 hover:bg-primary-50 hover:border-primary-200'
                                    : 'bg-warm-50 border-warm-100 opacity-60 hover:opacity-80'
                              )}
                            >
                              <span className="font-mono text-xs text-warm-400">{student.student_number}</span>
                              <span className={clsx('font-medium', student.is_active ? 'text-secondary-700' : 'text-warm-400')}>
                                {student.last_name} {student.first_name}
                              </span>
                              {student.has_pai && (
                                <Tooltip label="Projet d'Aide Individualisé">
                                  <span className="text-xs font-semibold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">PAI</span>
                                </Tooltip>
                              )}
                              {student.exit_authorization && (
                                <Tooltip label="Autorisation de sortie accordée">
                                  <LogOut size={12} className="text-green-500 flex-shrink-0" />
                                </Tooltip>
                              )}
                              {student.media_authorization && (
                                <Tooltip label="Autorisation média accordée">
                                  <Camera size={12} className="text-green-500 flex-shrink-0" />
                                </Tooltip>
                              )}
                              {!student.is_active && (
                                <span className="text-xs bg-warm-200 text-warm-500 px-1 py-0.5 rounded">inactif</span>
                              )}
                            </button>
                          ))}
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
