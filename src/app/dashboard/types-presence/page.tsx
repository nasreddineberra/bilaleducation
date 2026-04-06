import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TypesPresenceClient from '@/components/types-presence/TypesPresenceClient'

export default async function TypesPresencePage() {
  const supabase = await createClient()

  // Réservé aux admin et direction
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'direction'].includes(profile?.role ?? '')) {
    redirect('/dashboard')
  }

  const { data: types } = await supabase
    .from('presence_types')
    .select('id, label, code, color, is_active, order_index')
    .order('order_index')
    .order('label')

  return (
    <div className="space-y-6 animate-fade-in">
      <TypesPresenceClient initialTypes={(types ?? []) as any[]} />
    </div>
  )
}
