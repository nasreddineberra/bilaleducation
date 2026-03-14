import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import StaffMessageClient from '@/components/communications/StaffMessageClient'

export default async function StaffMessagePage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // Profil courant
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, email, first_name, last_name')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'

  // Membres du staff (sauf le sender lui-meme)
  const { data: staffMembers } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('is_active', true)
    .neq('id', userId)
    .neq('role', 'parent')
    .order('last_name')

  // Email(s) de la direction
  const directionEmails = (staffMembers ?? [])
    .filter(s => s.role === 'direction')
    .map(s => s.email)

  return (
    <div className="space-y-4 animate-fade-in">
      <StaffMessageClient
        role={role}
        senderEmail={profile?.email ?? ''}
        senderName={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()}
        staffMembers={(staffMembers ?? []) as any[]}
        directionEmails={directionEmails}
        etablissementId={etablissementId}
      />
    </div>
  )
}
