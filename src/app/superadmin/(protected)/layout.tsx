import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SuperAdminSidebar from '@/components/superadmin/SuperAdminSidebar'

export default async function SuperAdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/superadmin/login')
  }

  // Vérifier le rôle super_admin via le profil
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    redirect('/superadmin/login')
  }

  return (
    <div className="h-screen overflow-hidden bg-warm-50 flex">
      <SuperAdminSidebar email={user.email} />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}
