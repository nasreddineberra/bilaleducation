'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import {
  BookOpenText, Plus, CalendarDays, BookOpen,
  ClipboardList, GraduationCap, FileText, Lightbulb,
} from 'lucide-react'
import type { UserRole } from '@/types/database'
import { FloatSelect, SearchField, FloatButton } from '@/components/ui/FloatFields'

interface Props {
  role: string
  classes: { id: string; name: string; level?: string | null; day_of_week?: string | null; start_time?: string | null; end_time?: string | null; class_teachers: { is_main_teacher: boolean; teachers: { civilite?: string | null; first_name: string; last_name: string } | null }[]; cotisation_types?: { label: string } | null }[]
  journalEntries: any[]
  homeworkEntries: any[]
  teacherId: string | null
  teacherAssignments: { class_id: string; is_main_teacher: boolean; subject: string | null }[]
  allTeachers: { id: string; first_name: string; last_name: string }[]
  allAssignments: { class_id: string; teacher_id: string; is_main_teacher: boolean; subject: string | null }[]
  etablissementId: string
}

const HOMEWORK_TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  exercice: { label: 'Exercice', color: 'bg-blue-100 text-blue-700', icon: ClipboardList },
  lecon:    { label: 'Lecon',    color: 'bg-green-100 text-green-700', icon: BookOpen },
  expose:   { label: 'Expose',   color: 'bg-purple-100 text-purple-700', icon: Lightbulb },
  autre:    { label: 'Autre',    color: 'bg-warm-100 text-warm-600', icon: FileText },
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function teacherName(t: { civilite?: string | null; first_name: string; last_name: string } | null): string {
  if (!t) return ''
  const civ = t.civilite ? `${t.civilite} ` : ''
  return `${civ}${t.first_name} ${t.last_name}`
}

