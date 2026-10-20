/**
 * PDF GENERES PAR L'APPLICATION : affichage dans un NOUVEL ONGLET.
 *
 * Decision utilisateur du 20/10 : un clic sur un bouton, une icone ou un lien
 * qui produit un PDF l'AFFICHE dans un nouvel onglet, il ne demande pas a
 * l'enregistrer (`doc.save()` le faisait). L'enregistrement reste possible depuis
 * la visionneuse du navigateur.
 *
 * PIEGE DES FENETRES SURGISSANTES : un `window.open` fait APRES un `await` n'est
 * plus rattache au clic et le navigateur le bloque. La generation etant
 * asynchrone (import de jsPDF, polices, logo), l'onglet est ouvert AU CLIC par
 * `ouvrirOngletPdf()`, AVANT tout `await`, puis rempli par `afficherPdf()`.
 * Si l'ouverture a quand meme ete refusee, on retombe sur l'enregistrement :
 * le document n'est jamais perdu.
 *
 * L'URL `blob:` n'est pas revoquee : la visionneuse s'en sert encore pour son
 * propre bouton « Telecharger ». Elle disparait avec la page.
 */

type DocPdf = {
  output(type: 'blob'): Blob
  save(nom: string): unknown
  setProperties(p: { title?: string }): unknown
}

/** A appeler dans le gestionnaire du clic, AVANT le premier `await`. */
export function ouvrirOngletPdf(): Window | null {
  if (typeof window === 'undefined') return null
  return window.open('', '_blank')
}

/** Affiche le PDF dans l'onglet ouvert au clic (ou, a defaut, l'enregistre). */
export function afficherPdf(doc: DocPdf, nom: string, onglet: Window | null) {
  // Titre de l'onglet : le nom du document plutot que l'adresse `blob:`.
  doc.setProperties({ title: nom.replace(/\.pdf$/i, '').replace(/_/g, ' ') })
  const url = URL.createObjectURL(doc.output('blob'))
  if (onglet && !onglet.closed) {
    onglet.location.href = url
    return
  }
  const w = window.open(url, '_blank')
  if (!w) doc.save(nom)
}

/** Referme l'onglet prepare si la generation a echoue (sinon il resterait vide). */
export function fermerOngletPdf(onglet: Window | null) {
  if (onglet && !onglet.closed) onglet.close()
}

/**
 * Fichier DEPOSE (bucket prive) : ouvre son URL signee dans un nouvel onglet.
 * Meme piege que ci-dessus : l'URL s'obtient par un `await`, l'onglet est donc
 * ouvert AVANT. Rend `false` si l'URL n'a pas pu etre obtenue (onglet referme).
 */
export async function ouvrirDansOnglet(obtenirUrl: () => Promise<string | null>): Promise<boolean> {
  const onglet = ouvrirOngletPdf()
  const url = await obtenirUrl()
  if (!url) { fermerOngletPdf(onglet); return false }
  if (onglet && !onglet.closed) {
    onglet.opener = null
    onglet.location.href = url
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  return true
}
