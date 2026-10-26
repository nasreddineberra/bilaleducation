// Calcul financier des cotisations — SOURCE UNIQUE.
//
// Partage par les sous-menus Financements « Reglements » (plan de travail) et
// « Stats reglements » (vue globale), qui calculaient chacun de leur cote et
// divergeaient (bug du 16/07 : reductions retranchees du percu au lieu du du).
// Toute evolution du modele comptable se fait ICI, pas dans une page.
//
// Isomorphe (aucune dependance serveur) : importable en Server ET Client Component.

import type { FeeStatus } from '@/types/database'

export interface CotisationLike {
  id?: string | null
  amount?: number | null
  registration_fee?: number | null
  sibling_discount?: number | null
  sibling_discount_same_type?: boolean | null
}

export interface FeeLike {
  fee_adjustments?: Array<{ amount?: number | null }> | null
  fee_installments?: Array<{ amount_paid?: number | null }> | null
}

export interface FamilyFinancials {
  subtotal: number
  totalDue: number
  adjustmentsTotal: number   // negatif pour les reductions / avoirs / remboursements
  totalPaid: number
  netPercu: number
  remaining: number
  status: FeeStatus
}

/**
 * Le recapitulatif renvoye par les RPC d'ecriture
 * (`fin_ajouter_reduction`, `fin_supprimer_reduction`,
 *  `fin_enregistrer_paiement`, `fin_supprimer_paiement`).
 *
 * Ces chiffres viennent de la BASE, qui les a calcules dans la meme transaction
 * que l'ecriture — l'ecran ne refait donc aucun calcul parallele susceptible de
 * diverger de ce qui est stocke. Voir `add-financement-rpc-atomiques.sql`.
 */
export interface RecapDossier {
  subtotal: number
  adjustments_total: number
  total_due: number
  total_paid: number
  status: FeeStatus
}

/**
 * Statut d'un dossier a partir du percu et du du.
 *
 * ── MIROIR SQL : `fin_statut_dossier()` ────────────────────────────────────
 * Portee en base pour que les RPC d'ecriture puissent conclure dans leur propre
 * transaction. C'est la SEULE regle de ce fichier dupliquee en SQL, et c'est
 * assume : le reste (remise fratrie, subtotal) reste ici, parce que le dupliquer
 * reproduirait le defaut du 17 juillet. **Les deux doivent rester d'accord** —
 * l'ORDRE des branches est significatif, la migration le teste sur six cas.
 */
export function feeStatus(paid: number, due: number): FeeStatus {
  if (paid > due && due > 0) return 'overpaid'
  if (due <= 0)             return 'paid'
  if (paid >= due)          return 'paid'
  if (paid > 0)             return 'partial'
  return 'pending'
}

/**
 * Remise fratrie appliquee a une liste d'inscriptions eleves, DANS L'ORDRE reçu.
 * Renvoie la remise de chaque eleve (0 si aucune), alignee sur l'entree.
 *
 * `sibling_discount_same_type` : remise des le 2e enfant du MEME type de
 * cotisation ; sinon des le 2e enfant, tous types confondus.
 *
 * NB : un eleve sans cotisation compte quand meme dans l'ordre de la fratrie
 * (comportement de la fiche Reglements, qui fait foi).
 */
export function siblingDiscounts(cotisations: Array<CotisationLike | null | undefined>): number[] {
  const indexByType: Record<string, number> = {}
  let globalIndex = 0

  return cotisations.map(ct => {
    const ctId = ct?.id ?? ''
    const sameTypeOnly = ct?.sibling_discount_same_type ?? false
    const sib = Number(ct?.sibling_discount ?? 0)
    let discount = 0

    if (sib > 0) {
      if (sameTypeOnly) {
        const typeIdx = indexByType[ctId] ?? 0
        if (typeIdx > 0) discount = sib
        indexByType[ctId] = typeIdx + 1
      } else if (globalIndex > 0) {
        discount = sib
      }
    } else if (sameTypeOnly) {
      // Pas de remise configuree : on tient quand meme le compteur du type.
      indexByType[ctId] = (indexByType[ctId] ?? 0) + 1
    }

    globalIndex++
    return discount
  })
}

/** Total du d'une inscription : cotisation + frais de dossier - remise fratrie. */
export function lineTotal(ct: CotisationLike | null | undefined, discount = 0): number {
  return Number(ct?.amount ?? 0) + Number(ct?.registration_fee ?? 0) - discount
}

// ─── Depart en cours d'annee ──────────────────────────────────────────────────
//
// Reglage PAR ETABLISSEMENT (`etablissements.regle_ajustement`), FIGE sur chaque
// depart (`mouvements_inscription.regle`). Decisions du 26/10 :
//   - la regle ne concerne que les DEPARTS : une arrivee doit l'annee ;
//   - prorata au MOIS COMMENCE, compte depuis la rentree (le mois du depart
//     compte) ; il porte sur la cotisation diminuee de la remise fratrie ;
//   - frais d'inscription dus dans TOUS les cas ;
//   - un enfant parti garde sa place dans l'ordre de la fratrie ;
//   - au cas par cas : l'ecole decide ; en attendant, le depart compte « sans
//     ajustement ».
// Un retrait par CORRECTION (Affectations, enfant sans donnees) n'est pas un
// depart : l'inscription n'existe plus, rien n'est du.

export type RegleAjustement = 'sans_ajustement' | 'due' | 'prorata' | 'cas_par_cas'
export type DecisionAjustement = Exclude<RegleAjustement, 'cas_par_cas'>

