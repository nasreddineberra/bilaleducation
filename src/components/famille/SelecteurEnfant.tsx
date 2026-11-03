'use client'

import FiltreSwitch from '@/components/ui/FiltreSwitch'

/**
 * Choix du participant en tete d'un ecran de l'espace famille : « Tous », un
 * prenom par enfant, « Moi » pour le tuteur inscrit a un cours adulte (cours
 * FUSIONNE avec les enfants, decision du 03/11). Affiche a partir de deux choix ;
 * la valeur est memorisee par l'ecran.
 */
export default function SelecteurEnfant({ choix, valeur, onChange }: {
  choix: { valeur: string; libelle: string }[]
  valeur: string
  onChange: (valeur: string) => void
}) {
  if (choix.length < 2) return null
  return (
    <FiltreSwitch
      ariaLabel="Choisir un enfant"
      actif={valeur}
      onChange={onChange}
      options={[{ valeur: '', libelle: 'Tous' }, ...choix]}
    />
  )
}
