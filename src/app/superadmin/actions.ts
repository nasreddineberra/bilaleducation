'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { validatePasswordServer } from '@/lib/validation/password'
import { validateSlug } from '@/lib/tenant/slug'
import { requireEditor } from '@/lib/auth/requireEditor'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { schoolUrl } from '@/lib/tenant/console-url'

/**
 * Envoie le lien de définition du mot de passe, sur le SOUS-DOMAINE de l'école.
 *
 * L'email part par Supabase Auth : c'est lui qui fabrique le jeton à usage
 * unique, gère son expiration et sait le vérifier. Le reconstruire nous-mêmes
 * n'aurait apporté que la possibilité de se tromper.
 *
 * NON BLOQUANT : un compte reste créé même si l'email échoue — adresse erronée,
 * quota atteint, expéditeur non configuré. Le mot de passe temporaire sert alors
 * de repli, et l'appelant est informé pour pouvoir le dire à l'écran.
 */
async function envoyerLienMotDePasse(email: string, slug: string): Promise<boolean> {
  const { error } = await createAdminClient().auth.resetPasswordForEmail(email, {
    redirectTo: schoolUrl(slug, '/auth/callback?next=/auth/reset-password'),
  })
  if (error) console.error('[superadmin] envoi du lien de mot de passe:', error)
  return !error
}

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
  /** Échéance d'abonnement, réglable dès l'ouverture du compte client. */
  subscription_expires_at?: string | null
  /** Limite d'élèves (mode essai) ; absente = illimité. */
  max_students?: number | null
  director: {
    first_name: string
    last_name:  string
    email:      string
    password:   string
  }
}): Promise<{ error?: string; id?: string; emailEnvoye?: boolean }> {
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  // Le slug DEVIENT le sous-domaine et n'est pas modifiable ensuite : on refuse
  // avant plutot que de corriger apres. Le formulaire fait le meme controle pour
  // le retour immediat, mais lui seul ne protege de rien — un appel direct a
  // l'API le contourne.
  const slugError = validateSlug(data.slug)
  if (slugError) return { error: slugError }

  // Une limite d'élèves nulle ou négative n'a pas de sens et bloquerait toute
  // inscription : on la refuse plutôt que de l'enregistrer.
  if (data.max_students != null && (!Number.isInteger(data.max_students) || data.max_students < 1)) {
    return { error: "La limite d'élèves doit être un nombre entier supérieur à zéro." }
  }

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
      subscription_expires_at: data.subscription_expires_at || null,
      max_students:            data.max_students ?? null,
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

  const emailEnvoye = await envoyerLienMotDePasse(data.director.email, data.slug.trim().toLowerCase())

  await logAudit(await createClient(), {
    action: 'INSERT',
    entityType: 'etablissements',
    entityId: etablissement.id,
    description: `Console éditeur · établissement « ${data.nom.trim()} » créé (${data.slug.trim().toLowerCase()}) avec sa direction`,
    etablissementId: etablissement.id,
  })

  revalidatePath('/superadmin')
  return { id: etablissement.id, emailEnvoye }
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
  }).eq('id', id)

  if (error) {
    console.error('[superadmin] updateEtablissement:', error)
    return { error: 'Erreur lors de la mise à jour.' }
  }

  // Les notes vivent dans une table RÉSERVÉE À L'ÉDITEUR : elles portent des
  // observations commerciales sur le client, et la ligne `etablissements` est
  // lisible par toute l'école. Voir `move-etablissement-notes-to-editor-table.sql`.
  const notes = data.notes?.trim() || null
  const { error: notesError } = await supabase
    .from('etablissement_notes')
    .upsert({ etablissement_id: id, notes }, { onConflict: 'etablissement_id' })

  if (notesError) {
    console.error('[superadmin] updateEtablissement (notes):', notesError)
    return { error: "Erreur lors de l'enregistrement des notes." }
  }

  // La trace ne dit PAS ce que contiennent les notes : le journal de l'école est
  // lisible par son admin et sa direction.
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
 * Le SEUL rôle que la console peut attribuer.
 *
 * DÉCISION DE L'ÉDITEUR (7 août) : il ouvre la porte, l'école range sa maison.
 * Créer le compte de direction fait partie de la mise en service d'un client ;
 * ses enseignants, son secrétariat et sa comptabilité relèvent d'elle, et elle
 * dispose pour cela de son propre écran Utilisateurs.
 *
 * Ce n'est pas qu'une question d'ergonomie : chaque compte créé d'ici serait un
 * compte que l'éditeur devrait ensuite maintenir — mot de passe oublié, départ,
 * changement de rôle. Refuser à la création, c'est refuser la suite.
 *
 * `super_admin` en est évidemment absent : la console crée des comptes CHEZ UN
 * CLIENT, jamais un second éditeur. `admin` aussi — ce rôle est le sommet de
 * l'école, il se donne depuis l'école.
 *
 * Vérifié côté serveur : le formulaire ne protège de rien.
 */
const ROLES_TENANT = ['direction'] as const

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

  const { data: ecoleSlug } = await supabase
    .from('etablissements').select('slug').eq('id', etablissementId).single()
  if (ecoleSlug?.slug) await envoyerLienMotDePasse(data.email, ecoleSlug.slug)

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

// ─── Renvoyer le lien de définition du mot de passe ──────────────────────────

/**
 * Renvoie le lien à un utilisateur d'une école, depuis la console.
 *
 * CLOISONNÉE comme `updateTenantUser` : le compte est lu en exigeant qu'il
 * appartienne à l'établissement affiché. Sans ce filtre, un identifiant forgé
 * enverrait un lien de réinitialisation au compte de n'importe quel client —
 * l'action s'exécute en service-role, aucune RLS ne la rattraperait.
 */
export async function resendTenantUserReset(
  profileId: string,
  etablissementId: string,
): Promise<{ error?: string; email?: string }> {
  const { error: roleError } = await requireEditor()
  if (roleError) return { error: roleError }

  const supabase = createAdminClient()

  const { data: cible } = await supabase
    .from('profiles')
    .select('email, last_name, first_name, etablissements:etablissement_id(slug)')
    .eq('id', profileId)
    .eq('etablissement_id', etablissementId)
    .maybeSingle()

  if (!cible?.email) return { error: "Ce compte n'appartient pas à cet établissement." }

  const slug = (cible.etablissements as unknown as { slug: string } | null)?.slug
  if (!slug) return { error: 'Établissement introuvable.' }

  if (!(await envoyerLienMotDePasse(cible.email, slug))) {
    return { error: "L'email n'a pas pu être envoyé. Vérifiez la messagerie du projet Supabase." }
  }

  await logAudit(await createClient(), {
    action: 'UPDATE',
    entityType: 'auth',
    entityId: profileId,
    description: `Console éditeur · lien de mot de passe renvoyé à ${cible.last_name} ${cible.first_name}`,
    etablissementId,
  })

  return { email: cible.email }
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
