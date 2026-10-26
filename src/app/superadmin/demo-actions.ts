'use server'

import { randomInt } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireEditor } from '@/lib/auth/requireEditor'
import { tracerActionEditeur } from '@/lib/support/actions-editeur'
import { validatePasswordServer } from '@/lib/validation/password'
import { pluriel } from '@/lib/texte/pluriel'

/**
 * ECOLE DE DEMONSTRATION (console de l'editeur).
 *
 * Une ecole comme les autres, marquee `est_demo`, que l'editeur montre aux
 * prospects. Le travail de donnees est en base (`add-ecole-demo.sql`) :
 * `reinitialiser_ecole_demo` vide puis repeuple en UNE transaction, et refuse
 * toute ecole non marquee. Ces actions ne font que ce que le SQL ne sait pas
 * faire : creer les COMPTES de connexion (API d'authentification) et effacer les
 * FICHIERS (le Storage n'est pas une table).
 *
 * Les comptes sont crees UNE fois et conserves aux remises a zero : leur 2FA
 * s'enrole une seule fois. Adresses en `.invalid`, domaine garanti sans
 * messagerie — et l'ecole n'a pas de messagerie configuree : aucun email ne peut
 * partir vers une adresse inventee.
 */

const SLUG_DEMO = 'demonstration'
const DOMAINE = 'demonstration.invalid'

// Noms fictifs et cosmopolites : l'application ne vise aucune communaute en
// particulier. Ils sont remis a jour a chaque remise a zero (`appliquerComptes`),
// un changement ici prend donc effet sans recreer les comptes.
const COMPTES = [
  { role: 'direction',               civilite: 'M.',  nom: 'MOREAU',    prenom: 'Laurent',  email: 'direction' },
  { role: 'comptable',               civilite: 'Mme', nom: 'COSTA',     prenom: 'Ana',      email: 'comptable' },
  { role: 'secretaire',              civilite: 'Mme', nom: 'NGUYEN',    prenom: 'Linh',     email: 'secretariat' },
  { role: 'responsable_pedagogique', civilite: 'M.',  nom: 'BIANCHI',   prenom: 'Marco',    email: 'pedagogie' },
  { role: 'enseignant',              civilite: 'Mme', nom: 'LEFEBVRE',  prenom: 'Camille',  email: 'enseignant1' },
  { role: 'enseignant',              civilite: 'M.',  nom: 'OKAFOR',    prenom: 'Daniel',   email: 'enseignant2' },
  { role: 'enseignant',              civilite: 'Mme', nom: 'BENSAID',   prenom: 'Yasmina',  email: 'enseignant3' },
] as const

const LIGNE_MDP = 'Mot de passe commun des comptes : '

/** Notes internes de la fiche : mot de passe + liste des comptes. */
function notesDemo(mdp: string | null): string {
  return [
    'École de démonstration (données fictives).',
    `${LIGNE_MDP}${mdp ?? '(inconnu)'}`,
    ...COMPTES.map(c => `${c.email}@${DOMAINE} · ${c.nom} ${c.prenom}`),
  ].join('\n')
}

/**
 * Remet les noms des comptes a ceux de `COMPTES`, par adresse. Ni le mot de
 * passe ni la 2FA ne sont touches (ils vivent dans `auth`, pas dans `profiles`).
 * Appelee AVANT le peuplement : les fiches enseignant sont recreees depuis les
 * profils. Les notes de la fiche suivent, en gardant le mot de passe range.
 */
async function appliquerComptes(admin: ReturnType<typeof createAdminClient>, etablissementId: string): Promise<void> {
  for (const c of COMPTES) {
    const { error } = await admin.from('profiles')
      .update({ civilite: c.civilite, first_name: c.prenom, last_name: c.nom })
      .eq('etablissement_id', etablissementId).eq('email', `${c.email}@${DOMAINE}`).select('id')
    if (error) console.error('[demo] nom du compte %s non mis a jour :', c.email, error)
  }
  const mdp = await lireMotDePasse(admin, etablissementId)
  const { error } = await admin.from('etablissement_notes').upsert({ etablissement_id: etablissementId, notes: notesDemo(mdp) })
  if (error) console.error('[demo] notes:', error)
}

