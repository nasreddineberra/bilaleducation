'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}

// ─── Créer un enseignant avec compte utilisateur automatique ──────────────────

export async function createTeacherWithAccount(data: {
  employee_number: string
  civilite:        string | null
  last_name:       string
  first_name:      string
  email:           string
  phone:           string | null
  hire_date:       string
  specialization:  string | null
  is_active:       boolean
}): Promise<{ error?: string; tempPassword?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const supabase = createAdminClient()
  const tempPassword = generateTempPassword()

  // 1. Créer le compte auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Cette adresse email est déjà utilisée par un autre compte.' }
    }
    return { error: authError.message }
  }

  // 2. Insérer profile + teacher dans une seule transaction atomique via RPC
  const { data: teacherId, error: rpcError } = await supabase.rpc('create_profile_and_teacher', {
    p_profile_id:         authData.user.id,
    p_email:              data.email,
    p_role:               'enseignant',
    p_first_name:         data.first_name,
    p_last_name:          data.last_name,
    p_civilite:           data.civilite,
    p_phone:              data.phone,
    p_is_active:          true,
    p_etablissement_id:   etablissementId,
    p_employee_number:    data.employee_number,
    p_specialization:     data.specialization,
    p_hire_date:          data.hire_date,
  })

  if (rpcError) {
    // Rollback du compte auth — on logge mais on ne bloque pas
    await supabase.auth.admin.deleteUser(authData.user.id).catch((e) =>
      console.error('[createTeacherWithAccount] Échec du rollback auth:', e)
    )
    if (rpcError.code === '23505') {
      return { error: "Ce numéro d'employé ou cet email est déjà utilisé." }
    }
    return { error: `Erreur lors de la création du profil et de la fiche enseignant : ${rpcError.message}` }
  }

  if (!teacherId) {
    await supabase.auth.admin.deleteUser(authData.user.id).catch((e) =>
      console.error('[createTeacherWithAccount] Échec du rollback auth (teacherId null):', e)
    )
    return { error: "Erreur inattendue : aucun ID retourné par le RPC." }
  }

  return { tempPassword }
}

// ─── Mettre à jour un enseignant ──────────────────────────────────────────────

export async function updateTeacher(
  teacherId: string,
  data: {
    employee_number: string
    civilite:        string | null
    last_name:       string
    first_name:      string
    email:           string
    phone:           string | null
    hire_date:       string
    specialization:  string | null
    is_active:       boolean
  }
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const supabase = createAdminClient()

  const { error } = await supabase.from('teachers').update({
    employee_number:  data.employee_number,
    civilite:         data.civilite,
    last_name:        data.last_name,
    first_name:       data.first_name,
    email:            data.email,
    phone:            data.phone,
    hire_date:        data.hire_date,
    specialization:   data.specialization,
    is_active:        data.is_active,
  }).eq('id', teacherId)

  if (error) {
    if (error.code === '23505') return { error: "Ce numéro d'employé ou cet email est déjà utilisé." }
    return { error: 'Erreur lors de la mise à jour.' }
  }

  return {}
}

// ─── Créer un compte parent pour un tuteur ───────────────────────────────────

export async function createParentAccount(data: {
  email:      string
  first_name: string
  last_name:  string
  phone?:     string | null
}): Promise<{ error?: string; userId?: string; tempPassword?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'secretaire'])
  if (roleError) return { error: roleError }

  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const supabase = createAdminClient()
  const tempPassword = generateTempPassword()

  // 1. Créer le compte auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: `L'email ${data.email} est déjà utilisé par un autre compte.` }
    }
    return { error: authError.message }
  }

  // 2. Créer le profil (role parent)
  const { error: profileError } = await supabase.from('profiles').insert({
    id:               authData.user.id,
    email:            data.email,
    role:             'parent',
    first_name:       data.first_name,
    last_name:        data.last_name,
    phone:            data.phone || null,
    is_active:        true,
    etablissement_id: etablissementId,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { error: 'Erreur lors de la création du profil parent.' }
  }

  return { userId: authData.user.id, tempPassword }
}
