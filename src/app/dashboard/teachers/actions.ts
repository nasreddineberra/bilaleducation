'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { CreateTeacherSchema, UpdateTeacherSchema, validateInput } from '@/lib/validation/schemas'

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
  notes:           string | null
}): Promise<{ error?: string; tempPassword?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  // Validation côté serveur
  const validation = validateInput(CreateTeacherSchema, data)
  if ('error' in validation) return { error: `Validation : ${validation.error}` }

  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const admin = createAdminClient()          // création du compte auth (service-role obligatoire)
  const supabase = await createClient()      // écritures de tables : client SESSION → audit utilisateur tracé
  const tempPassword = generateTempPassword()

  // 1. Créer le compte auth (client admin obligatoire)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
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

  // 2. Insérer profile + teacher via RPC (client SESSION → le trigger d'audit capte l'utilisateur)
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
    await admin.auth.admin.deleteUser(authData.user.id).catch((e) =>
      console.error('[createTeacherWithAccount] Échec du rollback auth:', e)
    )
    if (rpcError.code === '23505') {
      return { error: "Ce numéro d'employé ou cet email est déjà utilisé." }
    }
    return { error: `Erreur lors de la création du profil et de la fiche enseignant : ${rpcError.message}` }
  }

  if (!teacherId) {
    await admin.auth.admin.deleteUser(authData.user.id).catch((e) =>
      console.error('[createTeacherWithAccount] Échec du rollback auth (teacherId null):', e)
    )
    return { error: "Erreur inattendue : aucun ID retourné par le RPC." }
  }

  // Notes internes (non gérées par le RPC de création)
  if (data.notes) {
    const { error: notesError } = await supabase.from('teachers').update({ notes: data.notes }).eq('id', teacherId)
    if (notesError) console.error('[createTeacherWithAccount] Échec enregistrement des notes:', notesError)
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
    notes:           string | null
  }
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  // Validation côté serveur
  const validation = validateInput(UpdateTeacherSchema, data)
  if ('error' in validation) return { error: `Validation : ${validation.error}` }

  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  // Client SESSION (et non admin) : le trigger d'audit capte auth.uid() → utilisateur tracé.
  // La RLS autorise deja admin/direction a modifier les enseignants.
  const supabase = await createClient()

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
    notes:            data.notes,
  }).eq('id', teacherId)

  if (error) {
    if (error.code === '23505') return { error: "Ce numéro d'employé ou cet email est déjà utilisé." }
    return { error: 'Erreur lors de la mise à jour.' }
  }

  // Synchroniser l'état du compte de connexion avec la fiche (actif ↔ actif)
  const { error: syncError } = await supabase.rpc('set_teacher_profile_active', {
    p_teacher_id: teacherId,
    p_active:     data.is_active,
  })
  if (syncError) console.error('[updateTeacher] Échec sync compte de connexion:', syncError)

  return {}
}

// ─── Activer / désactiver un enseignant + son compte de connexion ─────────────

export async function setTeacherActive(
  teacherId: string,
  active: boolean,
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient() // client SESSION → audit tracé

  const { error } = await supabase.from('teachers').update({ is_active: active }).eq('id', teacherId)
  if (error) return { error: 'Erreur lors de la mise à jour du statut.' }

  const { error: syncError } = await supabase.rpc('set_teacher_profile_active', {
    p_teacher_id: teacherId,
    p_active:     active,
  })
  if (syncError) console.error('[setTeacherActive] Échec sync compte de connexion:', syncError)

  return {}
}

// ─── Supprimer définitivement un enseignant (fiche + compte) ──────────────────
// Uniquement si aucune donnée liée ne le référence.

export async function deleteTeacher(teacherId: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient() // client SESSION → audit tracé
  const admin = createAdminClient()     // suppression Storage + compte auth

  // 1. Re-contrôle serveur des dépendances bloquantes
  const [
    { count: classesCount },
    { count: slotsCount },
    { count: exceptionsCount },
    { count: schedulesCount },
    { count: evaluationsCount },
    { count: gradesCount },
  ] = await Promise.all([
    supabase.from('class_teachers').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    supabase.from('schedule_slots').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    supabase.from('schedule_exceptions').select('id', { count: 'exact', head: true }).eq('override_teacher_id', teacherId),
    supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    supabase.from('evaluations').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    supabase.from('grades').select('id', { count: 'exact', head: true }).eq('graded_by', teacherId),
  ])

  const total = (classesCount ?? 0) + (slotsCount ?? 0) + (exceptionsCount ?? 0)
    + (schedulesCount ?? 0) + (evaluationsCount ?? 0) + (gradesCount ?? 0)
  if (total > 0) {
    return { error: 'Des données sont rattachées à cet enseignant. Rendez-le inactif plutôt que de le supprimer.' }
  }

  // 2. Récupérer le compte lié et les fichiers Storage
  const { data: teacher } = await supabase.from('teachers').select('user_id').eq('id', teacherId).single()
  const { data: docs } = await supabase.from('teacher_documents').select('file_url').eq('teacher_id', teacherId)

  // 3. Supprimer les fichiers du bucket (les lignes teacher_documents partent en cascade)
  if (docs && docs.length > 0) {
    const paths = docs.map(d => (d as { file_url: string }).file_url).filter(Boolean)
    if (paths.length > 0) {
      await admin.storage.from('teacher-documents').remove(paths).catch((e) =>
        console.error('[deleteTeacher] Échec suppression Storage:', e)
      )
    }
  }

  // 4. Supprimer la fiche (client session → audit ; cascade teacher_documents)
  const { error: delError } = await supabase.from('teachers').delete().eq('id', teacherId)
  if (delError) {
    if (delError.code === '23503') {
      return { error: 'Des données sont rattachées à cet enseignant. Rendez-le inactif plutôt que de le supprimer.' }
    }
    return { error: 'Erreur lors de la suppression.' }
  }

  // 5. Supprimer le compte auth (le profil part en cascade via la migration)
  if (teacher?.user_id) {
    await admin.auth.admin.deleteUser(teacher.user_id).catch((e) =>
      console.error('[deleteTeacher] Échec suppression compte auth:', e)
    )
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

  const admin = createAdminClient()          // création du compte auth (service-role obligatoire)
  const supabase = await createClient()      // écriture du profil : client SESSION → audit utilisateur tracé
  const tempPassword = generateTempPassword()

  // 1. Créer le compte auth (client admin obligatoire)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
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

  // 2. Créer le profil (role 'parent' verrouillé) via RPC SECURITY DEFINER
  //    appelé avec le client SESSION → le trigger d'audit capte l'utilisateur.
  const { error: profileError } = await supabase.rpc('create_parent_login_profile', {
    p_profile_id:       authData.user.id,
    p_email:            data.email,
    p_first_name:       data.first_name,
    p_last_name:        data.last_name,
    p_phone:            data.phone || null,
    p_etablissement_id: etablissementId,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Erreur lors de la création du profil parent.' }
  }

  return { userId: authData.user.id, tempPassword }
}
