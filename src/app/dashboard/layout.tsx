import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/layout/DashboardNav'
import DashboardSidebar from '@/components/layout/DashboardSidebar'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import { getCachedProfile, getCachedEtablissement, getCachedCurrentYear } from '@/lib/cache/dashboard'


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

  // Garde-fou immédiat via JWT (pas besoin de requête DB)
  if (user.app_metadata?.role === 'super_admin') {
    redirect('/superadmin')
  }

  // Récupérer le profil + les infos établissement + année courante en parallèle
  // Ces requêtes sont cachées (1h pour le profil, 6h pour l'établissement, 24h pour l'année)
  const [profile, etablissement, currentYear] = await Promise.all([
    getCachedProfile(user.id),
    getCachedEtablissement(),
    getCachedCurrentYear(),
  ])

  // Compteur notifications non lues (staff) — pas caché (change fréquemment)
  const { count: staffUnread } = await supabase
    .from('announcement_staff_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .eq('is_read', false)

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
    <SidebarProvider>
      <div className="h-screen overflow-hidden bg-warm-50 flex">
        {/* Sidebar fixe à gauche */}
        <DashboardSidebar
          role={profile?.role}
          etablissementNom={etablissement?.nom ?? null}
          etablissementLogo={etablissement?.logo_url ?? null}
          anneeCourante={currentYear?.label ?? null}
        />

        {/* Zone droite : navbar + contenu */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardNav user={user} profile={profile} unreadNotifCount={unreadNotifCount} />
          <main className="flex-1 px-8 pt-5 pb-4 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
