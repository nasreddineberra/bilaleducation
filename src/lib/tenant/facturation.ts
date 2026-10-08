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
