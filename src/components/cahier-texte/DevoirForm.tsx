'use client'

import { useState, useId, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { modifierDevoir } from '@/app/dashboard/cahier-texte/actions'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import { messageErreur } from '@/lib/erreur'
import type { DevoirCahier } from '@/lib/cahier-texte/donnees'
import type { TypeDevoir } from '@/components/cahier-texte/commun'

const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor'))

// Matière obligatoire côté BDD (homework.subject NOT NULL) : « Général » = valeur
// littérale 'General' ; la sentinelle sert juste à faire monter le label flottant.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- matiere forcee « General » en V1 (11/07), machinerie du Secondaire conservee
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
  initialData?: Pick<DevoirCahier, 'id' | 'subject' | 'title' | 'homework_type' | 'due_date' | 'description_html'>   // présent en édition
}

// Champ en lecture seule (classe / enseignant / matiere) : champ verrouille de la charte.
function LockedField({ label, value }: { label: string; value: string }) {
  return <FloatInput label={label} value={value || '·'} locked readOnly />
}

export default function DevoirForm({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matiere forcee « General » en V1 (11/07), machinerie du Secondaire conservee
  etablissementId, classId, className, teacherId, teacherLabel, subjects,
  onClose, onSaved, initialData,
}: Props) {
  const router = useRouter()
  const toast  = useToast()
  const isEdit = !!initialData

  // '' = Général (converti en littéral 'General' à l'enregistrement)
  const initialSubject = initialData?.subject && initialData.subject !== 'General' ? initialData.subject : ''
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matiere forcee « General » en V1 (11/07), machinerie du Secondaire conservee
  const [subject, setSubject] = useState<string>(initialSubject)
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [type, setType] = useState<TypeDevoir>(initialData?.homework_type ?? 'exercice')
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? '')
  const [descriptionHtml, setDescriptionHtml] = useState(initialData?.description_html ?? '')

  const [saving, setSaving] = useState(false)

  const formId = useId()

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
        // Server action et non un `update()` depuis le navigateur : la FENETRE
        // (date de rendu passee) se verifie cote serveur — griser le bouton ne
        // protegerait rien, l API REST restant ouverte. Elle apporte aussi la
        // trace, qu une modification de devoir n avait jamais eue.
        const res = await modifierDevoir(initialData.id, payload)
        if (res.error) throw new Error(res.error)
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
    } catch (err: unknown) {
      toast.error(messageErreur(err) ?? 'Erreur lors de l\'enregistrement.')
      setSaving(false)
    }
  }

  // Modale volontairement NON fermable au clic sur le fond ni à Échap (FormModal).
  return (
    <FormModal
      title={isEdit ? 'Modifier le devoir' : 'Nouveau devoir'}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={<>
        <span className="text-xs text-red-700"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton variant="secondary" type="button" onClick={onClose}>Annuler</FloatButton>
        <FloatButton variant={isEdit ? 'edit' : 'submit'} type="submit" form={formId} loading={saving}>
          {isEdit ? 'Modifier' : 'Valider'}
        </FloatButton>
      </>}>
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LockedField label="Classe" value={className} />
          <LockedField label="Enseignant" value={teacherLabel} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* V1 (mono-mode Primaire) : Matière forcée sur « Général » (verrouillée).
              En Secondaire, réactiver un select alimenté par les matières de la classe. */}
          <LockedField label="Matière" value="Général" />

          <FloatSelect label="Type" required value={type} onChange={e => setType(e.target.value as TypeDevoir)}>
            <option value="exercice">Exercice</option>
            <option value="lecon">Leçon à apprendre</option>
            <option value="expose">Exposé</option>
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
          <span className="section-title">Consignes</span>
          <div className="mt-1">
            <Suspense fallback={<div className="h-48 bg-warm-50 rounded-lg animate-pulse" />}>
              <RichTextEditor
                content={descriptionHtml}
                onChange={setDescriptionHtml}
              />
            </Suspense>
          </div>
        </div>
      </form>
    </FormModal>
  )
}
