'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Link2Off, LogOut, Camera } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/types/database'

interface StudentsTableProps {
  students: Student[]
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

function GenderIcon({ gender }: { gender: string | null }) {
  if (gender === 'male') return (
    <Tooltip label="Masculin">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold leading-none">M</span>
    </Tooltip>
  )
  if (gender === 'female') return (
    <Tooltip label="Féminin">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 text-pink-500 text-xs font-bold leading-none">F</span>
    </Tooltip>
  )
  return <span className="text-warm-300 text-sm">—</span>
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
        <p className="text-warm-400 text-sm">Aucun élève pour le moment</p>
        <p className="text-warm-300 text-xs mt-1">Cliquez sur "Ajouter un élève" pour commencer</p>
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
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-4/12">
                Élève
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-2/12">
                N° élève
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-3/12">
                Naissance
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-1/12">
                Genre
              </th>
              <th className="px-4 py-2 w-2/12" />
            </tr>
          </thead>

          <tbody className="divide-y divide-warm-50">
            {students.map((student) => (
              <tr
                key={student.id}
                className={clsx(
                  'transition-colors',
                  student.has_pai
                    ? 'bg-red-50/70 hover:bg-red-100/60'
                    : student.is_active
                      ? 'hover:bg-warm-50'
                      : 'bg-warm-50/60 hover:bg-warm-100/60'
                )}
              >

                {/* Élève */}
                <td className="px-4 py-[3px]">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'text-sm font-medium',
                      student.is_active ? 'text-secondary-800' : 'text-warm-400'
                    )}>
                      {student.last_name} {student.first_name}
                    </span>
                    {!student.is_active && (
                      <span className="text-xs bg-warm-200 text-warm-500 px-1.5 py-0.5 rounded font-medium">inactif</span>
                    )}
                    {student.has_pai && (
                      <Tooltip label="Projet d'Aide Individualisé">
                        <span className="text-xs font-semibold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">PAI</span>
                      </Tooltip>
                    )}
                    {student.exit_authorization && (
                      <Tooltip label="Autorisation de sortie accordée">
                        <LogOut size={13} className="text-green-500 flex-shrink-0" />
                      </Tooltip>
                    )}
                    {student.media_authorization && (
                      <Tooltip label="Autorisation média accordée">
                        <Camera size={13} className="text-green-500 flex-shrink-0" />
                      </Tooltip>
                    )}
                    {!student.parent_id && (
                      <Tooltip label="Sans rattachement parental">
                        <Link2Off size={13} className="text-red-400 flex-shrink-0" />
                      </Tooltip>
                    )}
                  </div>
                </td>

                {/* N° élève */}
                <td className="px-4 py-[3px]">
                  <span className={clsx(
                    'font-mono text-xs',
                    student.is_active ? 'text-warm-500' : 'text-warm-300'
                  )}>{student.student_number}</span>
                </td>

                {/* Date de naissance */}
                <td className="px-4 py-[3px]">
                  <span className={clsx(
                    'text-sm',
                    student.is_active ? 'text-secondary-700' : 'text-warm-400'
                  )}>{formatDate(student.date_of_birth)}</span>
                  <span className="text-xs text-warm-400 ml-1.5">({calcAge(student.date_of_birth)})</span>
                </td>

                {/* Genre */}
                <td className="px-4 py-[3px]">
                  <GenderIcon gender={student.gender} />
                </td>

                {/* Actions */}
                <td className="px-4 py-[3px]">
                  {confirmDeleteId === student.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-warm-500">Supprimer ?</span>
                      <button
                        onClick={() => handleDelete(student.id)}
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
                      <Tooltip label="Modifier">
                        <button
                          onClick={() => router.push(`/dashboard/students/${student.id}`)}
                          className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <button
                          onClick={() => { setConfirmDeleteId(student.id); setDeleteError(null) }}
                          className="p-1.5 text-warm-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
