/**
 * BARRES D'ABSENCE DU CALENDRIER DE TEMPS DE PRESENCE (29/10).
 *
 * Une absence d'enseignant s'affiche en BARRE qui couvre ses jours, semaine par
 * semaine : coupee net au bord d'une semaine quand elle continue, rangee sur la
 * premiere ligne libre pour ne jamais chevaucher une autre barre. Une absence
 * garde la meme ligne sur toute la semaine.
 *
 * Module PUR, dates `AAAA-MM-JJ` comparees en chaine (aucun objet Date).
 */

/** Une absence reduite a ses jours : du premier au dernier jour compris. */
export interface JoursAbsence {
  id: string
  premier: string
  dernier: string
}

export interface Barre {
  id: string
  /** Colonnes de la semaine (0 = premier jour affiche), bornes comprises. */
  colDebut: number
  colFin: number
  /** Ligne de rangement, 0 en haut. */
  ligne: number
  /** L'absence a commence avant cette semaine / continue apres. */
  coupeAvant: boolean
  coupeApres: boolean
}

/**
 * Premier et dernier jour d'une absence `debut`-`fin` (`AAAA-MM-JJTHH:MM`).
 * Une absence qui finit a minuit pile ne couvre pas le jour qui commence.
 */
export function joursCouverts(debut: string, fin: string): { premier: string; dernier: string } {
  const premier = debut.slice(0, 10)
  let dernier = fin.slice(0, 10)
  if (fin.slice(11, 16) === '00:00' && dernier > premier) dernier = veille(dernier)
  return { premier, dernier }
}

function veille(jour: string): string {
  const [y, m, d] = jour.split('-').map(Number)
  const v = new Date(y, m - 1, d - 1)
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
}

/**
 * Les barres d'une semaine (`jours` : ses 7 dates dans l'ordre affiche).
 * Ordre de rangement : la plus ancienne d'abord, la plus longue a egalite.
 */
export function barresDeLaSemaine(absences: JoursAbsence[], jours: string[]): Barre[] {
  if (jours.length === 0) return []
  const lundi = jours[0]
  const dimanche = jours[jours.length - 1]
  const visibles = absences
    .filter(a => a.premier <= dimanche && a.dernier >= lundi)
    .sort((a, b) => a.premier.localeCompare(b.premier) || b.dernier.localeCompare(a.dernier) || a.id.localeCompare(b.id))

  // Derniere colonne occupee de chaque ligne.
  const finDeLigne: number[] = []
  return visibles.map(a => {
    const colDebut = a.premier <= lundi ? 0 : jours.indexOf(a.premier)
    const colFin = a.dernier >= dimanche ? jours.length - 1 : jours.indexOf(a.dernier)
    let ligne = finDeLigne.findIndex(f => f < colDebut)
    if (ligne === -1) ligne = finDeLigne.length
    finDeLigne[ligne] = colFin
    return { id: a.id, colDebut, colFin, ligne, coupeAvant: a.premier < lundi, coupeApres: a.dernier > dimanche }
  })
}
