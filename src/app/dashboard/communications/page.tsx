import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import SentMessagesClient from '@/components/communications/SentMessagesClient'
import { effectiveRole } from '@/lib/auth/effective-role'

export default async function CommunicationsPage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // Profil courant
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', userId)
    .single()

  const role = effectiveRole(profile) ?? 'enseignant'

  // L'ENSEIGNANT N'A PLUS ACCES A CET ECRAN (decision du 24/09). Il n'ecrit ni
  // aux parents (il ne communique que les devoirs, par le cahier de texte) ni au
  // staff (decision du 16 juillet : l'envoi est reserve a l'encadrement, il
  // reste destinataire) : l'historique des envois ne lui montrait donc qu'une
  // liste VIDE, filtree sur `published_by = lui`. Le lien est retire de la barre
  // laterale, et la garde est posee ICI aussi — un ecran reste atteignable par
  // son adresse quand seul le lien disparait.
  //
  // Il continue de RECEVOIR les messages internes : ils arrivent dans la cloche
  // (`announcement_staff_recipients`), qui n'est pas touchee.
  if (role === 'enseignant') redirect('/dashboard')

  // Messages envoyes
  const query = supabase
    .from('announcements')
    .select('id, title, announcement_type, target_class_id, channel, recipient_count, published_at, sent_at, published_by, profiles:published_by(first_name, last_name), classes:target_class_id(name, cotisation_types(label), class_teachers(is_main_teacher, teachers(civilite, first_name, last_name)))')
    .eq('etablissement_id', etablissementId)
    .eq('is_published', true)
    .order('published_at', { ascending: false })


  const { data } = await query
  const messages = (data ?? []) as any[]

  // Annee en cours : libelle dynamique « Parents {annee} » (comme l'ecran d'envoi).
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('is_current', true)
    .single()

  return (
    <div className="space-y-4 animate-fade-in">
      <SentMessagesClient messages={messages} yearLabel={schoolYear?.label ?? null} />
    </div>
  )
}
