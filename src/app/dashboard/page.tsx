import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile, getCurrentYear } from '@/lib/cache/dashboard'
import { chargerDonneesDirection } from '@/lib/dashboard/direction'
import { chargerDonneesEnseignant } from '@/lib/dashboard/enseignant'
import { chargerDonneesComptable } from '@/lib/dashboard/comptable'
import { chargerDonneesPedagogie } from '@/lib/dashboard/pedagogie'
import { chargerDonneesSecretaire } from '@/lib/dashboard/secretaire'
import { chargerEnTete } from '@/lib/dashboard/commun'
import { chargerDonneesParent } from '@/lib/dashboard/parent'
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

  // Periode courante et notifications de l'en-tete (`lib/dashboard/commun.ts`).
  const { periodes, currentPeriod, parentId, unreadNotifs, recentNotifs } =
    await chargerEnTete(supabase, userId, currentYear?.id ?? null)

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
        periodHint={getPeriodHint(periodes)}
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
  // Lectures dans `lib/dashboard/parent.ts`. « Aujourd'hui » est celui de PARIS :
  // le serveur tourne en UTC.
  const stats = await chargerDonneesParent(supabase, parentId, currentYear?.label ?? null, jourParis(new Date()))

  return (
    <DashboardParent
      {...common}
      stats={stats}
    />
  )
}
