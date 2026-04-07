'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'

// ─── Types strictes pour les payloads ─────────────────────────────────────────

export interface CreateParentPayload {
  // Tuteur 1
  tutor1_first_name?: string
  tutor1_last_name?: string
  tutor1_email?: string
  tutor1_phone?: string | null
  tutor1_relationship?: string | null
  tutor1_address?: string | null
  tutor1_city?: string | null
  tutor1_postal_code?: string | null
  tutor1_profession?: string | null
  tutor1_adult_courses?: boolean
  // Tuteur 2
  tutor2_first_name?: string | null
  tutor2_last_name?: string | null
  tutor2_email?: string | null
  tutor2_phone?: string | null
  tutor2_relationship?: string | null
  tutor2_address?: string | null
  tutor2_city?: string | null
  tutor2_postal_code?: string | null
  tutor2_profession?: string | null
  tutor2_adult_courses?: boolean
  // Famille
  situation_familiale?: string | null
  type_garde?: string | null
  // Métadonnées
  notes?: string | null
  student_ids?: string[]
  // Champs gérés automatiquement (NON injectables)
  // etablissement_id, tutor1_user_id, tutor2_user_id, created_at
}

export interface UpdateParentPayload {
  // Mêmes champs que CreateParentPayload, sauf ceux gérés automatiquement
  tutor1_first_name?: string
  tutor1_last_name?: string
  tutor1_email?: string | null
  tutor1_phone?: string | null
  tutor1_relationship?: string | null
  tutor1_address?: string | null
  tutor1_city?: string | null
  tutor1_postal_code?: string | null
  tutor1_profession?: string | null
  tutor1_adult_courses?: boolean
  tutor2_first_name?: string | null
  tutor2_last_name?: string | null
  tutor2_email?: string | null
  tutor2_phone?: string | null
  tutor2_relationship?: string | null
  tutor2_address?: string | null
  tutor2_city?: string | null
  tutor2_postal_code?: string | null
  tutor2_profession?: string | null
  tutor2_adult_courses?: boolean
  situation_familiale?: string | null
  type_garde?: string | null
  notes?: string | null
  // is_active est géré séparément — ne pas autoriser via ce endpoint
}

// Champs interdits à l'injection
const FORBIDDEN_FIELDS = [
  'id', 'etablissement_id', 'tutor1_user_id', 'tutor2_user_id',
  'created_at', 'updated_at', 'is_active', 'role',
]

const ALLOWED_FIELDS: (keyof CreateParentPayload)[] = [
  'tutor1_first_name', 'tutor1_last_name', 'tutor1_email', 'tutor1_phone',
  'tutor1_relationship', 'tutor1_address', 'tutor1_city', 'tutor1_postal_code',
  'tutor1_profession', 'tutor1_adult_courses',
  'tutor2_first_name', 'tutor2_last_name', 'tutor2_email', 'tutor2_phone',
  'tutor2_relationship', 'tutor2_address', 'tutor2_city', 'tutor2_postal_code',
  'tutor2_profession', 'tutor2_adult_courses',
  'situation_familiale', 'type_garde', 'notes', 'student_ids',
]

function sanitizeParentPayload(payload: Record<string, any>): CreateParentPayload {
  const clean: CreateParentPayload = {}
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_FIELDS.includes(key)) continue
    if ((ALLOWED_FIELDS as string[]).includes(key)) {
      (clean as any)[key] = value
    }
  }
  return clean
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}

export interface TutorAccountResult {
  tutorLabel: string
  email: string
  tempPassword: string
}

// ─── Créer une fiche parents avec comptes utilisateurs automatiques ──────────

export async function createParentWithAccounts(payload: CreateParentPayload): Promise<{
  error?: string
  parentId?: string
  accounts?: TutorAccountResult[]
}> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'secretaire'])
  if (roleError) return { error: roleError }

  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const supabase = createAdminClient()
  const accounts: TutorAccountResult[] = []
  const cleanPayload = sanitizeParentPayload(payload)
  const parentData: Record<string, any> = { ...cleanPayload, etablissement_id: etablissementId }

  // Créer compte tuteur 1 si email présent
  if (payload.tutor1_email) {
    const result = await createTutorAccount(supabase, etablissementId, {
      email: payload.tutor1_email,
      first_name: payload.tutor1_first_name ?? '',
      last_name: payload.tutor1_last_name ?? '',
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
      first_name: payload.tutor2_first_name ?? '',
      last_name: payload.tutor2_last_name ?? '',
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
  payload: UpdateParentPayload
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'secretaire'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const cleanPayload: Record<string, any> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (!FORBIDDEN_FIELDS.includes(key)) {
      cleanPayload[key] = value
    }
  }

  const { error } = await supabase
    .from('parents')
    .update(cleanPayload)
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
