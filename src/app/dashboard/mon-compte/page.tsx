import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MonCompteClient from '@/components/mon-compte/MonCompteClient'
import { chargerAssiduite } from '@/lib/temps-presence/assiduite'

/**
 * Roles qui POINTENT, donc qui ont un temps de presence a consulter.
 *
 * Copie conforme de l'exclusion appliquee au module Temps de presence : parent
 * et super_admin n'y figurent pas, et l'admin gere le suivi sans y pointer ses
 * propres heures. Leur afficher un encadre vide serait leur promettre une
 * fonctionnalite qui ne les concerne pas.
 */
const ROLES_POINTABLES = ['direction', 'comptable', 'secretaire', 'responsable_pedagogique', 'enseignant']

export default async function MonComptePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, civilite, first_name, last_name, phone, etablissement_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  let etablissementName = ''
  if (profile.etablissement_id) {
    const { data: etab } = await supabase
      .from('etablissements')
      .select('nom')
      .eq('id', profile.etablissement_id)
      .single()
    etablissementName = etab?.nom ?? ''
  }

  // L'interesse lit ses PROPRES heures : la RLS de `staff_time_entries` ne lui
  // en donnera pas d'autres, meme si la requete en demandait.
  const assiduite = ROLES_POINTABLES.includes(profile.role)
    ? await chargerAssiduite(supabase, profile.id)
    : null

  return (
    <MonCompteClient
      profile={profile}
      email={user.email ?? profile.email}
      etablissementName={etablissementName}
      assiduite={assiduite}
    />
  )
}
