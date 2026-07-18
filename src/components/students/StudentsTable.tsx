'use client'

import { useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2, Link2Off, LogOut, Camera } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import Tooltip from '@/components/ui/Tooltip'
import type { StudentWithClass, Discipline } from './StudentsClient'

interface StudentsTableProps {
  students: StudentWithClass[]
}

// Affiche absences / retards / avertissements (année en cours), non-nuls uniquement.
// Couleurs alignées sur l'onglet Discipline de la fiche. Rien si élève inactif (discipline null).
function DisciplineInfo({ discipline }: { discipline: Discipline | null }) {
  if (!discipline) return null
  const parts: ReactElement[] = []
  if (discipline.absences > 0)
    parts.push(<span key="a" className="text-red-600 whitespace-nowrap">{discipline.absences} abs.</span>)
  if (discipline.retards > 0)
    parts.push(<span key="r" className="text-amber-700 whitespace-nowrap">{discipline.retards} {discipline.retards > 1 ? 'retards' : 'retard'}</span>)
  if (discipline.avertissements > 0)
    parts.push(<span key="w" className="text-purple-600 whitespace-nowrap">{discipline.avertissements} avert.</span>)
  if (parts.length === 0) return <span className="text-xs text-warm-700">—</span>
  return (
    <span className="text-xs">
      {parts.map((node, i) => (
        <span key={i}>{i > 0 ? <span className="text-warm-700">, </span> : null}{node}</span>
      ))}
    </span>
  )
}