export default function CahierTexteClient({
  role, classes, journalEntries, homeworkEntries,
  teacherId, teacherAssignments, allTeachers, allAssignments, etablissementId,
}: Props) {
  const [tab, setTab] = useState<'journal' | 'devoirs'>('journal')
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSubject, setFilterSubject] = useState('')

  const selectedClass = classes.find(c => c.id === filterClass) ?? null
  const canCreate = ['enseignant', 'direction', 'responsable_pedagogique'].includes(role)

  // Sujets uniques pour le filtre
  const subjects = useMemo(() => {
    const set = new Set<string>()
    journalEntries.forEach(j => { if (j.subject) set.add(j.subject) })
    homeworkEntries.forEach(h => { if (h.subject) set.add(h.subject) })
    return [...set].sort()
  }, [journalEntries, homeworkEntries])

  const filteredJournal = useMemo(() => {
    let list = journalEntries
    if (filterClass) list = list.filter(j => j.class_id === filterClass)
    if (filterSubject) list = list.filter(j => j.subject === filterSubject)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(j => j.title.toLowerCase().includes(q) || stripHtml(j.content_html).toLowerCase().includes(q))
    }
    return list
  }, [journalEntries, filterClass, filterSubject, search])

  const filteredHomework = useMemo(() => {
    let list = homeworkEntries
    if (filterClass) list = list.filter(h => h.class_id === filterClass)
    if (filterSubject) list = list.filter(h => h.subject === filterSubject)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(h => h.title.toLowerCase().includes(q) || stripHtml(h.description_html).toLowerCase().includes(q))
    }
    return list
  }, [homeworkEntries, filterClass, filterSubject, search])

  return (
    <div className="space-y-4">
      {/* Barre filtres + actions */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">

        <FloatSelect
          label="Classe"
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          wrapperClassName="w-fit"
        >
          <option value=""></option>
          {classes.map(c => {
            const main = c.class_teachers?.find(t => t.is_main_teacher)
            const teacher = main?.teachers
              ? [main.teachers.civilite, main.teachers.first_name, main.teachers.last_name].filter(Boolean).join(' ')
              : null
            return (
              <option key={c.id} value={c.id}>
                {[c.name, teacher].filter(Boolean).join(' — ')}
              </option>
            )
          })}
        </FloatSelect>

        {subjects.length > 0 && (
          <FloatSelect
            label="Matiere"
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            wrapperClassName="w-fit"
          >
            <option value=""></option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </FloatSelect>
        )}

        <SearchField value={search} onChange={setSearch} />

        {/* Droite : infos classe + bouton */}
        <div className="flex items-center gap-3 ml-auto">
          {selectedClass && (() => {
            const main = selectedClass.class_teachers?.find(t => t.is_main_teacher)
            const teacher = main?.teachers ? [main.teachers.civilite, main.teachers.first_name, main.teachers.last_name].filter(Boolean).join(' ') : null
            const schedule = selectedClass.day_of_week
              ? `${selectedClass.day_of_week}${selectedClass.start_time && selectedClass.end_time ? ` ${selectedClass.start_time.slice(0, 5)}–${selectedClass.end_time.slice(0, 5)}` : ''}`
              : null
            const parts = [teacher, selectedClass.cotisation_types?.label, selectedClass.level ? `Niveau ${selectedClass.level}` : null, schedule].filter(Boolean)
            return parts.length > 0 ? (
              <span className="text-sm font-medium text-warm-600 whitespace-nowrap">{parts.join(' · ')}</span>
            ) : null
          })()}
          {canCreate && (
            <Link href="/dashboard/cahier-texte/new">
              <FloatButton variant="submit" type="button" className="whitespace-nowrap">
                <Plus size={14} /> Ajouter
              </FloatButton>
            </Link>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-warm-200">
        <button
          onClick={() => setTab('journal')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            tab === 'journal' ? 'border-primary-500 text-primary-700' : 'border-transparent text-warm-500 hover:text-warm-700'
          )}
        >
          <CalendarDays size={14} className="inline mr-1.5" />
          Journal de séance
        </button>
        <button
          onClick={() => setTab('devoirs')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            tab === 'devoirs' ? 'border-primary-500 text-primary-700' : 'border-transparent text-warm-500 hover:text-warm-700'
          )}
        >
          <ClipboardList size={14} className="inline mr-1.5" />
          Devoirs
        </button>
      </div>

      {/* Contenu */}
      {tab === 'journal' ? (
        filteredJournal.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <CalendarDays size={32} className="mx-auto text-warm-300 mb-2" />
            <p className="text-sm text-warm-400">Aucune seance enregistree.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredJournal.map((j: any) => (
              <Link
                key={j.id}
                href={`/dashboard/cahier-texte/${j.id}`}
                className="card px-4 py-3 flex items-start gap-3 hover:shadow-md transition-all group"
              >
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="text-xs font-bold text-primary-600">{formatDate(j.session_date)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-warm-800 truncate">{j.title}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-100 text-secondary-700">
                      {j.classes?.name}
                    </span>
                    {j.subject && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warm-100 text-warm-600">
                        {j.subject}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-warm-400 mt-0.5 truncate">
                    {stripHtml(j.content_html).slice(0, 150)}
                  </p>
                  <div className="text-[11px] text-warm-400 mt-1">
                    {teacherName(j.teachers)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        filteredHomework.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <ClipboardList size={32} className="mx-auto text-warm-300 mb-2" />
            <p className="text-sm text-warm-400">Aucun devoir enregistre.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHomework.map((h: any) => {
              const typeInfo = HOMEWORK_TYPE_LABELS[h.homework_type] ?? HOMEWORK_TYPE_LABELS.autre
              const TypeIcon = typeInfo.icon
              const isPast = new Date(h.due_date) < new Date(new Date().toDateString())

              return (
                <Link
                  key={h.id}
                  href={`/dashboard/cahier-texte/${h.journal_entry_id ?? h.id}?hw=${h.id}`}
                  className={clsx(
                    'card px-4 py-3 flex items-start gap-3 hover:shadow-md transition-all group',
                    isPast && 'opacity-60'
                  )}
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className={clsx('text-xs font-bold', isPast ? 'text-warm-400' : 'text-red-600')}>
                      {formatDate(h.due_date)}
                    </div>
                    <div className="text-[10px] text-warm-400">a rendre</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-warm-800 truncate">{h.title}</h3>
                      <span className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold', typeInfo.color)}>
                        <TypeIcon size={10} />
                        {typeInfo.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-100 text-secondary-700">
                        {h.classes?.name}
                      </span>
                      {h.subject && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warm-100 text-warm-600">
                          {h.subject}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-warm-400 mt-0.5 truncate">
                      {stripHtml(h.description_html).slice(0, 150)}
                    </p>
                    <div className="text-[11px] text-warm-400 mt-1">
                      {teacherName(h.teachers)}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
