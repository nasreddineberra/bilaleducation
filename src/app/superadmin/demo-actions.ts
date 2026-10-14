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

const COMPTES = [
  { role: 'direction',               civilite: 'M.',  nom: 'KHALDI',    prenom: 'Sofiane',  email: 'direction' },
  { role: 'comptable',               civilite: 'Mme', nom: 'ARAB',      prenom: 'Nadia',    email: 'comptable' },
  { role: 'secretaire',              civilite: 'Mme', nom: 'BENMOUSSA', prenom: 'Lamia',    email: 'secretariat' },
  { role: 'responsable_pedagogique', civilite: 'M.',  nom: 'HALIMI',    prenom: 'Walid',    email: 'pedagogie' },
  { role: 'enseignant',              civilite: 'Mme', nom: 'AZIZI',     prenom: 'Fatima',   email: 'enseignant1' },
  { role: 'enseignant',              civilite: 'M.',  nom: 'BENHADJ',   prenom: 'Omar',     email: 'enseignant2' },
  { role: 'enseignant',              civilite: 'Mme', nom: 'SAHRAOUI',  prenom: 'Khadija',  email: 'enseignant3' },
] as const

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
    const email = `${c.email}@${DOMAINE}`
    const { data: auth, error: eAuth } = await admin.auth.admin.createUser({
      email, password: mdp, email_confirm: true,
      app_metadata: { role: c.role, etablissement_id: ecole.id },
    })
    if (eAuth || !auth.user) return annuler(`Création du compte ${email} impossible : ${eAuth?.message ?? 'réponse vide'}`)
    crees.push(auth.user.id)
    const { error: eProfil } = await admin.from('profiles').insert({
      id: auth.user.id, email, role: c.role, civilite: c.civilite,
      first_name: c.prenom, last_name: c.nom, is_active: true, etablissement_id: ecole.id,
    })
    if (eProfil) return annuler(`Création du profil ${email} impossible : ${eProfil.message}`)
  }

  const { error: ePeuple } = await admin.rpc('reinitialiser_ecole_demo', { p_id: ecole.id })
  if (ePeuple) return annuler(`Peuplement impossible : ${ePeuple.message}`)

  // Le mot de passe n'est affiche qu'une fois a l'ecran : on le garde aussi dans
  // les notes de l'EDITEUR (table serveur uniquement), seul endroit ou il le
  // retrouvera. Ce sont des comptes de demonstration sur donnees fictives.
  const notes = [
    'École de démonstration (données fictives).',
    `Mot de passe commun des comptes : ${mdp}`,
    ...COMPTES.map(c => `${c.email}@${DOMAINE} · ${c.nom} ${c.prenom}`),
  ].join('\n')
  const { error: eNotes } = await admin.from('etablissement_notes').upsert({ etablissement_id: ecole.id, notes })
  if (eNotes) console.error('[demo] notes:', eNotes)

  const logo = await poserLogoDemo(admin, ecole.id)

  await tracerActionEditeur(await createClient(), { etablissementId: ecole.id, description: "Création de l'école de démonstration" })
  revalidatePath('/superadmin')
  return { id: ecole.id, motDePasse: mdp, logo }
}

export async function reinitialiserEcoleDemo(etablissementId: string): Promise<{ error?: string; fichiers?: number; logo?: boolean }> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const admin = createAdminClient()
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
    description: `Remise à zéro de l'école de démonstration (année ${data.annee})`,
  })
  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return { fichiers, logo }
}
