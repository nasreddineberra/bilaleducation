'use client'

import { useRouter } from 'next/navigation'
import FiltreSwitch from '@/components/ui/FiltreSwitch'

/**
 * Filtre de la page Santé : Tous / À surveiller. L'état vit dans l'adresse
 * (`?filtre=surveiller`), la page serveur filtre elle-même.
 */
export default function FiltreSante({ filtre, tous, aSurveiller }: {
  filtre: 'tous' | 'surveiller'
  tous: number
  aSurveiller: number
}) {
  const router = useRouter()
  return (
    <FiltreSwitch
      ariaLabel="Filtrer les établissements"
      actif={filtre}
      onChange={v => router.replace(v === 'surveiller' ? '?filtre=surveiller' : '?', { scroll: false })}
      options={[
        { valeur: 'tous',       nombre: tous,        libelle: 'Tous' },
        { valeur: 'surveiller', nombre: aSurveiller, libelle: 'À surveiller', couleur: 'text-amber-700' },
      ]}
    />
  )
}
