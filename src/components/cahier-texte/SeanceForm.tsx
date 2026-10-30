'use client'

import { useState, useId, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { modifierSeance } from '@/app/dashboard/cahier-texte/actions'
import { FloatInput, FloatButton } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import { messageErreur } from '@/lib/erreur'
import type { SeanceCahier } from '@/lib/cahier-texte/donnees'
import { aujourdhui } from './commun'

const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor'))

// Valeur sentinelle pour « Général » : garde une valeur non vide dans le select
// (sinon le label flottant de FloatSelect ne monte pas et chevauche le texte).
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
  initialData?: Pick<SeanceCahier, 'id' | 'subject' | 'session_date' | 'title' | 'content_html'>   // présent en édition
}

// Champ en lecture seule (classe / enseignant / matiere) : champ verrouille de la charte.
function LockedField({ label, value }: { label: string; value: string }) {
  return <FloatInput label={label} value={value || '·'} locked readOnly />
}

export default function SeanceForm({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matiere forcee « General » en V1 (11/07), machinerie du Secondaire conservee
  etablissementId, classId, className, teacherId, teacherLabel, subjects,
  onClose, onSaved, initialData,
}: Props) {
  const router = useRouter()
  const toast  = useToast()
  const isEdit = !!initialData

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matiere forcee « General » en V1 (11/07), machinerie du Secondaire conservee
  const [subject, setSubject] = useState<string>(initialData?.subject ?? '')  // '' = Général
  const [sessionDate, setSessionDate] = useState(initialData?.session_date ?? aujourdhui())
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [contentHtml, setContentHtml] = useState(initialData?.content_html ?? '')

  const [saving, setSaving] = useState(false)

  const formId = useId()

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
        // Server action : la fenetre des 7 jours se verifie cote serveur, et la
        // modification est tracee. Voir `modifierSeance`.
        const res = await modifierSeance(initialData.id, journalPayload)
        if (res.error) throw new Error(res.error)
      } else {
        const { error } = await supabase
          .from('class_journal')
          .insert({ etablissement_id: etablissementId, ...journalPayload })
        if (error) throw error
      }

      onSaved()
      router.refresh()
      onClose()
    } catch (err: unknown) {
      toast.error(messageErreur(err) ?? 'Erreur lors de l\'enregistrement.')
      setSaving(false)
    }
  }

  // Modale volontairement NON fermable au clic sur le fond ni à Échap (FormModal) :
  // on ne ferme que par X / Annuler / enregistrement pour ne pas perdre la saisie.
  return (
    <FormModal
      title={isEdit ? 'Modifier la séance' : 'Nouvelle séance'}
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

          <FloatInput
            label="Date de séance"
            required
            type="date"
            value={sessionDate}
            onChange={e => setSessionDate(e.target.value)}
          />
        </div>

        <FloatInput
          label="Titre de la séance"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex : Les fractions · Introduction"
        />

        <div>
          <span className="section-title">
            Contenu de la séance <span className="text-red-700">*</span>
          </span>
          <div className="mt-1">
            <Suspense fallback={<div className="h-48 bg-warm-50 rounded-lg animate-pulse" />}>
              <RichTextEditor
                content={contentHtml}
                onChange={setContentHtml}
              />
            </Suspense>
          </div>
        </div>
      </form>
    </FormModal>
  )
}
