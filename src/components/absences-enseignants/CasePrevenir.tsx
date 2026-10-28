'use client'

import { FloatCheckbox } from '@/components/ui/FloatFields'

/**
 * Case « prevenir les familles » des absences enseignants (lot 3c) : cochee par
 * defaut, grisee avec la raison quand l'ecole n'a pas de messagerie.
 */
export default function CasePrevenir({ label, coche, onChange, messagerie }: {
  label: string; coche: boolean; onChange: (v: boolean) => void; messagerie: boolean
}) {
  return (
    <FloatCheckbox
      label={label}
      checked={messagerie && coche}
      onChange={onChange}
      disabled={!messagerie}
      hint={messagerie ? undefined : 'Messagerie non configurée : Paramètres → Établissement → Messagerie.'}
    />
  )
}
