'use client'

import { useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { User, GraduationCap, ShieldAlert, FileText } from 'lucide-react'
import StudentForm from './StudentForm'
import StudentScolarite from './StudentScolarite'
import StudentDiscipline from './StudentDiscipline'
import StudentDocuments from './StudentDocuments'
import type { Student } from '@/types/database'

interface ParentOption {
  id: string
  tutor1_last_name: string
  tutor1_first_name: string
  tutor1_relationship?: string | null
  tutor1_address?: string | null
  tutor1_city?: string | null
  tutor1_postal_code?: string | null
  tutor1_phone?: string | null
  tutor1_email?: string | null
  tutor2_last_name?: string | null
  tutor2_first_name?: string | null
  tutor2_relationship?: string | null
  tutor2_address?: string | null
  tutor2_city?: string | null
  tutor2_postal_code?: string | null
  tutor2_phone?: string | null
  tutor2_email?: string | null
}

interface Props {
  student: Student
  parents: ParentOption[]
  backHref: string
  etablissementId: string
  enrollments: any[]
  evaluations: any[]
  grades: any[]
  periods: any[]
  absences: any[]
  absencesFull: any[]
  studentWarnings: any[]
  bulletinArchives: any[]
  mainTeachers: any[]
  docTypeConfigs: any[]
  studentDocuments: any[]
  siblings: any[]
  currentYearLabel: string
}

const TABS = [
  { key: 'identite',   label: 'Identité',   icon: User },
  { key: 'scolarite',  label: 'Scolarité',  icon: GraduationCap },
  { key: 'discipline', label: 'Discipline', icon: ShieldAlert },
  { key: 'documents',  label: 'Documents',  icon: FileText },
] as const

type TabKey = typeof TABS[number]['key']

export default function StudentDetail({
  student, parents, backHref, etablissementId,
  enrollments, evaluations, grades, periods, absences, absencesFull, studentWarnings, bulletinArchives, mainTeachers, docTypeConfigs, studentDocuments, siblings, currentYearLabel,
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
    enrollments.find((e: any) => e.status === 'active')?.classes?.name ?? null
  const initiales = `${(student.last_name?.[0] ?? '').toUpperCase()}${(student.first_name?.[0] ?? '').toUpperCase()}`
  const genderRing = student.gender === 'male'
    ? 'ring-2 ring-blue-500'
    : student.gender === 'female'
      ? 'ring-2 ring-pink-500'
      : 'ring-1 ring-warm-200'

  return (
    <div className="space-y-4">

      {/* En-tête : avatar + nom + repères */}
      <div className="flex items-center gap-3">
        <div className={clsx(
          'w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 select-none bg-warm-100 text-warm-600',
          genderRing
        )}>
          {initiales}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-secondary-800 leading-tight truncate">
            {student.last_name} {student.first_name}
          </h1>
          <div className="flex items-center gap-2 text-xs text-warm-500 mt-0.5 flex-wrap">
            <span className="font-mono">{student.student_number}</span>
            {activeClassName
              ? <span>· {activeClassName}</span>
              : <span className="text-warm-300 italic">· Non affecté</span>}
            {!student.is_active && (
              <span className="bg-warm-200 text-warm-500 px-1.5 py-0.5 rounded font-medium">Inactif</span>
            )}
            {student.has_pai && (
              <span className="font-semibold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">PAI</span>
            )}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div role="tablist" aria-label="Sections de la fiche élève" className="flex gap-1 border-b border-warm-200">
        {TABS.map((tab, idx) => {
          const Icon = tab.icon
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
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px rounded-t',
                'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
                active
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-warm-400 hover:text-warm-600 hover:border-warm-300'
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

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
            hasActiveEnrollment={enrollments.some((e: any) => e.status === 'active')}
          />
        </div>
      )}

      {activeTab === 'scolarite' && (
        <div role="tabpanel" id="panel-scolarite" aria-labelledby="tab-scolarite">
          <StudentScolarite
            studentId={student.id}
            enrollments={enrollments}
            evaluations={evaluations}
            grades={grades}
            periods={periods}
            absences={absences}
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
          />
        </div>
      )}
    </div>
  )
}
