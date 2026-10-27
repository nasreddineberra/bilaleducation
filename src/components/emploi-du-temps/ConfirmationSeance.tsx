'use client'

import { useState } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { FloatInput } from '@/components/ui/FloatFields'
import { intituleCreneau } from '@/lib/edt/intitule'
import { nomEnseignant } from '@/lib/teachers/nom'
import type { ResolvedSlot } from './EmploiDuTempsClient'

/**
 * Confirmation d'une action sur UNE seance (decision du 27/10) : le recapitulatif
 * complet de la seance, puis la saisie d'un mot-cle (« ANNULATION »,
 * « SUPPRESSION ») qui seul debloque le bouton — double confirmation, la seance
 * visee est relue avant d'agir. Casse et espaces autour ignores.
 */
const MODES = {
  annuler: {
    titre: 'Annuler la séance',
    motCle: 'ANNULATION',
    bouton: 'Annuler la séance',
    rappel: 'Elle restera affichée « ANNULÉ » et pourra être réactivée.',
  },
  supprimer: {
    titre: 'Supprimer la séance',
    motCle: 'SUPPRESSION',
    bouton: 'Supprimer la séance',
    rappel: 'Cette séance ponctuelle sera supprimée définitivement.',
  },
} as const

export type ModeConfirmationSeance = keyof typeof MODES

export default function ConfirmationSeance({ seance, mode, onConfirm, onCancel }: {
  seance: ResolvedSlot
  mode: ModeConfirmationSeance
  onConfirm: () => void
  onCancel: () => void
}) {
  const m = MODES[mode]
  const [saisie, setSaisie] = useState('')
  const date = new Date(seance.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const lignes: [string, string][] = [
    ['Classe', seance.classes?.name ?? '·'],
    ['Date', date.charAt(0).toUpperCase() + date.slice(1)],
    ['Horaire', `${seance.start_time.slice(0, 5)}-${seance.end_time.slice(0, 5)}`],
    ['Intitulé', intituleCreneau(seance)],
    ['Enseignant', seance.teacher_id ? (seance.teachers ? nomEnseignant(seance.teachers) : '·') : 'Prof non affecté'],
  ]
  if (seance.rooms?.name) lignes.push(['Salle', seance.rooms.name])

  return (
    <ConfirmModal
      title={m.titre}
      variant="danger"
      confirmLabel={m.bouton}
      cancelLabel="Retour"
      confirmDisabled={saisie.trim().toUpperCase() !== m.motCle}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="space-y-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {lignes.map(([libelle, valeur]) => (
            <div key={libelle} className="contents">
              <dt className="text-warm-700">{libelle}</dt>
              <dd className="font-medium text-secondary-800">{valeur}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-warm-700">{m.rappel}</p>
        <FloatInput
          label={`Saisissez ${m.motCle} pour confirmer`}
          value={saisie}
          onChange={e => setSaisie(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </div>
    </ConfirmModal>
  )
}
