'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import {
  BookOpenText, Search, Plus, CalendarDays, BookOpen,
  ClipboardList, GraduationCap, FileText, Lightbulb,
} from 'lucide-react'
import type { UserRole } from '@/types/database'

interface Props {
  role: string
  classes: { id: string; name: string }[]
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-secondary-800 flex items-center gap-2">
          <BookOpenText size={20} className="text-primary-500" />
          Cahier de texte
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-warm-500">
            {journalEntries.length} seance{journalEntries.length !== 1 ? 's' : ''} / {homeworkEntries.length} devoir{homeworkEntries.length !== 1 ? 's' : ''}
          </span>
          {canCreate && (
            <Link href="/dashboard/cahier-texte/new" className="btn btn-primary text-sm flex items-center gap-1.5">
              <Plus size={16} /> Nouvelle seance
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
          Journal de seance
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

      {/* Filtres */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="input text-sm py-1.5 pl-8 w-full"
          />
        </div>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="input text-sm py-1.5">
          <option value="">Toutes les classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {subjects.length > 0 && (
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="input text-sm py-1.5">
            <option value="">Toutes les matieres</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
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
