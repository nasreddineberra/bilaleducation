'use server'

import { zipSync, strToU8 } from 'fflate'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireEditor } from '@/lib/auth/requireEditor'
import { tracerActionEditeur } from '@/lib/support/actions-editeur'
import { versCsv } from '@/lib/depart/csv'
import { refuserSiEffacee } from '@/lib/tenant/effacement'
import { pluriel } from '@/lib/texte/pluriel'

/**
 * DEPART D'UNE ECOLE (RGPD) : export de ses donnees, effacement, reouverture.
 *
 * Le travail est en base (`rework-effacement-etablissement.sql`) :
 * `exporter_etablissement` rend toutes ses donnees table par table,
 * `effacer_etablissement` efface ses DONNEES en UNE transaction (la fiche, les
 * donnees de l'editeur et le logo restent), avec un filet qui annule si une
 * ligne d'une AUTRE ecole a bouge. La fiche reste dans la console, grisee, et
 * peut etre ROUVERTE : l'ecole repart alors vide. Ces actions ne font que ce que le SQL ne sait pas faire : lire et
 * effacer les FICHIERS (le Storage n'est pas une table), et fabriquer le ZIP.
 *
 * Toutes gardees par `requireEditor` (colonne brute du role) et executees en
 * service-role : les deux fonctions SQL refusent tout autre appelant.
 */

const BUCKET_EXPORTS = 'exports-ecoles'
const LOT_SUPPRESSION = 100

type Fichier = { bucket: string; nom: string }

/**
 * Un export de l'ecole existe-t-il ? (ZIP depose dans `exports-ecoles/<id>/`).
 * Condition de l'effacement (23/10) : on n'efface pas une ecole dont les
 * donnees n'ont jamais ete exportees. Verifiee a l'ecran ET dans `effacerEcole`.
 */
async function aUnExport(etablissementId: string): Promise<boolean> {
  const { data } = await createAdminClient().storage.from(BUCKET_EXPORTS).list(etablissementId, { limit: 1 })
  return (data ?? []).some(f => f.name.endsWith('.zip'))
}

export async function exportExiste(etablissementId: string): Promise<{ existe: boolean; error?: string }> {
  const { error: refus } = await requireEditor()
  if (refus) return { existe: false, error: refus }
  return { existe: await aUnExport(etablissementId) }
}

/** AAAA-MM-JJ_HHhMM, heure de Paris : lisible dans un nom de fichier. */
function horodatage(d = new Date()): string {
  const p = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d)
  const v = (t: string) => p.find(x => x.type === t)?.value ?? ''
  return `${v('year')}-${v('month')}-${v('day')}_${v('hour')}h${v('minute')}`
}

const lisezMoi = (nom: string, slug: string, quand: string, nTables: number, nFichiers: number, manquants: number) => [
  `Export des données de l'établissement « ${nom} » (${slug})`,
  `Généré le ${quand} (heure de Paris).`,
  '',
  'CONTENU',
  `  donnees/   ${nTables} fichiers CSV, un par table. Séparateur « ; », encodage UTF-8 :`,
  '             ils s\'ouvrent directement dans Excel ou LibreOffice.',
  `  fichiers/  ${pluriel(nFichiers, 'fichier déposé', 'fichiers déposés')} dans l'application, rangés par dossier :`,
  '             bulletins, documents des apprenants et des enseignants, justificatifs,',
  '             pièces jointes, photos, logo.',
  '  manifeste.json  le nombre de lignes de chaque table et la liste des fichiers.',
  ...(manquants > 0
    ? ['', `ATTENTION : ${pluriel(manquants, 'fichier')} ${manquants > 1 ? "n'ont pas pu être récupérés" : "n'a pas pu être récupéré"} (voir manifeste.json).`]
    : []),
  '',
  'Les colonnes « id » et « ..._id » sont les identifiants qui relient les tables entre elles.',
  'Le journal d\'activité n\'est pas inclus : c\'est une trace technique de l\'application.',
  '',
].join('\r\n')

/**
 * Fabrique le ZIP, le depose dans le bucket prive des exports et rend une URL
 * signee. Le ZIP n'est pas renvoye directement : la reponse d'une fonction est
 * plafonnee (quelques Mo), et les bulletins d'une ecole la depasseraient.
 */
