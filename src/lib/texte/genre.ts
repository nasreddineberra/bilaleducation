// Accords en genre — SOURCE UNIQUE.
//
// Un texte affiche ne porte jamais « (e) » : « Née le », pas « Né(e) le ». Le
// genre vient de `students.gender` ('male' | 'female' | 'non_specified', ou
// vide). Hors masculin / feminin, l'appelant fournit une tournure NEUTRE (on
// reformule, on ne retombe pas sur « (e) »). Module PUR, eprouve par `node --test`.

type Genre = string | null | undefined

/** `accordGenre('female', 'Né le', 'Née le', 'Date de naissance')` → « Née le ». */
export function accordGenre(genre: Genre, masculin: string, feminin: string, neutre: string): string {
  if (genre === 'male') return masculin
  if (genre === 'female') return feminin
  return neutre
}
