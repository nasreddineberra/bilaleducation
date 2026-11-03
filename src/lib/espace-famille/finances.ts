import {
  computeFamilyFinancials, departsRetenus, departSelonMouvements, cleDepartAdulte, cleDepartEleve,
  type CotisationLike, type DepartCharge, type FamilyFinancials, type LigneCotisation, type MouvementDepart,
} from '../financements/compute.ts'
import { sousTotalFoyer } from '../financements/foyer.ts'

/**
 * SITUATION FINANCIERE DU FOYER (espace famille, Reglements) : les donnees
 * BRUTES de `famille_finances()` (lot 2) passees par le MEME calcul que l'ecole
 * (`sousTotalFoyer`, `departSelonMouvements`, `departsRetenus`,
 * `computeFamilyFinancials`). Pur et teste.
 */

/** Forme du jsonb rendu par `famille_finances()` (migration espace-famille-lecture). */
export interface DonneesFinancesFoyer {
  annee: { id: string; label: string; start_date: string | null; end_date: string | null } | null
  enfants: {
    id: string; first_name: string; last_name: string; created_at: string; is_active: boolean
    enrollment_id: string; status: 'active' | 'withdrawn'; class_id: string; date_depart: string | null
    classe_nom: string; cotisation: (CotisationLike & { id: string; label: string; is_adult: boolean | null }) | null
  }[]
  adultes: {
    tutor_number: number; status: 'active' | 'withdrawn'; class_id: string; date_depart: string | null
    classe_nom: string; cotisation: (CotisationLike & { id: string; label: string; is_adult: boolean | null }) | null
  }[]
  mouvements_depart: MouvementDepart[]
  dossiers: {
    id: string; subtotal: number | null; adjustments_total: number | null; total_due: number | null
    num_installments: number | null; status: string | null
    reductions: { adjustment_date: string | null; adjustment_type: string; label: string; amount: number }[]
    echeances: {
      installment_number: number; due_date: string; amount_due: number; amount_paid: number | null
      paid_date: string | null; payment_method: string | null; receipt_number: string | null; status: string | null
    }[]
  }[]
}

export interface LigneFoyer {
  /** Enfant (prenom NOM) ou « Cours adulte · tuteur N ». */
  qui: string
  classe: string
  cotisation: string
  depart: DepartCharge | null
  ligne: LigneCotisation
}

export interface SituationFoyer {
  financier: FamilyFinancials
  lignes: LigneFoyer[]
  paiements: { date: string | null; montant: number; moyen: string | null; recu: string | null }[]
  echeances: DonneesFinancesFoyer['dossiers'][number]['echeances']
  reductions: DonneesFinancesFoyer['dossiers'][number]['reductions']
}

export function situationFoyer(d: DonneesFinancesFoyer, parentId: string): SituationFoyer {
  const annee = d.annee ?? { start_date: null, end_date: null }
  const depart = departSelonMouvements(d.mouvements_depart)

  // Enfants : presents (actifs, affectation active) puis partis RETENUS (dernier
  // depart, aucun pour un enfant revenu) : meme regle que `chargerDeparts`.
  const presents = d.enfants.filter(e => e.status === 'active' && e.is_active)
  const revenus = new Set(d.enfants.filter(e => e.status === 'active').map(e => e.id))
  const partis = departsRetenus(d.enfants.filter(e => e.status === 'withdrawn'), e => e.id, revenus)
  const eleves = [
    ...presents.map(e => ({ e, depart: null as DepartCharge | null })),
    ...partis.map(e => ({ e, depart: depart(cleDepartEleve(e.id, e.class_id), e.date_depart) })),
  ]

  // Cours adultes : presents, puis departs retenus des cours ADULTES seulement.
  const cle = (a: { tutor_number: number }) => `${parentId}-${a.tutor_number}`
  const adultesPresents = d.adultes.filter(a => a.status === 'active')
  const adultesRevenus = new Set(adultesPresents.filter(a => a.cotisation?.is_adult).map(cle))
  const adultesPartis = departsRetenus(
    d.adultes.filter(a => a.status === 'withdrawn' && a.cotisation?.is_adult), cle, adultesRevenus)
  const adultes = [
    ...adultesPresents.map(a => ({ a, depart: null as DepartCharge | null })),
    ...adultesPartis.map(a => ({ a, depart: depart(cleDepartAdulte(parentId, a.tutor_number, a.class_id), a.date_depart) })),
  ]

  const { lignesEleves, lignesAdultes, subtotal: sousTotal } = sousTotalFoyer(
    eleves.map(x => ({ ct: x.e.cotisation, ordre: x.e.created_at, depart: x.depart })),
    adultes.map(x => ({ ct: x.a.cotisation, depart: x.depart })),
    annee,
  )

  // Sans aucune inscription : le sous-total ENREGISTRE (meme repli que l'ecole).
  const sansInscription = eleves.length === 0 && adultes.length === 0
  const subtotal = sansInscription
    ? d.dossiers.reduce((t, f) => t + Number(f.subtotal ?? 0), 0)
    : sousTotal
  const fees = d.dossiers.map(f => ({
    fee_adjustments: f.reductions.map(r => ({ amount: r.amount })),
    fee_installments: f.echeances.map(i => ({ amount_paid: i.amount_paid })),
  }))

  const lignes: LigneFoyer[] = [
    ...eleves.flatMap((x, i) => x.e.cotisation ? [{
      qui: `${x.e.last_name} ${x.e.first_name}`, classe: x.e.classe_nom, cotisation: x.e.cotisation.label,
      depart: x.depart, ligne: lignesEleves[i],
    }] : []),
    ...adultes.flatMap((x, i) => x.a.cotisation ? [{
      qui: `Cours adulte · tuteur ${x.a.tutor_number}`, classe: x.a.classe_nom, cotisation: x.a.cotisation.label,
      depart: x.depart, ligne: lignesAdultes[i],
    }] : []),
  ]

  const echeances = d.dossiers.flatMap(f => f.echeances)
  return {
    financier: computeFamilyFinancials(subtotal, fees),
    lignes,
    paiements: echeances
      .filter(i => Number(i.amount_paid ?? 0) > 0)
      .map(i => ({ date: i.paid_date, montant: Number(i.amount_paid), moyen: i.payment_method, recu: i.receipt_number }))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    echeances,
    reductions: d.dossiers.flatMap(f => f.reductions),
  }
}
