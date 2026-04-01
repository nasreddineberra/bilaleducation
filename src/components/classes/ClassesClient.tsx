'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'
import { FloatButton, SearchField } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherInfo {
  first_name: string
  last_name: string
}

interface ClassTeacherRow {
  teacher_id: string
  is_main_teacher: boolean
  subject: string | null
  teachers: TeacherInfo | null
}

interface ClassRow {
  id: string
  name: string
  level: string
  academic_year: string
  room_number: string | null
  max_students: number
  day_of_week: string | null
  start_time: string | null
  end_time: string | null
  cotisation_types: { id: string; label: string; is_adult: boolean } | null
  class_teachers: ClassTeacherRow[]
}

interface ClassesClientProps {
  classes: ClassRow[]
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ClassesClient({ classes }: ClassesClientProps) {
  const router = useRouter()
  const [search,      setSearch]      = useState('')
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmId,   setConfirmId]   = useState<string | null>(null)

  const filtered = search.trim() === ''
    ? classes
    : classes.filter(c => {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || c.level?.toLowerCase().includes(q)
      })

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setDeleteError(null)
    try {
      const supabase = createClient()

      // Vérifier si des élèves sont affectés à la classe
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', id)
      if (count && count > 0) {
        setDeleteError(`${count} élève${count > 1 ? 's' : ''} inscrit${count > 1 ? 's' : ''} dans cette classe. Retirez-les avant de supprimer.`)
        setDeletingId(null)
        setConfirmId(null)
        return
      }

      const { error } = await supabase.from('classes').delete().eq('id', id)
      if (error) {
        setDeleteError('Une erreur est survenue. Veuillez réessayer.')
        setDeletingId(null)
        setConfirmId(null)
        return
      }
      router.refresh()
    } catch {
      setDeleteError('Une erreur est survenue.')
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-secondary-800">{classes.length}</span>
          <span className="text-xs text-warm-500 leading-tight">au total</span>
        </div>
        <div className="flex-1" />
        <SearchField value={search} onChange={setSearch} placeholder="Nom, niveau..." />
        <FloatButton type="button" variant="submit" onClick={() => router.push('/dashboard/classes/new')}>
          <Plus size={14} /> Ajouter
        </FloatButton>
      </div>

      {/* Erreur suppression */}
      {deleteError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600">
            <Plus size={14} className="rotate-45" />
          </button>
        </div>
      )}

      {/* État vide */}
      {filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-4 text-center">
          <BookOpen size={40} className="text-warm-300" />
          <div>
            <p className="text-base font-semibold text-secondary-700">
              {search ? 'Aucune classe trouvée' : 'Aucune classe configurée'}
            </p>
            <p className="text-sm text-warm-400 mt-1">
              {search ? 'Modifiez votre recherche.' : 'Créez votre première classe pour commencer.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100 bg-warm-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wider">Niveau</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wider">Salle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wider">Planning</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wider">Capacité</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-warm-500 uppercase tracking-wider">Enseignants</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {filtered.map(cls => {
                const isConfirming = confirmId === cls.id
                const isDeleting   = deletingId === cls.id
                const teachers     = cls.class_teachers ?? []

                return (
                  <tr key={cls.id} className="hover:bg-warm-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-semibold text-secondary-800">{cls.name}</span>
                      {cls.cotisation_types && (
                        <span className={clsx(
                          'ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          cls.cotisation_types.is_adult
                            ? 'bg-violet-100 text-violet-600'
                            : 'bg-warm-100 text-warm-600'
                        )}>
                          {cls.cotisation_types.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary-600">
                      {cls.level || <span className="text-warm-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-secondary-600">
                      {cls.room_number || <span className="text-warm-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-secondary-600 whitespace-nowrap">
                      {cls.day_of_week ? (
                        <span>
                          {cls.day_of_week}
                          {cls.start_time && (
                            <> {cls.start_time.slice(0, 5)}{cls.end_time ? ` à ${cls.end_time.slice(0, 5)}` : ''}</>
                          )}
                        </span>
                      ) : (
                        <span className="text-warm-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-secondary-600">{cls.max_students}</td>
                    <td className="px-4 py-3">
                      {teachers.length === 0 ? (
                        <span className="text-warm-300 text-xs italic">Non affecté</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {teachers.slice(0, 2).map((t, i) => (
                            <span key={i} className="text-xs text-secondary-600">
                              {t.teachers ? `${t.teachers.last_name} ${t.teachers.first_name}` : '—'}
                              {t.is_main_teacher
                                ? <span className="ml-1 text-[10px] text-primary-500 font-medium">(principal)</span>
                                : t.subject ? <span className="ml-1 text-warm-400">· {t.subject}</span> : null
                              }
                            </span>
                          ))}
                          {teachers.length > 2 && (
                            <span className="text-xs text-warm-400">+{teachers.length - 2} autre{teachers.length - 2 > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => handleDelete(cls.id)}
                              disabled={isDeleting}
                              className="text-xs text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isDeleting ? '…' : 'Confirmer'}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="text-xs text-warm-500 hover:text-secondary-700 px-2.5 py-1 rounded-lg border border-warm-200 transition-colors"
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => router.push(`/dashboard/classes/${cls.id}`)}
                              className="p-1.5 text-warm-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => { setConfirmId(cls.id); setDeleteError(null) }}
                              className="p-1.5 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
