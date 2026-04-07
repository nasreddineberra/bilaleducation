'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { validatePasswordServer } from '@/lib/validation/password'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'

// ─── Créer un tenant complet (établissement + directeur initial) ──────────────

export async function createTenant(data: {
  slug:      string
  nom:       string
  adresse?:  string
  telephone?: string
  director: {
    first_name: string
    last_name:  string
    email:      string
    password:   string
  }
}): Promise<{ error?: string; id?: string }> {
  const { error: roleError } = await requireRoleServer(['super_admin'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  // 1. Créer l'établissement
  const { data: etablissement, error: etabError } = await supabase
    .from('etablissements')
    .insert({
      slug:      data.slug.trim().toLowerCase(),
      nom:       data.nom.trim(),
      adresse:   data.adresse?.trim()   || null,
      telephone: data.telephone?.trim() || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (etabError) {
    if (etabError.message.includes('unique') || etabError.code === '23505') {
      return { error: `Le slug "${data.slug}" est déjà utilisé par un autre établissement.` }
    }
    return { error: etabError.message }
  }

  // 2. Créer le compte auth du directeur
  const pwdError = validatePasswordServer(data.director.password, data.director.first_name, data.director.last_name)
  if (pwdError) {
    await supabase.from('etablissements').delete().eq('id', etablissement.id)
    return { error: `Le mot de passe du directeur ne respecte pas la règle : ${pwdError}` }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:         data.director.email,
    password:      data.director.password,
    email_confirm: true,
    app_metadata:  { role: 'direction' },
  })

  if (authError) {
    // Annuler la création de l'établissement
    await supabase.from('etablissements').delete().eq('id', etablissement.id)
    if (authError.message.includes('already registered')) {
      return { error: 'Cette adresse email est déjà utilisée.' }
    }
    return { error: authError.message }
  }

  // 3. Créer le profil du directeur
  const { error: profileError } = await supabase.from('profiles').insert({
    id:               authData.user.id,
    email:            data.director.email,
    role:             'direction',
    first_name:       data.director.first_name.trim(),
    last_name:        data.director.last_name.trim(),
    is_active:        true,
    etablissement_id: etablissement.id,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    await supabase.from('etablissements').delete().eq('id', etablissement.id)
    return { error: 'Erreur lors de la création du profil directeur.' }
  }

  revalidatePath('/superadmin')
  return { id: etablissement.id }
}

// ─── Mettre à jour les infos d'un établissement ───────────────────────────────

export async function updateEtablissement(id: string, data: {
  nom:       string
  adresse?:  string
  telephone?: string
  contact?:  string
  notes?:    string | null
}): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['super_admin'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase.from('etablissements').update({
    nom:       data.nom.trim(),
    adresse:   data.adresse?.trim()   || null,
    telephone: data.telephone?.trim() || null,
    contact:   data.contact?.trim()   || null,
    notes:     data.notes?.trim()     || null,
  }).eq('id', id)

  if (error) return { error: 'Erreur lors de la mise à jour.' }
  revalidatePath(`/superadmin/ecoles/${id}`)
  revalidatePath('/superadmin')
  return {}
}

// ─── Activer / désactiver un établissement ────────────────────────────────────

export async function toggleEtablissementActive(
  id: string,
  is_active: boolean
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['super_admin'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('etablissements')
    .update({ is_active })
    .eq('id', id)

  if (error) return { error: 'Erreur lors de la mise à jour du statut.' }
  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/ecoles/${id}`)
  return {}
}

// ─── Modifier la limite d'élèves ─────────────────────────────────────────────

export async function updateMaxStudents(
  id: string,
  max_students: number | null
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['super_admin'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('etablissements')
    .update({ max_students })
    .eq('id', id)

  if (error) return { error: 'Erreur lors de la mise à jour.' }
  revalidatePath(`/superadmin/ecoles/${id}`)
  return {}
}

// ─── Modifier la date d'expiration de l'abonnement ───────────────────────────

export async function updateSubscription(
  id: string,
  expires_at: string | null
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['super_admin'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('etablissements')
    .update({ subscription_expires_at: expires_at })
    .eq('id', id)

  if (error) return { error: 'Erreur lors de la mise à jour de l\'abonnement.' }
  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/ecoles/${id}`)
  return {}
}

// ─── Créer un utilisateur dans un établissement ───────────────────────────────

export async function createTenantUser(
  etablissementId: string,
  data: {
    email:      string
    password:   string
    role:       string
    first_name: string
    last_name:  string
  }
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['super_admin'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  // Validation du mot de passe côté serveur
  const pwdError = validatePasswordServer(data.password, data.first_name, data.last_name)
  if (pwdError) {
    return { error: `Le mot de passe ne respecte pas la règle : ${pwdError}` }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:         data.email,
    password:      data.password,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Cette adresse email est déjà utilisée.' }
    }
    return { error: authError.message }
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id:               authData.user.id,
    email:            data.email,
    role:             data.role,
    first_name:       data.first_name.trim(),
    last_name:        data.last_name.trim(),
    is_active:        true,
    etablissement_id: etablissementId,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { error: 'Erreur lors de la création du profil.' }
  }

  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return {}
}

// ─── Modifier un utilisateur d'un établissement ──────────────────────────────

export async function updateTenantUser(
  profileId: string,
  etablissementId: string,
  data: { role?: string; is_active?: boolean }
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['super_admin'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', profileId)

  if (error) return { error: 'Erreur lors de la mise à jour.' }
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return {}
}
