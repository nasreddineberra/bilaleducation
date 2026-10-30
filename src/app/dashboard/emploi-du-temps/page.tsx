import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import dynamic from 'next/dynamic'
import { effectiveRole } from '@/lib/auth/effective-role'

const EmploiDuTempsClient = dynamic(
  () => import('@/components/emploi-du-temps/EmploiDuTempsClient'),
  { loading: () => <div className="flex items-center justify-center h-96 text-warm-700">Chargement de l'emploi du temps…</div> },
)

export default async function EmploiDuTempsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name, etablissement_id')
    .eq('id', userId)
    .single()

  const role = effectiveRole(profile) ?? 'enseignant'
  const canEdit = ['admin', 'direction', 'responsable_pedagogique', 'secretaire'].includes(role)

  // Annee scolaire courante
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date, vacations, jours_feries')
    .eq('is_current', true)
    .maybeSingle()

  if (!currentYear) {
    return (
      <div className="h-full flex items-center justify-center text-warm-700">
        Aucune année scolaire active
      </div>
    )
  }

  // Classes avec prof principal
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, level, room_id, day_of_week, start_time, end_time, teaching_mode, class_teachers(teacher_id, is_main_teacher, subject, effective_from, effective_until, teachers(id, first_name, last_name, civilite)), cotisation_types(label)')
    .eq('academic_year', currentYear.label)
    .order('name')

  // Un enseignant ne lit que SA ligne `teachers` (RLS) : le nom d'un collegue
  // remplacant revient vide. On le complete cote serveur, pour les SEULS
  // identifiants deja lus dans `class_teachers` (donc de l'ecole) — c'est ce
  // qui permet d'afficher « Remplace par NOM Prenom ».
  type AffectationClasse = { teacher_id: string; teachers: unknown }
  const affectations = (classes ?? []).flatMap(c => (c.class_teachers ?? []) as unknown as AffectationClasse[])
  const manquants = [...new Set(affectations.filter(a => !a.teachers).map(a => a.teacher_id))]
  if (manquants.length > 0) {
    const { data: noms } = await createAdminClient()
      .from('teachers')
      .select('id, first_name, last_name, civilite')
      .in('id', manquants)
    const parId = new Map((noms ?? []).map(t => [t.id, t]))
    for (const a of affectations) if (!a.teachers) a.teachers = parId.get(a.teacher_id) ?? null
  }

  // Enseignants actifs
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, first_name, last_name, civilite, user_id')
    .eq('is_active', true)
    .order('last_name')

  // Créneaux de l'année en cours
  const { data: slots } = await supabase
    .from('schedule_slots')
    .select('*, classes(name), cours(nom_fr), unites_enseignement(nom_fr), rooms(name)')
    .eq('school_year_id', currentYear.id)
    .eq('is_active', true)
    .order('start_time')

  // Le type de presence ecrit a la validation (code reserve du type de seance)
  // est choisi par la base (`valider_seance`) : plus rien a charger ici.

  // Exceptions — limitées aux créneaux de l'année en cours (évite le sur-fetch)
  const slotIds = (slots ?? []).map(s => s.id)
  const { data: exceptions } = slotIds.length > 0
    ? await supabase.from('schedule_exceptions').select('*').in('schedule_slot_id', slotIds)
    : { data: [] }

  // Salles disponibles
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, room_type, capacity')
    .eq('is_available', true)
    .order('name')

  // Référentiel cours
  const { data: coursList } = await supabase
    .from('cours')
    .select('id, nom_fr, unite_enseignement_id, unites_enseignement(nom_fr, color)')
    .order('nom_fr')

  // UE avec couleur (pour la palette)
  const { data: ueList } = await supabase
    .from('unites_enseignement')
    .select('id, nom_fr, code, color')
    .order('order_index')

  // Week start day
  const { data: etablissement } = await supabase
    .from('etablissements')
    .select('week_start_day, working_days')
    .single()

  // Validations (toutes les dates pour permettre la validation des jours passés)
  const { data: todayValidations } = await supabase
    .from('schedule_validations')
    .select('id, schedule_slot_id, profile_id, validation_date, time_entry_id')

  // ── Absences d'enseignant et leurs decisions (lot 3) ─────────────────────
  //
  // Seul chemin des absences et des remplacements : la page Absences
  // enseignants. L'EDT les LIT pour annoncer AVANT le clic ce que la base
  // refuserait (seance « a decider ») et pour dire qui assure une seance.
  // La RLS rend toutes les absences a l'encadrement, ses propres absences a
  // l'enseignant ; les decisions (sans motif) a tout le personnel.
  const { data: absencesEnseignants } = await supabase
    .from('absences_enseignants')
    .select('id, teacher_id, debut, fin')
    .gte('fin', `${currentYear.start_date ?? '1970-01-01'}T00:00`)
    .lte('debut', `${currentYear.end_date ?? '2999-12-31'}T23:59`)

  const { data: decisions } = slotIds.length > 0
    ? await supabase
        .from('absences_enseignants_seances')
        .select('absence_id, schedule_slot_id, seance_date, decision, remplacant_profile_id')
        .in('schedule_slot_id', slotIds)
    : { data: [] }

  // Noms des remplacants : un enseignant ne lit pas le profil d'un collegue
  // (RLS). Completes cote serveur pour les SEULS comptes deja lus dans les
  // decisions (donc de l'ecole), comme les noms d'enseignants plus haut.
  const idsRemplacants = [...new Set((decisions ?? []).map(d => d.remplacant_profile_id).filter((id): id is string => !!id))]
  const { data: profilsRemplacants } = idsRemplacants.length > 0
    ? await createAdminClient()
        .from('profiles')
        .select('id, first_name, last_name, civilite')
        .in('id', idsRemplacants)
    : { data: [] }
  const nomsProfils = Object.fromEntries((profilsRemplacants ?? []).map(p => [p.id, p]))

  return (
    <div className="h-full animate-fade-in">
      <EmploiDuTempsClient
        absencesEnseignants={absencesEnseignants ?? []}
        decisions={decisions ?? []}
        nomsProfils={nomsProfils}
        currentUserId={userId}
        currentUserName={`${profile?.last_name ?? ''} ${profile?.first_name ?? ''}`}
        role={role}
        canEdit={canEdit}
        schoolYearId={currentYear.id}
        classes={classes ?? []}
        teachers={teachers ?? []}
        slots={slots ?? []}
        exceptions={exceptions ?? []}
        rooms={rooms ?? []}
        coursList={coursList ?? []}
        ueList={ueList ?? []}
        todayValidations={todayValidations ?? []}
        weekStartDay={etablissement?.week_start_day ?? 1}
        workingDays={etablissement?.working_days ?? 5}
        schoolYearStartDate={currentYear.start_date ?? null}
        schoolYearEndDate={currentYear.end_date ?? null}
        vacations={currentYear.vacations ?? []}
        feries={currentYear.jours_feries ?? []}
      />
    </div>
  )
}
