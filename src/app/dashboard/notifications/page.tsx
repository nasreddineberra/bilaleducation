import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import NotificationsClient from '@/components/notifications/NotificationsClient'
import { effectiveRole } from '@/lib/auth/effective-role'
import { chargerNotifications } from '@/lib/communications/notifications'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', userId)
    .single()

  const role = effectiveRole(profile) ?? 'enseignant'

  // Annee en cours : nomme le ciblage « Parents {annee} » (aligne sur l'historique).
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('etablissement_id', etablissementId)
    .eq('is_current', true)
    .maybeSingle()

  // Annonces recues (equipe, foyer) et notifications automatiques
  // (`lib/communications/notifications.ts`).
  const { notifications, parentId } = await chargerNotifications(supabase, userId)

  return (
    <div className="space-y-4 animate-fade-in">
      <NotificationsClient notifications={notifications} role={role} parentId={parentId} yearLabel={currentYear?.label ?? null} />
    </div>
  )
}