/** Mot de passe commun range dans les notes de la fiche (`null` s'il n'y est plus). */
async function lireMotDePasse(admin: ReturnType<typeof createAdminClient>, etablissementId: string): Promise<string | null> {
  const { data } = await admin.from('etablissement_notes').select('notes').eq('etablissement_id', etablissementId).maybeSingle()
  const ligne = (data?.notes ?? '').split('\n').find((l: string) => l.startsWith(LIGNE_MDP))
  return ligne ? ligne.slice(LIGNE_MDP.length).trim() || null : null
}

/**
 * Cree UN compte de la demonstration : connexion (API d'authentification) puis
 * profil. Si le profil echoue, le compte de connexion est retire : pas de compte
 * orphelin. Partagee par la creation de l'ecole et par la remise a zero (qui
 * recree les comptes disparus, apres un depart de l'ecole par exemple).
 */
async function creerCompteDemo(
  admin: ReturnType<typeof createAdminClient>, c: (typeof COMPTES)[number], etablissementId: string, mdp: string,
): Promise<{ id?: string; error?: string }> {
  const email = `${c.email}@${DOMAINE}`
  const { data: auth, error: eAuth } = await admin.auth.admin.createUser({
    email, password: mdp, email_confirm: true,
    app_metadata: { role: c.role, etablissement_id: etablissementId },
  })
  if (eAuth || !auth.user) return { error: `Création du compte ${email} impossible : ${eAuth?.message ?? 'réponse vide'}` }
  const { error: eProfil } = await admin.from('profiles').insert({
    id: auth.user.id, email, role: c.role, civilite: c.civilite,
    first_name: c.prenom, last_name: c.nom, is_active: true, etablissement_id: etablissementId,
  })
  if (eProfil) {
    await admin.auth.admin.deleteUser(auth.user.id).catch(e => console.error('[demo] retrait du compte orphelin:', e))
    return { error: `Création du profil ${email} impossible : ${eProfil.message}` }
  }
  return { id: auth.user.id }
}

type Fichier = { bucket: string; nom: string }

/** Un mot de passe commun aux comptes de demonstration, conforme aux regles. */
function motDePasse(): string {
  const lettres = 'abcdefghjkmnpqrstuvwxyz'
  const l = () => lettres[randomInt(lettres.length)]
  return `Demo#${randomInt(1000, 10000)}${l().toUpperCase()}${l()}${l()}`
}

/** Efface les fichiers deposes pendant une demonstration ; rend le nombre efface. */
async function effacerFichiers(admin: ReturnType<typeof createAdminClient>, fichiers: Fichier[]): Promise<number> {
  const parBucket = new Map<string, string[]>()
  for (const f of fichiers) parBucket.set(f.bucket, [...(parBucket.get(f.bucket) ?? []), f.nom])
  let n = 0
  for (const [bucket, noms] of parBucket) {
    const { data, error } = await admin.storage.from(bucket).remove(noms)
    if (error) console.error('[demo] fichiers non effaces (%s) :', bucket, error)
    n += data?.length ?? 0
  }
  return n
}

/**
 * Le logo de l'école de démonstration est celui de Bilal Education. Il est
 * déposé là où une école dépose le sien (`etablissement-logos/{id}/logo.png`),
 * pour s'afficher partout comme un vrai logo d'école : console, barre latérale,
 * écrans de connexion, en-têtes des PDF.
 *
 * Source : l'icône de l'application (version transparente), lue sur le SITE en
 * production — les sources ne sont pas présentes sur le serveur déployé — et sur
 * le disque en local. Reposé à chaque remise à zéro : si le logo de l'application
 * change, la démonstration suit. Non bloquant : rend `false` si la copie échoue.
 */
