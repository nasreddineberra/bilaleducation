'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import type { UserRole } from '@/types/database'
import { validatePasswordServer } from '@/lib/validation/password'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'

export type { UserRole }

// ─── Créer un utilisateur ────────────────────────────────────────────────────

export async function createUser(data: {
  email:      string
  password:   string
  role:       UserRole
  civilite?:  string
  first_name: string
  last_name:  string
  phone?:     string
}): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  // Lire l'etablissement_id injecté par le middleware
  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')

  if (!etablissementId) {
    return { error: 'Établissement non identifié. Veuillez vous reconnecter.' }
  }

  const supabase = createAdminClient()

  // Validation du mot de passe côté serveur
  const pwdError = validatePasswordServer(data.password, data.first_name, data.last_name)
  if (pwdError) {
    return { error: `Le mot de passe ne respecte pas la règle : ${pwdError}` }
  }

  // 1. Créer le compte auth (email_confirm: true = pas de mail de confirmation)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:          data.email,
    password:       data.password,
    email_confirm:  true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Cette adresse email est déjà utilisée.' }
    }
    return { error: authError.message }
  }

  // 2. Insérer le profil dans une transaction atomique via RPC
  const { error: rpcError } = await supabase.rpc('create_profile_only', {
    p_profile_id:       authData.user.id,
    p_email:            data.email,
    p_role:             data.role,
    p_first_name:       data.first_name,
    p_last_name:        data.last_name,
    p_civilite:         data.civilite || null,
    p_phone:            data.phone || null,
    p_is_active:        true,
    p_etablissement_id: etablissementId,
  })

  if (rpcError) {
    await supabase.auth.admin.deleteUser(authData.user.id).catch((e) =>
      console.error('[createUser] Échec du rollback auth:', e)
    )
    return { error: `Erreur lors de la création du profil : ${rpcError.message}` }
  }

  revalidatePath('/dashboard/utilisateurs')
  return {}
}

// ─── Modifier un profil ───────────────────────────────────────────────────────

export async function updateProfile(id: string, data: {
  role:       UserRole
  civilite?:  string
  first_name: string
  last_name:  string
  phone?:     string
}): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase.from('profiles').update({
    role:       data.role,
    civilite:   data.civilite || null,
    first_name: data.first_name,
    last_name:  data.last_name,
    phone:      data.phone || null,
  }).eq('id', id)

  if (error) return { error: 'Erreur lors de la mise à jour.' }

  revalidatePath('/dashboard/utilisateurs')
  return {}
}

// ─── Activer / désactiver ─────────────────────────────────────────────────────

export async function toggleActive(id: string, is_active: boolean): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase.from('profiles').update({ is_active }).eq('id', id)

  if (error) return { error: 'Erreur lors de la mise à jour du statut.' }

  revalidatePath('/dashboard/utilisateurs')
  return {}
}

// ─── Modifier l'email ────────────────────────────────────────────────────────

export async function updateEmail(id: string, email: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error: authError } = await supabase.auth.admin.updateUserById(id, { email })
  if (authError) {
    if (authError.message.includes('already registered')) return { error: 'Cette adresse email est déjà utilisée.' }
    return { error: authError.message }
  }

  const { error: profileError } = await supabase.from('profiles').update({ email }).eq('id', id)
  if (profileError) return { error: "Erreur lors de la mise à jour de l'email." }

  revalidatePath('/dashboard/utilisateurs')
  return {}
}

// ─── Réinitialiser le mot de passe ───────────────────────────────────────────

export async function sendPasswordReset(email: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback?next=/auth/reset-password`,
  })

  if (error) return { error: 'Erreur lors de l\'envoi de l\'email.' }
  return {}
}
