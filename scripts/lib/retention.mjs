/**
 * QUELLES SAUVEGARDES GARDER — logique PURE, sans disque.
 *
 * Extraite de `sauvegarder.mjs` pour une raison simple : c'est la seule partie
 * du dispositif qui SUPPRIME. Une regle de retention fausse ne leve pas, elle
 * efface — et l'on ne s'en apercoit que le jour ou l'on cherche une sauvegarde
 * qui n'est plus la. Elle est donc eprouvee par `retention.test.mjs`, qui tourne
 * avec les tests du projet.
 *
 * Deux defauts y ont deja ete trouves PAR L'EPREUVE, et aucun des deux ne se
 * voyait a la lecture :
 *   1. garder « les 7 plus recentes » n'est pas garder « les 7 derniers JOURS » :
 *      quelques lancements manuels le meme jour evincaient une semaine
 *      d'historique, en silence ;
 *   2. les semaines deja couvertes par la passe quotidienne consommaient le
 *      budget hebdomadaire — on gardait 2 semaines au lieu des 4 annoncees.
 *
 * Meme motif que `src/lib/closure/ordre.ts` : une regle que rien ne signale
 * quand elle derive vit dans un module feuille, avec son test.
 */

/** Nom de dossier d'une sauvegarde : `AAAA-MM-JJ_HHhMM`. */
export const MOTIF_DOSSIER = /^\d{4}-\d{2}-\d{2}_\d{2}h\d{2}$/

/**
 * Semaine ISO d'une date, en `AAAA-Snn`.
 *
 * On passe par UTC a l'interieur pour que le calcul ne depende pas du fuseau
 * du poste — c'est une CLE de regroupement, pas une date affichee.
 */
export function numeroDeSemaine(d) {
  const j = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  j.setUTCDate(j.getUTCDate() + 4 - (j.getUTCDay() || 7))
  const debut = new Date(Date.UTC(j.getUTCFullYear(), 0, 1))
  return `${j.getUTCFullYear()}-S${String(Math.ceil(((j - debut) / 86400000 + 1) / 7)).padStart(2, '0')}`
}

const semaineDe = nom => {
  const [a, m, j] = nom.slice(0, 10).split('-').map(Number)
  return numeroDeSemaine(new Date(a, m - 1, j))
}

/**
 * @param noms  les noms de dossiers candidats, dans n'importe quel ordre
 * @returns `{ garder: string[], supprimer: string[] }`, du plus recent au plus ancien
 *
 * Regle : la plus recente de chacun des N derniers JOURS, puis la plus recente
 * de chacune des M semaines SUPPLEMENTAIRES au-dela.
 *
 * Un nom qui ne respecte pas `MOTIF_DOSSIER` n'est NI garde NI supprime : il
 * n'est pas a nous. L'appelant ne doit rien effacer qui ne sorte de `supprimer`.
 */
export function choisirAGarder(noms, { quotidiennes = 7, hebdomadaires = 4 } = {}) {
  const candidats = [...noms].filter(n => MOTIF_DOSSIER.test(n)).sort().reverse()
  const garder = new Set()

  // Passe QUOTIDIENNE : la plus recente de chaque jour.
  const joursVus = new Set()
  for (const nom of candidats) {
    const jour = nom.slice(0, 10)
    if (joursVus.has(jour)) continue
    if (joursVus.size >= quotidiennes) break
    joursVus.add(jour)
    garder.add(nom)
  }

  // Passe HEBDOMADAIRE, au-dela. Les semaines deja couvertes sont ensemencees
  // pour ne pas etre repechees, mais le BUDGET ne compte que les ajouts.
  const semainesVues = new Set([...garder].map(semaineDe))
  let ajoutees = 0
  for (const nom of candidats) {
    if (garder.has(nom)) continue
    const sem = semaineDe(nom)
    if (semainesVues.has(sem)) continue
    if (ajoutees >= hebdomadaires) break
    semainesVues.add(sem)
    garder.add(nom)
    ajoutees++
  }

  return {
    garder: candidats.filter(n => garder.has(n)),
    supprimer: candidats.filter(n => !garder.has(n)),
  }
}
