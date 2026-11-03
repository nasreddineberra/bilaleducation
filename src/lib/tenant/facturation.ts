/**
 * Facturation d une ecole (payeur + tarif), table `etablissement_facturation`.
 * Module ordinaire : un fichier 'use server' ne peut exporter que des fonctions.
 */
export interface FacturationEcole {
  structure:    string | null
  identifiant:  string | null
  adresse:      string | null
  responsable:  string | null
  email:        string | null
  prix_inscrit: number | null
  forfait:      number | null
}

/** Montant d un mois : forfait + base facturable x prix par inscrit. */
export function montantMensuel(base: number, prixInscrit: number | null, forfait: number | null): number | null {
  if (prixInscrit === null && forfait === null) return null
  return (forfait ?? 0) + base * (prixInscrit ?? 0)
}

/** Releve mensuel tel que le calcul le lit (`releves_facturation`). */
export interface ReleveMontant {
  eleves_actifs: number
  adultes_inscrits: number
  prix_inscrit: number | null
  forfait: number | null
  option_espace_famille?: boolean | null
  famille_forfait?: number | null
  famille_prix_inscrit?: number | null
}

/**
 * Montant d'un releve : tarif de base + option espace famille si elle etait
 * active ce mois-la (decisions 19 et 20, docs/ESPACE-FAMILLE.md). L'option a son
 * propre forfait et son prix par inscrit, sur la MEME base (eleves actifs +
 * adultes inscrits). `total` est `null` si aucun tarif n'est fixe.
 */
export function montantReleve(r: ReleveMontant): { base: number; tarif: number | null; option: number | null; total: number | null } {
  const base = r.eleves_actifs + r.adultes_inscrits
  const tarif = montantMensuel(base, r.prix_inscrit, r.forfait)
  const option = r.option_espace_famille ? montantMensuel(base, r.famille_prix_inscrit ?? null, r.famille_forfait ?? null) : null
  const total = tarif === null && option === null ? null : (tarif ?? 0) + (option ?? 0)
  return { base, tarif, option, total }
}
