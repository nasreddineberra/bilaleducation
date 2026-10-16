import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile, getCurrentYear } from '@/lib/cache/dashboard'
import { chargerDonneesDirection } from '@/lib/dashboard/direction'
import { jourParis } from '@/lib/tenant/abonnement'
import { heureParis } from '@/lib/dates'
import { getFamilyFinancials } from '@/lib/financements/family-financials'
import { getPeriodHint } from '@/lib/school-year/current-period-hint'
import { effectiveRole } from '@/lib/auth/effective-role'
import DashboardAdmin from '@/components/dashboard/DashboardAdmin'
import DashboardComptable from '@/components/dashboard/DashboardComptable'
import DashboardPedago from '@/components/dashboard/DashboardPedago'
import DashboardEnseignant from '@/components/dashboard/DashboardEnseignant'
import DashboardSecretaire from '@/components/dashboard/DashboardSecretaire'
import DashboardParent from '@/components/dashboard/DashboardParent'
import { libelleRole } from '@/lib/auth/role-labels'


/** Clé de date en composantes LOCALES (jamais `toISOString`, qui bascule en UTC
 *  et peut décaler la borne d'un jour). */
const todayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const todayKey = () => todayKeyOf(new Date())

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')
  const userId = user.id

  // Profil et année courante — données cachées
  const profileResults = await Promise.allSettled([
    getCachedProfile(userId),
    getCurrentYear(),
  ])

  const profile = profileResults[0].status === 'fulfilled' ? profileResults[0].value : null
  const currentYear = profileResults[1].status === 'fulfilled' ? profileResults[1].value : null

  if (profileResults[0].status === 'rejected') {
    console.error('[dashboard/page] Échec profil:', profileResults[0].reason)
  }
  if (profileResults[1].status === 'rejected') {
    console.error('[dashboard/page] Échec année scolaire:', profileResults[1].reason)
  }

  // `admin` pendant une intervention de support : aucune branche de cette page
  // ne connaît `super_admin`, l'éditeur tomberait sur le tableau de bord parent.
  const role = effectiveRole(profile) ?? 'parent'

  // ── Periode courante ─────────────────────────────────────────────────
  // Le flag `is_current` (feature « periode en cours ») prime ; repli sur la 1re.
  const { data: periodRows } = currentYear
    ? await supabase
        .from('periods')
        .select('id, label, is_current, order_index')
        .eq('school_year_id', currentYear.id)
        .order('order_index', { ascending: true })
    : { data: null }
  const currentPeriod = (periodRows ?? []).find((p: any) => p.is_current) ?? (periodRows ?? [])[0] ?? null

  // ── Notifications non lues ───────────────────────────────────────────
  // « email seul » exclu de la cloche in-app (jointure inner + filtre canal).
  const { count: staffUnread } = await supabase
    .from('announcement_staff_recipients')
    .select('id, announcements!inner(channel)', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .eq('is_read', false)
    .neq('announcements.channel', 'email')

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
  // `is_read = false` porté DANS la requête : la liste prenait les 3 plus
  // récentes toutes confondues, puis le composant écartait les lues — le
  // bandeau annonçait donc un nombre et pouvait n'afficher aucune ligne.
  const { data: recentNotifsRaw } = await supabase
    .from('announcement_staff_recipients')
    .select('id, is_read, created_at, announcements!inner(id, title, channel, published_at, profiles:published_by(first_name, last_name))')
    .eq('profile_id', userId)
    .eq('is_read', false)
    .neq('announcements.channel', 'email')
    .order('created_at', { ascending: false })
    .limit(3)

  // Côté PARENT, les notifications vivent dans `announcement_recipients` (clé
  // parent_id) et non dans la table staff : le compteur les additionnait alors
  // que la liste ne les voyait jamais — bandeau « 3 non lues », aucune ligne.
  let parentRecent: any[] = []
  if (parentLink) {
    const { data } = await supabase
      .from('announcement_recipients')
      .select('id, is_read, created_at, announcements!inner(id, title, channel, published_at, profiles:published_by(first_name, last_name))')
      .eq('parent_id', parentLink.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(3)
    parentRecent = (data ?? []).map((n: any) => ({ ...n, recipientType: 'parent' }))
  }

  const recentNotifs = [
    ...((recentNotifsRaw ?? []) as any[]).map(n => ({ ...n, recipientType: 'staff' })),
    ...parentRecent,
  ]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 3)

  // ── Données communes ────────────────────────────────────────────────
  const common = {
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    role,
    roleLabel: libelleRole(role),
    yearLabel: currentYear?.label ?? '',
    periodLabel: currentPeriod?.label ?? '',
    unreadNotifs,
    recentNotifs,
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ADMIN / DIRECTION
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'admin' || role === 'direction') {
    // Toutes les lectures passent par le client de SESSION (RLS : ecole + role).
    // Voir `lib/dashboard/direction.ts`. « Aujourd'hui » et l'heure sont ceux
    // de PARIS : le serveur tourne en UTC.
    const instant = new Date()
    const donnees = await chargerDonneesDirection(
      supabase, currentYear, currentPeriod?.id ?? null, jourParis(instant), heureParis(instant),
    )

    return (
      <DashboardAdmin
        {...common}
        donnees={donnees}
        // Rappel de bascule de periode : l'action reste manuelle.
        periodHint={getPeriodHint((periodRows ?? []) as any[])}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  COMPTABLE
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'comptable') {
    // Bornes deja portees par `getCurrentYear` : plus de requete de rappel.
    const yearFull = currentYear

    const [financials, { data: recentPayments }] = await Promise.all([
      yearFull ? getFamilyFinancials(supabase, yearFull) : Promise.resolve(null),
      supabase.from('fee_installments').select('id, amount_paid, paid_date, payment_method, family_fees:family_fee_id(parents:parent_id(tutor1_last_name, tutor1_first_name))').eq('status', 'paid').order('paid_date', { ascending: false }).limit(6),
    ])

    const kpi = financials?.kpi ?? { billed: 0, collected: 0, outstanding: 0, overpaid: 0, counts: { pending: 0, partial: 0, paid: 0, overpaid: 0 }, rate: 0 }
    const topDebtors = (financials?.rows ?? [])
      .filter(r => r.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 8)

    return (
      <DashboardComptable
        {...common}
        stats={{
          billed: kpi.billed,
          collected: kpi.collected,
          outstanding: kpi.outstanding,
          overpaidCount: kpi.counts.overpaid,
          overpaidAmount: kpi.overpaid,
          // Familles n'ayant fait AUCUN paiement — meme definition que la ligne
          // « A traiter » du tableau de bord admin.
          pendingFamilies: kpi.counts.pending,
          rate: kpi.rate,
          totalFamilies: (financials?.rows ?? []).length,
          monthly: financials?.monthly ?? [],
          byMethod: financials?.byMethod ?? {},
          topDebtors,
          recentPayments: (recentPayments ?? []) as any[],
        }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  RESPONSABLE PEDAGOGIQUE
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'responsable_pedagogique') {
    const yearPeriodIds = (periodRows ?? []).map((p: any) => p.id)
    const currentPeriodId = currentPeriod?.id ?? null

    const [
      { count: classesCount },
      { count: evalsCount },
      { count: bulletinsCount },
      { data: recentEvals },
      { data: periodEvals },
    ] = await Promise.all([
      // Classes de l'ANNEE EN COURS : les deux cartes voisines (evaluations,
      // bulletins) etaient bornees a l'annee, celle-ci comptait toutes les
      // annees — a la rentree suivante elle aurait double.
      currentYear
        ? supabase.from('classes').select('id', { count: 'exact', head: true }).eq('academic_year', currentYear.label)
        : Promise.resolve({ count: 0 }),
      yearPeriodIds.length > 0
        ? supabase.from('evaluations').select('id', { count: 'exact', head: true }).in('period_id', yearPeriodIds)
        : Promise.resolve({ count: 0 }),
      yearPeriodIds.length > 0
        ? supabase.from('bulletin_archives').select('id', { count: 'exact', head: true }).in('period_id', yearPeriodIds)
        : Promise.resolve({ count: 0 }),
      supabase.from('evaluations').select('id, title, evaluation_date, classes:class_id(name)').order('evaluation_date', { ascending: false }).limit(5),
      currentPeriodId
        ? supabase.from('evaluations').select('id, title, classes:class_id(name)').eq('period_id', currentPeriodId)
        : Promise.resolve({ data: [] }),
    ])

    // « A finaliser » : evaluations de la periode en cours SANS aucune note.
    const pEvals = (((periodEvals as any).data ?? []) as any[])
    let evalsWithoutGrades: any[] = []
    if (pEvals.length > 0) {
      const ids = pEvals.map(e => e.id)
      const { data: gradeRows } = await supabase.from('grades').select('evaluation_id').in('evaluation_id', ids)
      const graded = new Set((gradeRows ?? []).map((g: any) => g.evaluation_id))
      evalsWithoutGrades = pEvals.filter(e => !graded.has(e.id))
    }

    return (
      <DashboardPedago
        {...common}
        stats={{
          classesCount: classesCount ?? 0,
          evalsCount: evalsCount ?? 0,
          bulletinsCount: bulletinsCount ?? 0,
          recentEvals: (recentEvals ?? []) as any[],
          evalsWithoutGrades: evalsWithoutGrades as any[],
        }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ENSEIGNANT
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'enseignant') {
    // Resolution FIABLE : par user_id (et non par email, qui peut diverger).
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    const teacherId = teacher?.id
    const today = todayKey()
    const todayDow = new Date().getDay() // 0=dimanche … 6=samedi (comme schedule_slots)

    let myClasses: any[] = []
    let myStudentsCount = 0
    let absencesToday = 0
    let recentAbsences: any[] = []
    let todaySlots: any[] = []

    if (teacherId) {
      // Classes ou je suis affecte AUJOURD'HUI (titulaire ou remplacant).
      // Classes de l'ANNEE EN COURS (`classes!inner`) : une affectation ancienne
      // restee ouverte (`effective_until` nul) ramenait sinon une classe de
      // l'annee passee. L'effectif n'est PLUS compte ici — voir plus bas.
      const { data: classTeachers } = currentYear
        ? await supabase
            .from('class_teachers')
            .select('class_id, is_main_teacher, effective_from, effective_until, classes!inner(id, name, level, academic_year)')
            .eq('teacher_id', teacherId)
            .eq('classes.academic_year', currentYear.label)
        : { data: [] }

      const activeCt = (classTeachers ?? []).filter((ct: any) =>
        (!ct.effective_from || ct.effective_from <= today) &&
        (!ct.effective_until || ct.effective_until >= today)
      )
      const myClassIds = [...new Set(activeCt.map((ct: any) => ct.class_id).filter(Boolean))]

      // Effectifs : memes regles que le tableau de bord admin — inscriptions
      // ACTIVES seulement, et les deux tables (une classe d'adultes affichait 0).
      const [teacherStudents, teacherAdults] = myClassIds.length > 0
        ? await Promise.all([
            supabase.from('enrollments').select('class_id').eq('status', 'active').in('class_id', myClassIds),
            supabase.from('parent_class_enrollments').select('class_id').eq('status', 'active').in('class_id', myClassIds),
          ])
        : [{ data: [] }, { data: [] }]

      const countByClass = [...(teacherStudents.data ?? []), ...(teacherAdults.data ?? [])]
        .reduce<Record<string, number>>((m, r: any) => (m[r.class_id] = (m[r.class_id] ?? 0) + 1, m), {})

      myClasses = activeCt.map((ct: any) => ({
        id: ct.classes?.id,
        name: ct.classes?.name,
        level: ct.classes?.level,
        isMain: ct.is_main_teacher,
        enrolled: countByClass[ct.class_id] ?? 0,
      }))
      myStudentsCount = myClasses.reduce((s, c) => s + c.enrolled, 0)

      if (myClassIds.length > 0) {
        const [{ data: slots }, { count: absToday }, { data: recentAbs }] = await Promise.all([
          // Emploi du temps du JOUR (creneaux recurrents de mes classes).
          supabase.from('schedule_slots')
            .select('id, class_id, start_time, end_time, slot_type, effective_from, effective_until, classes:class_id(name)')
            .in('class_id', myClassIds)
            .eq('day_of_week', todayDow)
            .eq('is_active', true)
            .eq('is_recurring', true)
            .order('start_time'),
          supabase.from('absences').select('id', { count: 'exact', head: true })
            .neq('absence_type', 'retard').eq('absence_date', today).in('class_id', myClassIds),
          supabase.from('absences').select('id, absence_date, absence_type, students:student_id(id, first_name, last_name), classes:class_id(name, level, day_of_week, start_time, end_time, cotisation_types(label), class_teachers(is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name)))')
            .neq('absence_type', 'retard').in('class_id', myClassIds).order('absence_date', { ascending: false }).limit(5),
        ])

        // Fenetre d'effet filtree cote JS : null = borne ouverte (from <= today <= until).
        todaySlots = ((slots ?? []) as any[])
          .filter((s: any) => (!s.effective_from || s.effective_from <= today) && (!s.effective_until || s.effective_until >= today))
          .map((s: any) => ({
            id: s.id, classId: s.class_id, className: s.classes?.name,
            start: s.start_time, end: s.end_time, slotType: s.slot_type,
          }))
        absencesToday = absToday ?? 0
        recentAbsences = (recentAbs ?? []) as any[]
      }
    }

    return (
      <DashboardEnseignant
        {...common}
        stats={{ myClasses, myStudentsCount, absencesToday, recentAbsences, todaySlots }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECRETAIRE
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'secretaire') {
    // Bornes du mois en composantes LOCALES : `toISOString()` bascule en UTC et
    // decale la borne d'un jour sur un fuseau negatif. Borne HAUTE ajoutee, sans
    // quoi une inscription datee dans le futur comptait pour « ce mois ».
    const now = new Date()
    const thisMonth = todayKeyOf(new Date(now.getFullYear(), now.getMonth(), 1))
    const nextMonth = todayKeyOf(new Date(now.getFullYear(), now.getMonth() + 1, 1))

    const [
      { count: studentsActive },
      { count: parentsCount },
      { count: teachersCount },
      { count: enrollmentsThisMonth },
      { count: adultEnrollmentsThisMonth },
      { data: recentStudents },
    ] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('parents').select('id', { count: 'exact', head: true }),
      supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      // Les DEUX tables d'inscription : une inscription d'adulte est une
      // inscription, et ne comptait pas jusqu'ici.
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('enrollment_date', thisMonth).lt('enrollment_date', nextMonth),
      supabase.from('parent_class_enrollments').select('id', { count: 'exact', head: true }).gte('enrollment_date', thisMonth).lt('enrollment_date', nextMonth),
      supabase.from('students').select('id, first_name, last_name, student_number, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(6),
    ])

    return (
      <DashboardSecretaire
        {...common}
        stats={{
          studentsActive: studentsActive ?? 0,
          parentsCount: parentsCount ?? 0,
          teachersCount: teachersCount ?? 0,
          enrollmentsThisMonth: (enrollmentsThisMonth ?? 0) + (adultEnrollmentsThisMonth ?? 0),
          recentStudents: (recentStudents ?? []) as any[],
        }}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PARENT (dormant en V1) ou fallback
  // ══════════════════════════════════════════════════════════════════════
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
      // `!inner` OBLIGATOIRE : un filtre sur une ressource imbriquée est
      // IGNORÉ par PostgREST sans jointure interne. Mesuré avant correction :
      // 12 notes renvoyées au lieu de 3 — celles des enfants d'autres familles.
      supabase.from('grades').select('id, score, evaluations:evaluation_id(title, max_score, evaluation_date), students:student_id!inner(first_name, last_name, parent_id)').eq('students.parent_id', parentLink.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('absences').select('id, absence_date, absence_type, is_justified, students:student_id!inner(first_name, last_name, parent_id)').neq('absence_type', 'retard').eq('students.parent_id', parentLink.id).order('absence_date', { ascending: false }).limit(5),
      supabase.from('family_fees').select('id, total_due, status').eq('parent_id', parentLink.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    children = (students ?? []) as any[]
    childGrades = (grades ?? []) as any[]
    childAbsences = (absences ?? []) as any[]
    familyFee = fee
  }

  let upcomingHomework: any[] = []
  if (children.length > 0) {
    const childClassIds = [...new Set(children.flatMap((c: any) => c.enrollments?.map((e: any) => e.class_id) ?? []))]
    if (childClassIds.length > 0) {
      const today = todayKey()
      const { data: hw } = await supabase
        .from('homework')
        .select('id, title, homework_type, due_date, subject, classes:class_id(name)')
        .in('class_id', childClassIds)
        .gte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(5)
      upcomingHomework = (hw ?? []) as any[]
    }
  }

  return (
    <DashboardParent
      {...common}
      stats={{
        children,
        recentGrades: childGrades,
        recentAbsences: childAbsences,
        familyFee,
        upcomingHomework,
      }}
    />
  )
}
