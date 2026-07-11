'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, BookOpenText } from 'lucide-react'
import { sanitize } from '@/lib/security/sanitize'
import { FloatButton } from '@/components/ui/FloatFields'
import SeanceForm from './SeanceForm'

interface Props {
  journal: any
  role: string
  canEdit: boolean
  subjects: string[]
  etablissementId: string
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export default function CahierTexteDetail({ journal, canEdit, subjects, etablissementId }: Props) {
  const [showEdit, setShowEdit] = useState(false)

  const teacherLabel = journal.teachers
    ? `${journal.teachers.civilite ? journal.teachers.civilite + ' ' : ''}${journal.teachers.first_name} ${journal.teachers.last_name}`
    : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/cahier-texte?class=${journal.class_id}`} aria-label="Retour au cahier de texte" className="btn btn-ghost p-2">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-secondary-800">{journal.title}</h1>
            <div className="flex items-center gap-2 text-xs text-warm-500 mt-0.5">
              <CalendarDays size={12} />
              <span>{formatDate(journal.session_date)}</span>
              <span className="px-1.5 py-0.5 rounded bg-secondary-100 text-secondary-700 font-bold">
                {journal.classes?.name}
              </span>
              {journal.subject && (
                <span className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-600 font-bold">
                  {journal.subject}
                </span>
              )}
              <span>{teacherLabel}</span>
            </div>
          </div>
        </div>
        {canEdit && (
          <FloatButton variant="edit" type="button" onClick={() => setShowEdit(true)}>
            Modifier
          </FloatButton>
        )}
      </div>

      {/* Contenu de la séance */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <BookOpenText size={14} className="text-primary-500" />
          Contenu de la seance
        </h2>
        <div
          className="prose prose-sm max-w-none text-warm-700"
          dangerouslySetInnerHTML={{ __html: sanitize(journal.content_html) }}
        />
      </div>

      {showEdit && (
        <SeanceForm
          etablissementId={etablissementId}
          classId={journal.class_id}
          className={journal.classes?.name ?? ''}
          teacherId={journal.teacher_id}
          teacherLabel={teacherLabel}
          subjects={subjects}
          onClose={() => setShowEdit(false)}
          onSaved={() => setShowEdit(false)}
          initialData={{
            id: journal.id,
            subject: journal.subject,
            session_date: (journal.session_date ?? '').slice(0, 10),
            title: journal.title,
            content_html: journal.content_html,
          }}
        />
      )}
    </div>
  )
}
