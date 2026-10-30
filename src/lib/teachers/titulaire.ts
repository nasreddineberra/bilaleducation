/**
 * Titulaire ACTUEL d'une classe : l'affectation principale sans date de fin.
 * Un titulaire retire garde sa ligne (historique, `effective_until` posee) : il
 * ne doit plus etre propose ni affiche comme titulaire. Meme regle que la fiche
 * classe (« Sans titulaire ») et la liste des classes.
 */
export function titulaireActuel<T extends { is_main_teacher: boolean | null; effective_until?: string | null }>(
  affectations: T[] | null | undefined,
): T | undefined {
  return affectations?.find(a => a.is_main_teacher && !a.effective_until)
}

/**
 * Titulaires d'une classe pour un RECAPITULATIF ou un HISTORIQUE : « initial
 * puis remplacant » (decision du 30/10). Le premier et le dernier par date
 * d'effet ; ceux du milieu ne sont pas nommes. Un seul titulaire (ou le meme au
 * debut et a la fin) : un seul nom. Les ecrans en TEMPS REEL nomment le seul
 * titulaire en poste (`titulaireActuel`).
 */
export function libelleTitulaires(titulaires: { nom: string; du: string | null }[]): string | null {
  // Tri stable, sans date = « depuis le debut » ; la liste recue n'est pas modifiee.
  const ordre = titulaires.filter(t => t.nom).sort((a, b) => (a.du ?? '').localeCompare(b.du ?? ''))
  if (ordre.length === 0) return null
  const initial = ordre[0].nom
  const dernier = ordre[ordre.length - 1].nom
  return initial === dernier ? initial : `${initial} puis ${dernier}`
}
