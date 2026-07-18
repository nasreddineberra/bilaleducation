'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'

const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor'))

// Valeur sentinelle pour « Général » : garde une valeur non vide dans le select
// (sinon le label flottant de FloatSelect ne monte pas et chevauche le texte).
const GENERAL = '__general__'

interface Props {
  etablissementId: string
  // Classe + enseignant verrouillés (un seul prof par classe — mono-mode Primaire)
  classId: string
  className: string
  teacherId: string
  teacherLabel: string
  subjects: string[]          // matières disponibles pour la classe
  onClose: () => void
  onSaved: () => void
  initialData?: any           // présent en édition
}

// Champ en lecture seule (classe / enseignant), même gabarit visuel qu'un FloatField.
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative">
      <div className="w-full pl-3 pr-8 pt-5 pb-1.5 rounded-lg border border-warm-200 bg-warm-50 text-sm text-secondary-700">
        {value || '·'}
      </div>
      <span className="absolute left-3 top-1.5 text-[10px] font-semibold tracking-wide uppercase text-warm-700 pointer-events-none">
        {label}
      </span>
    </div>
  )
}

export default function SeanceForm({
  etablissementId, classId, className, teacherId, teacherLabel, subjects,
  onClose, onSaved, initialData,
}: Props) {
  const router = useRouter()
  const toast  = useToast()
  const isEdit = !!initialData

  const [subject, setSubject] = useState<string>(initialData?.subject ?? '')  // '' = Général
  const [sessionDate, setSessionDate] = useState(initialData?.session_date ?? new Date().toISOString().slice(0, 10))
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [contentHtml, setContentHtml] = useState(initialData?.content_html ?? '')

  const [saving, setSaving] = useState(false)

  // Portail : la modale doit sortir de tout ancêtre transformé (`.animate-fade-in`
  // garde un translateY et deviendrait le bloc conteneur du `position: fixed`).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !contentHtml.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      const journalPayload = {
        class_id: classId,
        teacher_id: teacherId,
        subject: subject || null,
        session_date: sessionDate,
        title: title.trim(),
        content_html: contentHtml,
      }

      if (isEdit) {
        const { error } = await supabase.from('class_journal').update(journalPayload).eq('id', initialData.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('class_journal')
          .insert({ etablissement_id: etablissementId, ...journalPayload })
        if (error) throw error
      }

      onSaved()
      router.refresh()
      onClose()
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'enregistrement.')
      setSaving(false)
    }
  }

  if (!mounted) return null

  // Modale volontairement NON fermable au clic sur le fond ni à Échap : on ne
  // ferme que par les boutons (X / Annuler / enregistrement) pour ne pas perdre la saisie.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seance-form-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-warm-100 flex items-center justify-between flex-shrink-0">
          <h3 id="seance-form-title" className="text-sm font-bold text-secondary-800">
            {isEdit ? 'Modifier la séance' : 'Nouvelle séance'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LockedField label="Classe" value={className} />
            <LockedField label="Enseignant" value={teacherLabel} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* V1 (mono-mode Primaire) : Matière forcée sur « Général » (verrouillée).
                En Secondaire, réactiver un select alimenté par les matières de la classe. */}
            <LockedField label="Matiere" value="Général" />

            <FloatInput
              label="Date de seance"
              required
              type="date"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
            />
          </div>

          <FloatInput
            label="Titre de la seance"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex : Les fractions - Introduction"
          />

          <div>
            <label className="text-xs font-bold text-warm-700 uppercase tracking-widest">
              Contenu de la seance <span className="text-red-400">*</span>
            </label>
            <div className="mt-1">
              <Suspense fallback={<div className="h-48 bg-warm-50 rounded-lg animate-pulse" />}>
                <RichTextEditor
                  content={contentHtml}
                  onChange={setContentHtml}
                  placeholder="Decrivez ce qui a ete fait en classe..."
                />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-warm-100 flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
          <div className="flex-1" />
          <FloatButton variant="secondary" type="button" onClick={onClose}>Annuler</FloatButton>
          <FloatButton variant={isEdit ? 'edit' : 'submit'} type="submit" loading={saving}>
            {isEdit ? 'Modifier' : 'Valider'}
          </FloatButton>
        </div>
      </form>
    </div>,
    document.body
  )
}
