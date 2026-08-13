import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import TempsPresenceClient from '@/components/temps-presence/TempsPresenceClient'
import { effectiveRole } from '@/lib/auth/effective-role'

export default async function TempsPresencePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: initialMonth } = await searchParams
  const supabase = await createClient()
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''

  // Etablissement (en-tete de l'export PDF du recapitulatif)
  const { data: etab } = await supabase
    .from('etablissements')
    .select('nom, logo_url')
    .eq('id', etablissementId)
    .maybeSingle()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name, etablissement_id')
    .eq('id', userId)
    .single()

  const role = effectiveRole(profile) ?? 'enseignant'
  // VOIR et SAISIR sont deux droits distincts, et les confondre etait le defaut :
  // le comptable doit tout LIRE (il analyse les couts) sans rien SAISIR, et
  // l'enseignant ne saisit pas du tout ici — il valide depuis l'emploi du temps.
  // Les deux listes sont calquees sur la RLS (`add-role-checks-to-time-tracking`).
  const canSeeAll = ['admin', 'direction', 'comptable', 'secretaire', 'responsable_pedagogique'].includes(role)
  const canWriteAll = ['admin', 'direction', 'secretaire'].includes(role)
  // enseignant inclus : il voit un recap de SES propres saisies (avec ses couts).
  const canSeeRecap = ['admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant'].includes(role)

  // Annee scolaire courante (dates = perimetre du recap annuel)
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date, vacations, jours_feries')
    .eq('is_current', true)
    .maybeSingle()

  // ── Creneaux de l'annee, pour designer un remplacant PAR CRENEAU ─────────
  //
  // Charges ici plutot qu'a l'ouverture de la modale : quelques lignes, et une
  // requete par ouverture rendrait le champ « Remplace par » vide le temps de
  // l'aller-retour, juste au moment ou on le regarde.
  const { data: slots } = currentYear
    ? await supabase
        .from('schedule_slots')
        .select('id, class_id, teacher_id, day_of_week, start_time, end_time, slot_type, is_recurring, slot_date, effective_from, effective_until, is_active')
        .eq('school_year_id', currentYear.id)
        .eq('is_active', true)
    : { data: [] }

  const { data: exceptions } = slots?.length
    ? await supabase
        .from('schedule_exceptions')
        .select('schedule_slot_id, exception_date, exception_type, override_teacher_id')
        .in('schedule_slot_id', slots.map(s => s.id))
    : { data: [] }

  const { data: classes } = currentYear
    ? await supabase.from('classes').select('id, name').eq('academic_year', currentYear.label)
    : { data: [] }
  const classesById = Object.fromEntries((classes ?? []).map(c => [c.id, c.name]))

  // `teachers.id` et non `profile_id` : c'est ce que portent `schedule_slots`
  // et `schedule_exceptions`. Le lien vers le compte passe par `user_id`.
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, user_id, first_name, last_name, civilite')
    .eq('is_active', true)
    .order('last_name')

  // Liste des membres pointables (profiles actifs). Exclus : parent, super_admin
  // et admin (l'admin gere le suivi mais ne pointe pas son propre temps).
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .not('role', 'in', '("parent","super_admin","admin")')
    .eq('is_active', true)
    .order('last_name')
    .order('first_name')

  // Types de presence actifs de l'annee en cours (etablissement via RLS)
  let presenceTypes: { id: string; label: string; code: string; color: string; is_absence: boolean }[] = []
  if (currentYear) {
    const { data } = await supabase
      .from('presence_types')
      .select('id, label, code, color, is_absence, reserved_kind')
      .eq('is_active', true)
      .eq('school_year_id', currentYear.id)
      .order('order_index')
      .order('label')
    presenceTypes = (data ?? []) as typeof presenceTypes
  }

  // Taux par type de presence pour l'annee en cours
  let presenceTypeRates: { presence_type_id: string; rate: number }[] = []
  if (currentYear) {
    const { data } = await supabase
      .from('presence_type_rates')
      .select('presence_type_id, rate')
      .eq('school_year_id', currentYear.id)
    presenceTypeRates = (data ?? []) as { presence_type_id: string; rate: number }[]
  }

  return (
    <div className="h-full animate-fade-in">
      <TempsPresenceClient
        currentUserId={userId}
        currentUserName={`${profile?.last_name ?? ''} ${profile?.first_name ?? ''}`}
        role={role}
        canSeeAll={canSeeAll}
        canWriteAll={canWriteAll}
        canSeeRecap={canSeeRecap}
        staffList={(staffList ?? []) as any[]}
        presenceTypes={(presenceTypes ?? []) as any[]}
        slots={(slots ?? []) as never[]}
        exceptions={(exceptions ?? []) as never[]}
        classesById={classesById}
        teachers={(teachers ?? []) as never[]}
        vacations={(currentYear?.vacations as never[]) ?? []}
        feries={(currentYear?.jours_feries as never[]) ?? []}
        presenceTypeRates={presenceTypeRates}
        schoolYearId={currentYear?.id ?? null}
        schoolYearLabel={currentYear?.label ?? null}
        schoolYearStart={currentYear?.start_date ?? null}
        schoolYearEnd={currentYear?.end_date ?? null}
        initialMonth={initialMonth}
        etablissementNom={etab?.nom ?? 'Établissement'}
        etablissementLogo={etab?.logo_url ?? null}
      />
    </div>
  )
}
