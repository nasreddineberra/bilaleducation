'use client'

import type { NotifRecente } from '@/lib/dashboard/commun'
import Link from 'next/link'
import { usePetitEcran } from '@/hooks/usePetitEcran'
import type { DonneesComptable } from '@/lib/dashboard/comptable'
import { Wallet, Hourglass, Banknote, Scale } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import { Tuile, JaugeTuile, Sparkline, Encadre, Puce, Vide } from './tdb'
import { METHOD_LABELS, fmtEur } from './viz'
import { HistoEncaissements, RepartitionFamilles, COULEUR_MOYEN } from './finances-tdb'
import { pluriel } from '@/lib/texte/pluriel'

interface Props {
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: NotifRecente[]
  donnees: DonneesComptable
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const signe = (n: number) => `${n > 0 ? '+' : ''}${fmtEur(n)}`
const dateCourte = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T12:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''

export default function DashboardComptable({ donnees: d, ...headerProps }: Props) {
  const petitEcran = usePetitEcran()
  const lien = (href: string) => (petitEcran ? null : href)
  const reglements = (parentId?: string | null) =>
    lien(parentId ? `/dashboard/financements/reglements?parent=${parentId}` : '/dashboard/financements/reglements')

  const [, mm] = d.aujourdhui.split('-').map(Number)
  const nomMois = MOIS[mm - 1]
  const moisPrecedent = MOIS[(mm + 10) % 12]

  const f = d.finances
  const s = d.situation
  const ecartMois = d.mois.encaisse - d.mois.precedent
  // Allure des encaissements jusqu'au mois en cours (les mois a venir sont vides).
  const allure = (f?.mensuel ?? []).filter(m => m.key <= d.aujourdhui.slice(0, 7)).map(m => m.encaisse)
  const totalMoyens = (f?.moyens ?? []).reduce((t, m) => t + m.montant, 0)

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader
        {...headerProps}
        masquerNotifs
        sousTitre={[
          new Date(`${d.aujourdhui}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
          headerProps.yearLabel ? `année ${headerProps.yearLabel}` : null,
          f ? pluriel(f.familles, 'famille') : null,
        ].filter(Boolean).join(' · ')}
      />

      {/* ── 4 tuiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Tuile
          ton="marque" titre="Encaissé · année" icone={Wallet}
          valeur={f ? fmtEur(f.collected) : '-'}
          pied={f ? `${f.rate} % de ${fmtEur(f.billed)} facturés` : 'Aucune année en cours'}
          lien={{ href: lien('/dashboard/financements/vue-globale'), label: 'Statistiques' }}
        >
          {f ? <JaugeTuile pct={f.rate} /> : null}
        </Tuile>

        <Tuile
          ton="ambre" titre="Reste à percevoir" icone={Hourglass}
          valeur={f ? fmtEur(f.outstanding) : '-'}
          pied={f ? `${f.counts.partial} partiel${f.counts.partial > 1 ? 's' : ''} · ${f.counts.pending} sans versement` : 'Aucune année en cours'}
          lien={{ href: reglements(), label: 'Règlements' }}
        >
          {f && f.counts.partial + f.counts.pending > 0 && (
            <div className="flex gap-1" role="presentation">
              <div className="h-1.5 rounded-full" style={{ flex: f.counts.partial, background: 'var(--tuile-jauge)' }} />
              <div className="h-1.5 rounded-full" style={{ flex: f.counts.pending, background: 'var(--tuile-piste)' }} />
            </div>
          )}
        </Tuile>

        <Tuile
          ton="ardoise" titre={`Encaissé · ${nomMois}`} icone={Banknote}
          valeur={fmtEur(d.mois.encaisse)}
          unite={d.mois.paiements === null ? undefined : pluriel(d.mois.paiements, 'paiement')}
          pied={`${signe(ecartMois)} par rapport à ${moisPrecedent}`}
          lien={{ href: reglements(), label: 'Règlements' }}
        >
          <Sparkline valeurs={allure} label="Allure des encaissements depuis la rentrée" />
        </Tuile>

        <Tuile
          ton="encre" titre="Situation financière · année" icone={Scale}
          valeur={s ? signe(s.solde) : '-'}
          pied={s ? `Recettes ${fmtEur(s.recettes)} · charges ${fmtEur(s.charges)}` : 'Calcul indisponible'}
          lien={{ href: lien('/dashboard/financements'), label: 'Situation' }}
        >
          {s && s.recettes + s.charges > 0 && (
            <div className="flex gap-1" role="presentation">
              <div className="h-1.5 rounded-full" style={{ flex: s.recettes, background: 'var(--tuile-jauge)' }} />
              <div className="h-1.5 rounded-full" style={{ flex: s.charges, background: 'var(--tuile-ambre)' }} />
            </div>
          )}
        </Tuile>
      </div>

      {/* ── Encaissements · Familles ── hauteur fixe : la page tient sans defilement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Encaissements par mois" className="lg:col-span-2 lg:h-[236px]"
          lien={{ href: lien('/dashboard/financements/vue-globale'), label: 'Statistiques' }}>
          {!f ? <Vide>Aucune facturation.</Vide> : <HistoEncaissements mensuel={f.mensuel} hauteur={172} />}
        </Encadre>

        <Encadre titre={f ? `Familles · ${pluriel(f.familles, 'dossier')}` : 'Familles'} className="lg:h-[236px]"
          lien={{ href: reglements(), label: 'Règlements' }}>
          {!f || f.familles === 0 ? (
            <Vide>Aucun dossier.</Vide>
          ) : (
            <>
              <RepartitionFamilles counts={f.counts} />
              {f.overpaid > 0 && (
                <div className="mt-auto pt-2">
                  <div className="flex justify-between items-center rounded-lg bg-warm-50 px-3 py-1.5 text-xs">
                    <span className="text-warm-700">Trop perçu à rembourser</span>
                    <b className="tabular-nums text-secondary-800">{fmtEur(f.overpaid)}</b>
                  </div>
                </div>
              )}
            </>
          )}
        </Encadre>
      </div>

      {/* ── Débiteurs · Derniers paiements · Moyens ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Familles débitrices" className="lg:h-[264px]" lien={{ href: reglements(), label: 'Relancer' }}>
          {!f || f.debiteurs.length === 0 ? (
            <Vide>Aucun reste à percevoir.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {f.debiteurs.map(r => (
                <LigneFamille key={r.parentId} href={reglements(r.parentId)} famille={r.famille}
                  detail={r.verse > 0 ? `${fmtEur(r.verse)} versés` : 'aucun versement'}
                  montant={fmtEur(r.reste)} />
              ))}
            </div>
          )}
        </Encadre>

        <Encadre titre="Derniers paiements" className="lg:h-[264px]" lien={{ href: reglements(), label: 'Règlements' }}>
          {d.paiements.length === 0 ? (
            <Vide>Aucun paiement enregistré.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {d.paiements.map(p => (
                <LigneFamille key={p.id} href={reglements(p.parentId)} famille={p.famille || 'Famille'}
                  detail={[dateCourte(p.date), p.mode ? (METHOD_LABELS[p.mode] ?? p.mode) : null].filter(Boolean).join(' · ')}
                  montant={fmtEur(p.montant)} />
              ))}
            </div>
          )}
        </Encadre>

        <Encadre titre="Moyens de paiement" className="lg:h-[264px]" aside={<span className="text-[11px] text-warm-700 ml-auto">année</span>}>
          {!f || totalMoyens === 0 ? (
            <Vide>Aucun encaissement.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              <div className="space-y-2.5">
                {f.moyens.map(m => {
                  const pct = Math.round((m.montant / totalMoyens) * 100)
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-semibold text-secondary-800">{METHOD_LABELS[m.key] ?? m.key}</span>
                        <span className="text-warm-700 tabular-nums">{fmtEur(m.montant)} · {pct} %</span>
                      </div>
                      <div className="piste-tdb">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COULEUR_MOYEN[m.key] ?? 'var(--ink-muted)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {f.cotisations.length > 0 && (
                <>
                  <p className="stat-label mt-4 mb-1">Facturé par cotisation</p>
                  {f.cotisations.map(c => (
                    <div key={c.label} className="ligne-tdb text-secondary-800">
                      <span className="flex-1 min-w-0 truncate">{c.label}</span>
                      {c.isAdult && <Puce ton="remplacement">Adultes</Puce>}
                      <b className="tabular-nums">{fmtEur(c.billed)}</b>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Encadre>
      </div>
    </div>
  )
}

function LigneFamille({ href, famille, detail, montant }: {
  href: string | null
  famille: string
  detail: string
  montant: string
}) {
  return (
    <div className="ligne-tdb">
      <div className="flex-1 min-w-0">
        {href ? (
          <Link href={href} className="block font-semibold text-secondary-800 truncate hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-surface)] dark:focus-visible:ring-[var(--brand-accent)]">{famille}</Link>
        ) : (
          <p className="font-semibold text-secondary-800 truncate">{famille}</p>
        )}
        <p className="text-[11px] text-warm-700 truncate">{detail}</p>
      </div>
      <b className="tabular-nums text-secondary-800 shrink-0">{montant}</b>
    </div>
  )
}