async function poserLogoDemo(admin: ReturnType<typeof createAdminClient>, etablissementId: string): Promise<boolean> {
  try {
    let octets: Uint8Array | null = null
    const site = process.env.NEXT_PUBLIC_SITE_URL
    if (site) {
      const r = await fetch(new URL('/icon.png', site), { cache: 'no-store' })
      if (r.ok) octets = new Uint8Array(await r.arrayBuffer())
    }
    if (!octets) octets = new Uint8Array(await readFile(path.join(process.cwd(), 'src', 'app', 'icon.png')))

    const chemin = `${etablissementId}/logo.png`
    const { error: eUp } = await admin.storage.from('etablissement-logos')
      .upload(chemin, octets, { upsert: true, contentType: 'image/png' })
    if (eUp) throw eUp
    const { data: { publicUrl } } = admin.storage.from('etablissement-logos').getPublicUrl(chemin)
    const { error: eMaj } = await admin.from('etablissements')
      .update({ logo_url: `${publicUrl}?t=${Date.now()}` }).eq('id', etablissementId).select('id')
    if (eMaj) throw eMaj
    return true
  } catch (e) {
    console.error('[demo] logo:', e)
    return false
  }
}

export async function creerEcoleDemo(): Promise<{ error?: string; id?: string; motDePasse?: string; logo?: boolean }> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const admin = createAdminClient()
  const { data: existe } = await admin.from('etablissements').select('id').or(`est_demo.eq.true,slug.eq.${SLUG_DEMO}`).limit(1)
  if (existe?.length) return { error: "L'école de démonstration existe déjà." }

  const mdp = motDePasse()
  for (const c of COMPTES) {
    if (validatePasswordServer(mdp, c.prenom, c.nom)) return { error: 'Génération du mot de passe impossible. Réessayez.' }
  }

  const { data: ecole, error: eEtab } = await admin.from('etablissements')
    .insert({ slug: SLUG_DEMO, nom: 'ÉCOLE DÉMONSTRATION', is_active: true, est_demo: true, week_start_day: 1, working_days: 7 })
    .select('id').single()
  if (eEtab || !ecole) return { error: `Création de l'école impossible : ${eEtab?.message ?? 'réponse vide'}` }

  // Rollback complet si un compte echoue : une ecole de demonstration a moitie
  // creee n'aurait pas ses trois enseignants et ne se peuplerait pas.
  const crees: string[] = []
  const annuler = async (motif: string) => {
    for (const id of crees) await admin.auth.admin.deleteUser(id).catch(e => console.error('[demo] rollback compte:', e))
    const { error } = await admin.from('etablissements').delete().eq('id', ecole.id).select('id')
    if (error) console.error('[demo] rollback ecole:', error)
    return { error: motif }
  }

  for (const c of COMPTES) {
    const r = await creerCompteDemo(admin, c, ecole.id, mdp)
    if (r.error || !r.id) return annuler(r.error ?? 'Création d\'un compte impossible.')
    crees.push(r.id)
  }

  const { error: ePeuple } = await admin.rpc('reinitialiser_ecole_demo', { p_id: ecole.id })
  if (ePeuple) return annuler(`Peuplement impossible : ${ePeuple.message}`)

  // Le mot de passe n'est affiche qu'une fois a l'ecran : on le garde aussi dans
  // les notes de l'EDITEUR (table serveur uniquement), seul endroit ou il le
  // retrouvera. Ce sont des comptes de demonstration sur donnees fictives.
  const { error: eNotes } = await admin.from('etablissement_notes').upsert({ etablissement_id: ecole.id, notes: notesDemo(mdp) })
  if (eNotes) console.error('[demo] notes:', eNotes)

  const logo = await poserLogoDemo(admin, ecole.id)

  await tracerActionEditeur(await createClient(), { etablissementId: ecole.id, description: "Création de l'école de démonstration" })
  revalidatePath('/superadmin')
  return { id: ecole.id, motDePasse: mdp, logo }
}