export async function exporterEcole(etablissementId: string): Promise<{
  error?: string; url?: string; lignes?: number; fichiers?: number; manquants?: number
}> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const effacee = await refuserSiEffacee(etablissementId)
  if (effacee) return { error: effacee }

  const admin = createAdminClient()
  const { data: ecole } = await admin.from('etablissements').select('nom, slug').eq('id', etablissementId).maybeSingle()
  if (!ecole) return { error: 'Établissement introuvable.' }

  const { data, error } = await admin.rpc('exporter_etablissement', { p_id: etablissementId })
  if (error || !data) {
    console.error('[depart] export:', error)
    return { error: `Export impossible : ${error?.message ?? 'réponse vide'}` }
  }
  const tables = data.tables as Record<string, Record<string, unknown>[]>
  const fichiers = data.fichiers as Fichier[]

  const zip: Record<string, Uint8Array> = {}
  const comptes: Record<string, number> = {}
  for (const [nom, lignes] of Object.entries(tables)) {
    zip[`donnees/${nom}.csv`] = strToU8(versCsv(lignes))
    comptes[nom] = lignes.length
  }

  // Les fichiers : un echec n'arrete pas l'export, il est NOMME (manifeste +
  // LISEZ-MOI + compte rendu a l'ecran). Un export muet sur un manque serait
  // remis a l'ecole comme complet.
  const manquants: Fichier[] = []
  const prefixe = `${etablissementId}/`
  for (const f of fichiers) {
    const { data: blob, error: e } = await admin.storage.from(f.bucket).download(f.nom)
    if (e || !blob) { manquants.push(f); continue }
    const chemin = f.nom.startsWith(prefixe) ? f.nom.slice(prefixe.length) : f.nom
    zip[`fichiers/${f.bucket}/${chemin}`] = new Uint8Array(await blob.arrayBuffer())
  }

  const quand = horodatage()
  const nLignes = Object.values(comptes).reduce((a, b) => a + b, 0)
  zip['manifeste.json'] = strToU8(JSON.stringify({
    etablissement: ecole.nom, slug: ecole.slug, exporte_le: new Date().toISOString(),
    lignes: nLignes, tables: comptes,
    fichiers: fichiers.length - manquants.length, fichiers_manquants: manquants,
  }, null, 2))
  zip['LISEZ-MOI.txt'] = strToU8(lisezMoi(ecole.nom, ecole.slug, quand.replace('_', ' à '), Object.keys(tables).length, fichiers.length - manquants.length, manquants.length))

  // Les PDF et images sont deja compresses : un niveau eleve couterait du temps pour rien.
  const octets = zipSync(zip, { level: 6 })
  const nomFichier = `export-${ecole.slug}-${quand}.zip`
  const chemin = `${etablissementId}/${nomFichier}`
  const { error: eUp } = await admin.storage.from(BUCKET_EXPORTS)
    .upload(chemin, octets, { contentType: 'application/zip', upsert: true })
  if (eUp) {
    console.error('[depart] depot du zip:', eUp)
    return { error: `Dépôt de l'export impossible : ${eUp.message}` }
  }
  const { data: signe, error: eUrl } = await admin.storage.from(BUCKET_EXPORTS)
    .createSignedUrl(chemin, 600, { download: nomFichier })
  if (eUrl || !signe) return { error: 'Export créé, mais le lien de téléchargement n\'a pas pu être généré. Réessayez.' }

  await tracerActionEditeur(await createClient(), {
    etablissementId,
    description: `Export des données · ${nLignes} ligne${nLignes > 1 ? 's' : ''}, ${fichiers.length - manquants.length} fichier${fichiers.length - manquants.length > 1 ? 's' : ''}`
      + (manquants.length ? ` · ${pluriel(manquants.length, 'manquant')}` : ''),
  })

  return { url: signe.signedUrl, lignes: nLignes, fichiers: fichiers.length - manquants.length, manquants: manquants.length }
}

/**
 * Simulation : le meme effacement, annule en base. Le compte rendu est donc
 * exact, cascades comprises — c'est ce qu'on montre avant de confirmer.
 */
export async function simulerEffacement(etablissementId: string, slug: string): Promise<{
  error?: string; lignes?: Record<string, number>; comptes?: number; fichiers?: number
}> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const { data, error } = await createAdminClient().rpc('effacer_etablissement', {
    p_id: etablissementId, p_slug: slug, p_reel: false, p_auteur: null,
  })
  if (error || !data) return { error: error?.message ?? 'Simulation impossible.' }
  return { lignes: data.lignes, comptes: data.comptes, fichiers: data.fichiers }
}

