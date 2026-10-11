'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { sameName } from '@/lib/normalize-name'
import { CreateTeacherSchema, UpdateTeacherSchema, validateInput } from '@/lib/validation/schemas'
import { envoyerLienMotDePasse } from '@/lib/auth/lien-mot-de-passe'
import { logAudit } from '@/lib/audit'

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
}): Promise<{ error?: string; tempPassword?: string; lienEnvoye?: boolean }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'secretaire'])
  if (roleError) return { error: roleError }

  // Validation côté serveur
  const validation = validateInput(CreateTeacherSchema, data)
  if ('error' in validation) return { error: `Validation : ${validation.error}` }

  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const admin = createAdminClient()          // création du compte auth (service-role obligatoire)
  const supabase = await createClient()      // écritures de tables : client SESSION → audit utilisateur tracé

  // Doublon nom + prénom : contrôlé AVANT de créer le compte auth, sinon un refus
  // laisserait un compte orphelin. Le formulaire fait déjà ce test, mais lui seul
  // ne protège ni de deux saisies simultanées, ni d'un appel hors formulaire.
  const { data: existingTeachers } = await supabase
    .from('teachers')
    .select('id, last_name, first_name')
  const dup = existingTeachers?.find(t => sameName(t, data))
  if (dup) {
    return { error: `Un enseignant « ${dup.last_name} ${dup.first_name} » existe déjà.` }
  }

  const tempPassword = generateTempPassword()

  // 1. Créer le compte auth (client admin obligatoire)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
    // `app_metadata` porte le ROLE et l'ETABLISSEMENT dans le JETON.
    // Sans eux, le middleware lisait `app_metadata?.role ?? 'parent'` et
    // traitait donc tout compte normal comme un parent — ce qui le faisait
    // echapper au controle 2FA. L'etablissement, lui, rend le controle de
    // tenant gratuit, sans requete supplementaire a chaque navigation.
    // Ces valeurs sont un MIROIR de `profiles` : l'autorite reste la table,
    // la RLS s'appuyant sur `get_user_role()` et non sur le jeton.
    app_metadata: { role: 'enseignant', etablissement_id: etablissementId },
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
    const echecNotes = erreurEcriture(
      await supabase.from('teachers').update({ notes: data.notes }).eq('id', teacherId).select('id'),
      'Les remarques',
    )
    if (echecNotes) console.error('[createTeacherWithAccount] Échec enregistrement des notes:', echecNotes)
  }

  // Envoi AUTOMATIQUE du lien « Définissez votre mot de passe » : l'enseignant
  // choisit le sien. Le mot de passe provisoire reste affiche, en secours. Un
  // echec d'envoi n'annule pas la creation : il est signale a l'ecran.
  const echecLien = await envoyerLienMotDePasse(data.email)
  if (!echecLien) {
    try {
      await logAudit(supabase, {
        action: 'UPDATE', entityType: 'auth',
        description: `Envoi du lien de définition du mot de passe à ${data.email} (création du compte enseignant)`,
      })
    } catch { /* non bloquant */ }
  }

  return { tempPassword, lienEnvoye: !echecLien }
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
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'secretaire'])
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

  const resMaj = await supabase.from('teachers').update({
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
  }).eq('id', teacherId).select('id')

  if (resMaj.error?.code === '23505') {
    return { error: "Ce numéro d'employé ou cet email est déjà utilisé." }
  }
  const echecMaj = erreurEcriture(resMaj, 'Cette fiche')
  if (echecMaj) return { error: echecMaj }

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
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'secretaire'])
  if (roleError) return { error: roleError }

  const supabase = await createClient() // client SESSION → audit tracé

  const echec = erreurEcriture(
    await supabase.from('teachers').update({ is_active: active }).eq('id', teacherId).select('id'),
    'Ce statut',
  )
  if (echec) return { error: echec }

  const { error: syncError } = await supabase.rpc('set_teacher_profile_active', {
    p_teacher_id: teacherId,
    p_active:     active,
  })
  if (syncError) console.error('[setTeacherActive] Échec sync compte de connexion:', syncError)

  return {}
}

// ─── Dépendances d'un enseignant ──────────────────────────────────────────────
// Source UNIQUE du comptage : la modale de la liste et la suppression l'emploient
// toutes deux, pour qu'elles ne puissent pas diverger.
//
// BLOQUANT : affectations EN COURS ou à venir, emploi du temps, évaluations, notes,
// et le cahier de texte (séances, devoirs) — ces deux tables partent en CASCADE avec
// la fiche, donc les ignorer détruirait en silence ce que l'enseignant a rédigé.
// NON BLOQUANT : les affectations TERMINÉES (historique). Elles disparaissent avec la
// fiche ; la modale l'annonce (`historique`).
type DepsEnseignant = {
  classes: number; historique: number; edt: number; evaluations: number
  grades: number; seances: number; devoirs: number
}

function aujourdhuiLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function compterDependancesEnseignant(supabase: Awaited<ReturnType<typeof createClient>>, teacherId: string): Promise<DepsEnseignant | null> {
  const today = aujourdhuiLocal()
  const compte = (table: string, col: string) =>
    supabase.from(table).select('id', { count: 'exact', head: true }).eq(col, teacherId)
  const r = await Promise.all([
    // « en cours ou a venir » : sans date de fin, ou fin >= aujourd'hui (fin INCLUSE)
    compte('class_teachers', 'teacher_id').or(`effective_until.is.null,effective_until.gte.${today}`),
    compte('class_teachers', 'teacher_id').lt('effective_until', today),
    compte('schedule_slots', 'teacher_id'),
    compte('schedule_exceptions', 'override_teacher_id'),
    compte('evaluations', 'teacher_id'),
    compte('grades', 'graded_by'),
    compte('class_journal', 'teacher_id'),
    compte('homework', 'teacher_id'),
  ])
  // Un comptage `head` impossible rend `count: null` SANS erreur : on refuse de
  // conclure plutot que de prendre une panne pour « aucune donnee ».
  if (r.some(x => x.count === null)) return null
  const [classes, historique, slots, exceptions, evaluations, grades, seances, devoirs] = r.map(x => x.count as number)
  return { classes, historique, edt: slots + exceptions, evaluations, grades, seances, devoirs }
}

const dependancesBloquantes = (d: DepsEnseignant) =>
  d.classes + d.edt + d.evaluations + d.grades + d.seances + d.devoirs

// Pour la modale de la liste.
export async function getTeacherDeleteDeps(teacherId: string): Promise<{ error?: string; deps?: DepsEnseignant }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }
  const supabase = await createClient()
  const deps = await compterDependancesEnseignant(supabase, teacherId)
  if (!deps) return { error: 'Vérification des données rattachées impossible. Réessayez.' }
  return { deps }
}

// ─── Supprimer définitivement un enseignant (fiche + compte) ──────────────────
// Uniquement si aucune donnée liée ne le référence.

export async function deleteTeacher(teacherId: string): Promise<{ error?: string }> {
  // Suppression NON ouverte a la secretaire (decision du 5 aout) : elle entraine
  // le compte de connexion et les fichiers Storage. La RLS l'interdit aussi
  // (policy `teachers_delete`), cette garde n'est que la premiere barriere.
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient() // client SESSION → audit tracé
  const admin = createAdminClient()     // suppression Storage + compte auth

  // 1. Re-contrôle serveur des dépendances bloquantes (mêmes règles que la modale)
  const deps = await compterDependancesEnseignant(supabase, teacherId)
  if (!deps) return { error: 'Vérification des données rattachées impossible. Réessayez.' }
  if (dependancesBloquantes(deps) > 0) {
    return { error: 'Des données sont rattachées à cet enseignant. Rendez-le inactif plutôt que de le supprimer.' }
  }

  // 2. Récupérer le compte lié et les fichiers Storage
  const { data: teacher } = await supabase.from('teachers').select('user_id').eq('id', teacherId).single()
  const { data: docs } = await supabase.from('teacher_documents').select('file_url').eq('teacher_id', teacherId)

  // 3. Supprimer la fiche (client session → audit ; cascade teacher_documents)
  const resDel = await supabase.from('teachers').delete().eq('id', teacherId).select('id')
  if (resDel.error?.code === '23503') {
    return { error: 'Des données sont rattachées à cet enseignant. Rendez-le inactif plutôt que de le supprimer.' }
  }
  const echecDel = erreurEcriture(resDel, 'Cet enseignant')
  if (echecDel) return { error: echecDel }

  // 4. Les fichiers ne partent QU APRES : l'ordre inverse les detruisait avant de
  //    savoir si la fiche pouvait partir, et un refus RLS ne leve rien. Les chemins
  //    sont deja en memoire (etape 2), la cascade n'efface que les lignes.
  if (docs && docs.length > 0) {
    const paths = docs.map(d => (d as { file_url: string }).file_url).filter(Boolean)
    if (paths.length > 0) {
      await admin.storage.from('teacher-documents').remove(paths).catch((e) =>
        console.error('[deleteTeacher] Échec suppression Storage:', e)
      )
    }
  }

  // 5. Supprimer le compte auth (le profil part en cascade via la migration)
  if (teacher?.user_id) {
    // Les messages d'equipe RECUS par cette personne referencent son profil sans
    // cascade : ils empechaient la suppression du compte, qui echouait en silence
    // (le compte restait, sans fiche, bloque en « modifier » dans Utilisateurs).
    // Ce sont des lignes de reception : le message lui-meme n'est pas touche.
    const resRecus = await supabase.from('announcement_staff_recipients').delete().eq('profile_id', teacher.user_id).select('id')
    if (resRecus.error) {
      console.error('[deleteTeacher] Échec nettoyage des messages reçus:', resRecus.error)
      return { error: 'La fiche est supprimée, mais le compte de connexion n\'a pas pu l\'être (messages reçus). Supprimez-le depuis Utilisateurs.' }
    }

    // L'echec est RENDU : `deleteUser` ne leve pas, il renvoie `{ error }`, que
    // l'ancien `.catch` ne voyait jamais — l'ecran annoncait un succes.
    const { error: errAuth } = await admin.auth.admin.deleteUser(teacher.user_id)
    if (errAuth) {
      console.error('[deleteTeacher] Échec suppression compte auth:', errAuth)
      return { error: `La fiche est supprimée, mais le compte de connexion n'a pas pu l'être : ${errAuth.message}` }
    }
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
    // Miroir de `profiles` — voir le commentaire de createTeacherWithAccount.
    app_metadata: { role: 'parent', etablissement_id: etablissementId },
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