// ─── ACCES PROSPECT ──────────────────────────────────────────────────────────
//
// L'editeur donne a un prospect l'usage d'un compte de la demonstration en y
// mettant SON adresse, puis le « retablit » (ou remet l'ecole a zero, ce qui
// retablit tous les comptes). Trois precautions, sans lesquelles l'acces ne
// marcherait pas ou exposerait les autres comptes :
//   - la 2FA du compte est retiree : enrolee sur le telephone de l'editeur, elle
//     bloquerait le prospect ; l'application lui fera enroler la sienne ;
//   - le compte recoit un mot de passe PROPRE : le mot de passe commun ouvre les
//     six autres comptes ;
//   - au retablissement, ses sessions ouvertes sont coupees
//     (`demo_couper_sessions`), sinon un jeton de rafraichissement survivrait.
//
// IDENTITE DE DEMONSTRATION : la remise a zero retrouvait chaque compte par son
// adresse. Une adresse de prospect la casserait : la cle (`enseignant1`...) est
// donc rangee dans `app_metadata.demo_compte` au premier changement d'adresse
// (fusionne par l'API, `role` et `etablissement_id` sont conserves).

type CompteDemo = { id: string; email: string; cle: string | null; prenom: string; nom: string }

/** Compte de la demonstration, CLOISONNE : il doit appartenir a l'ecole affichee, marquee demo. */
async function lireCompteDemo(
  admin: ReturnType<typeof createAdminClient>, profileId: string, etablissementId: string,
): Promise<CompteDemo | { error: string }> {
  const { data: ecole } = await admin.from('etablissements').select('est_demo').eq('id', etablissementId).maybeSingle()
  if (!ecole?.est_demo) return { error: "Ce n'est pas l'école de démonstration." }
  const { data: p } = await admin.from('profiles').select('id, email, first_name, last_name')
    .eq('id', profileId).eq('etablissement_id', etablissementId).maybeSingle()
  if (!p) return { error: "Ce compte n'appartient pas à l'école de démonstration." }
  const { data: u } = await admin.auth.admin.getUserById(profileId)
  const email = String(p.email ?? '')
  const parAdresse = email.endsWith(`@${DOMAINE}`) ? email.slice(0, -DOMAINE.length - 1) : null
  const cle = (u?.user?.app_metadata?.demo_compte as string | undefined) ?? parAdresse
  return { id: p.id, email, cle: cle && COMPTES.some(c => c.email === cle) ? cle : null, prenom: p.first_name ?? '', nom: p.last_name ?? '' }
}

/** Retire la 2FA du compte et coupe ses sessions. Rend un message si quelque chose a echoue. */
async function remettreAuPropre(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId })
  if (error) return 'lecture de la 2FA impossible'
  for (const f of data?.factors ?? []) {
    const { error: e } = await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id })
    if (e) return 'retrait de la 2FA impossible'
  }
  const { error: eS } = await admin.rpc('demo_couper_sessions', { p_user: userId })
  if (eS) return 'coupure des sessions impossible'
  return null
}

const estEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export async function ouvrirAccesProspect(
  profileId: string, etablissementId: string, email: string, motDePasse: string,
): Promise<{ error?: string }> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const adresse = email.trim().toLowerCase()
  if (!estEmail(adresse)) return { error: 'Adresse email invalide.' }
  if (adresse.endsWith(`@${DOMAINE}`)) return { error: `Saisissez l'adresse du prospect, pas une adresse @${DOMAINE}.` }

  const admin = createAdminClient()
  const compte = await lireCompteDemo(admin, profileId, etablissementId)
  if ('error' in compte) return compte
  if (!compte.cle) return { error: "Ce compte n'est pas un compte de démonstration reconnu." }

  const mdpInvalide = validatePasswordServer(motDePasse, compte.prenom, compte.nom)
  if (mdpInvalide) return { error: mdpInvalide }

  const { data: deja } = await admin.from('profiles').select('id').ilike('email', adresse).neq('id', profileId).limit(1)
  if (deja?.length) return { error: 'Cette adresse est déjà utilisée par un autre compte.' }

  // Sessions et 2FA d'abord : si l'editeur avait ouvert ce compte, rien ne
  // doit passer au prospect.
  const sale = await remettreAuPropre(admin, profileId)
  if (sale) return { error: `Accès non ouvert : ${sale}.` }

  const { error: eAuth } = await admin.auth.admin.updateUserById(profileId, {
    email: adresse, email_confirm: true, password: motDePasse,
    app_metadata: { demo_compte: compte.cle },
  })
  if (eAuth) {
    return { error: /already|exists|registered/i.test(eAuth.message) ? 'Cette adresse est déjà utilisée par un autre compte.' : `Adresse non modifiée : ${eAuth.message}` }
  }
  const { error: eProfil } = await admin.from('profiles').update({ email: adresse })
    .eq('id', profileId).eq('etablissement_id', etablissementId).select('id')
  if (eProfil) console.error('[demo] email du profil non mis a jour :', eProfil)

  await tracerActionEditeur(await createClient(), {
    etablissementId,
    description: `Accès prospect ouvert : ${compte.nom} ${compte.prenom} (${compte.cle}) → ${adresse}`,
  })
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return {}
}

/** Rend son adresse, le mot de passe commun et un etat sans 2FA ni session a un compte. */
async function retablir(
  admin: ReturnType<typeof createAdminClient>, compte: CompteDemo, etablissementId: string, mdp: string | null,
): Promise<string | null> {
  if (!compte.cle) return `${compte.email} : compte de démonstration non reconnu`
  const origine = `${compte.cle}@${DOMAINE}`
  const sale = await remettreAuPropre(admin, compte.id)
  if (sale) return `${compte.email} : ${sale}`
  const { error } = await admin.auth.admin.updateUserById(compte.id, {
    email: origine, email_confirm: true, ...(mdp ? { password: mdp } : {}),
  })
  if (error) return `${compte.email} : ${error.message}`
  const { error: eProfil } = await admin.from('profiles').update({ email: origine })
    .eq('id', compte.id).eq('etablissement_id', etablissementId).select('id')
  if (eProfil) return `${compte.email} : profil non mis à jour`
  return null
}

function motDePasseCommun(notes: string | null | undefined): string | null {
  const ligne = (notes ?? '').split('\n').find(l => l.startsWith(LIGNE_MDP))
  const mdp = ligne ? ligne.slice(LIGNE_MDP.length).trim() : ''
  return mdp && mdp !== '(inconnu)' ? mdp : null
}

export async function retablirCompteDemo(profileId: string, etablissementId: string): Promise<{ error?: string; avertissement?: string }> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const admin = createAdminClient()
  const compte = await lireCompteDemo(admin, profileId, etablissementId)
  if ('error' in compte) return compte
  const { data: n } = await admin.from('etablissement_notes').select('notes').eq('etablissement_id', etablissementId).maybeSingle()
  const mdp = motDePasseCommun(n?.notes)

  const echec = await retablir(admin, compte, etablissementId, mdp)
  if (echec) return { error: `Rétablissement incomplet · ${echec}` }

  await tracerActionEditeur(await createClient(), {
    etablissementId,
    description: `Accès prospect fermé : ${compte.nom} ${compte.prenom} (${compte.cle}), ancienne adresse ${compte.email}`,
  })
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return mdp ? {} : { avertissement: 'Adresse rétablie, mais le mot de passe commun est introuvable dans les notes : le mot de passe du prospect reste en place.' }
}

