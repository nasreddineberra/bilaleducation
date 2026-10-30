'use client'

import { useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import Onglets, { classeOnglet } from '@/components/ui/Onglets'
import { User, GraduationCap, ShieldAlert, FileText, Clock } from 'lucide-react'
import StudentForm from './StudentForm'
import StudentScolarite from './StudentScolarite'
import StudentDiscipline from './StudentDiscipline'
import StudentDocuments from './StudentDocuments'
import StudentHistory from './StudentHistory'
import type { FicheEleve } from '@/lib/students/fiche'
import { classInfoWithTeacher } from '@/components/dashboard/classInfo'

// Donnees de la fiche : celles de `chargerFicheEleve`, sans recopie.
type Props = Omit<FicheEleve, 'depart'> & {
  backHref: string
  etablissementId: string
  /** Fiche en lecture seule : l'ecriture de `students` n'est pas ouverte a ce role. */
  lectureSeule?: boolean
  /** « Declarer un depart » : `null` si l'eleve n'est affecte a aucune classe cette annee. */
  depart?: FicheEleve['depart']
}

const TABS = [
  { key: 'identite',   label: 'Identité',   icon: User },
  { key: 'scolarite',  label: 'Scolarité',  icon: GraduationCap },
  { key: 'discipline', label: 'Discipline', icon: ShieldAlert },
  { key: 'documents',  label: 'Documents',  icon: FileText },
  { key: 'historique', label: 'Historique', icon: Clock },
] as const

type TabKey = typeof TABS[number]['key']

export default function StudentDetail({
  student, parents, backHref, etablissementId,
  enrollments, periods, absencesFull, studentWarnings, bulletinArchives, mainTeachers, docTypeConfigs, studentDocuments, siblings, currentYearLabel, history,
  lectureSeule = false, depart,
}: Props) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const initialTab = (TABS.find(t => t.key === searchParams.get('tab'))?.key ?? 'identite') as TabKey
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Change d'onglet + met à jour l'URL (?tab=) sans recharger le serveur (partage / rechargement OK)
  const selectTab = (key: TabKey) => {
    setActiveTab(key)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', key)
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
  }

  // Navigation clavier entre onglets (flèches ← →)
  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir  = e.key === 'ArrowRight' ? 1 : -1
    const next = (idx + dir + TABS.length) % TABS.length
    tabRefs.current[next]?.focus()
    selectTab(TABS[next].key)
  }

  // ── En-tête de fiche (contexte permanent) ──
  const activeClassName =
    enrollments.find(e => e.status === 'active')?.classes?.name ?? null
  const initiales = `${(student.last_name?.[0] ?? '').toUpperCase()}${(student.first_name?.[0] ?? '').toUpperCase()}`
  const genderRing = student.gender === 'male'
    ? 'ring-2 ring-blue-500'
    : student.gender === 'female'
      ? 'ring-2 ring-pink-500'
      : 'ring-1 ring-warm-200'

  // Inscription active de l'annee en cours : bloque le switch ACTIF/INACTIF.
  // On construit le libelle complet de la classe pour l'infobulle (format standard).
  const activeEnrollment = enrollments.find(
    e => e.status === 'active' && e.classes?.academic_year === currentYearLabel
  )
  const activeTeacher = (() => {
    const tt = mainTeachers.find(m => m.class_id === activeEnrollment?.class_id)?.teachers
    return tt ? `${tt.civilite ? tt.civilite + ' ' : ''}${tt.last_name} ${tt.first_name}`.trim() : ''
  })()
  const activeClassInfo = activeEnrollment ? classInfoWithTeacher(activeEnrollment.classes, activeTeacher) : ''

  return (
    <div className="space-y-4">

      {/* En-tête : avatar + nom + repères */}
      <div className="flex items-center gap-3">
        <div className={clsx(
          'w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 select-none bg-warm-100 text-warm-700',
          genderRing
        )}>
          {initiales}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-secondary-800 leading-tight truncate">
            {student.last_name} {student.first_name}
          </h1>
          <div className="flex items-center gap-2 text-xs text-warm-700 mt-0.5 flex-wrap">
            <span className="font-mono">{student.student_number}</span>
            {activeClassName
              ? <span>· {activeClassName}</span>
              : <span className="text-warm-700 italic">· Non affecté</span>}
            {!student.is_active && (
              <span className="bg-warm-200 text-warm-700 px-1.5 py-0.5 rounded font-medium">Inactif</span>
            )}
            {student.has_pai && (
              <span className="font-semibold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">PAI</span>
            )}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <Onglets ariaLabel="Sections de la fiche élève" actifIndex={TABS.findIndex(t => t.key === activeTab)}>
        {TABS.map((tab, idx) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              ref={el => { tabRefs.current[idx] = el }}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={active}
              aria-controls={`panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={e => onTabKeyDown(e, idx)}
              className={classeOnglet(active)}
            >
              {tab.label}
            </button>
          )
        })}
      </Onglets>

      {/* Contenu */}
      {activeTab === 'identite' && (
        <div role="tabpanel" id="panel-identite" aria-labelledby="tab-identite">
          <StudentForm
            student={student}
            parents={parents}
            backHref={backHref}
            etablissementId={etablissementId}
            siblings={siblings}
            mainTeachers={mainTeachers}
            hasActiveEnrollment={!!activeEnrollment}
            activeClassName={activeEnrollment?.classes?.name ?? null}
            activeClassInfo={activeClassInfo}
            lectureSeule={lectureSeule}
          />
        </div>
      )}

      {activeTab === 'scolarite' && (
        <div role="tabpanel" id="panel-scolarite" aria-labelledby="tab-scolarite">
          <StudentScolarite
            studentId={student.id}
            studentName={`${student.last_name.toUpperCase()} ${student.first_name}`}
            depart={depart ?? null}
            studentActive={!!student.is_active}
            enrollments={enrollments}
            periods={periods}
            bulletinArchives={bulletinArchives}
            mainTeachers={mainTeachers}
            warnings={studentWarnings}
          />
        </div>
      )}

      {activeTab === 'discipline' && (
        <div role="tabpanel" id="panel-discipline" aria-labelledby="tab-discipline">
          <StudentDiscipline
            studentId={student.id}
            etablissementId={etablissementId}
            absences={absencesFull}
            warnings={studentWarnings}
            periods={periods}
            enrollments={enrollments}
            currentYearLabel={currentYearLabel}
            lectureSeule={lectureSeule}
          />
        </div>
      )}

      {activeTab === 'documents' && (
        <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents">
          <StudentDocuments
            studentId={student.id}
            etablissementId={etablissementId}
            docTypes={docTypeConfigs}
            documents={studentDocuments}
            lectureSeule={lectureSeule}
          />
        </div>
      )}

      {activeTab === 'historique' && (
        <div role="tabpanel" id="panel-historique" aria-labelledby="tab-historique">
          <StudentHistory history={history} />
        </div>
      )}
    </div>
  )
}
