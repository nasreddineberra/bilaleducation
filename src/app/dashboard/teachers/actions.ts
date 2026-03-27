'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import crypto from 'crypto'

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

  // 2. Créer le profil (role enseignant)
  const { error: profileError } = await supabase.from('profiles').insert({
    id:               authData.user.id,
    email:            data.email,
    role:             'enseignant',
    civilite:         data.civilite,
    first_name:       data.first_name,
    last_name:        data.last_name,
    phone:            data.phone,
    is_active:        true,
    etablissement_id: etablissementId,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { error: 'Erreur lors de la création du profil utilisateur.' }
  }

  // 3. Créer la fiche enseignant liée
  const { error: teacherError } = await supabase.from('teachers').insert({
    employee_number:  data.employee_number,
    civilite:         data.civilite,
    last_name:        data.last_name,
    first_name:       data.first_name,
    email:            data.email,
    phone:            data.phone,
    hire_date:        data.hire_date,
    specialization:   data.specialization,
    is_active:        data.is_active,
    user_id:          authData.user.id,
    etablissement_id: etablissementId,
  })

  if (teacherError) {
    // Nettoyage si la fiche enseignant échoue
    await supabase.from('profiles').delete().eq('id', authData.user.id)
    await supabase.auth.admin.deleteUser(authData.user.id)
    if (teacherError.code === '23505') {
      return { error: "Ce numéro d'employé ou cet email est déjà utilisé." }
    }
    return { error: 'Erreur lors de la création de la fiche enseignant.' }
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
