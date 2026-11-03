import { createClient } from '@/lib/supabase/server'
import { chargerAbsences, chargerEnfants, enfantsActifs } from '@/lib/espace-famille/donnees'
import FamilleAbsencesClient from '@/components/famille/FamilleAbsencesClient'

/**
 * Espace famille · Absences et retards de l'annee des enfants actifs, justifies
 * ou non, avec leur commentaire (decision du 03/11). Lecture seule (decision 7 :
 * pas de justification en ligne).
 */
export default async function FamilleAbsencesPage() {
  const supabase = await createClient()
  const [enfants, absences] = await Promise.all([chargerEnfants(supabase), chargerAbsences(supabase)])
  return <FamilleAbsencesClient enfants={enfantsActifs(enfants)} absences={absences} />
}
