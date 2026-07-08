'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

// Mise à jour de son propre profil (colonnes non sensibles uniquement).
// Client SESSION → RLS « update own profile » + trigger anti-escalade + audit tracé.
export async function updateOwnProfile(data: {
  civilite:   string | null
  first_name: string
  last_name:  string
  phone:      string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  if (!data.first_name.trim() || !data.last_name.trim()) {
    return { error: 'Le prénom et le nom sont obligatoires.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      civilite:   data.civilite,
      first_name: data.first_name.trim(),
      last_name:  data.last_name.trim(),
      phone:      data.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: 'Erreur lors de la mise à jour du profil.' }
  return {}
}

// Changement de son propre email — réservé admin/direction (pas de hiérarchie au-dessus).
// Changement direct (auth + profil), tracé via le client session.
export async function updateOwnEmail(newEmail: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || (me.role !== 'admin' && me.role !== 'direction')) {
    return { error: 'Seuls les rôles administration/direction peuvent changer eux-mêmes leur email.' }
  }

  const email = newEmail.trim()
  if (!isValidEmail(email)) return { error: 'Adresse email invalide.' }

  // 1. Compte auth (service-role, changement direct)
  const admin = createAdminClient()
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, { email })
  if (authErr) {
    if (authErr.message.includes('already registered')) return { error: 'Cette adresse email est déjà utilisée.' }
    return { error: authErr.message }
  }

  // 2. Profil (client SESSION → RLS « update own » + audit ; email non protégé par le trigger)
  const { error: profErr } = await supabase.from('profiles').update({ email }).eq('id', user.id)
  if (profErr) return { error: "Erreur lors de la mise à jour de l'email du profil." }

  return {}
}
