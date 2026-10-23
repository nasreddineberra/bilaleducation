'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { sanitize } from '@/lib/security/sanitize'
import { FloatButton } from '@/components/ui/FloatFields'
import SeanceForm from './SeanceForm'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FormModal from '@/components/ui/FormModal'
import { dateLocale } from './commun'
import Tooltip from '@/components/ui/Tooltip'
import { useToast } from '@/lib/toast-context'
import { useRouter } from 'next/navigation'
import { supprimerSeance } from '@/app/dashboard/cahier-texte/actions'

const STAFF = ['admin', 'direction', 'responsable_pedagogique']

function teacherLabelOf(t: any): string {
  if (!t) return ''
  return `${t.civilite ? t.civilite + ' ' : ''}${t.last_name} ${t.first_name}`
}
const DAY_STR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi',
  friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}
// Info classe : cotisation · Niveau (si) · horaires.
function classInfoOf(c: any): string {
  if (!c) return ''
  const parts: string[] = []
  if (c.cotisation_types?.label) parts.push(c.cotisation_types.label)
  if (c.level) parts.push(`Niveau ${c.level}`)
  if (c.day_of_week && c.start_time) {
    const day = DAY_STR[c.day_of_week] ?? c.day_of_week
    parts.push(`${day} ${c.start_time.slice(0, 5)}${c.end_time ? `-${c.end_time.slice(0, 5)}` : ''}`)
  }
  return parts.join(' · ')
}
function formatDate(d: string): string {
  return dateLocale(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
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

  const teacherLabel = teacherLabelOf(journal.teachers)
  const canEdit = STAFF.includes(role) || journal.teacher_id === teacherId

  // SUPPRESSION — fenetre de 7 jours pour l'enseignant, aucune pour
  // l'encadrement (c'est lui qui corrige les erreurs anciennes). La regle est
  // verifiee cote SERVEUR aussi : masquer un bouton ne protege rien. Le bouton
  // reste visible et grise plutot que masque (regle du 4 aout).
  const joursEcoules = (() => {
    const [ay, am, ad] = String(journal.session_date ?? '').slice(0, 10).split('-').map(Number)
    if (!ay) return 0
    const now = new Date()
    return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
  })()
  const horsFenetre = !STAFF.includes(role) && joursEcoules > 7

  const [confirmSuppr, setConfirmSuppr] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const toast  = useToast()
  const router = useRouter()

  const handleSupprimer = async () => {
    setSuppression(true)
    const res = await supprimerSeance(journal.id)
    setSuppression(false)
    setConfirmSuppr(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Séance supprimée.')
    onClose()
    router.refresh()
  }

  // Modale verrouillée (FormModal) : fermeture par X / Fermer seulement.
  return (
    <>
    <FormModal
      title={journal.title}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={<>
        {canEdit && (
          horsFenetre ? (
            <Tooltip content="Cette séance date de plus de 7 jours : elle ne peut plus être supprimée.">
              <FloatButton variant="danger" type="button" disabled>Supprimer</FloatButton>
            </Tooltip>
          ) : (
            <FloatButton variant="danger" type="button" onClick={() => setConfirmSuppr(true)}>Supprimer</FloatButton>
          )
        )}
        <div className="flex-1" />
        {canEdit && (
          horsFenetre ? (
            <Tooltip content="Cette séance date de plus de 7 jours : elle ne peut plus être modifiée.">
              <FloatButton variant="edit" type="button" disabled>Modifier</FloatButton>
            </Tooltip>
          ) : (
            <FloatButton variant="edit" type="button" onClick={() => setShowEdit(true)}>Modifier</FloatButton>
          )
        )}
        <FloatButton variant="secondary" type="button" onClick={onClose}>Fermer</FloatButton>
      </>}
    >
      <div className="flex items-center gap-2 text-[11px] text-warm-700 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-secondary-100 text-secondary-700 font-bold whitespace-nowrap">{journal.classes?.name}</span>
        {journal.subject && <span className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-700 font-bold">{journal.subject}</span>}
        {/* Un seul bloc : sur telephone, le retour a la ligne commencait par « · ». */}
        <span>{teacherLabel}{classInfoOf(journal.classes) && ` · ${classInfoOf(journal.classes)}`}</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="section-title">Contenu de la séance</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warm-700">
          <CalendarDays size={14} /> {formatDate(journal.session_date)}
        </span>
      </div>
      <div className="prose prose-sm max-w-none text-warm-700" dangerouslySetInnerHTML={{ __html: sanitize(journal.content_html) }} />
    </FormModal>

      {confirmSuppr && (
        <ConfirmModal
          open
          variant="danger"
          title="Supprimer cette séance"
          confirmLabel={suppression ? 'Suppression…' : 'Supprimer définitivement'}
          onConfirm={handleSupprimer}
          onCancel={() => setConfirmSuppr(false)}
        >
          <p className="text-sm text-warm-700">« {journal.title} » · {journal.classes?.name ?? ''}</p>
        </ConfirmModal>
      )}

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
    </>
  )
}
