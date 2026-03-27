'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import crypto from 'crypto'

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}

export interface TutorAccountResult {
  tutorLabel: string
  email: string
  tempPassword: string
}

// ─── Créer une fiche parents avec comptes utilisateurs automatiques ──────────

export async function createParentWithAccounts(payload: Record<string, any>): Promise<{
  error?: string
  parentId?: string
  accounts?: TutorAccountResult[]
}> {
  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const supabase = createAdminClient()
  const accounts: TutorAccountResult[] = []
  const parentData = { ...payload, etablissement_id: etablissementId } as any

  // Créer compte tuteur 1 si email présent
  if (payload.tutor1_email) {
    const result = await createTutorAccount(supabase, etablissementId, {
      email: payload.tutor1_email,
      first_name: payload.tutor1_first_name,
      last_name: payload.tutor1_last_name,
      phone: payload.tutor1_phone,
    })
    if (result.error) return { error: `Tuteur 1 : ${result.error}` }
    parentData.tutor1_user_id = result.userId
    accounts.push({
      tutorLabel: `Tuteur 1 : ${payload.tutor1_first_name} ${payload.tutor1_last_name}`,
      email: payload.tutor1_email,
      tempPassword: result.tempPassword!,
    })
  }

  // Créer compte tuteur 2 si email présent
  if (payload.tutor2_email) {
    const result = await createTutorAccount(supabase, etablissementId, {
      email: payload.tutor2_email,
      first_name: payload.tutor2_first_name,
      last_name: payload.tutor2_last_name,
      phone: payload.tutor2_phone,
    })
    if (result.error) {
      // Nettoyage du compte tuteur 1 si le tuteur 2 échoue
      if (parentData.tutor1_user_id) {
        await supabase.from('profiles').delete().eq('id', parentData.tutor1_user_id)
        await supabase.auth.admin.deleteUser(parentData.tutor1_user_id)
      }
      return { error: `Tuteur 2 : ${result.error}` }
    }
    parentData.tutor2_user_id = result.userId
    accounts.push({
      tutorLabel: `Tuteur 2 : ${payload.tutor2_first_name} ${payload.tutor2_last_name}`,
      email: payload.tutor2_email,
      tempPassword: result.tempPassword!,
    })
  }

  // Créer la fiche parents
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .insert(parentData)
    .select('id')
    .single()

  if (parentError) {
    // Nettoyage des comptes créés
    for (const key of ['tutor1_user_id', 'tutor2_user_id'] as const) {
      if (parentData[key]) {
        await supabase.from('profiles').delete().eq('id', parentData[key])
        await supabase.auth.admin.deleteUser(parentData[key])
      }
    }
    return { error: 'Erreur lors de la création de la fiche parents.' }
  }

  return { parentId: parent.id, accounts }
}

// ─── Mettre à jour une fiche parents ─────────────────────────────────────────

export async function updateParentRecord(
  parentId: string,
  payload: Record<string, any>
): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('parents')
    .update(payload)
    .eq('id', parentId)

  if (error) return { error: 'Erreur lors de la mise à jour.' }
  return {}
}

// ─── Helper interne : créer un compte pour un tuteur ─────────────────────────

async function createTutorAccount(
  supabase: ReturnType<typeof createAdminClient>,
  etablissementId: string,
  data: { email: string; first_name: string; last_name: string; phone?: string | null }
): Promise<{ error?: string; userId?: string; tempPassword?: string }> {
  const tempPassword = generateTempPassword()

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
    return { error: 'Erreur lors de la création du profil.' }
  }

  return { userId: authData.user.id, tempPassword }
}
