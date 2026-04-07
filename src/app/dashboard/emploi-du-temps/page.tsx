import { createClient } from '@/lib/supabase/server'
import dynamic from 'next/dynamic'

const EmploiDuTempsClient = dynamic(
  () => import('@/components/emploi-du-temps/EmploiDuTempsClient'),
  { loading: () => <div className="flex items-center justify-center h-96 text-warm-400">Chargement de l'emploi du temps…</div> },
)

export default async function EmploiDuTempsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'
  const canEdit = ['admin', 'direction', 'responsable_pedagogique', 'secretaire'].includes(role)

  // Annee scolaire courante
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date, vacations')
    .eq('is_current', true)
    .maybeSingle()

  if (!currentYear) {
    return (
      <div className="h-full flex items-center justify-center text-warm-400">
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

  // Exceptions
  const { data: exceptions } = await supabase
    .from('schedule_exceptions')
    .select('*')

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

  return (
    <div className="h-full animate-fade-in">
      <EmploiDuTempsClient
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
        weekStartDay={etablissement?.week_start_day ?? 1}
        workingDays={etablissement?.working_days ?? 5}
        schoolYearStartDate={currentYear.start_date ?? null}
        schoolYearEndDate={currentYear.end_date ?? null}
        vacations={(currentYear.vacations as any[]) ?? []}
      />
    </div>
  )
}
