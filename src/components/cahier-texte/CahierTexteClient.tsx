'use client'

import { useState, useMemo, useEffect } from 'react'
import SeanceDetailModal from './SeanceDetailModal'
import DevoirDetailModal from './DevoirDetailModal'
import { clsx } from 'clsx'
import {
  CalendarDays, BookOpen,
  ClipboardList, FileText, Lightbulb,
} from 'lucide-react'
import { FloatSelect, SearchField, FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import SeanceForm from './SeanceForm'
import DevoirForm from './DevoirForm'

interface Props {
  role: string
  classes: { id: string; name: string; level?: string | null; day_of_week?: string | null; start_time?: string | null; end_time?: string | null; class_teachers: { is_main_teacher: boolean; subject?: string | null; teachers: { id: string; civilite?: string | null; first_name: string; last_name: string } | null }[]; cotisation_types?: { label: string; is_adult?: boolean } | null }[]
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
  lecon:    { label: 'Leçon',    color: 'bg-green-100 text-green-700', icon: BookOpen },
  expose:   { label: 'Expose',   color: 'bg-purple-100 text-purple-700', icon: Lightbulb },
  autre:    { label: 'Autre',    color: 'bg-warm-100 text-warm-700', icon: FileText },
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

// Valeur spéciale du filtre Classe (staff) : afficher toutes les classes.
const ALL_CLASSES = '__all__'

export default function CahierTexteClient({
  role, classes, journalEntries, homeworkEntries,
  teacherId, teacherAssignments, allTeachers, allAssignments, etablissementId,
}: Props) {
  const [tab, setTab] = useState<'journal' | 'devoirs'>('journal')
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSubject, setFilterSubject] = useState('')

  // Restaure la classe sélectionnée depuis l'URL (?class=) au montage — permet de
  // retrouver sa sélection au retour d'une fiche (lien « Retour » ou bouton Précédent).
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('class')
    if (c === ALL_CLASSES && isStaff) setFilterClass(ALL_CLASSES)
    else if (c && classes.some(cl => cl.id === c)) setFilterClass(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Change la classe + mémorise le choix dans l'URL (sans rechargement).
  const changeClass = (id: string) => {
    setFilterClass(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('class', id)
    else url.searchParams.delete('class')
    window.history.replaceState(null, '', url.toString())
  }

  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<{ type: 'seance' | 'devoir'; entry: any } | null>(null)

  const selectedClass = classes.find(c => c.id === filterClass) ?? null
  const canCreate = ['admin', 'enseignant', 'direction', 'responsable_pedagogique'].includes(role)
  const isStaff = ['admin', 'direction', 'responsable_pedagogique'].includes(role)
  const isAllClasses = filterClass === ALL_CLASSES

  // Ligne de bas de carte : « Enseignant · Cotisation · Jour HH:MM–HH:MM »
  const classById = useMemo(() => new Map(classes.map(c => [c.id, c])), [classes])
  const subjectsForClass = (classId: string) =>
    [...new Set(((classById.get(classId)?.class_teachers ?? []).map(ct => ct.subject).filter(Boolean) as string[]))].sort()
  const entryMeta = (entry: any) => {
    const c = classById.get(entry.class_id)
    const schedule = c?.day_of_week
      ? `${c.day_of_week}${c.start_time && c.end_time ? ` ${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}` : ''}`
      : null
    return [teacherName(entry.teachers), c?.cotisation_types?.label, schedule].filter(Boolean).join(' · ')
  }

  // Prof principal + matières de la classe filtrée (pré-remplissage de la création)
  const mainCT = selectedClass?.class_teachers?.find(ct => ct.is_main_teacher) ?? null
  const mainTeacherId = mainCT?.teachers?.id ?? ''
  const mainTeacherLabel = mainCT?.teachers ? teacherName(mainCT.teachers) : ''
  // Auteur d'une création = enseignant CONNECTÉ s'il est affecté à la classe
  // (titulaire OU remplaçant), sinon le titulaire (cas d'un staff qui crée pour le compte de).
  const meCT = teacherId ? (selectedClass?.class_teachers?.find(ct => ct.teachers?.id === teacherId) ?? null) : null
  const authorId = meCT?.teachers?.id ?? mainTeacherId
  const authorLabel = meCT?.teachers ? teacherName(meCT.teachers) : mainTeacherLabel
  const classSubjects = useMemo(
    () => [...new Set(((selectedClass?.class_teachers ?? []).map(ct => ct.subject).filter(Boolean) as string[]))].sort(),
    [selectedClass]
  )

  // Sujets uniques pour le filtre
  const subjects = useMemo(() => {
    const set = new Set<string>()
    journalEntries.forEach(j => { if (j.subject) set.add(j.subject) })
    homeworkEntries.forEach(h => { if (h.subject) set.add(h.subject) })
    return [...set].sort()
  }, [journalEntries, homeworkEntries])

  const filteredJournal = useMemo(() => {
    let list = journalEntries
    if (filterClass && filterClass !== ALL_CLASSES) list = list.filter(j => j.class_id === filterClass)
    if (filterSubject) list = list.filter(j => j.subject === filterSubject)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(j => j.title.toLowerCase().includes(q) || stripHtml(j.content_html).toLowerCase().includes(q))
    }
    if (filterClass === ALL_CLASSES) {
      list = [...list].sort((a, b) =>
        (b.session_date ?? '').localeCompare(a.session_date ?? '') ||
        (a.classes?.name ?? '').localeCompare(b.classes?.name ?? ''))
    }
    return list
  }, [journalEntries, filterClass, filterSubject, search])

  const filteredHomework = useMemo(() => {
    let list = homeworkEntries
    if (filterClass && filterClass !== ALL_CLASSES) list = list.filter(h => h.class_id === filterClass)
    if (filterSubject) list = list.filter(h => h.subject === filterSubject)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(h => h.title.toLowerCase().includes(q) || stripHtml(h.description_html).toLowerCase().includes(q))
    }
    if (filterClass === ALL_CLASSES) {
      list = [...list].sort((a, b) =>
        (b.due_date ?? '').localeCompare(a.due_date ?? '') ||
        (a.classes?.name ?? '').localeCompare(b.classes?.name ?? ''))
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
          onChange={e => changeClass(e.target.value)}
          wrapperClassName="w-fit"
        >
          <option value=""></option>
          {isStaff && <option value={ALL_CLASSES}>Toutes les classes</option>}
          {classes.map(c => {
            const main = c.class_teachers?.find(t => t.is_main_teacher)
            const teacher = main?.teachers
              ? [main.teachers.civilite, main.teachers.first_name, main.teachers.last_name].filter(Boolean).join(' ')
              : null
            return (
              <option key={c.id} value={c.id}>
                {[c.name, teacher].filter(Boolean).join(' · ')}
              </option>
            )
          })}
        </FloatSelect>

        {/* V1 (mono-mode Primaire) : filtre Matière verrouillé sur « Général ».
            En Secondaire, réactiver le select alimenté par les matières de la classe. */}
        {filterClass && (
          <FloatSelect
            label="Matiere"
            value="__general__"
            onChange={() => {}}
            disabled
            wrapperClassName="w-fit"
            className="bg-warm-50 text-warm-700 cursor-not-allowed"
          >
            <option value="__general__">Général</option>
          </FloatSelect>
        )}

        <SearchField value={search} onChange={setSearch} ariaLabel="Rechercher dans le cahier de texte" />

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
              <span className="text-sm font-medium text-warm-700 whitespace-nowrap">{parts.join(' · ')}</span>
            ) : null
          })()}
          {canCreate && (() => {
            const addLabel = tab === 'journal' ? 'Ajouter une séance' : 'Ajouter un devoir'
            return (!filterClass || isAllClasses) ? (
              <Tooltip content={`Sélectionnez une classe précise pour ${tab === 'journal' ? 'ajouter une séance' : 'ajouter un devoir'}`}>
                <FloatButton variant="submit" type="button" disabled className="whitespace-nowrap">
                  {addLabel}
                </FloatButton>
              </Tooltip>
            ) : (
              <FloatButton
                variant="submit"
                type="button"
                className="whitespace-nowrap"
                disabled={!authorId}
                onClick={() => setShowCreate(true)}
              >
                {addLabel}
              </FloatButton>
            )
          })()}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-warm-200" role="tablist" aria-label="Cahier de texte">
        <button
          role="tab"
          id="tab-journal"
          aria-selected={tab === 'journal'}
          aria-controls="panel-journal"
          onClick={() => setTab('journal')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            tab === 'journal' ? 'border-primary-500 text-primary-700' : 'border-transparent text-warm-700 hover:text-warm-700'
          )}
        >
          <CalendarDays size={14} className="inline mr-1.5" />
          Journal de séance
        </button>
        <button
          role="tab"
          id="tab-devoirs"
          aria-selected={tab === 'devoirs'}
          aria-controls="panel-devoirs"
          onClick={() => setTab('devoirs')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            tab === 'devoirs' ? 'border-primary-500 text-primary-700' : 'border-transparent text-warm-700 hover:text-warm-700'
          )}
        >
          <ClipboardList size={14} className="inline mr-1.5" />
          Devoirs
        </button>
      </div>

      {/* Contenu */}
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {!filterClass ? (
        <div className="card px-6 py-10 text-center">
          <BookOpen size={32} className="mx-auto text-warm-700 mb-2" />
          <p className="text-sm text-warm-700">Sélectionnez une classe pour afficher le cahier de texte.</p>
        </div>
      ) : tab === 'journal' ? (
        filteredJournal.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <CalendarDays size={32} className="mx-auto text-warm-700 mb-2" />
            <p className="text-sm text-warm-700">Aucune seance enregistree.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredJournal.map((j: any) => (
              <button
                key={j.id}
                type="button"
                onClick={() => setDetail({ type: 'seance', entry: j })}
                className="card px-4 py-3 flex items-start gap-3 hover:shadow-md transition-all group text-left w-full"
              >
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="text-xs font-bold text-primary-600">{formatDate(j.session_date)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-secondary-800 truncate">{j.title}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-100 text-secondary-700">
                      {j.classes?.name}
                    </span>
                    {j.subject && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warm-100 text-warm-700">
                        {j.subject}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-warm-700 mt-0.5 truncate">
                    {stripHtml(j.content_html).slice(0, 150)}
                  </p>
                  <div className="text-[11px] text-warm-700 mt-1">
                    {entryMeta(j)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        filteredHomework.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <ClipboardList size={32} className="mx-auto text-warm-700 mb-2" />
            <p className="text-sm text-warm-700">Aucun devoir enregistre.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHomework.map((h: any) => {
              const typeInfo = HOMEWORK_TYPE_LABELS[h.homework_type] ?? HOMEWORK_TYPE_LABELS.autre
              const TypeIcon = typeInfo.icon
              const isPast = new Date(h.due_date) < new Date(new Date().toDateString())

              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setDetail({ type: 'devoir', entry: h })}
                  className={clsx(
                    'card px-4 py-3 flex items-start gap-3 hover:shadow-md transition-all group text-left w-full',
                    isPast && 'opacity-60'
                  )}
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className={clsx('text-xs font-bold', isPast ? 'text-warm-700' : 'text-red-600')}>
                      {formatDate(h.due_date)}
                    </div>
                    <div className="text-[10px] text-warm-700">a rendre</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-secondary-800 truncate">{h.title}</h3>
                      <span className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold', typeInfo.color)}>
                        <TypeIcon size={10} />
                        {typeInfo.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-100 text-secondary-700">
                        {h.classes?.name}
                      </span>
                      {h.subject && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warm-100 text-warm-700">
                          {h.subject}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-warm-700 mt-0.5 truncate">
                      {stripHtml(h.description_html).slice(0, 150)}
                    </p>
                    <div className="text-[11px] text-warm-700 mt-1">
                      {entryMeta(h)}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )
      )}
      </div>

      {showCreate && selectedClass && authorId && (
        tab === 'journal' ? (
          <SeanceForm
            etablissementId={etablissementId}
            classId={selectedClass.id}
            className={selectedClass.name}
            teacherId={authorId}
            teacherLabel={authorLabel}
            subjects={classSubjects}
            onClose={() => setShowCreate(false)}
            onSaved={() => setShowCreate(false)}
          />
        ) : (
          <DevoirForm
            etablissementId={etablissementId}
            classId={selectedClass.id}
            className={selectedClass.name}
            teacherId={authorId}
            teacherLabel={authorLabel}
            subjects={classSubjects}
            onClose={() => setShowCreate(false)}
            onSaved={() => setShowCreate(false)}
          />
        )
      )}

      {detail?.type === 'seance' && (
        <SeanceDetailModal
          journal={detail.entry}
          role={role}
          teacherId={teacherId}
          subjects={subjectsForClass(detail.entry.class_id)}
          etablissementId={etablissementId}
          onClose={() => setDetail(null)}
        />
      )}
      {detail?.type === 'devoir' && (
        <DevoirDetailModal
          homework={detail.entry}
          role={role}
          teacherId={teacherId}
          isAdult={!!classById.get(detail.entry.class_id)?.cotisation_types?.is_adult}
          subjects={subjectsForClass(detail.entry.class_id)}
          etablissementId={etablissementId}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
