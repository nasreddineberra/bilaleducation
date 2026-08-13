import { createClient } from '@/lib/supabase/server'
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
    .select('id, name, level, room_id, day_of_week, start_time, end_time, teaching_mode, class_teachers(teacher_id, is_main_teacher, subject, teachers(id, first_name, last_name, civilite)), cotisation_types(label)')
    .eq('academic_year', currentYear.label)
    .order('name')

  // Enseignants actifs
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, first_name, last_name, civilite, user_id')
    .eq('is_active', true)
    .order('last_name')

  // Créneaux de l'année en cours
  const { data: slots } = await supabase
    .from('schedule_slots')
    .select('*, classes(name), teachers(first_name, last_name, civilite), cours(nom_fr), rooms(name)')
    .eq('school_year_id', currentYear.id)
    .eq('is_active', true)
    .order('start_time')

  // Types de présence RÉSERVÉS de l'année : correspondance slot_type ('cours'/'activite')
  // → code réel du type (ex. 'CRS'/'ACT') écrit dans staff_time_entries à la validation.
  const { data: reservedPresenceTypes } = await supabase
    .from('presence_types')
    .select('code, reserved_kind')
    .eq('school_year_id', currentYear.id)
    .not('reserved_kind', 'is', null)

  // Exceptions — limitées aux créneaux de l'année en cours (évite le sur-fetch)
  const slotIds = (slots ?? []).map((s: { id: string }) => s.id)
  const { data: exceptions } = slotIds.length > 0
    ? await supabase.from('schedule_exceptions').select('*').in('schedule_slot_id', slotIds)
    : { data: [] as unknown[] }

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

  // ── Absences du personnel ────────────────────────────────────────────────
  //
  // L'emploi du temps ignorait totalement le temps de presence : un enseignant
  // marque absent voyait son creneau ET son bouton de validation. Il pouvait
  // donc valider un cours qu'il n'avait pas assure — la base le refuse
  // desormais (`guard-presence-absence-exclusivity`), mais un refus qui tombe
  // APRES le clic est une mauvaise reponse. On charge donc les absences pour
  // l'annoncer AVANT.
  //
  // Bornees a l'annee : quelques lignes, et la vue ne sort jamais de cette
  // fenetre. Les codes d'absence sont lus depuis `presence_types` plutot
  // qu'ecrits en dur — le code d'un type est parametrable par etablissement.
  const { data: typesAbsence } = await supabase
    .from('presence_types')
    .select('code')
    .eq('school_year_id', currentYear.id)
    .eq('is_absence', true)

  const codesAbsence = (typesAbsence ?? []).map(t => t.code)

  const { data: absences } = codesAbsence.length
    ? await supabase
        .from('staff_time_entries')
        .select('profile_id, entry_date, absence_period')
        .in('entry_type', codesAbsence)
        .gte('entry_date', currentYear.start_date)
        .lte('entry_date', currentYear.end_date)
    : { data: [] }

  return (
    <div className="h-full animate-fade-in">
      <EmploiDuTempsClient
        absences={(absences ?? []) as never[]}
        currentUserId={userId}
        currentUserName={`${profile?.last_name ?? ''} ${profile?.first_name ?? ''}`}
        role={role}
        canEdit={canEdit}
        schoolYearId={currentYear.id}
        classes={(classes ?? []) as any[]}
        teachers={(teachers ?? []) as any[]}
        slots={(slots ?? []) as any[]}
        exceptions={(exceptions ?? []) as any[]}
        rooms={(rooms ?? []) as any[]}
        coursList={(coursList ?? []) as any[]}
        ueList={(ueList ?? []) as any[]}
        todayValidations={(todayValidations ?? []) as any[]}
        reservedPresenceTypes={(reservedPresenceTypes ?? []) as any[]}
        weekStartDay={etablissement?.week_start_day ?? 1}
        workingDays={etablissement?.working_days ?? 5}
        schoolYearStartDate={currentYear.start_date ?? null}
        schoolYearEndDate={currentYear.end_date ?? null}
        vacations={(currentYear.vacations as any[]) ?? []}
        feries={(currentYear.jours_feries as any[]) ?? []}
      />
    </div>
  )
}
