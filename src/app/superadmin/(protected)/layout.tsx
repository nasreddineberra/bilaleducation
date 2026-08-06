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

  // Rôle vérifié sur la COLONNE BRUTE, et cela doit le rester : pendant une
  // intervention de support le rôle effectif vaut `admin`, et traduire ici
  // fermerait la console à l'éditeur au moment précis où elle est sa seule
  // sortie. Le rôle en base est l'identité, le rôle effectif un costume.
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
