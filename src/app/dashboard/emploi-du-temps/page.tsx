import { createClient } from '@/lib/supabase/server'
import EmploiDuTempsClient from '@/components/emploi-du-temps/EmploiDuTempsClient'

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
  const canEdit = ['admin', 'direction', 'responsable_pedagogique'].includes(role)

  // Annee scolaire courante
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label')
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
    .select('id, name, level, room_id, day_of_week, start_time, end_time, class_teachers(teacher_id, is_main_teacher, teachers(id, first_name, last_name, civilite)), cotisation_types(label)')
    .eq('academic_year', currentYear.label)
    .order('name')

  // Enseignants actifs
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, first_name, last_name, civilite')
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
    .select('id, nom_fr, unite_enseignement_id, unites_enseignement(nom_fr)')
    .order('nom_fr')

  // Validations du jour
  const today = new Date().toISOString().split('T')[0]
  const { data: todayValidations } = await supabase
    .from('schedule_validations')
    .select('id, schedule_slot_id, profile_id, validation_date, time_entry_id')
    .eq('validation_date', today)

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
        todayValidations={(todayValidations ?? []) as any[]}
      />
    </div>
  )
}
