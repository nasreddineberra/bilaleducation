import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/layout/DashboardNav'
import DashboardSidebar from '@/components/layout/DashboardSidebar'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import { ThemeProvider } from '@/components/layout/ThemeContext'
import { getCachedProfile, getCachedEtablissement, getCurrentYear } from '@/lib/cache/dashboard'
import { headers } from 'next/headers'
import { effectiveRole, isSupportSession } from '@/lib/auth/effective-role'
import { consoleUrl } from '@/lib/tenant/console-url'


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Profil + établissement + année en cours, en parallèle.
  // Le profil (1 h) et l'établissement (6 h) sont cachés ; l'année scolaire ne
  // l'est PLUS — voir le commentaire de `getCurrentYear`.
  const results = await Promise.allSettled([
    getCachedProfile(user.id),
    getCurrentYear(),
  ])

  const profile = results[0].status === 'fulfilled' ? results[0].value : null
  const currentYear = results[1].status === 'fulfilled' ? results[1].value : null

  // L'établissement est désormais lu APRÈS le profil, qui en porte
  // l'identifiant : `getCachedEtablissement` ne fait plus de `.single()` sans
  // filtre. Séquentiel et non parallèle — c'est le prix du cloisonnement.
  // L'autorité est le PROFIL de l'utilisateur, pas l'en-tête de tenant posé par
  // le middleware, qui reflète l'URL et non l'identité.
  const etablissement = profile?.etablissement_id
    ? await getCachedEtablissement(profile.etablissement_id).catch(() => null)
    : null

  // ── Accès support de l'éditeur ─────────────────────────────────────────────
  //
  // Le super-admin n'appartient à aucune école. Pour dépanner un client il s'y
  // RATTACHE, et le rattachement se prend DEPUIS LA CONSOLE, jamais ici : ouvrir
  // une intervention est une écriture, elle doit invalider le cache du profil
  // (`updateTag`), ce qu'un rendu de page n'a pas le droit de faire. Sans cette
  // invalidation, le tableau de bord travaillerait une heure sur l'état d'avant.
  //
  // Ce layout ne fait donc que VÉRIFIER, et il vérifie contre le sous-domaine :
  // l'URL désigne l'école, le rattachement doit désigner la même. Tout écart —
  // aucune intervention ouverte, ou une intervention ouverte ailleurs — renvoie
  // à la console, seul endroit d'où l'on entre et d'où l'on sort.
  if (user.app_metadata?.role === 'super_admin') {
    const tenantId = (await headers()).get('x-etablissement-id')
    if (!profile?.etablissement_id || profile.etablissement_id !== tenantId) {
      // Adresse ABSOLUE : `/superadmin` n'existe pas sur le domaine d'une école,
      // le middleware l'y renvoie vers `/login` — et le super-admin retomberait
      // sur l'écran de connexion après s'être authentifié, ce qui ressemble à un
      // échec. C'est l'impasse déjà rencontrée, sous une autre forme.
      redirect(consoleUrl())
    }
  }

  // Le rôle d'AFFICHAGE : `admin` pendant une intervention, sans quoi la sidebar
  // et le tableau de bord ne connaîtraient pas `super_admin` et l'écran serait
  // vide alors que la base, elle, aurait tout ouvert. Voir `effectiveRole`.
  const displayRole = effectiveRole(profile)
  const supportEcole = isSupportSession(profile) ? (etablissement?.nom ?? 'cet établissement') : null

  // Log des échecs partiels (ne pas bloquer le rendu)
  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error(`[dashboard/layout] Échec requête ${i}:`, result.reason)
    }
  }

  // Compteur notifications non lues (staff) — pas caché (change fréquemment).
  // Les messages « email seul » (channel = 'email') n'apparaissent pas dans la
  // cloche in-app : jointure inner + filtre sur le canal de l'annonce.
  const { count: staffUnread } = await supabase
    .from('announcement_staff_recipients')
    .select('id, announcements!inner(channel)', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .eq('is_read', false)
    .neq('announcements.channel', 'email')

  // Compteur notifications non lues (parent) — pas caché
  const { data: parentLink } = await supabase
    .from('parents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  let parentUnread = 0
  if (parentLink) {
    const { count } = await supabase
      .from('announcement_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentLink.id)
      .eq('is_read', false)
    parentUnread = count ?? 0
  }

  const unreadNotifCount = (staffUnread ?? 0) + parentUnread

  return (
    <ThemeProvider initialTheme={profile?.theme === 'dark' ? 'dark' : 'light'}>
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[200] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-secondary-800 focus:text-white focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Aller au contenu
      </a>
      <div className="h-screen overflow-hidden bg-[var(--surface-page)] flex">
        {/* Sidebar fixe à gauche */}
        <DashboardSidebar
          role={displayRole}
          etablissementNom={etablissement?.nom ?? null}
          etablissementLogo={etablissement?.logo_url ?? null}
          anneeCourante={currentYear?.label ?? null}
        />

        {/* Zone droite : navbar + contenu */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardNav user={user} profile={profile} unreadNotifCount={unreadNotifCount} supportEcole={supportEcole} />
          <main id="main-content" tabIndex={-1} className="flex-1 px-8 pt-5 pb-4 overflow-y-auto outline-none">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </ThemeProvider>
  )
}
