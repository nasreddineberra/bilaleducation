/**
 * Domaine des comptes fictifs de l'ecole de demonstration (`.invalid` : reserve,
 * aucun email ne peut y partir). Lu par la remise a zero (`demo-actions.ts`) et
 * par la fiche ecole de la console, qui distingue ces comptes de ceux d'un
 * prospect. Module sans dependance : importable cote navigateur.
 */
export const DOMAINE_COMPTES_DEMO = 'demonstration.invalid'

/**
 * Adresse fictive de la demonstration (comptes, tuteurs, enseignants). L'envoi
 * l'ecarte (`sendNotificationEmail`) : une demonstration dotee d'une messagerie
 * enverrait sinon vers des dizaines d'adresses inexistantes, et les rejets
 * abimeraient la reputation du compte d'envoi.
 */
export function estAdresseFictive(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DOMAINE_COMPTES_DEMO}`)
}
