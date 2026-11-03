'use client'

import FiltreSwitch from '@/components/ui/FiltreSwitch'

/**
 * Choix de l'enfant en tete d'un ecran de l'espace famille (affiche a partir de
 * deux enfants). « Tous » d'abord ; la valeur est memorisee par l'ecran.
 */
export default function SelecteurEnfant({ enfants, valeur, onChange }: {
  enfants: { id: string; first_name: string }[]
  valeur: string
  onChange: (id: string) => void
}) {
  if (enfants.length < 2) return null
  return (
    <FiltreSwitch
      ariaLabel="Choisir un enfant"
      actif={valeur}
      onChange={onChange}
      options={[
        { valeur: '', libelle: 'Tous' },
        ...enfants.map(e => ({ valeur: e.id, libelle: e.first_name })),
      ]}
    />
  )
}
