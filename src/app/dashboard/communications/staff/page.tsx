import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { hasSmtpConfig } from '@/lib/email'
import { buildSignatureHtml } from '@/lib/communications/signature'
import StaffMessageClient from '@/components/communications/StaffMessageClient'

// Communication interne = encadrement (tout staff SAUF enseignant). Le comptable
// ecrit (paie / sujets comptables) ; l'enseignant reste destinataire.
const STAFF_SEND_ROLES = ['admin', 'direction', 'secretaire', 'responsable_pedagogique', 'comptable']

export default async function StaffMessagePage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? ''
  if (!STAFF_SEND_ROLES.includes(role)) redirect('/dashboard/communications')

  // Membres du staff pointables (hors soi, hors parent/super_admin).
  const { data: staffMembers } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('is_active', true)
    .neq('id', user.id)
    .not('role', 'in', '(parent,super_admin)')
    .order('last_name')

  const smtpConfigured = etablissementId ? await hasSmtpConfig(etablissementId) : false

  // Signature auto (editable) ajoutee au corps : Cordialement + coordonnees.
  const { data: etab } = await supabase
    .from('etablissements')
    .select('nom, contact, adresse, telephone')
    .eq('id', etablissementId)
    .single()
  const signatureHtml = buildSignatureHtml(etab)

  return (
    <div className="animate-fade-in">
      <StaffMessageClient
        role={role}
        staffMembers={(staffMembers ?? []) as any[]}
        etablissementId={etablissementId}
        smtpConfigured={smtpConfigured}
        signatureHtml={signatureHtml}
      />
    </div>
  )
}
