import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile, getCurrentYear } from '@/lib/cache/dashboard'
import { chargerDonneesDirection } from '@/lib/dashboard/direction'
import { chargerDonneesEnseignant } from '@/lib/dashboard/enseignant'
import { chargerDonneesComptable } from '@/lib/dashboard/comptable'
import { chargerDonneesPedagogie } from '@/lib/dashboard/pedagogie'
import { chargerDonneesSecretaire } from '@/lib/dashboard/secretaire'
import { jourParis } from '@/lib/tenant/abonnement'
import { heureParis } from '@/lib/dates'
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
    // Client de SESSION (RLS : ecole + role). Voir `lib/dashboard/comptable.ts`.
    const donnees = await chargerDonneesComptable(supabase, currentYear, jourParis(new Date()))
    return <DashboardComptable {...common} donnees={donnees} />
  }

  // ══════════════════════════════════════════════════════════════════════
  //  RESPONSABLE PEDAGOGIQUE
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'responsable_pedagogique') {
    // Client de SESSION (RLS : ecole + role). Voir `lib/dashboard/pedagogie.ts`.
    const instant = new Date()
    const donnees = await chargerDonneesPedagogie(
      supabase, currentYear, currentPeriod?.id ?? null, jourParis(instant), heureParis(instant),
    )
    return <DashboardPedago {...common} donnees={donnees} />
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ENSEIGNANT
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'enseignant') {
    // Client de SESSION ; les seances sont filtrees sur l'enseignant connecte
    // (la RLS lui ouvre l'EDT de toute l'ecole). Voir `lib/dashboard/enseignant.ts`.
    const instant = new Date()
    const donnees = await chargerDonneesEnseignant(
      supabase, userId, currentYear, currentPeriod?.id ?? null, jourParis(instant), heureParis(instant),
    )
    return <DashboardEnseignant {...common} donnees={donnees} />
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECRETAIRE
  // ══════════════════════════════════════════════════════════════════════
  if (role === 'secretaire') {
    // Client de SESSION (RLS : ecole + role). Voir `lib/dashboard/secretaire.ts`.
    const instant = new Date()
    const donnees = await chargerDonneesSecretaire(
      supabase, currentYear, currentPeriod?.id ?? null, jourParis(instant), heureParis(instant),
    )
    return <DashboardSecretaire {...common} donnees={donnees} />
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
