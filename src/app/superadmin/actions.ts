'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { validatePasswordServer } from '@/lib/validation/password'
import { validateSlug } from '@/lib/tenant/slug'
import { requireEditor } from '@/lib/auth/requireEditor'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

/**
 * Toutes les actions de cette console sont gardees par `requireEditor`, qui lit
 * la COLONNE BRUTE du role — jamais `requireRoleServer`, qui compare le role
 * EFFECTIF et repond `admin` pendant une intervention de support : la console
 * cesserait alors de fonctionner au moment ou l'editeur est entre dans une ecole.
 *
 * Elles s'executent en service-role, donc HORS RLS : chaque ecriture doit porter
 * son propre cloisonnement, rien ne la rattrapera.
 *
 * La tracabilite passe par `logAudit` avec un etablissement EXPLICITE : l'editeur
 * n'en a aucun hors intervention, et la trace serait abandonnee en silence.
 */

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
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  // Le slug DEVIENT le sous-domaine et n'est pas modifiable ensuite : on refuse
  // avant plutot que de corriger apres. Le formulaire fait le meme controle pour
  // le retour immediat, mais lui seul ne protege de rien — un appel direct a
  // l'API le contourne.
  const slugError = validateSlug(data.slug)
  if (slugError) return { error: slugError }

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
    app_metadata:  { role: 'direction', etablissement_id: etablissement.id },
  })

  if (authError) {
    // Annuler la création de l'établissement
    await supabase.from('etablissements').delete().eq('id', etablissement.id)
    if (authError.message.includes('already registered')) {
      return { error: 'Cette adresse email est déjà utilisée.' }
    }
    return { error: authError.message }
  }

  // 3. Insérer le profil du directeur dans une transaction atomique via RPC
  const { error: rpcError } = await supabase.rpc('create_profile_only', {
    p_profile_id:       authData.user.id,
    p_email:            data.director.email,
    p_role:             'direction',
    p_first_name:       data.director.first_name.trim(),
    p_last_name:        data.director.last_name.trim(),
    p_civilite:         null,
    p_phone:            null,
    p_is_active:        true,
    p_etablissement_id: etablissement.id,
  })

  if (rpcError) {
    await supabase.auth.admin.deleteUser(authData.user.id).catch((e) =>
      console.error('[createTenant] Échec du rollback auth:', e)
    )
    await supabase.from('etablissements').delete().eq('id', etablissement.id)
    return { error: `Erreur lors de la création du profil directeur : ${rpcError.message}` }
  }

  await logAudit(await createClient(), {
    action: 'INSERT',
    entityType: 'etablissements',
    entityId: etablissement.id,
    description: `Console éditeur · établissement « ${data.nom.trim()} » créé (${data.slug.trim().toLowerCase()}) avec sa direction`,
    etablissementId: etablissement.id,
  })

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
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase.from('etablissements').update({
    nom:       data.nom.trim(),
    adresse:   data.adresse?.trim()   || null,
    telephone: data.telephone?.trim() || null,
    contact:   data.contact?.trim()   || null,
    notes:     data.notes?.trim()     || null,
  }).eq('id', id)

  if (error) {
    console.error('[superadmin] updateEtablissement:', error)
    return { error: 'Erreur lors de la mise à jour.' }
  }

  await logAudit(await createClient(), {
    action: 'UPDATE',
    entityType: 'etablissements',
    entityId: id,
    description: "Console éditeur · informations de l'établissement modifiées",
    etablissementId: id,
  })

  revalidatePath(`/superadmin/ecoles/${id}`)
  revalidatePath('/superadmin')
  return {}
}

// ─── Activer / désactiver un établissement ────────────────────────────────────

export async function toggleEtablissementActive(
  id: string,
  is_active: boolean
): Promise<{ error?: string }> {
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('etablissements')
    .update({ is_active })
    .eq('id', id)

  if (error) {
    console.error('[superadmin] toggleEtablissementActive:', error)
    return { error: 'Erreur lors de la mise à jour du statut.' }
  }

  await logAudit(await createClient(), {
    action: 'UPDATE',
    entityType: 'etablissements',
    entityId: id,
    description: `Console éditeur · établissement ${is_active ? 'réactivé' : 'DÉSACTIVÉ (accès coupé)'}`,
    etablissementId: id,
  })

  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/ecoles/${id}`)
  return {}
}

// ─── Modifier la limite d'élèves ─────────────────────────────────────────────

export async function updateMaxStudents(
  id: string,
  max_students: number | null
): Promise<{ error?: string }> {
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('etablissements')
    .update({ max_students })
    .eq('id', id)

  if (error) {
    console.error('[superadmin] updateMaxStudents:', error)
    return { error: 'Erreur lors de la mise à jour.' }
  }

  await logAudit(await createClient(), {
    action: 'UPDATE',
    entityType: 'etablissements',
    entityId: id,
    description: `Console éditeur · limite d'élèves ${max_students === null ? 'retirée' : `portée à ${max_students}`}`,
    etablissementId: id,
  })

  revalidatePath(`/superadmin/ecoles/${id}`)
  return {}
}

// ─── Modifier la date d'expiration de l'abonnement ───────────────────────────

