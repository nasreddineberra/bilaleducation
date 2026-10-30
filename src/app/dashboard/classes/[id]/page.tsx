import { nomEnseignant } from '@/lib/teachers/nom'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ClassForm from '@/components/classes/ClassForm'
import type { AssignmentData, SeanceRemplacee } from '@/components/classes/ClassForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditClassPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: cls },
    { data: classTeachers },
    { data: schoolYears },
    { data: teachers },
    { data: currentYearRow },
    { data: rooms },
    { data: etablissement },
  ] = await Promise.all([
    supabase.from('classes').select('*').eq('id', id).single(),
    supabase
      .from('class_teachers')
      .select('teacher_id, is_main_teacher, subject, effective_from, effective_until, teachers ( first_name, last_name )')
      .eq('class_id', id),
    supabase
      .from('school_years')
      .select('*')
      .order('label', { ascending: false }),
    supabase
      .from('teachers')
      .select('id, first_name, last_name, employee_number, is_active')
      .eq('is_active', true)
      .order('last_name')
      .order('first_name'),
    supabase
      .from('school_years')
      .select('id, start_date, end_date, vacations')
      .eq('is_current', true)
      .single(),
    supabase
      .from('rooms')
      .select('id, name, capacity, room_type')
      .eq('is_available', true)
      .in('room_type', ['salle_cours', 'salle_informatique', 'salle_sport', 'autre'])
      .order('name'),
    supabase
      .from('etablissements')
      .select('week_start_day, working_days')
      .single(),
  ])

  // Matieres d'un cours : unites d'enseignement du referentiel, dans leur ordre.
  const { data: matieres } = await supabase
    .from('unites_enseignement')
    .select('id, nom_fr')
    .order('order_index', { nullsFirst: false })
    .order('nom_fr')

  const { data: cotisationTypes } = currentYearRow
    ? await supabase
        .from('cotisation_types')
        .select('*')
        .eq('school_year_id', currentYearRow.id)
        .order('order_index')
    : { data: [] }

  // Tous les créneaux récurrents actifs pour cette classe dans l'année en cours
  const { data: existingSlots } = currentYearRow
    ? await supabase
        .from('schedule_slots')
        .select('id, day_of_week, start_time, end_time, effective_from, effective_until, slot_type, unite_enseignement_id, libelle, room_id')
        .eq('class_id', id)
        .eq('school_year_id', currentYearRow.id)
        .eq('is_recurring', true)
        .eq('is_active', true)
        .order('effective_from', { ascending: true, nullsFirst: true })
    : { data: null }

  if (!cls) notFound()

  // ── Remplacements de la classe (lot 4) : seances remplacees ou annulees pour
  // une absence d'enseignant, du jour et a venir. Lues dans les decisions de la
  // page Absences enseignants, seul ecran qui les ecrit ; la fiche les montre.
  // Jour de PARIS (le serveur tourne en UTC).
  const aujourdhui = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
  const { data: decisions } = await supabase
    .from('absences_enseignants_seances')
    .select('absence_id, schedule_slot_id, seance_date, decision, remplacant_profile_id, schedule_slots!inner(class_id, start_time, end_time)')
    .eq('schedule_slots.class_id', id)
    .gte('seance_date', aujourdhui)
    .order('seance_date')
  const remplacantsIds = Array.from(new Set((decisions ?? []).map(d => d.remplacant_profile_id).filter((x): x is string => !!x)))
  const { data: remplacants } = remplacantsIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', remplacantsIds)
    : { data: [] }
  const nomRemplacant = new Map((remplacants ?? []).map(p => [p.id, `${p.last_name ?? ''} ${p.first_name ?? ''}`.trim()]))
  const seancesRemplacees: SeanceRemplacee[] = (decisions ?? [])
    .map(d => ({
      absenceId: d.absence_id,
      slotId: d.schedule_slot_id,
      date: d.seance_date,
      start: d.schedule_slots.start_time.slice(0, 5),
      end: d.schedule_slots.end_time.slice(0, 5),
      decision: d.decision,
      remplacant: d.remplacant_profile_id ? (nomRemplacant.get(d.remplacant_profile_id) ?? null) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))

  const initialAssignments: AssignmentData[] = (classTeachers ?? []).map(ct => ({
    teacher_id:      ct.teacher_id,
    teacher_name:    ct.teachers ? nomEnseignant(ct.teachers) : ct.teacher_id,
    is_main_teacher: ct.is_main_teacher,
    subject:         ct.subject ?? '',
    effective_from:  ct.effective_from,
    effective_until: ct.effective_until,
  }))

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/classes"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <ClassForm
        key={cls.updated_at}
        cls={cls}
        initialAssignments={initialAssignments}
        schoolYears={schoolYears ?? []}
        teachers={teachers ?? []}
        cotisationTypes={cotisationTypes ?? []}
        rooms={rooms ?? []}
        currentSchoolYear={currentYearRow}
        existingSlots={existingSlots ?? []}
        matieres={matieres ?? []}
        weekStartDay={etablissement?.week_start_day ?? 1}
        workingDays={etablissement?.working_days ?? 5}
        seancesRemplacees={seancesRemplacees}
      />

    </div>
  )
}
