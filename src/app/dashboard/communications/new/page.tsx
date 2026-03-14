import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import NewMessageClient from '@/components/communications/NewMessageClient'

export default async function NewMessagePage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // 1. Profil courant
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, email, first_name, last_name')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'

  // 2. Annee scolaire en cours
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()

  const schoolYearId = schoolYear?.id ?? null
  const yearLabel = schoolYear?.label ?? null

  // 3. Classes (filtrées selon le rôle)
  type ClassRow = {
    id: string; name: string; level: string
    day_of_week: string | null; start_time: string | null; end_time: string | null
    main_teacher_name: string | null; main_teacher_civilite: string | null
    cotisation_label: string | null
  }
  let classes: ClassRow[] = []

  if (['admin', 'direction', 'responsable_pedagogique', 'secretaire', 'comptable'].includes(role)) {
    const query = supabase.from('classes').select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label)').order('name')
    if (yearLabel) query.eq('academic_year', yearLabel)
    const { data } = await query
    classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null, cotisation_label: c.cotisation_types?.label ?? null })) as ClassRow[]
  } else if (role === 'enseignant') {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (teacher) {
      const { data: assignments } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('teacher_id', teacher.id)

      const classIds = (assignments ?? []).map(a => a.class_id)
      if (classIds.length > 0) {
        const query = supabase.from('classes').select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label)').in('id', classIds).order('name')
        if (yearLabel) query.eq('academic_year', yearLabel)
        const { data } = await query
        classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null, cotisation_label: c.cotisation_types?.label ?? null })) as ClassRow[]
      }
    }
  }

  // 3b. Professeur principal de chaque classe
  if (classes.length > 0) {
    type CTRow = { class_id: string; teachers: { civilite: string | null; first_name: string; last_name: string } | null }
    const { data: mainTeacherRows } = await supabase
      .from('class_teachers')
      .select('class_id, teachers(civilite, first_name, last_name)')
      .eq('is_main_teacher', true)
      .in('class_id', classes.map(c => c.id)) as { data: CTRow[] | null }

    const teacherMap = new Map(
      (mainTeacherRows ?? []).map(ct => [
        ct.class_id,
        ct.teachers
          ? { name: `${ct.teachers.first_name} ${ct.teachers.last_name}`, civilite: ct.teachers.civilite }
          : null,
      ])
    )
    classes = classes.map(c => {
      const t = teacherMap.get(c.id)
      return { ...c, main_teacher_name: t?.name ?? null, main_teacher_civilite: t?.civilite ?? null }
    })
  }

  // 4. Parents avec emails (pour "parents choisis")
  type ParentRow = {
    id: string
    tutor1_last_name: string; tutor1_first_name: string; tutor1_email: string | null
    tutor2_last_name: string | null; tutor2_first_name: string | null; tutor2_email: string | null
  }

  let parents: ParentRow[] = []
  if (role === 'enseignant') {
    // Enseignant : parents de ses eleves uniquement
    const classIds = classes.map(c => c.id)
    if (classIds.length > 0) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('students(parent_id)')
        .in('class_id', classIds)
        .eq('status', 'active')

      const parentIds = [...new Set(
        ((enrollments ?? []) as any[])
          .map(e => e.students?.parent_id)
          .filter(Boolean)
      )]

      if (parentIds.length > 0) {
        const { data } = await supabase
          .from('parents')
          .select('id, tutor1_last_name, tutor1_first_name, tutor1_email, tutor2_last_name, tutor2_first_name, tutor2_email')
          .in('id', parentIds)
          .order('tutor1_last_name')
        parents = (data ?? []) as ParentRow[]
      }
    }
  } else {
    const { data } = await supabase
      .from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor1_email, tutor2_last_name, tutor2_first_name, tutor2_email')
      .order('tutor1_last_name')
    parents = (data ?? []) as ParentRow[]
  }

  // 5. Mapping classe → parent_ids (pour filtrer par classe cote client)
  type EnrollmentRow = { class_id: string; students: { parent_id: string | null } | null }
  let classParentMap: Record<string, string[]> = {}
  if (classes.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id, students(parent_id)')
      .in('class_id', classes.map(c => c.id))
      .eq('status', 'active')

    const map: Record<string, Set<string>> = {}
    for (const e of ((enrollments ?? []) as any[])) {
      const pid = e.students?.parent_id
      if (!pid) continue
      if (!map[e.class_id]) map[e.class_id] = new Set()
      map[e.class_id].add(pid)
    }
    for (const [cid, pids] of Object.entries(map)) {
      classParentMap[cid] = [...pids]
    }
  }

  // 6. Email(s) de la direction (pour CCI automatique)
  const { data: directionProfiles } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'direction')
    .eq('is_active', true)

  const directionEmails = (directionProfiles ?? []).map(p => p.email).filter(Boolean)

  return (
    <div className="space-y-4 animate-fade-in">
      <NewMessageClient
        role={role}
        senderEmail={profile?.email ?? ''}
        senderName={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()}
        classes={classes}
        parents={parents}
        classParentMap={classParentMap}
        directionEmails={directionEmails}
        etablissementId={etablissementId}
        schoolYearId={schoolYearId}
        yearLabel={yearLabel}
      />
    </div>
  )
}
