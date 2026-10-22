import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ConsoleBarre from '@/components/superadmin/ConsoleBarre'
import SingleTabGuard from '@/components/layout/SingleTabGuard'
import { expirerSiDepassee } from '@/lib/support/intervention'

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
    .select('role, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    redirect('/superadmin/login')
  }

  // Une intervention de support qui a depasse sa duree est refermee (et
  // l'editeur detache) des l'ouverture de la console, sans attendre la tache
  // planifiee de la base (toutes les 5 min) : l'ecran dit tout de suite la verite.
  await expirerSiDepassee(user.id)

  // Pour la recherche globale de la barre du haut : quelques dizaines de lignes
  // au plus, chargees une fois par page plutot qu'un appel a chaque frappe.
  const { data: ecoles } = await admin
    .from('etablissements')
    .select('id, nom, slug')
    .order('nom', { ascending: true })

  return (
    <SingleTabGuard>
    <div className="h-screen overflow-hidden bg-[var(--surface-page)] flex flex-col">
      {/* NOM Prénom, et non l'adresse : c'est l'identité, pas un identifiant
          technique — et l'ordre est celui de toute l'application. */}
      <ConsoleBarre
        nom={`${profile.last_name ?? ''} ${profile.first_name ?? ''}`.trim()}
        ecoles={(ecoles ?? []).map(e => ({ id: e.id, nom: e.nom ?? '', slug: e.slug ?? '' }))}
      />
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-10">
        {children}
      </main>
    </div>
    </SingleTabGuard>
  )
}