function StudentAvatar({ lastName, firstName, gender }: { lastName: string; firstName: string; gender: string | null | undefined }) {
  const initiales = (lastName[0] ?? '').toUpperCase() + (firstName[0] ?? '').toUpperCase()
  // Avatar neutre (gris beige) ; le genre est indiqué par un liseré coloré
  const ring = gender === 'male'
    ? 'ring-2 ring-blue-500'
    : gender === 'female'
      ? 'ring-2 ring-pink-500'
      : 'ring-1 ring-warm-200'
  return (
    <div className={clsx(
      'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] flex-shrink-0 select-none bg-warm-100 text-warm-700',
      ring
    )}>
      {initiales}
    </div>
  )
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calcAge(dob: string): string {
  const diff = Date.now() - new Date(dob).getTime()
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  return `${age} ans`
}

export default function StudentsTable({ students }: StudentsTableProps) {
  const router = useRouter()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async (studentId: string) => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('students').delete().eq('id', studentId)

      if (error) {
        if (error.code === '23503') {
          setDeleteError('Impossible de supprimer : des données sont rattachées à cet élève.')
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

  if (students.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-warm-700 text-sm">Aucun élève pour le moment</p>
        <p className="text-warm-700 text-xs mt-1">Cliquez sur "Ajouter un élève" pour commencer</p>
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
              <th className="text-left list-th w-3/12">
                Élève
              </th>
              <th className="text-left list-th w-2/12">
                N° élève
              </th>
              <th className="text-left list-th w-2/12">
                Classe
              </th>
              <th className="text-left list-th w-2/12">
                Naissance
              </th>
              <th className="text-left list-th w-2/12">
                Discipline
              </th>
              <th className="px-4 py-1.5 w-1/12" />
            </tr>
          </thead>

          <tbody className="divide-y divide-warm-50">
            {students.map((student) => (
              <tr
                key={student.id}
                onClick={() => router.push(`/dashboard/students/${student.id}`)}
                className={clsx(
                  // 3 niveaux distincts : actif au repos = blanc, inactif au repos
                  // = warm-50 (bande grise discrete), survol = warm-100 (toujours
                  // plus fonce que l'inactif → jamais confondu avec lui).
                  'transition-colors cursor-pointer',
                  student.has_pai
                    ? 'bg-red-50/70 hover:bg-red-100/70'
                    : student.is_active
                      ? 'hover:bg-warm-100'
                      : 'bg-warm-50 hover:bg-warm-100'
                )}
              >

                {/* Élève */}
                <td className="list-td">
                  <div className="flex items-center gap-2.5">
                    <StudentAvatar lastName={student.last_name} firstName={student.first_name} gender={student.gender} />
                    <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/dashboard/students/${student.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={clsx(
                        'list-name rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
                        student.is_active ? 'text-secondary-800' : 'text-warm-400'
                      )}
                    >
                      {student.last_name} {student.first_name}
                    </Link>
                    {!student.is_active && (
                      <span className="text-xs bg-warm-200 text-warm-700 px-1.5 py-0.5 rounded font-medium">inactif</span>
                    )}
                    {student.has_pai && (
                      <Tooltip content="Projet d'Aide Individualisé">
                        <span className="text-xs font-semibold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">PAI</span>
                      </Tooltip>
                    )}
                    {student.exit_authorization && (
                      <Tooltip content="Autorisation de sortie accordée">
                        <LogOut size={13} className="text-primary-600 flex-shrink-0" />
                      </Tooltip>
                    )}
                    {student.media_authorization && (
                      <Tooltip content="Autorisation média accordée">
                        <Camera size={13} className="text-primary-600 flex-shrink-0" />
                      </Tooltip>
                    )}
                    {!student.parent_id && (
                      <Tooltip content="Sans rattachement parental">
                        <Link2Off size={13} className="text-red-400 flex-shrink-0" />
                      </Tooltip>
                    )}
                    </div>
                  </div>
                </td>

                {/* N° élève */}
                <td className="list-td">
                  <span className={clsx(
                    'font-mono text-xs',
                    student.is_active ? 'text-warm-700' : 'text-warm-400'
                  )}>{student.student_number}</span>
                </td>

                {/* Classe */}
                <td className="list-td">
                  {student.class_name ? (
                    student.class_tooltip ? (
                      <Tooltip content={<span className="whitespace-nowrap">{student.class_tooltip}</span>} maxWidth="max-w-none">
                        <span className={clsx(
                          'text-xs font-medium cursor-default',
                          student.is_active ? 'text-secondary-700' : 'text-warm-400'
                        )}>{student.class_name}</span>
                      </Tooltip>
                    ) : (
                      <span className={clsx(
                        'text-xs font-medium',
                        student.is_active ? 'text-secondary-700' : 'text-warm-400'
                      )}>{student.class_name}</span>
                    )
                  ) : (
                    <span className={clsx(
                      'text-xs italic',
                      student.is_active ? 'text-warm-700' : 'text-warm-400'
                    )}>Non affecté</span>
                  )}
                </td>

                {/* Date de naissance */}
                <td className="list-td">
                  <span className={clsx(
                    'text-xs',
                    student.is_active ? 'text-secondary-700' : 'text-warm-400'
                  )}>{formatDate(student.date_of_birth)}</span>
                  <span className={clsx(
                    'text-xs ml-1.5',
                    student.is_active ? 'text-secondary-700' : 'text-warm-400'
                  )}>({calcAge(student.date_of_birth)})</span>
                </td>

                {/* Discipline (actifs uniquement) */}
                <td className="list-td">
                  <DisciplineInfo discipline={student.discipline} />
                </td>

                {/* Actions */}
                <td className="list-td" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteId === student.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-warm-700">Supprimer ?</span>
                      <button
                        onClick={() => handleDelete(student.id)}
                        disabled={isDeleting}
                        className="text-xs font-medium px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {isDeleting ? '...' : 'Confirmer'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs font-medium px-2.5 py-1 bg-warm-100 text-warm-700 rounded-lg hover:bg-warm-200 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content="Modifier">
                        <button
                          onClick={() => router.push(`/dashboard/students/${student.id}`)}
                          aria-label="Modifier l'élève"
                          className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                        >
                          <Pencil size={14} />
                        </button>
                      </Tooltip>
                      <Tooltip content="Supprimer">
                        <button
                          onClick={() => { setConfirmDeleteId(student.id); setDeleteError(null) }}
                          aria-label="Supprimer l'élève"
                          className="p-1.5 text-warm-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
