/**
 * Longueurs maximales de l'identité d'un établissement.
 *
 * Elles ne sont pas arbitraires : elles ont été MESURÉES sur l'en-tête des PDF,
 * où le nom partage sa ligne avec le titre du document — « ATTESTATION DE
 * PAIEMENT » étant le pire cas — et où l'adresse occupe la ligne suivante.
 *
 * La contrainte vit aussi en base (`add-etablissement-length-limits.sql`) : la
 * fiche s'écrit directement depuis le navigateur, une limite posée dans le seul
 * formulaire se contournerait par un appel à l'API. Ce module est la source
 * unique côté application — la fiche d'école et la console doivent afficher le
 * même compteur, sans quoi l'une accepterait ce que l'autre refuse.
 */
export const ETAB_NOM_MAX = 30
export const ETAB_ADRESSE_MAX = 80
