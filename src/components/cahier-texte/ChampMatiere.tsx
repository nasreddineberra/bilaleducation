'use client'

import { useState } from 'react'
import { FloatInput, FloatSelect } from '@/components/ui/FloatFields'
import { choixMatiere, LIBELLE_MATIERE_GENERALE, type CreneauMatiere } from '@/lib/cahier-texte/matiere'

// Sentinelle de « Général » dans le select : une valeur vide ne ferait pas
// monter le libelle flottant de FloatSelect.
const GENERAL = '__general__'

/**
 * Matiere d'une seance ou d'un devoir, deduite des creneaux de la classe a
 * `date` (regle : `lib/cahier-texte/matiere.ts`). Valeur '' = « Général ».
 *
 * En creation, la valeur SUIT la matiere proposee (elle change avec la date de
 * la seance) tant que l'utilisateur n'a rien choisi. En modification, elle part
 * de la matiere enregistree, conservee meme si elle a quitte l'EDT.
 */
export function useMatiere(creneaux: CreneauMatiere[], date: string, enregistree: string | null) {
  const { options: duJour, proposee } = choixMatiere(creneaux, date)
  const [choisie, setChoisie] = useState<string | null>(enregistree)
  const valeur = choisie ?? proposee
  const options = valeur && !duJour.includes(valeur)
    ? [...duJour, valeur].sort((a, b) => a.localeCompare(b, 'fr'))
    : duJour
  return { options, valeur, choisir: setChoisie }
}

export default function ChampMatiere({ options, valeur, onChange }: {
  options: string[]
  valeur: string
  onChange: (v: string) => void
}) {
  // Rien a choisir : la matiere s'affiche dans un champ verrouille.
  if (options.length === 0) return <FloatInput label="Matière" value={LIBELLE_MATIERE_GENERALE} locked readOnly />
  if (options.length === 1 && valeur === options[0]) return <FloatInput label="Matière" value={valeur} locked readOnly />
  return (
    <FloatSelect
      label="Matière"
      value={valeur || GENERAL}
      onChange={e => onChange(e.target.value === GENERAL ? '' : e.target.value)}
    >
      <option value={GENERAL}>{LIBELLE_MATIERE_GENERALE}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </FloatSelect>
  )
}
