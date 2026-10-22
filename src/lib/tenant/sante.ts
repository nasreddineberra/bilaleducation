/**
 * SANTE D'UN ETABLISSEMENT — source unique des signaux et du niveau.
 *
 * Partagee par la page Sante de la console (la liste des signaux) et la liste
 * des etablissements (le cœur de la colonne Sante) : les deux ne doivent jamais
 * se contredire.
 *
 * Un signal n'est une alerte que s'il appelle une action. Un etablissement
 * desactive n'en produit aucun : son silence et sa messagerie absente sont la
 * consequence d'une decision, pas un symptome. L'ecole de demonstration non plus
 * (22/10) : ses donnees sont fictives, ses signaux aussi.
 *
 * NIVEAU (decision du 22/10) : aucun signal = bon ; un signal = a surveiller ;
 * DEUX OU PLUS = critique ; demo, inactif ou donnees effacees = sans objet.
 */
import { depuis, SEUIL_INACTIVITE_JOURS } from './activite.ts'
import { joursRestants } from './abonnement.ts'

export const SEUIL_QUOTA = 0.9
export const SEUIL_ECHEANCE_JOURS = 30

export interface EtatSante {
  is_active:               boolean | null
  est_demo?:               boolean | null
  donnees_effacees_le?:    string | null
  smtp_configured:         boolean | null | undefined
  last_sign_in:            string | null | undefined
  base_facturable:         number | null | undefined
  max_students:            number | null | undefined
  subscription_expires_at: string | null | undefined
}

export type NiveauSante = 'bon' | 'surveiller' | 'critique' | 'sans_objet'

export function alertesSante(e: EtatSante, maintenant: number = Date.now()): string[] {
  if (!e.is_active || e.est_demo || e.donnees_effacees_le) return []
  const activite = depuis(e.last_sign_in ?? null, maintenant)
  const jAvant   = joursRestants(e.subscription_expires_at ?? null, new Date(maintenant))
  // La limite porte sur la BASE FACTURABLE (eleves actifs + adultes inscrits).
  const quota    = e.max_students && e.base_facturable != null ? e.base_facturable / e.max_students : null
  return [
    !e.smtp_configured                                      && 'Messagerie non configurée',
    activite.jours === null                                 && 'Jamais connecté',
    activite.jours !== null && activite.jours >= SEUIL_INACTIVITE_JOURS
                                                            && `Sans connexion depuis ${activite.texte.toLowerCase().replace('il y a ', '')}`,
    quota !== null && quota >= SEUIL_QUOTA                  && 'Inscrits proches de la limite',
    jAvant !== null && jAvant < 0                           && 'Abonnement expiré',
    jAvant !== null && jAvant >= 0 && jAvant <= SEUIL_ECHEANCE_JOURS && `Abonnement dans ${jAvant} j`,
  ].filter(Boolean) as string[]
}

export function niveauSante(e: EtatSante, maintenant: number = Date.now()): NiveauSante {
  if (!e.is_active || e.est_demo || e.donnees_effacees_le) return 'sans_objet'
  const n = alertesSante(e, maintenant).length
  return n === 0 ? 'bon' : n === 1 ? 'surveiller' : 'critique'
}
