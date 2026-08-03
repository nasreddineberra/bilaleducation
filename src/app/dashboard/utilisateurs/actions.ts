'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import type { UserRole } from '@/types/database'
import { validatePasswordServer } from '@/lib/validation/password'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'
import { CreateUserSchema, UpdateProfileSchema, validateInput } from '@/lib/validation/schemas'

// ─── Créer un utilisateur ────────────────────────────────────────────────────

export async function createUser(data: {
  email:      string
  password:   string
  role:       UserRole
  civilite?:  string
  first_name: string
  last_name:  string
  phone?:     string
  notes?:     string
}): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  // Validation côté serveur
  const validation = validateInput(CreateUserSchema, data)
  if ('error' in validation) return { error: `Validation : ${validation.error}` }

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

  // 2. Insérer le profil via RPC, avec le client SESSION : le trigger d'audit capte
  //    alors l'acteur (auth.uid()). Le RPC est SECURITY INVOKER et la policy
  //    « Admin and direction can insert profiles » autorise l'insertion.
  const session = await createClient()
  const { error: rpcError } = await session.rpc('create_profile_only', {
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

  // Remarques : posees apres le RPC (signature fixe). Champ libre non critique →
  // un echec ici ne doit pas annuler la creation du compte.
  if (data.notes?.trim()) {
    const { error: notesError } = await session
      .from('profiles')
      .update({ notes: data.notes.trim() })
      .eq('id', authData.user.id)
    if (notesError) console.error('[createUser] Remarques non enregistrees:', notesError)
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
  notes?:     string
  /** Statut du compte, envoye par la fiche (absent = inchange). */
  is_active?: boolean
}): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  // Validation côté serveur
  const validation = validateInput(UpdateProfileSchema, data)
  if ('error' in validation) return { error: `Validation : ${validation.error}` }

  // Client SESSION (pas admin) : le trigger d'audit capte alors l'acteur via auth.uid().
  // Requiert la policy « Admin and direction can update profiles » (fix-profiles-audit-user.sql).
  const supabase = await createClient()

  // Garde anti lock-out, identique a celle de toggleActive : un compte
  // structurant ne peut pas etre desactive, meme par un admin ou une direction.
  // Un ENSEIGNANT non plus : sa fiche synchronise fiche metier ET compte, deux
  // points d'entree finiraient par diverger.
  if (data.is_active === false) {
    const { data: target } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle()
    if (!target) return { error: 'Utilisateur introuvable.' }
    if (target.role === 'admin' || target.role === 'super_admin') {
      return { error: 'Ce compte est structurant : il ne peut pas être désactivé.' }
    }
    if (target.role === 'enseignant') {
      return { error: "Le statut d'un enseignant se modifie depuis sa fiche enseignant." }
    }
  }

  const { error } = await supabase.from('profiles').update({
    role:       data.role,
    civilite:   data.civilite || null,
    first_name: data.first_name,
    last_name:  data.last_name,
    phone:      data.phone || null,
    notes:      data.notes || null,
    ...(data.is_active === undefined ? {} : { is_active: data.is_active }),
  }).eq('id', id)

  if (error) return { error: 'Erreur lors de la mise à jour.' }

  revalidatePath('/dashboard/utilisateurs')
  return {}
}

// ─── Activer / désactiver ─────────────────────────────────────────────────────

export async function toggleActive(id: string, is_active: boolean): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  // Client SESSION : le trigger d'audit capte l'acteur via auth.uid().
  const supabase = await createClient()

  // Garde anti lock-out : les comptes structurants (admin / super_admin) ne peuvent
  // pas etre desactives, meme par un admin ou une direction (sinon plus d'acces).
  const { data: target } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle()
  if (!target) return { error: 'Utilisateur introuvable.' }
  if (!is_active && (target.role === 'admin' || target.role === 'super_admin')) {
    return { error: 'Ce compte est structurant : il ne peut pas être désactivé.' }
  }

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

  // Table via client SESSION → l'acteur est capte par le trigger d'audit
  // (le compte auth, lui, ne peut etre modifie qu'avec le service-role).
  const session = await createClient()
  const { error: profileError } = await session.from('profiles').update({ email }).eq('id', id)
  if (profileError) return { error: "Erreur lors de la mise à jour de l'email." }

  revalidatePath('/dashboard/utilisateurs')
  return {}
}

// ─── Réinitialiser la 2FA d'un utilisateur (déblocage admin) ─────────────────

export async function resetUserTwoFactor(userId: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const admin = createAdminClient()

  const { data, error: listErr } = await admin.auth.admin.mfa.listFactors({ userId })
  if (listErr) return { error: 'Erreur lors de la lecture des facteurs 2FA.' }

  const totp = (data?.factors ?? []).filter(f => f.factor_type === 'totp')
  if (totp.length === 0) return { error: 'Ce compte n\'a pas de 2FA à réinitialiser.' }

  for (const f of totp) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id })
    if (delErr) return { error: 'Erreur lors de la réinitialisation de la 2FA.' }
  }

  // Traçabilité : client SESSION → l'acteur (admin connecté) est capté
  try {
    const session = await createClient()
    const { data: target } = await session.from('profiles').select('email').eq('id', userId).single()
    await logAudit(session, {
      action: 'UPDATE',
      entityType: 'auth',
      entityId: userId,
      description: `Réinitialisation de la 2FA du compte ${target?.email ?? userId}`,
    })
  } catch {
    // non bloquant
  }

  revalidatePath('/dashboard/utilisateurs')
  return {}
}

