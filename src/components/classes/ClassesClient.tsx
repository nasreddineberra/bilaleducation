'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, BookOpen, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'
import { FloatButton, SearchField } from '@/components/ui/FloatFields'
import ListStatCard from '@/components/ui/ListStatCard'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Tooltip from '@/components/ui/Tooltip'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherInfo {
  first_name: string
  last_name: string
}

interface ClassTeacherRow {
  teacher_id: string
  is_main_teacher: boolean
  subject: string | null
  effective_from: string | null
  effective_until: string | null
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

function fmtD(d: string | null): string {
  if (!d) return ''
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ClassesClient({ classes }: ClassesClientProps) {
  const router = useRouter()
  const [search,      setSearch]      = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Double confirmation state
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null)
  const [deleteDeps, setDeleteDeps] = useState<{ slots: number; students: number; teachers: number } | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deleteNameInput, setDeleteNameInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const filtered = search.trim() === ''
    ? classes
    : classes.filter(c => {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || c.level?.toLowerCase().includes(q)
      })

  // Step 1: load dependencies and show first modal
  const startDelete = async (cls: ClassRow) => {
    const supabase = createClient()
    const [{ count: slotsCount }, { count: studentsCount }] = await Promise.all([
      supabase.from('schedule_slots').select('id', { count: 'exact', head: true }).eq('class_id', cls.id),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('class_id', cls.id),
    ])
    const teachersCount = cls.class_teachers?.length ?? 0
    setDeleteDeps({ slots: slotsCount ?? 0, students: studentsCount ?? 0, teachers: teachersCount })
    setDeleteTarget(cls)
    setDeleteStep(1)
    setDeleteNameInput('')
    setDeleteError(null)
  }

  // Step 2: final confirmation with name input
  const proceedToStep2 = () => {
    setDeleteStep(2)
    setDeleteNameInput('')
  }

  // Execute deletion with cascade
  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const supabase = createClient()

      // Vérifier si des élèves sont affectés à la classe
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', deleteTarget.id)
      if (count && count > 0) {
        setDeleteError(`${count} élève${count > 1 ? 's' : ''} inscrit${count > 1 ? 's' : ''} dans cette classe. Retirez-les avant de supprimer.`)
        return
      }

      const { error } = await supabase.from('classes').delete().eq('id', deleteTarget.id)
      if (error) {
        setDeleteError('Une erreur est survenue. Veuillez réessayer.')
        return
      }
      router.refresh()
      closeDeleteModal()
    } catch {
      setDeleteError('Une erreur est survenue.')
    } finally {
      setIsDeleting(false)
    }
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
    setDeleteDeps(null)
    setDeleteStep(1)
    setDeleteNameInput('')
  }

  return (
    <div className="space-y-2 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex items-center gap-3 flex-wrap">
        <ListStatCard value={classes.length} label="au total" />
        <div className="flex-1" />
        <SearchField value={search} onChange={setSearch} placeholder="Nom, niveau..." ariaLabel="Rechercher une classe" />
        <FloatButton type="button" variant="submit" onClick={() => router.push('/dashboard/classes/new')}>
          Ajouter
        </FloatButton>
      </div>

      {/* Erreur suppression */}
      {deleteError && !deleteTarget && (
        <div role="alert" aria-live="assertive" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            aria-label="Fermer le message d'erreur"
            className="text-red-400 hover:text-red-600 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <X size={14} />
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
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-xs" aria-label="Classes">
            <thead>
              <tr className="border-b border-warm-100">
                <th className="text-left list-th">Nom</th>
                <th className="text-left list-th">Niveau</th>
                <th className="text-left list-th">Salle</th>
                <th className="text-left list-th">Planning</th>
                <th className="text-center list-th">Capacité</th>
                <th className="text-left list-th">Titulaire</th>
                <th className="text-left list-th">Remplacements</th>
                <th className="px-4 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {filtered.map(cls => {
                const teachers      = cls.class_teachers ?? []
                const titulaire     = teachers.find(t => t.is_main_teacher && !t.effective_until)
                const remplacements = teachers
                  .filter(t => !t.is_main_teacher)
                  .sort((a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''))

                return (
                  <tr
                    key={cls.id}
                    onClick={() => router.push(`/dashboard/classes/${cls.id}`)}
                    className="cursor-pointer hover:bg-warm-50/50 transition-colors"
                  >
                    <td className="list-td whitespace-nowrap">
                      <Link
                        href={`/dashboard/classes/${cls.id}`}
                        onClick={e => e.stopPropagation()}
                        className="list-name font-semibold text-secondary-800 hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                      >
                        {cls.name}
                      </Link>
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
                    <td className="list-td text-secondary-600">
                      {cls.level || <span className="text-warm-300">—</span>}
                    </td>
                    <td className="list-td text-secondary-600">
                      {cls.room_number || <span className="text-warm-300">—</span>}
                    </td>
                    <td className="list-td text-secondary-600 whitespace-nowrap">
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
                    <td className="list-td text-center text-secondary-600">{cls.max_students}</td>
                    <td className="list-td text-secondary-600 whitespace-nowrap">
                      {titulaire?.teachers
                        ? `${titulaire.teachers.last_name} ${titulaire.teachers.first_name}`
                        : <span className="text-warm-300 text-xs italic">Non affecté</span>}
                    </td>
                    <td className="list-td">
                      {remplacements.length === 0 ? (
                        <span className="text-warm-300">·</span>
                      ) : (
                        <div className="flex flex-col gap-0.5 py-0.5">
                          {remplacements.map((t, i) => (
                            <span key={i} className="text-xs text-secondary-600 whitespace-nowrap">
                              {t.teachers ? `${t.teachers.last_name} ${t.teachers.first_name}` : ''}
                              <span className="ml-1 text-[10px] text-warm-400">
                                {t.effective_from ? fmtD(t.effective_from) : 'Début'} — {t.effective_until ? fmtD(t.effective_until) : 'en cours'}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="list-td" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Tooltip content="Modifier">
                          <button
                            onClick={() => router.push(`/dashboard/classes/${cls.id}`)}
                            aria-label={`Modifier ${cls.name}`}
                            className="p-1.5 text-warm-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                          >
                            <Pencil size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <button
                            onClick={() => startDelete(cls)}
                            aria-label={`Supprimer ${cls.name}`}
                            className="p-1.5 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal suppression étape 1 : liste des dépendances ── */}
      {deleteTarget && deleteStep === 1 && deleteDeps && (
        <ConfirmModal
          title={`Supprimer la classe "${deleteTarget.name}" ?`}
          onConfirm={proceedToStep2}
          onCancel={closeDeleteModal}
          confirmLabel="Continuer"
          confirmColor="red"
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Cette action est irréversible. Les éléments suivants seront supprimés :
              </p>
            </div>
            <ul className="text-sm text-secondary-700 space-y-1 ml-4 list-disc">
              {deleteDeps.slots > 0 && (
                <li><strong>{deleteDeps.slots}</strong> créneau{deleteDeps.slots > 1 ? 'x' : ''} EDT</li>
              )}
              {deleteDeps.students > 0 && (
                <li><strong>{deleteDeps.students}</strong> inscription{deleteDeps.students > 1 ? 's' : ''} élève{deleteDeps.students > 1 ? 's' : ''}</li>
              )}
              {deleteDeps.teachers > 0 && (
                <li><strong>{deleteDeps.teachers}</strong> affectation{deleteDeps.teachers > 1 ? 's' : ''} enseignant{deleteDeps.teachers > 1 ? 's' : ''}</li>
              )}
              {deleteDeps.slots === 0 && deleteDeps.students === 0 && deleteDeps.teachers === 0 && (
                <li>Aucune dépendance trouvée</li>
              )}
            </ul>
          </div>
        </ConfirmModal>
      )}

      {/* ── Modal suppression étape 2 : saisie du nom ── */}
      {deleteTarget && deleteStep === 2 && (
        <ConfirmModal
          title="Confirmation finale"
          onConfirm={handleDelete}
          onCancel={closeDeleteModal}
          confirmLabel={isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
          confirmColor="red"
          confirmDisabled={deleteNameInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase() || isDeleting}
        >
          <div className="space-y-3">
            <p className="text-sm text-secondary-700">
              Saisissez le nom de la classe <strong>{deleteTarget.name}</strong> pour confirmer la suppression :
            </p>
            <input
              type="text"
              value={deleteNameInput}
              onChange={e => setDeleteNameInput(e.target.value)}
              placeholder={deleteTarget.name}
              className="w-full px-3 py-2 text-sm border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
              autoFocus
            />
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
          </div>
        </ConfirmModal>
      )}

    </div>
  )
}
