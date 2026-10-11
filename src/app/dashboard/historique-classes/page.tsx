import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'
import HistoriqueClassesClient, { type ClasseArchivee } from '@/components/historique/HistoriqueClassesClient'

// Historique des classes : composition des annees ARCHIVEES (classe, enseignants,
// creneaux, eleves et adultes), figee au passage d'annee dans `class_year_history`.
// Ouvert a tout le personnel, enseignant compris, pour toutes les classes
// (decision utilisateur). La RLS de la table applique la meme regle.
const ROLES = ['admin', 'direction', 'secretaire', 'responsable_pedagogique', 'comptable', 'enseignant']

export default async function HistoriqueClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (!ROLES.includes(effectiveRole(me) ?? '')) redirect('/dashboard')

  const { data } = await supabase
    .from('class_year_history')
    .select('id, year_label, class_name, level, cotisation_label, is_adult, max_students, titulaires, remplacements, creneaux, participants, effectif')
    .order('year_label', { ascending: false })
    .order('class_name')

  return (
    <div className="h-full animate-fade-in">
      <HistoriqueClassesClient classes={(data ?? []) as ClasseArchivee[]} />
    </div>
  )
}
