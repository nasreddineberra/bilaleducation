import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'
import { chargerContexteSeances } from '@/lib/absences-enseignants/contexte'
import { nomEnseignantCivilite } from '@/lib/teachers/nom'
import AbsencesEnseignantsClient, { type AbsenceLigne } from '@/components/absences-enseignants/AbsencesEnseignantsClient'

// Absences enseignants (lot 3) : seul chemin des absences d'enseignant et des
// remplacements (docs/CONCEPTION-PLANNING-ABSENCES.md, § 3). L'encadrement et la
// secretaire declarent et decident ; l'enseignant voit SES absences en lecture
// (la RLS de `absences_enseignants` ne lui rend que les siennes).
const ENCADREMENT = ['admin', 'direction', 'responsable_pedagogique', 'secretaire']
const ROLES = [...ENCADREMENT, 'enseignant']

export default async function AbsencesEnseignantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  const role = effectiveRole(me) ?? ''
  if (!ROLES.includes(role)) redirect('/dashboard')
  const peutGerer = ENCADREMENT.includes(role)

  const { data: absences } = await supabase
    .from('absences_enseignants')
    .select('id, teacher_id, debut, fin, motif, teachers(civilite, first_name, last_name)')
    .order('debut', { ascending: false })

  const ids = (absences ?? []).map(a => a.id)
  const { data: decisions } = ids.length
    ? await supabase
        .from('absences_enseignants_seances')
        .select('absence_id, schedule_slot_id, seance_date, decision')
        .in('absence_id', ids)
    : { data: [] }

  const ctx = await chargerContexteSeances(supabase)

  const lignes: AbsenceLigne[] = (absences ?? []).map(a => {
    const seances = ctx.seancesDe({ debut: a.debut, fin: a.fin, teacherId: a.teacher_id })
    const touchees = new Set(seances.map(s => `${s.slotId}|${s.date}`))
    const siennes = (decisions ?? []).filter(d => d.absence_id === a.id && touchees.has(`${d.schedule_slot_id}|${d.seance_date}`))
    return {
      id: a.id,
      teacherId: a.teacher_id,
      enseignant: nomEnseignantCivilite(a.teachers),
      debut: a.debut.slice(0, 16).replace(' ', 'T'),
      fin: a.fin.slice(0, 16).replace(' ', 'T'),
      motif: a.motif,
      nbSeances: seances.length,
      nbADecider: seances.length - siennes.length,
    }
  })

  // Enseignants proposes a la declaration : les fiches actives.
  const { data: enseignants } = peutGerer
    ? await supabase
        .from('teachers')
        .select('id, civilite, first_name, last_name')
        .eq('is_active', true)
        .order('last_name')
        .order('first_name')
    : { data: [] }

  return (
    <div className="h-full animate-fade-in">
      <AbsencesEnseignantsClient
        absences={lignes}
        enseignants={(enseignants ?? []).map(t => ({ id: t.id, nom: nomEnseignantCivilite(t) }))}
        peutGerer={peutGerer}
      />
    </div>
  )
}
