import { createClient } from '@/lib/supabase/server'
import { chargerParticipants, CLE_MOI } from '@/lib/espace-famille/donnees'
import FamilleBulletinsClient from '@/components/famille/FamilleBulletinsClient'

/**
 * Espace famille · Bulletins ARCHIVES de l'annee en cours (decision 2 : les notes
 * se lisent ici seulement) : enfants, enfants partis jusqu'a la fin de l'annee
 * (decision 5), et bulletin du cours adulte du tuteur (fusion du 03/11). Les
 * regles du lot 2 bornent la lecture ; le PDF s'ouvre par une adresse signee.
 */
export default async function FamilleBulletinsPage() {
  const supabase = await createClient()
  const COLONNES = 'id, class_id, period_id, file_path, moyenne_generale, absences_count, absences_unjustified, retards_count, archived_at, classes:class_id(name), periods:period_id(label, order_index)' as const
  const [{ enfants }, { data: enfantsArchives }, { data: adulteArchives }] = await Promise.all([
    chargerParticipants(supabase),
    supabase.from('bulletin_archives').select(`student_id, ${COLONNES}`),
    supabase.from('adult_bulletin_archives').select(COLONNES),
  ])
  const prenom = new Map(enfants.map(e => [e.id, e.first_name]))
  const bulletins = [
    ...(enfantsArchives ?? []).map(b => ({ ...b, groupe: b.student_id, qui: prenom.get(b.student_id) ?? '' })),
    ...(adulteArchives ?? []).map(b => ({ ...b, groupe: CLE_MOI, qui: 'Moi' })),
  ].sort((a, b) => a.qui.localeCompare(b.qui) || (a.periods?.order_index ?? 0) - (b.periods?.order_index ?? 0))

  return <FamilleBulletinsClient bulletins={bulletins} />
}
