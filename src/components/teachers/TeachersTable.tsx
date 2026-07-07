'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteTeacher, setTeacherActive } from '@/app/dashboard/teachers/actions'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { Teacher } from '@/types/database'

interface TeachersTableProps {
  teachers: Teacher[]
}

interface DeleteDeps {
  classes:     number
  edt:         number
  evaluations: number
  grades:      number
}

export default function TeachersTable({ teachers }: TeachersTableProps) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)
  const [deps,         setDeps]         = useState<DeleteDeps | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)

  // Ouvre la modale après avoir compté les dépendances
  const startDelete = async (teacher: Teacher) => {
    setDeleteError(null)
    const supabase = createClient()
    const [
      { count: classes },
      { count: slots },
      { count: exceptions },
      { count: schedules },
      { count: evaluations },
      { count: grades },
    ] = await Promise.all([
      supabase.from('class_teachers').select('id', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
      supabase.from('schedule_slots').select('id', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
      supabase.from('schedule_exceptions').select('id', { count: 'exact', head: true }).eq('override_teacher_id', teacher.id),
      supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
      supabase.from('evaluations').select('id', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
      supabase.from('grades').select('id', { count: 'exact', head: true }).eq('graded_by', teacher.id),
    ])
    setDeps({
      classes:     classes ?? 0,
      edt:         (slots ?? 0) + (exceptions ?? 0) + (schedules ?? 0),
      evaluations: evaluations ?? 0,
      grades:      grades ?? 0,
    })
    setDeleteTarget(teacher)
  }

  const closeModal = () => { setDeleteTarget(null); setDeps(null) }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsProcessing(true)
    setDeleteError(null)
    const { error } = await deleteTeacher(deleteTarget.id)
    setIsProcessing(false)
    if (error) { setDeleteError(error); closeModal(); return }
    closeModal()
    router.refresh()
  }

  const confirmDeactivate = async () => {
    if (!deleteTarget) return
    setIsProcessing(true)
    setDeleteError(null)
    const { error } = await setTeacherActive(deleteTarget.id, false)
    setIsProcessing(false)
    if (error) { setDeleteError(error); closeModal(); return }
    closeModal()
    router.refresh()
  }

  const hasBlocking = !!deps && (deps.classes + deps.edt + deps.evaluations + deps.grades) > 0

  if (teachers.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-warm-400 text-sm">Aucun enseignant pour le moment</p>
        <p className="text-warm-300 text-xs mt-1">Cliquez sur "Ajouter un enseignant" pour commencer</p>
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
              <th className="text-left list-th">
                Nom
              </th>
              <th className="text-left list-th w-40">
                N° emp.
              </th>
              <th className="text-left list-th hidden md:table-cell">
                Email
              </th>
              <th className="text-left list-th hidden lg:table-cell">
                Spécialisation
              </th>
              <th className="text-left list-th hidden lg:table-cell">
                Embauche
              </th>
              <th className="px-4 py-1.5 w-32" />
            </tr>
          </thead>

          <tbody className="divide-y divide-warm-50">
            {teachers.map((teacher) => (
              <tr
                key={teacher.id}
                onClick={() => router.push(`/dashboard/teachers/${teacher.id}`)}
                className={`transition-colors cursor-pointer ${
                  teacher.is_active ? 'hover:bg-warm-50' : 'bg-warm-50/60 hover:bg-warm-100/60'
                }`}
              >

                {/* Nom */}
                <td className="list-td">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/teachers/${teacher.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`list-name rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50 ${teacher.is_active ? 'text-secondary-800' : 'text-warm-400'}`}
                    >
                      {teacher.last_name} {teacher.first_name}
                    </Link>
                    {!teacher.is_active && (
                      <span className="text-xs bg-warm-200 text-warm-500 px-1.5 py-0.5 rounded font-medium">inactif</span>
                    )}
                  </div>
                </td>

                {/* N° employé */}
                <td className="list-td">
                  <span className="font-mono text-xs text-warm-500 whitespace-nowrap">{teacher.employee_number}</span>
                </td>

                {/* Email */}
                <td className="list-td hidden md:table-cell">
                  <span className="text-xs text-warm-500">{teacher.email}</span>
                </td>

                {/* Spécialisation */}
                <td className="list-td hidden lg:table-cell">
                  <span className="text-xs text-warm-500">
                    {teacher.specialization || <span className="text-warm-300">—</span>}
                  </span>
                </td>

                {/* Date d'embauche */}
                <td className="list-td hidden lg:table-cell">
                  <span className="text-xs text-warm-500">
                    {new Date(teacher.hire_date).toLocaleDateString('fr-FR')}
                  </span>
                </td>

                {/* Actions */}
                <td className="list-td whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content="Modifier">
                      <button
                        onClick={() => router.push(`/dashboard/teachers/${teacher.id}`)}
                        aria-label="Modifier l'enseignant"
                        className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                      >
                        <Pencil size={14} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Supprimer">
                      <button
                        onClick={() => startDelete(teacher)}
                        aria-label="Supprimer l'enseignant"
                        className="p-1.5 text-warm-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modale suppression / désactivation */}
      {deleteTarget && deps && (
        <ConfirmModal
          title={hasBlocking ? 'Suppression impossible' : `Supprimer "${deleteTarget.last_name} ${deleteTarget.first_name}" ?`}
          confirmLabel={hasBlocking
            ? (isProcessing ? '...' : 'Rendre inactif')
            : (isProcessing ? 'Suppression...' : 'Supprimer définitivement')}
          confirmColor={hasBlocking ? 'amber' : 'red'}
          confirmDisabled={isProcessing}
          onConfirm={hasBlocking ? confirmDeactivate : confirmDelete}
          onCancel={closeModal}
        >
          {hasBlocking ? (
            <div className="space-y-3">
              <p className="text-sm text-secondary-700">
                <strong>{deleteTarget.last_name} {deleteTarget.first_name}</strong> ne peut pas être supprimé : des données lui sont rattachées.
              </p>
              <ul className="text-sm text-secondary-700 space-y-1 ml-4 list-disc">
                {deps.classes > 0 && (
                  <li><strong>{deps.classes}</strong> affectation{deps.classes > 1 ? 's' : ''} à des classes</li>
                )}
                {deps.edt > 0 && (
                  <li><strong>{deps.edt}</strong> élément{deps.edt > 1 ? 's' : ''} d&apos;emploi du temps</li>
                )}
                {deps.evaluations > 0 && (
                  <li><strong>{deps.evaluations}</strong> évaluation{deps.evaluations > 1 ? 's' : ''}</li>
                )}
                {deps.grades > 0 && (
                  <li><strong>{deps.grades}</strong> note{deps.grades > 1 ? 's' : ''} saisie{deps.grades > 1 ? 's' : ''}</li>
                )}
              </ul>
              <p className="text-xs text-warm-500">
                Vous pouvez le <strong>rendre inactif</strong> : son historique est conservé et son
                compte de connexion est désactivé.
              </p>
            </div>
          ) : (
            <p className="text-sm text-secondary-700">
              Aucune donnée n&apos;est rattachée à cet enseignant. Sa fiche <strong>et son compte de
              connexion</strong> seront supprimés définitivement. Cette action est irréversible.
            </p>
          )}
        </ConfirmModal>
      )}

    </div>
  )
}