/** Retablit tous les comptes dont l'adresse n'est plus celle d'origine. Rend les echecs. */
async function retablirTous(admin: ReturnType<typeof createAdminClient>, etablissementId: string): Promise<string[]> {
  const { data: profils } = await admin.from('profiles').select('id, email').eq('etablissement_id', etablissementId)
  const { data: n } = await admin.from('etablissement_notes').select('notes').eq('etablissement_id', etablissementId).maybeSingle()
  const mdp = motDePasseCommun(n?.notes)
  const echecs: string[] = []
  for (const p of profils ?? []) {
    if (String(p.email ?? '').endsWith(`@${DOMAINE}`)) continue
    const compte = await lireCompteDemo(admin, p.id, etablissementId)
    // Pas un compte de demonstration (l'editeur en intervention, un compte cree
    // a la main pendant une demo) : il n'a pas d'adresse d'origine a retrouver.
    if ('error' in compte || !compte.cle) continue
    const echec = await retablir(admin, compte, etablissementId, mdp)
    if (echec) echecs.push(echec)
  }
  return echecs
}

export async function reinitialiserEcoleDemo(etablissementId: string): Promise<{ error?: string; fichiers?: number; logo?: boolean; recrees?: number }> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const admin = createAdminClient()
  // Marquee « demo » AVANT de toucher aux noms des comptes : la RPC le verifie,
  // mais elle passe apres.
  const { data: ecole } = await admin.from('etablissements').select('est_demo').eq('id', etablissementId).maybeSingle()
  if (!ecole?.est_demo) return { error: "Ce n'est pas l'école de démonstration." }
  // Fin de TOUS les acces prospects : les adresses d'origine d'abord, sans
  // quoi `appliquerComptes` (qui retrouve les comptes par adresse) les sauterait.
  const echecs = await retablirTous(admin, etablissementId)
  if (echecs.length) return { error: `Accès prospects non fermés, remise à zéro annulée · ${echecs.join(' · ')}` }

  // Comptes DISPARUS (un depart de l'ecole les supprime, RGPD) : recrees avec le
  // mot de passe commun des notes, sinon un nouveau, range a son tour. Leur 2FA
  // est perdue avec eux et sera a enroler de nouveau. Les comptes presents sont
  // conserves tels quels, 2FA comprise.
  const { data: presents } = await admin.from('profiles').select('email').eq('etablissement_id', etablissementId)
  const emails = new Set((presents ?? []).map(p => p.email))
  const manquants = COMPTES.filter(c => !emails.has(`${c.email}@${DOMAINE}`))
  if (manquants.length) {
    let mdp = await lireMotDePasse(admin, etablissementId)
    if (!mdp || COMPTES.some(c => validatePasswordServer(mdp as string, c.prenom, c.nom))) {
      mdp = motDePasse()
      const { error: eNotes } = await admin.from('etablissement_notes').upsert({ etablissement_id: etablissementId, notes: notesDemo(mdp) })
      if (eNotes) return { error: `Mot de passe des comptes non rangé, remise à zéro annulée : ${eNotes.message}` }
    }
    for (const c of manquants) {
      const r = await creerCompteDemo(admin, c, etablissementId, mdp)
      if (r.error) return { error: `${r.error} Remise à zéro annulée.` }
    }
  }
  await appliquerComptes(admin, etablissementId)

  const { data, error } = await admin.rpc('reinitialiser_ecole_demo', { p_id: etablissementId })
  if (error || !data) {
    console.error('[demo] remise a zero:', error)
    return { error: error?.message ?? 'Remise à zéro impossible.' }
  }
  // Apres la base : sur un echec de la base, rien n'est perdu ; ici un echec ne
  // laisse que des fichiers orphelins.
  const fichiers = await effacerFichiers(admin, (data.fichiers ?? []) as Fichier[])
  const logo = await poserLogoDemo(admin, etablissementId)

  await tracerActionEditeur(await createClient(), {
    etablissementId,
    description: `Remise à zéro de l'école de démonstration (année ${data.annee})`
      + (manquants.length ? ` · ${pluriel(manquants.length, 'compte recréé', 'comptes recréés')}` : ''),
  })
  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return { fichiers, logo, recrees: manquants.length }
}
