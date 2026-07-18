import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import SentMessagesClient from '@/components/communications/SentMessagesClient'

export default async function CommunicationsPage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // Profil courant
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'

  // Messages envoyes
  let query = supabase
    .from('announcements')
    .select('id, title, announcement_type, target_class_id, channel, recipient_count, published_at, sent_at, published_by, profiles:published_by(first_name, last_name), classes:target_class_id(name, cotisation_types(label), class_teachers(is_main_teacher, teachers(civilite, first_name, last_name)))')
    .eq('etablissement_id', etablissementId)
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  // Enseignant : seulement ses propres messages
  if (role === 'enseignant') {
    query = query.eq('published_by', userId)
  }

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
