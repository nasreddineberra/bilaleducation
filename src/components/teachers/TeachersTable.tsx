'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Teacher } from '@/types/database'

interface TeachersTableProps {
  teachers: Teacher[]
}

export default function TeachersTable({ teachers }: TeachersTableProps) {
  const router = useRouter()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting,      setIsDeleting]      = useState(false)
  const [deleteError,     setDeleteError]     = useState<string | null>(null)

  const handleDelete = async (teacherId: string) => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('teachers').delete().eq('id', teacherId)

      if (error) {
        if (error.code === '23503') {
          setDeleteError('Impossible de supprimer : cet enseignant est affecté à des classes.')
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
                    <span className={`list-name ${teacher.is_active ? 'text-secondary-800' : 'text-warm-400'}`}>
                      {teacher.last_name} {teacher.first_name}
                    </span>
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
                <td className="list-td" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteId === teacher.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-warm-500">Supprimer ?</span>
                      <button
                        onClick={() => handleDelete(teacher.id)}
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
                      <button
                        onClick={() => router.push(`/dashboard/teachers/${teacher.id}`)}
                        className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(teacher.id); setDeleteError(null) }}
                        className="p-1.5 text-warm-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
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
