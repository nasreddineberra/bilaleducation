'use server'

import { updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveRole } from '@/lib/auth/effective-role'
import { alerterAncienneAdresse } from '@/lib/auth/email-change-alert'

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

// Préférence de thème (clair/sombre) de l'utilisateur connecté.
// Client SESSION → RLS « update own profile ». `updateTag('profile')` est
// INDISPENSABLE : le profil est mis en cache sans expiration (getCachedProfile),
// sans invalidation le thème reviendrait en arrière à la navigation suivante.
export async function setOwnTheme(theme: 'light' | 'dark'): Promise<{ error?: string }> {
  if (theme !== 'light' && theme !== 'dark') return { error: 'Thème invalide.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  // `.select()` est indispensable : un UPDATE filtré par la RLS ne renvoie AUCUNE
  // erreur, il modifie simplement 0 ligne. Sans ça, l'échec passe inaperçu.
  const { data, error } = await supabase
    .from('profiles').update({ theme }).eq('id', user.id).select('id')

  if (error) {
    console.error('[setOwnTheme] échec update:', error.message)
    return { error: 'Erreur lors de l’enregistrement du thème.' }
  }
  if (!data || data.length === 0) {
    console.error('[setOwnTheme] 0 ligne modifiée (RLS) pour', user.id)
    return { error: 'Thème non enregistré (droits insuffisants).' }
  }

  updateTag('profile')
  return {}
}

// Changement de son propre email — réservé admin/direction (pas de hiérarchie au-dessus).
// Changement direct (auth + profil), tracé via le client session.
export async function updateOwnEmail(newEmail: string): Promise<{ error?: string; avertissement?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (!['admin', 'direction'].includes(effectiveRole(me) ?? '')) {
    return { error: 'Seuls les rôles administration/direction peuvent changer eux-mêmes leur email.' }
  }

  const email = newEmail.trim()
  if (!isValidEmail(email)) return { error: 'Adresse email invalide.' }

  // Capturee AVANT le changement : ensuite, plus rien ne la porte.
  const ancienneAdresse = user.email ?? ''

  // 1. Compte auth (service-role, changement DIRECT)
  //
  // `email_confirm: true` est indispensable, et son absence était un bug : sans
  // lui, l'API admin ne change PAS l'adresse — elle ouvre un cycle de
  // confirmation et tente d'envoyer un email avec le gabarit « Change email
  // address », que nous n'avons pas écrit. L'opération échouait alors sur un
  // « Error updating user » opaque.
  //
  // Le changement direct est le comportement voulu (décision du 8 juillet) :
  // l'écran demande déjà confirmation, et l'action est réservée à
  // administration/direction.
  const admin = createAdminClient()
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
  })
  if (authErr) {
    // Message COMPLET au journal serveur : celui de Supabase est souvent
    // générique, et sans trace on ne peut que deviner.
    console.error('[mon-compte] changement d\'email refusé:', authErr.message, authErr)
    if (/already|registered|exists/i.test(authErr.message)) {
      return { error: 'Cette adresse email est déjà utilisée par un autre compte.' }
    }
    return { error: "L'adresse n'a pas pu être modifiée. Vérifiez qu'elle n'est pas déjà utilisée par un autre compte." }
  }

  // 2. Profil (client SESSION → RLS « update own » + audit ; email non protégé par le trigger)
  const { error: profErr } = await supabase.from('profiles').update({ email }).eq('id', user.id)
  if (profErr) return { error: "Erreur lors de la mise à jour de l'email du profil." }

  // 3. Alerte à l'ANCIENNE adresse — voir `alerterAncienneAdresse`.
  //    Envoyée APRÈS le changement, jamais avant : une alerte émise sur un
  //    changement qui échoue ensuite inquiéterait pour rien.
  //    Non bloquante : l'adresse est déjà modifiée, un échec d'envoi ne le défait pas.
  if (ancienneAdresse && me?.etablissement_id) {
    const alerte = await alerterAncienneAdresse({
      etablissementId: me.etablissement_id,
      ancienneAdresse,
      nouvelleAdresse: email,
      parUnAdministrateur: false,
    })
    if (!alerte.ok) {
      return { avertissement: "Adresse modifiée, mais l'alerte de sécurité n'a pas pu être envoyée à l'ancienne adresse." }
    }
  }

  return {}
}
