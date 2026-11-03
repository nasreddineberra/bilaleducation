import { createClient } from '@/lib/supabase/server'
import { chargerAbsences, chargerParticipants } from '@/lib/espace-famille/donnees'
import FamilleAbsencesClient from '@/components/famille/FamilleAbsencesClient'

/**
 * Espace famille · Absences et retards de l'annee : enfants actifs et cours
 * adulte du tuteur (fusionnes), justifies ou non, avec leur commentaire. Lecture
 * seule (decision 7 : pas de justification en ligne).
 */
export default async function FamilleAbsencesPage() {
  const supabase = await createClient()
  const [{ participants }, absences] = await Promise.all([chargerParticipants(supabase), chargerAbsences(supabase)])
  return <FamilleAbsencesClient participants={participants} absences={absences} />
}