export async function updateSubscription(
  id: string,
  expires_at: string | null
): Promise<{ error?: string }> {
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('etablissements')
    .update({ subscription_expires_at: expires_at })
    .eq('id', id)

  if (error) {
    // Le message affiché reste générique — on n'expose pas le détail d'une
    // erreur de base à l'écran. Mais il était AUSSI perdu côté serveur : cet
    // échec-ci a demandé de rejouer la requête à la main pour découvrir un
    // 42703. La cause part désormais dans les journaux.
    console.error('[superadmin] updateSubscription:', error)
    return { error: 'Erreur lors de la mise à jour de l\'abonnement.' }
  }

  await logAudit(await createClient(), {
    action: 'UPDATE',
    entityType: 'etablissements',
    entityId: id,
    description: `Console éditeur · abonnement ${expires_at ? `prolongé jusqu'au ${expires_at}` : 'sans date d\'expiration'}`,
    etablissementId: id,
  })

  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/ecoles/${id}`)
  return {}
}

// ─── Créer un utilisateur dans un établissement ───────────────────────────────

/**
 * Rôles qu'un compte d'école peut porter.
 *
 * `super_admin` en est absent, et c'est le point : la console crée des comptes
 * CHEZ UN CLIENT, jamais un second éditeur. `admin` en est absent aussi — le
 * rôle d'administration d'une école se donne depuis l'école. La liste est
 * vérifiée côté serveur : le formulaire ne protège de rien.
 */
const ROLES_TENANT = [
  'direction', 'comptable', 'responsable_pedagogique',
  'enseignant', 'secretaire', 'parent',
] as const

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
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  if (!(ROLES_TENANT as readonly string[]).includes(data.role)) {
    return { error: 'Ce rôle ne peut pas être attribué depuis la console.' }
  }

  const supabase = createAdminClient()

  // Validation du mot de passe côté serveur
  const pwdError = validatePasswordServer(data.password, data.first_name, data.last_name)
  if (pwdError) {
    return { error: `Le mot de passe ne respecte pas la règle : ${pwdError}` }
  }

  // `app_metadata` est INDISPENSABLE : le middleware y lit le rôle et
  // l'établissement. Sans elle, le compte est traité comme un `parent` — donc
  // **dispensé de 2FA** — et le contrôle d'appartenance au sous-domaine ne peut
  // pas s'appliquer. `createTenant` le posait, pas cette fonction : les deux
  // chemins de création divergeaient.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:         data.email,
    password:      data.password,
    email_confirm: true,
    app_metadata:  { role: data.role, etablissement_id: etablissementId },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Cette adresse email est déjà utilisée.' }
    }
    return { error: authError.message }
  }

  const { error: rpcError } = await supabase.rpc('create_profile_only', {
    p_profile_id:       authData.user.id,
    p_email:            data.email,
    p_role:             data.role,
    p_first_name:       data.first_name.trim(),
    p_last_name:        data.last_name.trim(),
    p_civilite:         null,
    p_phone:            null,
    p_is_active:        true,
    p_etablissement_id: etablissementId,
  })

  if (rpcError) {
    await supabase.auth.admin.deleteUser(authData.user.id).catch((e) =>
      console.error('[createTenantUser] Échec du rollback auth:', e)
    )
    return { error: `Erreur lors de la création du profil : ${rpcError.message}` }
  }

  await logAudit(await createClient(), {
    action: 'INSERT',
    entityType: 'profiles',
    entityId: authData.user.id,
    description: `Console éditeur · compte ${data.role} créé pour ${data.last_name.trim()} ${data.first_name.trim()}`,
    etablissementId,
  })

  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return {}
}

// ─── Modifier un utilisateur d'un établissement ──────────────────────────────

export async function updateTenantUser(
  profileId: string,
  etablissementId: string,
  data: { role?: string; is_active?: boolean }
): Promise<{ error?: string }> {
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  if (data.role !== undefined && !(ROLES_TENANT as readonly string[]).includes(data.role)) {
    return { error: 'Ce rôle ne peut pas être attribué depuis la console.' }
  }

  const supabase = createAdminClient()

  // CLOISONNEMENT EXPLICITE. On écrit en service-role, donc hors RLS : rien ne
  // rattraperait un identifiant qui désigne le profil d'une AUTRE école — ou
  // celui de l'éditeur lui-même. Le filtre sur l'établissement affiché est la
  // seule barrière.
  const { data: modifie, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', profileId)
    .eq('etablissement_id', etablissementId)
    .select('id, role, is_active, last_name, first_name')

  if (error) {
    console.error('[superadmin] updateTenantUser:', error)
    return { error: 'Erreur lors de la mise à jour.' }
  }
  // Zéro ligne n'est PAS une erreur pour PostgREST : sans ce contrôle, une cible
  // hors de l'école passerait pour un succès.
  if (!modifie?.length) return { error: "Ce compte n'appartient pas à cet établissement." }

  const p = modifie[0]
  const quoi = data.role !== undefined
    ? `rôle changé en ${data.role}`
    : `compte ${p.is_active ? 'réactivé' : 'désactivé'}`
  await logAudit(await createClient(), {
    action: 'UPDATE',
    entityType: 'profiles',
    entityId: profileId,
    description: `Console éditeur · ${p.last_name} ${p.first_name} · ${quoi}`,
    etablissementId,
  })

  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return {}
}