export async function effacerEcole(etablissementId: string, slugSaisi: string): Promise<{
  error?: string; avertissement?: string; lignes?: number; comptes?: number; fichiers?: number
}> {
  const { error: refus, userId } = await requireEditor()
  if (refus) return { error: refus }
  if (!(await aUnExport(etablissementId))) return { error: "Exportez d'abord les données de l'école." }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('effacer_etablissement', {
    p_id: etablissementId, p_slug: slugSaisi.trim(), p_reel: true, p_auteur: userId ?? null,
  })
  if (error || !data) {
    console.error('[depart] effacement:', error)
    return { error: error?.message ?? 'Effacement impossible.' }
  }

  // Les fichiers APRES la base : l'inverse laisserait, sur un echec de la base,
  // une ecole intacte privee de ses documents. Ici un echec ne laisse que des
  // fichiers orphelins, sous un dossier que plus rien ne reference.
  const fichiers = (data.fichiers ?? []) as Fichier[]
  const parBucket = new Map<string, string[]>()
  for (const f of fichiers) parBucket.set(f.bucket, [...(parBucket.get(f.bucket) ?? []), f.nom])
  let effaces = 0
  const echecs: string[] = []
  for (const [bucket, noms] of parBucket) {
    for (let i = 0; i < noms.length; i += LOT_SUPPRESSION) {
      const lot = noms.slice(i, i + LOT_SUPPRESSION)
      const { data: partis, error: e } = await admin.storage.from(bucket).remove(lot)
      if (e) { echecs.push(`${bucket} : ${e.message}`); continue }
      effaces += partis?.length ?? 0
    }
  }
  const { data: depart } = await admin.from('etablissement_departs')
    .select('id').eq('etablissement_id', etablissementId).order('efface_le', { ascending: false }).limit(1).maybeSingle()
  if (depart) {
    const { error: eTrace } = await admin.from('etablissement_departs').update({ fichiers_effaces: effaces }).eq('id', depart.id)
    if (eTrace) console.error('[depart] trace des fichiers effaces:', eTrace)
  }
  if (echecs.length) console.error('[depart] fichiers non effaces (%s) :', etablissementId, echecs)

  const lignes = Object.values(data.lignes as Record<string, number>).reduce((a, b) => a + b, 0)
  await tracerActionEditeur(await createClient(), {
    etablissementId,
    description: `Effacement des données · ${lignes} ligne${lignes > 1 ? 's' : ''}, ${data.comptes} compte${data.comptes > 1 ? 's' : ''}, ${effaces} fichier${effaces > 1 ? 's' : ''}`,
  })

  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return {
    lignes, comptes: data.comptes, fichiers: effaces,
    avertissement: effaces < fichiers.length
      ? `${pluriel(fichiers.length - effaces, 'fichier')} ${fichiers.length - effaces > 1 ? "n'ont pas pu être effacés" : "n'a pas pu être effacé"}. ${fichiers.length - effaces > 1 ? 'Ils restent' : 'Il reste'} dans le stockage, sous le dossier ${etablissementId}.`
      : undefined,
  }
}

/**
 * Reouverture d'une ecole effacee. Elle repart VIDE : rien n'est restaure. Elle
 * reste desactivee ; l'editeur la reactive puis recree son compte direction,
 * comme pour une ecole nouvelle.
 */
export async function rouvrirEcole(etablissementId: string): Promise<{ error?: string }> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const admin = createAdminClient()
  const { data, error } = await admin.from('etablissements')
    .update({ donnees_effacees_le: null })
    .eq('id', etablissementId).not('donnees_effacees_le', 'is', null)
    .select('id')
  if (error) return { error: `Réouverture impossible : ${error.message}` }
  if (!data?.length) return { error: "Cette école n'est pas effacée." }

  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  const { error: eDep } = await admin.from('etablissement_departs')
    .update({ rouvert_le: new Date().toISOString(), rouvert_par_email: user?.email ?? null })
    .eq('etablissement_id', etablissementId).is('rouvert_le', null)
  if (eDep) console.error('[depart] trace de reouverture:', eDep)

  await tracerActionEditeur(session, { etablissementId, description: "Réouverture de la fiche (données effacées, l'école repart vide)" })

  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return {}
}
