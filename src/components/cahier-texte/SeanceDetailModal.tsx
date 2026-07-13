'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, CalendarDays, BookOpenText } from 'lucide-react'
import { sanitize } from '@/lib/security/sanitize'
import { FloatButton } from '@/components/ui/FloatFields'
import SeanceForm from './SeanceForm'

const STAFF = ['admin', 'direction', 'responsable_pedagogique']

function teacherLabelOf(t: any): string {
  if (!t) return ''
  return `${t.civilite ? t.civilite + ' ' : ''}${t.first_name} ${t.last_name}`
}
function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

interface Props {
  journal: any
  role: string
  teacherId: string | null
  subjects: string[]
  etablissementId: string
  onClose: () => void
}

// Détail d'une séance en modale verrouillée (fermable uniquement par X / Fermer).
export default function SeanceDetailModal({ journal, role, teacherId, subjects, etablissementId, onClose }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const teacherLabel = teacherLabelOf(journal.teachers)
  const canEdit = STAFF.includes(role) || journal.teacher_id === teacherId

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seance-detail-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-warm-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h3 id="seance-detail-title" className="text-sm font-bold text-secondary-800 truncate">{journal.title}</h3>
            <div className="flex items-center gap-2 text-[11px] text-warm-500 mt-0.5 flex-wrap">
              <CalendarDays size={12} />
              <span>{formatDate(journal.session_date)}</span>
              <span className="px-1.5 py-0.5 rounded bg-secondary-100 text-secondary-700 font-bold">{journal.classes?.name}</span>
              {journal.subject && <span className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-600 font-bold">{journal.subject}</span>}
              <span>{teacherLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && <FloatButton variant="edit" type="button" onClick={() => setShowEdit(true)}>Modifier</FloatButton>}
            <button type="button" onClick={onClose} aria-label="Fermer" className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <h4 className="text-sm font-bold text-secondary-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <BookOpenText size={14} className="text-primary-500" /> Contenu de la seance
          </h4>
          <div className="prose prose-sm max-w-none text-warm-700" dangerouslySetInnerHTML={{ __html: sanitize(journal.content_html) }} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-warm-100 flex justify-end flex-shrink-0">
          <FloatButton variant="secondary" type="button" onClick={onClose}>Fermer</FloatButton>
        </div>
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
          onSaved={() => { setShowEdit(false); onClose() }}
          initialData={{
            id: journal.id,
            subject: journal.subject,
            session_date: (journal.session_date ?? '').slice(0, 10),
            title: journal.title,
            content_html: journal.content_html,
          }}
        />
      )}
    </div>,
    document.body
  )
}
