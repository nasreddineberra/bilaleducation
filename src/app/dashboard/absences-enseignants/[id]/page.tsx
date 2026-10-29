import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'
import { chargerContexteSeances, TOUTES_DATES } from '@/lib/absences-enseignants/contexte'
import { nomEnseignant, nomEnseignantCivilite } from '@/lib/teachers/nom'
import { libelleRole } from '@/lib/auth/role-labels'
import { hasSmtpConfig } from '@/lib/email'
import AbsenceDetailClient, { type SeanceFiche, type Membre } from '@/components/absences-enseignants/AbsenceDetailClient'

// Fiche d'une absence : les seances touchees et leur decision (lot 3b-1).
// Les remplacants possibles et la raison de ceux qui sont pris viennent de la
// base (`remplacants_possibles`), qui juge aussi l'enregistrement.
const ENCADREMENT = ['admin', 'direction', 'responsable_pedagogique', 'secretaire']

export default async function AbsenceEnseignantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  const role = effectiveRole(me) ?? ''
  if (![...ENCADREMENT, 'enseignant', 'comptable'].includes(role)) redirect('/dashboard')
  const peutGerer = ENCADREMENT.includes(role)

  // L'encadrement lit la table (la RLS juge). L'enseignant et le comptable lisent
  // toute absence de l'ecole par `absences_enseignants_information` (decision du
  // 29/10) : la RLS de `teachers` ne rendrait pas a un enseignant le nom d'un collegue.
  let absence: { teacher_id: string; debut: string; fin: string; motif: string; enseignant: string; etablissement_id: string | null } | null = null
  if (peutGerer) {
    const { data } = await supabase
      .from('absences_enseignants')
      .select('id, etablissement_id, teacher_id, debut, fin, motif, teachers(civilite, first_name, last_name)')
      .eq('id', id)
      .maybeSingle()
    if (data) absence = { ...data, enseignant: nomEnseignantCivilite(data.teachers) }
  } else {
    const { data } = await supabase.rpc('absences_enseignants_information', { p_debut: TOUTES_DATES.debut, p_fin: TOUTES_DATES.fin })
    const a = (data ?? []).find(x => x.id === id)
    if (a) absence = { teacher_id: a.teacher_id, debut: a.debut, fin: a.fin, motif: a.motif, enseignant: nomEnseignantCivilite(a), etablissement_id: null }
  }
  if (!absence) notFound()

  const debut = absence.debut.slice(0, 16).replace(' ', 'T')
  const fin = absence.fin.slice(0, 16).replace(' ', 'T')
  const ctx = await chargerContexteSeances(supabase)
  const touchees = ctx.seancesDe({ debut, fin, teacherId: absence.teacher_id })

  const slotIds = [...new Set(touchees.map(s => s.slotId))]
  const { data: decisions } = await supabase
    .from('absences_enseignants_seances')
    .select('schedule_slot_id, seance_date, decision, remplacant_profile_id, familles_prevenues_le')
    .eq('absence_id', id)
  const { data: validations } = slotIds.length
    ? await supabase
        .from('schedule_validations')
        .select('schedule_slot_id, validation_date')
        .in('schedule_slot_id', slotIds)
    : { data: [] }

  const cle = (slotId: string, date: string) => `${slotId}|${date}`
  const decisionDe = new Map((decisions ?? []).map(d => [cle(d.schedule_slot_id, d.seance_date), d]))
  const validees = new Set((validations ?? []).map(v => cle(v.schedule_slot_id, v.validation_date)))

  // Remplacants possibles, seance par seance (encadrement seulement : la base
  // refuse les autres roles).
  const occupations: Record<string, Record<string, string | null>> = {}
  const membreIds = new Set<string>()
  if (peutGerer && touchees.length) {
    const { data: lignes } = await supabase.rpc('remplacants_possibles', {
      p_absence_id: id,
      p_seances: touchees.map(s => ({ slot_id: s.slotId, date: s.date })),
    })
    for (const l of lignes ?? []) {
      const k = cle(l.slot_id, l.seance_date)
      ;(occupations[k] ??= {})[l.profile_id] = l.occupe
      membreIds.add(l.profile_id)
    }
  }
  for (const d of decisions ?? []) if (d.remplacant_profile_id) membreIds.add(d.remplacant_profile_id)

  const { data: profils } = membreIds.size
    ? await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('id', [...membreIds])
        .order('last_name')
        .order('first_name')
    : { data: [] }
  const membres: Membre[] = (profils ?? []).map(p => ({
    id: p.id, nom: nomEnseignant(p), role: libelleRole(p.role, 'court'),
  }))

  const seances: SeanceFiche[] = touchees.map(s => {
    const d = decisionDe.get(cle(s.slotId, s.date))
    return {
      slotId: s.slotId,
      date: s.date,
      classe: ctx.nomClasse(s.classId),
      debut: s.startTime,
      fin: s.endTime,
      decision: d ? (d.decision as 'annulee' | 'remplacee') : 'a_decider',
      remplacant: d?.remplacant_profile_id ?? null,
      validee: validees.has(cle(s.slotId, s.date)),
      prevenuesLe: d?.familles_prevenues_le ?? null,
      occupes: occupations[cle(s.slotId, s.date)] ?? {},
    }
  })

  return (
    <div className="h-full animate-fade-in">
      <AbsenceDetailClient
        absence={{ id, teacherId: absence.teacher_id, debut, fin, motif: absence.motif }}
        enseignant={absence.enseignant}
        seances={seances}
        membres={membres}
        peutGerer={peutGerer}
        messagerie={peutGerer && !!absence.etablissement_id && await hasSmtpConfig(absence.etablissement_id)}
      />
    </div>
  )
}