// ─── Réinitialiser le mot de passe ───────────────────────────────────────────

export async function sendPasswordReset(email: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  // NB : NEXT_PUBLIC_SITE_URL DOIT etre defini en production, sinon le lien du mail
  // pointe sur localhost (et l'URL doit figurer dans les Redirect URLs Supabase).
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback?next=/auth/reset-password`,
  })

  if (error) return { error: 'Erreur lors de l\'envoi de l\'email.' }

  // Tracabilite : action sensible declenchee par un admin/direction.
  // Client SESSION → l'acteur est capte (le client admin serait anonyme).
  try {
    const session = await createClient()
    await logAudit(session, {
      action: 'UPDATE',
      entityType: 'auth',
      description: `Envoi d'un lien de réinitialisation du mot de passe à ${email}`,
    })
  } catch {
    // non bloquant : la trace ne doit pas faire echouer l'envoi
  }

  return {}
}

/** Compte les dependances bloquantes d'un profil : paiements, echeances,
 *  reductions, depenses, recettes / absences relevees, appreciations, bulletins
 *  archives / heures de presence / fiche parents adossee au compte.
 *
 *  Le TYPE de retour est volontairement inline : un fichier `'use server'` ne
 *  peut exporter que des fonctions async — un `export interface` y provoque un
 *  500 sur toute modification (piege deja rencontre sur ce module). */
export async function getUserDeleteDeps(id: string): Promise<{
  finance: number; scolarite: number; presence: number; rattachement: number
}> {
  const supabase = await createClient()
  const head = { count: 'exact' as const, head: true }

  const [
    payments, installments, adjustments, expenses, revenues,
    absences, appreciations, archives,
    timeEntries,
    parentsT1, parentsT2,
  ] = await Promise.all([
    supabase.from('payments').select('id', head).eq('created_by', id),
    supabase.from('fee_installments').select('id', head).eq('recorded_by', id),
    supabase.from('fee_adjustments').select('id', head).eq('recorded_by', id),
    supabase.from('expenses').select('id', head).eq('created_by', id),
    supabase.from('other_revenues').select('id', head).eq('created_by', id),
    supabase.from('absences').select('id', head).eq('recorded_by', id),
    supabase.from('bulletin_appreciations').select('id', head).eq('updated_by', id),
    supabase.from('bulletin_archives').select('id', head).eq('archived_by', id),
    supabase.from('staff_time_entries').select('id', head).eq('profile_id', id),
    supabase.from('parents').select('id', head).eq('tutor1_user_id', id),
    supabase.from('parents').select('id', head).eq('tutor2_user_id', id),
  ])

  const n = (r: { count: number | null }) => r.count ?? 0
  return {
    finance:      n(payments) + n(installments) + n(adjustments) + n(expenses) + n(revenues),
    scolarite:    n(absences) + n(appreciations) + n(archives),
    presence:     n(timeEntries),
    rattachement: n(parentsT1) + n(parentsT2),
  }
}

/** Supprime definitivement un compte utilisateur (compte auth + profil en cascade).
 *
 *  Roles exclus :
 *    - admin / super_admin : comptes structurants ;
 *    - enseignant : passe par la liste des enseignants (fiche metier + Storage) ;
 *    - parent : passe par la fiche parents.
 *  On refuse aussi la suppression de SON PROPRE compte.
 */
export async function deleteUser(id: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()   // client SESSION → l'audit capte l'acteur
  const admin = createAdminClient()       // suppression du compte auth

  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === id) return { error: 'Vous ne pouvez pas supprimer votre propre compte.' }

  const { data: target } = await supabase
    .from('profiles')
    .select('role, first_name, last_name, email')
    .eq('id', id)
    .maybeSingle()
  if (!target) return { error: 'Utilisateur introuvable.' }

  if (target.role === 'admin' || target.role === 'super_admin') {
    return { error: 'Ce compte est structurant : il ne peut pas être supprimé.' }
  }
  if (target.role === 'enseignant') {
    return { error: 'Un enseignant se supprime depuis la liste des enseignants.' }
  }
  if (target.role === 'parent') {
    return { error: 'Un compte parent se gère depuis la fiche parents.' }
  }

  // Re-controle serveur : l'ecran a deja compte, mais lui seul ne protege pas
  // d'une donnee creee entre-temps ni d'un appel hors interface.
  const deps = await getUserDeleteDeps(id)
  if (deps.finance + deps.scolarite + deps.presence + deps.rattachement > 0) {
    return { error: 'Des données sont rattachées à ce compte. Rendez-le inactif plutôt que de le supprimer.' }
  }

  // Tracer AVANT d'effacer : apres coup, il n'y a plus rien a decrire.
  await logAudit(supabase, {
    action:      'DELETE',
    entityType:  'profiles',
    entityId:    id,
    description: `Suppression du compte ${target.last_name} ${target.first_name} (${target.email})`,
    oldData:     target as Record<string, unknown>,
  })

  // Le profil part en cascade avec le compte auth (profiles.id → auth.users).
  const { error: authError } = await admin.auth.admin.deleteUser(id)
  if (authError) return { error: "Erreur lors de la suppression du compte." }

  revalidatePath('/dashboard/utilisateurs')
  return {}
}
