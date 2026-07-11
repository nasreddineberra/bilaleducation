'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'

const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor'))

// Matière obligatoire côté BDD (homework.subject NOT NULL) : « Général » = valeur
// littérale 'General' ; la sentinelle sert juste à faire monter le label flottant.
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
      <span className="absolute left-3 top-1.5 text-[10px] font-semibold tracking-wide uppercase text-warm-500 pointer-events-none">
        {label}
      </span>
    </div>
  )
}

export default function DevoirForm({
  etablissementId, classId, className, teacherId, teacherLabel, subjects,
  onClose, onSaved, initialData,
}: Props) {
  const router = useRouter()
  const toast  = useToast()
  const isEdit = !!initialData

  // '' = Général (converti en littéral 'General' à l'enregistrement)
  const initialSubject = initialData?.subject && initialData.subject !== 'General' ? initialData.subject : ''
  const [subject, setSubject] = useState<string>(initialSubject)
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [type, setType] = useState<string>(initialData?.homework_type ?? 'exercice')
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? '')
  const [descriptionHtml, setDescriptionHtml] = useState(initialData?.description_html ?? '')

  const [saving, setSaving] = useState(false)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !dueDate) {
      toast.error('Veuillez remplir le titre et la date de rendu.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      const payload = {
        class_id: classId,
        teacher_id: teacherId,
        subject: subject || 'General',
        title: title.trim(),
        description_html: descriptionHtml,
        homework_type: type,
        due_date: dueDate,
      }

      if (isEdit) {
        const { error } = await supabase.from('homework').update(payload).eq('id', initialData.id)
        if (error) throw error
      } else {
        // Devoir autonome : aucun rattachement à une séance (journal_entry_id = null)
        const { data: hw, error } = await supabase
          .from('homework')
          .insert({ etablissement_id: etablissementId, journal_entry_id: null, ...payload })
          .select('id')
          .single()
        if (error) throw error
        if (hw) {
          fetch('/api/notifications/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ homework_id: hw.id, etablissement_id: etablissementId }),
          }).catch((err) => console.error('[DevoirForm] Échec notification devoir:', err))
        }
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

  // Modale volontairement NON fermable au clic sur le fond ni à Échap.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="devoir-form-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-warm-100 flex items-center justify-between flex-shrink-0">
          <h3 id="devoir-form-title" className="text-sm font-bold text-secondary-800">
            {isEdit ? 'Modifier le devoir' : 'Nouveau devoir'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
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

            <FloatSelect label="Type" required value={type} onChange={e => setType(e.target.value)}>
              <option value="exercice">Exercice</option>
              <option value="lecon">Leçon à apprendre</option>
              <option value="expose">Expose</option>
              <option value="autre">Autre</option>
            </FloatSelect>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FloatInput
              label="Titre du devoir"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex : Exercices page 45"
            />
            <FloatInput
              label="Date de rendu"
              required
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Consignes</label>
            <div className="mt-1">
              <Suspense fallback={<div className="h-48 bg-warm-50 rounded-lg animate-pulse" />}>
                <RichTextEditor
                  content={descriptionHtml}
                  onChange={setDescriptionHtml}
                  placeholder="Instructions pour le devoir..."
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
