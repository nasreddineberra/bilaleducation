import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { chargerCahierTexte } from '@/lib/cahier-texte/donnees'
import { chargerParticipants } from '@/lib/espace-famille/donnees'
import FamilleDevoirsClient from '@/components/famille/FamilleDevoirsClient'

/**
 * Espace famille · Devoirs des enfants ET du cours adulte du tuteur (fusionnes,
 * decision du 03/11). Lecture du cahier de texte en role parent (classes de
 * l'annee, devoirs ; jamais les seances, internes) et suivi « fait » du foyer.
 * Le detail s'ouvre dans la fenetre du devoir (lot 3).
 */
export default async function FamilleDevoirsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''

  const [cahier, { participants }, { data: suiviEnfants }, { data: suiviAdulte }] = await Promise.all([
    chargerCahierTexte(supabase, user?.id ?? '', 'parent'),
    chargerParticipants(supabase),
    supabase.from('homework_status').select('homework_id, student_id, is_seen, is_done'),
    supabase.from('adult_homework_status').select('homework_id, parent_id, tutor_number, is_seen, is_done'),
  ])

  return (
    <FamilleDevoirsClient
      devoirs={cahier.homeworkEntries}
      classes={cahier.classes}
      participants={participants}
      suiviEnfants={suiviEnfants ?? []}
      suiviAdulte={suiviAdulte ?? []}
      etablissementId={etablissementId}
    />
  )
}
