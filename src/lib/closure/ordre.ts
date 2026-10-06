// Presentation des anomalies d'audit — REGLE PARTAGEE PAR LES SIX AUDITS.
//
// Module feuille, SANS import en `@/` : c'est ce qui le rend eprouvable par
// `node --test`, qui ne resout pas l'alias (seul Turbopack le fait). `audits.ts`,
// qui interroge la base, ne peut pas l'etre — d'ou la separation.

export interface AuditItem {
  label: string
  /** Classe affichee apres le nom (avec tooltip `classInfo`). */
  className?: string
  /** Tooltip d'infos classe : « Civilité NOM Prénom · Cotisation · Niveau · horaires ». */
  classInfo?: string
  detail?: string
  href?: string
}

export const ITEMS_CAP = 100

/**
 * Ordonne les anomalies PUIS les plafonne. Les six audits passent par ici.
 *
 * ── L ORDRE EST ALPHABETIQUE, PARTOUT ─────────────────────────────────────
 *
 * Decision du 6 octobre. Les audits triaient chacun a leur facon — absences
 * decroissantes, montant du decroissant — en repondant a « ou agir en
 * premier ? ». A l usage c est l inverse qu on fait : on CHERCHE un foyer ou un
 * eleve, et un ordre par magnitude oblige a parcourir toute la liste.
 *
 * ── LE TRI PRECEDE LE PLAFOND, ET CE N EST PAS UN DETAIL ──────────────────
 *
 * Plafonner d abord puis trier garderait 100 lignes prises dans l ordre INTERNE
 * de l audit — donc un sous-ensemble arbitraire — avant de l ordonner joliment.
 * On garde les 100 PREMIERES DANS L ORDRE AFFICHE.
 *
 * ── LE TRI EST STABLE, ET C EST CE QUI SAUVE LES REGROUPEMENTS ────────────
 *
 * `sort` preserve l ordre relatif des egaux : les tris internes deviennent le
 * DEPARTAGE a libelle identique. Cela compte pour « Evaluations & notes », dont
 * le libelle est un nom de CLASSE repete une fois par periode — les lignes
 * d une meme classe restent groupees, periodes dans l ordre de l annee.
 *
 * `localeCompare('fr')` et non `<` : sans lui « Elodie » accentue passerait
 * apres « Zoe », et « Ecole » avant « Ea » accentue. L ordre des accents n est
 * pas celui des octets.
 */
export function ordonnerAnomalies(items: AuditItem[]): AuditItem[] {
  return [...items]
    .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
    .slice(0, ITEMS_CAP)
}