export const LIBELLES_REGLE: Record<RegleAjustement, string> = {
  sans_ajustement: 'Sans ajustement',
  due:             'Due en totalité',
  prorata:         'Au prorata',
  cas_par_cas:     'Au cas par cas',
}

export interface AnneeLike {
  start_date?: string | null
  end_date?: string | null
}

export interface DepartLike {
  /** Date de depart `AAAA-MM-JJ`. */
  date: string
  regle: RegleAjustement
  decision?: DecisionAjustement | null
}

export interface ParticipantLike {
  ct: CotisationLike | null | undefined
  /** Cle de tri de la fratrie (anciennete de la fiche). Ignoree pour un adulte. */
  ordre?: string | null
  /** Renseigne si le participant est PARTI en cours d'annee. */
  depart?: DepartLike | null
}

export interface LigneCotisation {
  remise: number
  /** Part de cotisation RETENUE (apres remise, et prorata le cas echeant). */
  cotisation: number
  frais: number
  total: number
  /** `null` : present. Sinon la regle appliquee, ou `a_decider` (au cas par cas en attente). */
  regle: DecisionAjustement | 'a_decider' | null
  /** Pour un prorata : mois retenus sur mois de l'annee. */
  mois: { retenus: number; total: number } | null
}

const arrondi = (n: number) => Math.round(n * 100) / 100

/** Rang d'un mois `AAAA-MM-JJ` (annee * 12 + mois), sans passer par `Date` (fuseau). */
const rangMois = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1

/**
 * Mois retenus d'un depart, au mois commence : de la rentree au mois du depart
 * inclus, sur les mois de l'annee (rentree et fin incluses). `null` si l'annee
 * n'a pas ses dates.
 */
export function moisProrata(annee: AnneeLike, dateDepart: string): { retenus: number; total: number } | null {
  if (!annee.start_date || !annee.end_date) return null
  const debut = rangMois(annee.start_date)
  const total = rangMois(annee.end_date) - debut + 1
  if (total <= 0) return null
  const retenus = Math.min(total, Math.max(1, rangMois(dateDepart) - debut + 1))
  return { retenus, total }
}

/** La regle qui s'applique a un depart, ou `null` si l'ecole n'a pas encore decide. */
export function regleDepart(d: DepartLike): DecisionAjustement | null {
  return d.regle === 'cas_par_cas' ? (d.decision ?? null) : d.regle
}

/**
 * Lignes de cotisation d'un foyer (eleves OU adultes), alignees sur l'entree.
 *
 * `fratrie` (eleves) : la remise suit l'ORDRE d'anciennete des fiches (`ordre`),
 * enfants partis compris, pour qu'un depart ne deplace pas la remise des autres.
 */
export function lignesCotisation(
  participants: ParticipantLike[],
  annee: AnneeLike,
  { fratrie = true }: { fratrie?: boolean } = {},
): LigneCotisation[] {
  const remises = new Array<number>(participants.length).fill(0)
  if (fratrie) {
    const ordre = participants
      .map((p, i) => ({ i, cle: p.ordre ?? '' }))
      .sort((a, b) => a.cle.localeCompare(b.cle) || a.i - b.i)
    const r = siblingDiscounts(ordre.map(o => participants[o.i].ct))
    ordre.forEach((o, k) => { remises[o.i] = r[k] })
  }

  return participants.map((p, i) => {
    const remise = remises[i]
    const base   = Number(p.ct?.amount ?? 0) - remise
    const frais  = Number(p.ct?.registration_fee ?? 0)
    if (!p.depart) {
      return { remise, cotisation: base, frais, total: base + frais, regle: null, mois: null }
    }
    const regle = regleDepart(p.depart)
    let cotisation = 0
    let mois: LigneCotisation['mois'] = null
    if (regle === 'due') cotisation = base
    if (regle === 'prorata') {
      mois = moisProrata(annee, p.depart.date)
      cotisation = mois ? arrondi(base * mois.retenus / mois.total) : base
    }
    return { remise, cotisation, frais, total: arrondi(cotisation + frais), regle: regle ?? 'a_decider', mois }
  })
}

/**
 * Financier d'une famille.
 * `subtotal` = somme des lignes deja totalisees (eleves + adultes).
 * `fee`      = ligne(s) `family_fees` de l'annee (une seule en pratique).
 *
 * REGLE COMPTABLE : les reductions / avoirs / remboursements (ajustements < 0)
 * reduisent ce que la famille DOIT, jamais ce qu'elle a paye. Payer la cotisation
 * entiere solde toujours (un remboursement de 20 ne remet pas 20 a devoir).
 */
export function computeFamilyFinancials(
  subtotal: number,
  fee: FeeLike | FeeLike[] | null | undefined,
): FamilyFinancials {
  const fees = fee == null ? [] : Array.isArray(fee) ? fee : [fee]

  let adjustmentsTotal = 0
  let totalPaid = 0
  for (const f of fees) {
    for (const a of (f?.fee_adjustments ?? [])) adjustmentsTotal += Number(a?.amount ?? 0)
    for (const i of (f?.fee_installments ?? [])) totalPaid += Number(i?.amount_paid ?? 0)
  }

  const totalDue  = subtotal + adjustmentsTotal
  const netPercu  = totalPaid
  const remaining = totalDue - netPercu

  return { subtotal, totalDue, adjustmentsTotal, totalPaid, netPercu, remaining, status: feeStatus(netPercu, totalDue) }
}
