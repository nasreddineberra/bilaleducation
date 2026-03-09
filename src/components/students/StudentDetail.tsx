'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { User, GraduationCap, ShieldAlert, FileText } from 'lucide-react'
import StudentForm from './StudentForm'
import StudentScolarite from './StudentScolarite'
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
  bulletinArchives: any[]
  mainTeachers: any[]
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
  enrollments, evaluations, grades, periods, absences, bulletinArchives, mainTeachers,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('identite')

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-1 border-b border-warm-200">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                active
                  ? 'border-primary text-primary'
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
        <StudentForm
          student={student}
          parents={parents}
          backHref={backHref}
          etablissementId={etablissementId}
        />
      )}

      {activeTab === 'scolarite' && (
        <StudentScolarite
          studentId={student.id}
          enrollments={enrollments}
          evaluations={evaluations}
          grades={grades}
          periods={periods}
          absences={absences}
          bulletinArchives={bulletinArchives}
          mainTeachers={mainTeachers}
        />
      )}

      {activeTab === 'discipline' && (
        <div className="card p-6">
          <p className="text-sm text-warm-400 italic">
            Absences, retards, justifications et avertissements.
          </p>
          <p className="text-xs text-warm-300 mt-2">Bientôt disponible</p>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="card p-6">
          <p className="text-sm text-warm-400 italic">
            Documents administratifs de l'élève.
          </p>
          <p className="text-xs text-warm-300 mt-2">Bientôt disponible</p>
        </div>
      )}
    </div>
  )
}
