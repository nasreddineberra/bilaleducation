import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/layout/DashboardNav'
import DashboardSidebar from '@/components/layout/DashboardSidebar'
import { SidebarProvider } from '@/components/layout/SidebarContext'


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
  // RLS filtre automatiquement par etablissement_id du profil
  const [{ data: profile }, { data: etablissement }, { data: currentYear }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('etablissements').select('nom, logo_url').single(),
    supabase.from('school_years').select('label').eq('is_current', true).maybeSingle(),
  ])

  // Compteur notifications non lues (staff)
  const { count: staffUnread } = await supabase
    .from('announcement_staff_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .eq('is_read', false)

  // Compteur notifications non lues (parent)
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
