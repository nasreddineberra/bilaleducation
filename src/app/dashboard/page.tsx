import { createClient } from '@/lib/supabase/server'
import DashboardAdmin from '@/components/dashboard/DashboardAdmin'
import DashboardComptable from '@/components/dashboard/DashboardComptable'
import DashboardPedago from '@/components/dashboard/DashboardPedago'
import DashboardEnseignant from '@/components/dashboard/DashboardEnseignant'
import DashboardSecretaire from '@/components/dashboard/DashboardSecretaire'
import DashboardParent from '@/components/dashboard/DashboardParent'

const roleLabel: Record<string, string> = {
  admin: 'Administrateur',
  direction: 'Direction',
  comptable: 'Comptable',
  responsable_pedagogique: 'Responsable Pedagogique',
  enseignant: 'Enseignant',
  secretaire: 'Secretaire',
  parent: 'Parent',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'parent'

  // ── Annee scolaire courante ──────────────────────────────────────────
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .maybeSingle()

  // ── Periode courante ─────────────────────────────────────────────────
  const { data: currentPeriod } = currentYear
    ? await supabase
        .from('periods')
        .select('id, label')
        .eq('school_year_id', currentYear.id)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null }

  // ── Notifications non lues ───────────────────────────────────────────
  const { count: staffUnread } = await supabase
    .from('announcement_staff_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .eq('is_read', false)

  const { data: parentLink } = await supabase
    .from('parents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  let parentUnreadCount = 0
  if (parentLink) {
    const { count } = await supabase
      .from('announcement_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentLink.id)
      .eq('is_read', false)
    parentUnreadCount = count ?? 0
  }

  const unreadNotifs = (staffUnread ?? 0) + parentUnreadCount

  // ── Dernières notifications ──────────────────────────────────────────
  const { data: recentNotifsRaw } = await supabase
    .from('announcement_staff_recipients')
    .select('id, is_read, created_at, announcements:announcement_id(id, title, published_at, profiles:published_by(first_name, last_name))')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(3)

  const recentNotifs = (recentNotifsRaw ?? []) as any[]

  // ── Données communes ────────────────────────────────────────────────
  const common = {
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    role,
    roleLabel: roleLabel[role] ?? role,
    yearLabel: currentYear?.label ?? '',
    periodLabel: currentPeriod?.label ?? '',
    unreadNotifs,
    recentNotifs,
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ADMIN / DIRECTION
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'admin' || role === 'direction') {
    const [
      { count: studentsActive },
      { count: studentsTotal },
      { count: teachersActive },
      { count: classesCount },
      { count: enrollmentsActive },
      { count: parentsCount },
      { count: absencesThisMonth },
      { count: absencesUnjustified },
      { data: classesList },
      { data: familyFees },
      { data: recentAbsences },
      { count: msgSentThisMonth },
      { count: msgReadCount },
      { count: msgTotalRecipients },
    ] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('parents').select('id', { count: 'exact', head: true }),
      supabase.from('absences').select('id', { count: 'exact', head: true }).gte('absence_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
      supabase.from('absences').select('id', { count: 'exact', head: true }).eq('is_justified', false).gte('absence_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
      supabase.from('classes').select('id, name, max_students, enrollments:enrollments(count)').order('name'),
      supabase.from('family_fees').select('id, status, total_due'),
      supabase.from('absences').select('id, absence_date, absence_type, is_justified, students:student_id(first_name, last_name), classes:class_id(name)').order('absence_date', { ascending: false }).limit(5),
      supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('is_published', true).gte('published_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from('announcement_recipients').select('id', { count: 'exact', head: true }).eq('is_read', true),
      supabase.from('announcement_recipients').select('id', { count: 'exact', head: true }),
    ])

    // Calcul financier
    const fees = (familyFees ?? []) as any[]
    const totalDue = fees.reduce((s: number, f: any) => s + Number(f.total_due || 0), 0)
    const feesByStatus = { pending: 0, partial: 0, paid: 0, overdue: 0, overpaid: 0 }
    fees.forEach((f: any) => { if (f.status in feesByStatus) (feesByStatus as any)[f.status]++ })

    // Effectifs par classe
    const classCapacity = (classesList ?? []).map((c: any) => ({
      name: c.name,
      enrolled: c.enrollments?.[0]?.count ?? 0,
      max: c.max_students ?? 30,
    }))

    return (
      <DashboardAdmin
        {...common}
        stats={{
          studentsActive: studentsActive ?? 0,
          studentsTotal: studentsTotal ?? 0,
          teachersActive: teachersActive ?? 0,
          classesCount: classesCount ?? 0,
          enrollmentsActive: enrollmentsActive ?? 0,
          parentsCount: parentsCount ?? 0,
          absencesThisMonth: absencesThisMonth ?? 0,
          absencesUnjustified: absencesUnjustified ?? 0,
          totalDue,
          feesByStatus,
          classCapacity,
          recentAbsences: (recentAbsences ?? []) as any[],
          msgSentThisMonth: msgSentThisMonth ?? 0,
          msgReadRate: msgTotalRecipients ? Math.round(((msgReadCount ?? 0) / msgTotalRecipients) * 100) : 0,
        }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  COMPTABLE
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'comptable') {
    const [
      { data: familyFees },
      { data: recentPayments },
    ] = await Promise.all([
      supabase.from('family_fees').select('id, status, total_due, parent_id, parents:parent_id(tutor1_last_name, tutor1_first_name)'),
      supabase.from('fee_installments').select('id, amount_paid, paid_date, payment_method, family_fees:family_fee_id(parents:parent_id(tutor1_last_name, tutor1_first_name))').eq('status', 'paid').order('paid_date', { ascending: false }).limit(5),
    ])

    const fees = (familyFees ?? []) as any[]
    const totalDue = fees.reduce((s: number, f: any) => s + Number(f.total_due || 0), 0)
    const feesByStatus = { pending: 0, partial: 0, paid: 0, overdue: 0, overpaid: 0 }
    fees.forEach((f: any) => { if (f.status in feesByStatus) (feesByStatus as any)[f.status]++ })
    const paidFees = fees.filter((f: any) => f.status === 'paid')
    const totalCollected = paidFees.reduce((s: number, f: any) => s + Number(f.total_due || 0), 0)
    const overdueFamilies = fees.filter((f: any) => f.status === 'overdue')

    return (
      <DashboardComptable
        {...common}
        stats={{
          totalDue,
          totalCollected,
          remaining: totalDue - totalCollected,
          familiesOverdue: overdueFamilies.length,
          feesByStatus,
          totalFamilies: fees.length,
          recentPayments: (recentPayments ?? []) as any[],
          overdueFamilies: overdueFamilies.slice(0, 5) as any[],
        }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  RESPONSABLE PEDAGOGIQUE
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'responsable_pedagogique') {
    const [
      { count: classesCount },
      { count: evalsCount },
      { count: bulletinsCount },
      { data: recentEvals },
    ] = await Promise.all([
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('evaluations').select('id', { count: 'exact', head: true }),
      supabase.from('bulletin_archives').select('id', { count: 'exact', head: true }),
      supabase.from('evaluations').select('id, title, evaluation_date, classes:class_id(name)').order('evaluation_date', { ascending: false }).limit(5),
    ])

    return (
      <DashboardPedago
        {...common}
        stats={{
          classesCount: classesCount ?? 0,
          evalsCount: evalsCount ?? 0,
          bulletinsCount: bulletinsCount ?? 0,
          recentEvals: (recentEvals ?? []) as any[],
        }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ENSEIGNANT
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'enseignant') {
    // Trouver le teacher_id correspondant au profil
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('email', profile?.email)
      .eq('is_active', true)
      .maybeSingle()

    const teacherId = teacher?.id

    let myClasses: any[] = []
    let myStudentsCount = 0
    let absencesToday = 0
    let recentAbsences: any[] = []

    if (teacherId) {
      const [
        { data: classTeachers },
        { data: absToday },
        { data: recentAbs },
      ] = await Promise.all([
        supabase.from('class_teachers').select('class_id, is_main_teacher, classes:class_id(id, name, level, schedules:schedules(day_of_week, start_time, end_time), enrollments:enrollments(count))').eq('teacher_id', teacherId),
        supabase.from('absences').select('id', { count: 'exact', head: true }).eq('absence_date', new Date().toISOString().slice(0, 10)),
        supabase.from('absences').select('id, absence_date, absence_type, students:student_id(first_name, last_name), classes:class_id(name)').order('absence_date', { ascending: false }).limit(5),
      ])

      myClasses = (classTeachers ?? []).map((ct: any) => ({
        id: ct.classes?.id,
        name: ct.classes?.name,
        level: ct.classes?.level,
        isMain: ct.is_main_teacher,
        enrolled: ct.classes?.enrollments?.[0]?.count ?? 0,
        schedule: ct.classes?.schedules?.[0] ?? null,
      }))

      myStudentsCount = myClasses.reduce((s, c) => s + c.enrolled, 0)
      absencesToday = absToday?.length ?? 0
      recentAbsences = (recentAbs ?? []) as any[]
    }

    return (
      <DashboardEnseignant
        {...common}
        stats={{
          myClasses,
          myStudentsCount,
          absencesToday,
          recentAbsences,
        }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECRETAIRE
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'secretaire') {
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

    const [
      { count: studentsActive },
      { count: parentsCount },
      { count: teachersCount },
      { count: enrollmentsThisMonth },
      { data: recentStudents },
    ] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('parents').select('id', { count: 'exact', head: true }),
      supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('enrollment_date', thisMonth),
      supabase.from('students').select('id, first_name, last_name, student_number, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(5),
    ])

    return (
      <DashboardSecretaire
        {...common}
        stats={{
          studentsActive: studentsActive ?? 0,
          parentsCount: parentsCount ?? 0,
          teachersCount: teachersCount ?? 0,
          enrollmentsThisMonth: enrollmentsThisMonth ?? 0,
          recentStudents: (recentStudents ?? []) as any[],
        }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PARENT
  // ══════════════════════════════════════════════════════════════════════
  // role === 'parent' ou fallback

  let children: any[] = []
  let childGrades: any[] = []
  let childAbsences: any[] = []
  let familyFee: any = null

  if (parentLink) {
    const [
      { data: students },
      { data: grades },
      { data: absences },
      { data: fee },
    ] = await Promise.all([
      supabase.from('students').select('id, first_name, last_name, gender, photo_url, enrollments:enrollments(class_id, classes:class_id(name))').eq('parent_id', parentLink.id).eq('is_active', true),
      supabase.from('grades').select('id, score, evaluations:evaluation_id(title, max_score, evaluation_date), students:student_id(first_name, last_name)').in('student_id', (await supabase.from('students').select('id').eq('parent_id', parentLink.id)).data?.map((s: any) => s.id) ?? []).order('created_at', { ascending: false }).limit(5),
      supabase.from('absences').select('id, absence_date, absence_type, is_justified, students:student_id(first_name, last_name)').in('student_id', (await supabase.from('students').select('id').eq('parent_id', parentLink.id)).data?.map((s: any) => s.id) ?? []).order('absence_date', { ascending: false }).limit(5),
      supabase.from('family_fees').select('id, total_due, status').eq('parent_id', parentLink.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    children = (students ?? []) as any[]
    childGrades = (grades ?? []) as any[]
    childAbsences = (absences ?? []) as any[]
    familyFee = fee
  }

  return (
    <DashboardParent
      {...common}
      stats={{
        children,
        recentGrades: childGrades,
        recentAbsences: childAbsences,
        familyFee,
      }}
    />
  )
}
