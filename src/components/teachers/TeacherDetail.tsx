'use client'

import { useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { User, FileText } from 'lucide-react'
import TeacherForm from './TeacherForm'
import TeacherDocuments from './TeacherDocuments'
import type { Teacher, TeacherDocument } from '@/types/database'

const TABS = [
  { key: 'identite',  label: 'Identité',  icon: User },
  { key: 'documents', label: 'Documents', icon: FileText },
] as const

type TabKey = typeof TABS[number]['key']

interface Props {
  teacher:   Teacher
  documents: TeacherDocument[]
}

export default function TeacherDetail({ teacher, documents: initialDocuments }: Props) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [documents, setDocuments] = useState<TeacherDocument[]>(initialDocuments)

  const initialTab = (TABS.find(t => t.key === searchParams.get('tab'))?.key ?? 'identite') as TabKey
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const selectTab = (key: TabKey) => {
    setActiveTab(key)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', key)
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
  }

  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir  = e.key === 'ArrowRight' ? 1 : -1
    const next = (idx + dir + TABS.length) % TABS.length
    tabRefs.current[next]?.focus()
    selectTab(TABS[next].key)
  }

  const initiales = `${(teacher.last_name?.[0] ?? '').toUpperCase()}${(teacher.first_name?.[0] ?? '').toUpperCase()}`

  return (
    <div className="space-y-4">

      {/* En-tête : avatar + nom + repères */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 select-none bg-warm-100 text-warm-600 ring-1 ring-warm-200">
          {initiales}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-secondary-800 leading-tight truncate">
            {teacher.last_name} {teacher.first_name}
          </h1>
          <div className="flex items-center gap-2 text-xs text-warm-500 mt-0.5 flex-wrap">
            <span className="font-mono">{teacher.employee_number}</span>
            {teacher.specialization && <span>· {teacher.specialization}</span>}
            {!teacher.is_active && (
              <span className="bg-warm-200 text-warm-500 px-1.5 py-0.5 rounded font-medium">Inactif</span>
            )}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div role="tablist" aria-label="Sections de la fiche enseignant" className="flex gap-1 border-b border-warm-200">
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
              {tab.key === 'documents' ? `${tab.label} (${documents.length})` : tab.label}
            </button>
          )
        })}
      </div>

      {/* Contenu */}
      {activeTab === 'identite' && (
        <div role="tabpanel" id="panel-identite" aria-labelledby="tab-identite">
          <TeacherForm teacher={teacher} />
        </div>
      )}

      {activeTab === 'documents' && (
        <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents">
          <TeacherDocuments
            teacherId={teacher.id}
            etablissementId={teacher.etablissement_id}
            documents={documents}
            setDocuments={setDocuments}
          />
        </div>
      )}
    </div>
  )
}
