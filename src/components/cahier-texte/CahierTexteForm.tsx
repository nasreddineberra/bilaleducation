'use client'

import { useState, lazy, Suspense } from 'react'
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
        {value || '—'}
      </div>
      <span className="absolute left-3 top-1.5 text-[10px] font-semibold tracking-wide uppercase text-warm-500 pointer-events-none">
        {label}
      </span>
    </div>
  )
}

export default function CahierTexteForm({
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

  const [showHomework, setShowHomework] = useState(!!initialData?.homework)
  const [hwId] = useState<string | null>(initialData?.homework?.id ?? null)
  const [hwTitle, setHwTitle] = useState(initialData?.homework?.title ?? '')
  const [hwType, setHwType] = useState<string>(initialData?.homework?.homework_type ?? 'exercice')
  const [hwDueDate, setHwDueDate] = useState(initialData?.homework?.due_date ?? '')
  const [hwDescription, setHwDescription] = useState(initialData?.homework?.description_html ?? '')

  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !contentHtml.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires.')
      return
    }
    if (showHomework && (!hwTitle.trim() || !hwDueDate)) {
      toast.error('Veuillez remplir le titre et la date de rendu du devoir.')
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

      // Séance : mise à jour en édition, insertion sinon
      let journalId: string
      if (isEdit) {
        const { error } = await supabase.from('class_journal').update(journalPayload).eq('id', initialData.id)
        if (error) throw error
        journalId = initialData.id
      } else {
        const { data, error } = await supabase
          .from('class_journal')
          .insert({ etablissement_id: etablissementId, ...journalPayload })
          .select('id')
          .single()
        if (error) throw error
        journalId = data.id
      }

      // Devoir : créer / mettre à jour / supprimer
      if (showHomework && hwTitle.trim() && hwDueDate) {
        const hwPayload = {
          class_id: classId,
          teacher_id: teacherId,
          subject: subject || 'General',
          title: hwTitle.trim(),
          description_html: hwDescription,
          homework_type: hwType,
          due_date: hwDueDate,
        }
        if (hwId) {
          const { error } = await supabase.from('homework').update(hwPayload).eq('id', hwId)
          if (error) throw error
        } else {
          const { data: hw, error } = await supabase
            .from('homework')
            .insert({ etablissement_id: etablissementId, journal_entry_id: journalId, ...hwPayload })
            .select('id')
            .single()
          if (error) throw error
          if (hw) {
            fetch('/api/notifications/homework', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ homework_id: hw.id, etablissement_id: etablissementId }),
            }).catch((err) => console.error('[CahierTexteForm] Échec notification devoir:', err))
          }
        }
      } else if (hwId) {
        const { error } = await supabase.from('homework').delete().eq('id', hwId)
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

  // Modale volontairement NON fermable au clic sur le fond ni à Échap : on ne
  // ferme que par les boutons (X / Annuler / enregistrement) pour ne pas perdre la saisie.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ct-form-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-warm-100 flex items-center justify-between flex-shrink-0">
          <h3 id="ct-form-title" className="text-sm font-bold text-secondary-800">
            {isEdit ? 'Modifier la séance' : 'Nouvelle séance'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LockedField label="Classe" value={className} />
            <LockedField label="Enseignant" value={teacherLabel} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FloatSelect
              label="Matiere"
              value={subject === '' ? GENERAL : subject}
              onChange={e => setSubject(e.target.value === GENERAL ? '' : e.target.value)}
            >
              <option value={GENERAL}>General (toutes matieres)</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </FloatSelect>

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
            <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">
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

          {/* Devoir */}
          <div className="border-t border-warm-200 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Devoir</h4>
              {!showHomework ? (
                <FloatButton variant="secondary" type="button" onClick={() => setShowHomework(true)}>
                  Ajouter un devoir
                </FloatButton>
              ) : (
                <FloatButton
                  variant="danger"
                  type="button"
                  onClick={() => { setShowHomework(false); setHwTitle(''); setHwDescription(''); setHwDueDate('') }}
                >
                  Retirer
                </FloatButton>
              )}
            </div>

            {showHomework && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatInput
                    label="Titre du devoir"
                    required
                    value={hwTitle}
                    onChange={e => setHwTitle(e.target.value)}
                    placeholder="Ex : Exercices page 45"
                  />
                  <FloatSelect label="Type" required value={hwType} onChange={e => setHwType(e.target.value)}>
                    <option value="exercice">Exercice</option>
                    <option value="lecon">Lecon a apprendre</option>
                    <option value="expose">Expose</option>
                    <option value="autre">Autre</option>
                  </FloatSelect>
                  <FloatInput
                    label="Date de rendu"
                    required
                    type="date"
                    value={hwDueDate}
                    onChange={e => setHwDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Consignes</label>
                  <div className="mt-1">
                    <Suspense fallback={<div className="h-48 bg-warm-50 rounded-lg animate-pulse" />}>
                      <RichTextEditor
                        content={hwDescription}
                        onChange={setHwDescription}
                        placeholder="Instructions pour le devoir..."
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
            )}
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
    </div>
  )
}
