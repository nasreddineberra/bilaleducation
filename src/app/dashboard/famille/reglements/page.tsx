import { createClient } from '@/lib/supabase/server'
import { foyerDuCompte } from '@/lib/parents/foyer'
import { situationFoyer, type DonneesFinancesFoyer } from '@/lib/espace-famille/finances'
import { LIBELLES_REGLE } from '@/lib/financements/compute'
import { fmtEuro, libelleAjustement, libelleMoyen } from '@/lib/financements/libelles'
import { formatDateFr } from '@/lib/dates'
import { Tuile, Encadre, Puce, Vide } from '@/components/dashboard/tdb'
import { Wallet, Receipt, CircleDollarSign } from 'lucide-react'
import type { Ton } from '@/components/dashboard/tdb'

/**
 * Espace famille · Reglements de l'annee en cours (decision 4, lecture seule) :
 * du, paye, reste ; detail des cotisations (enfants et cours adultes) ;
 * paiements un a un (decision du 03/11) ; echeances ; reductions. MEME calcul
 * que l'ecran Reglements de l'ecole (`lib/espace-famille/finances.ts`).
 */
const STATUT: Record<string, { label: string; ton: Ton }> = {
  paid:     { label: 'Soldé', ton: 'ok' },
  partial:  { label: 'Partiellement réglé', ton: 'attente' },
  pending:  { label: 'À régler', ton: 'attente' },
  overpaid: { label: 'Trop-perçu', ton: 'info' },
}

export default async function FamilleReglementsPage() {
  const supabase = await createClient()
  const [{ data }, foyer] = await Promise.all([supabase.rpc('famille_finances'), foyerDuCompte(supabase)])
  if (!data || !foyer) return <Vide>Aucune situation financière pour cette année.</Vide>

  const d = data as unknown as DonneesFinancesFoyer
  const s = situationFoyer(d, foyer)
  const f = s.financier
  const statut = STATUT[f.status] ?? STATUT.pending

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Tuile ton="marque" titre="Dû" icone={CircleDollarSign} valeur={fmtEuro(f.totalDue)}
          pied={d.annee ? `Année ${d.annee.label}` : 'Année en cours'} />
        <Tuile ton="ardoise" titre="Payé" icone={Receipt} valeur={fmtEuro(f.totalPaid)}
          pied={s.paiements.length ? `${s.paiements.length} paiement${s.paiements.length > 1 ? 's' : ''}` : 'Aucun paiement'} />
        <Tuile ton="ambre" titre={f.remaining < 0 ? 'Trop-perçu' : 'Reste à payer'} icone={Wallet}
          valeur={fmtEuro(Math.abs(f.remaining))} pied={<Puce ton={statut.ton}>{statut.label}</Puce>} />
      </div>

      <Encadre titre="Détail des cotisations">
        {s.lignes.length === 0 ? <Vide>Aucune cotisation cette année.</Vide> : (
          <ul className="liste text-xs">
            {s.lignes.map((l, i) => (
              <li key={i} className="flex items-start gap-3 px-2 py-1.5 flex-wrap">
                <span className="min-w-0 flex-1">
                  <span className="list-name text-secondary-800 block">{l.qui}</span>
                  <span className="text-warm-700 block">
                    {[l.classe, l.cotisation, l.ligne.frais ? `frais d’inscription ${fmtEuro(l.ligne.frais)}` : null,
                      l.ligne.remise ? `réduction fratrie ${fmtEuro(l.ligne.remise)}` : null].filter(Boolean).join(' · ')}
                  </span>
                  {l.depart && (
                    <span className="text-warm-700 block">
                      Départ le {formatDateFr(l.depart.date)} · {l.ligne.regle === 'a_decider'
                        ? 'règle à décider par l’établissement'
                        : `${LIBELLES_REGLE[l.ligne.regle ?? 'due']}${l.ligne.mois ? ` (${l.ligne.mois.retenus} mois sur ${l.ligne.mois.total})` : ''}`}
                    </span>
                  )}
                </span>
                <span className="tabular-nums font-semibold text-secondary-800 shrink-0">{fmtEuro(l.ligne.total)}</span>
              </li>
            ))}
            {s.reductions.map((r, i) => (
              <li key={`r${i}`} className="flex items-center gap-3 px-2 py-1.5">
                <span className="min-w-0 flex-1 text-secondary-800">
                  {libelleAjustement(r.adjustment_type)} · {r.label}{r.adjustment_date ? ` · ${formatDateFr(r.adjustment_date)}` : ''}
                </span>
                <span className="tabular-nums font-semibold text-secondary-800 shrink-0">{fmtEuro(r.amount)}</span>
              </li>
            ))}
            <li className="sans-survol flex items-center gap-3 px-2 py-1.5 border-t border-[var(--line)]">
              <span className="flex-1 font-bold text-secondary-800">Total dû</span>
              <span className="tabular-nums font-bold text-secondary-800">{fmtEuro(f.totalDue)}</span>
            </li>
          </ul>
        )}
      </Encadre>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <Encadre titre="Paiements">
          {s.paiements.length === 0 ? <Vide>Aucun paiement enregistré.</Vide> : (
            <ul className="liste text-xs">
              {s.paiements.map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-2 py-1.5">
                  <span className="tabular-nums text-secondary-800 shrink-0 w-24">{p.date ? formatDateFr(p.date) : '·'}</span>
                  <span className="min-w-0 flex-1 text-warm-700">
                    {[libelleMoyen(p.moyen), p.recu ? `reçu ${p.recu}` : null].filter(Boolean).join(' · ')}
                  </span>
                  <span className="tabular-nums font-semibold text-secondary-800 shrink-0">{fmtEuro(p.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </Encadre>

        <Encadre titre="Échéances">
          {s.echeances.length === 0 ? <Vide>Aucune échéance.</Vide> : (
            <ul className="liste text-xs">
              {s.echeances.map(e => {
                const paye = Number(e.amount_paid ?? 0)
                const ton: Ton = paye >= Number(e.amount_due) ? 'ok' : paye > 0 ? 'attente' : 'neutre'
                return (
                  <li key={e.installment_number} className="flex items-center gap-3 px-2 py-1.5">
                    <span className="tabular-nums text-secondary-800 shrink-0 w-24">{formatDateFr(e.due_date)}</span>
                    <span className="min-w-0 flex-1 text-warm-700">Échéance {e.installment_number}</span>
                    <Puce ton={ton}>{paye >= Number(e.amount_due) ? 'Réglée' : paye > 0 ? `${fmtEuro(paye)} réglés` : 'À régler'}</Puce>
                    <span className="tabular-nums font-semibold text-secondary-800 shrink-0">{fmtEuro(Number(e.amount_due))}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Encadre>
      </div>
    </div>
  )
}
