import type { VacationPeriod, JourFerie } from '@/types/database'

/**
 * LES JOURS OU L'ECOLE NE FONCTIONNE PAS.
 *
 * ┌─ POURQUOI UNE SOURCE UNIQUE ────────────────────────────────────────────┐
 * │ Trois ecrans en dependent — emploi du temps, feuille d'appel, temps de   │
 * │ presence — et seul le premier savait lire les vacances, avec sa propre   │
 * │ boucle. Recopier ce calcul deux fois de plus, c'est le motif qui a       │
 * │ produit le calcul comptable divergent dans trois sous-menus de           │
 * │ Financements, corrige dans un seul pendant un mois.                     │
 * │                                                                          │
 * │ Et c'est la raison d'etre des vacances et des feries : une donnee que    │
 * │ personne ne consomme ne sert a rien.                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * DEUX NATURES, UN SEUL EFFET. Une vacance couvre une PLAGE de dates, un ferie
 * une journee isolee — mais pour qui demande « peut-on faire cours ce jour-la »,
 * la reponse est la meme. Le motif, lui, differe et doit rester lisible : on
 * n'annonce pas « Vacances de Toussaint » un 11 novembre.
 *
 * Les dates circulent en `AAAA-MM-JJ`, jamais en `Date` : la comparaison
 * lexicographique de ce format est exacte, et elle evite le piege des fuseaux
 * qu'un `toISOString()` reintroduirait a chaque conversion.
 */

export type JourFerme = {
  /** `ferie` ou `vacances` — le motif se dit, il ne se devine pas. */
  nature: 'ferie' | 'vacances'
  /** Comment la NATURE s'appelle : « Vacances » / « Jour férié ». Toujours la. */
  titre: string
  /**
   * Le nom SAISI, quand il y en a un — « Toussaint », « Armistice ».
   *
   * `null` et non un repli : le helper rapporte ce qui existe, il n'invente pas
   * un nom. Sans cette distinction les appelants qui composent « titre · label »
   * affichaient « Vacances · Vacances » sur une periode sans nom, et la pastille
   * de l'emploi du temps ne pouvait pas savoir s'il y avait une 2e ligne a
   * ecrire. Le repli est une decision d'AFFICHAGE, elle appartient a l'ecran.
   */
  label: string | null
}

/**
 * Ce jour est-il ferme, et pourquoi ?
 *
 * Les FERIES sont testes en premier : un ferie tombant pendant les vacances
 * existe (le 1er novembre, le 25 decembre), et c'est son nom qui apprend
 * quelque chose — « Vacances de Noel » sur un 25 decembre n'informe personne.
 */
export function jourFerme(
  date: string,
  vacations: VacationPeriod[] | null | undefined,
  feries: JourFerie[] | null | undefined,
): JourFerme | null {
  const f = (feries ?? []).find(x => x.date === date)
  if (f) return { nature: 'ferie', titre: 'Jour férié', label: f.label?.trim() || null }

  const v = (vacations ?? []).find(x => date >= x.start_date && date <= x.end_date)
  if (v) return { nature: 'vacances', titre: 'Vacances', label: v.label?.trim() || null }

  return null
}

/** Raccourci pour les appelants qui n'ont besoin que du oui/non. */
export function estJourFerme(
  date: string,
  vacations: VacationPeriod[] | null | undefined,
  feries: JourFerie[] | null | undefined,
): boolean {
  return jourFerme(date, vacations, feries) !== null
}
