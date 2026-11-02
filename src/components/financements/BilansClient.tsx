'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton, FloatSelect } from '@/components/ui/FloatFields'
import { Puce } from '@/components/dashboard/tdb'
import { useToast } from '@/lib/toast-context'
import { messageErreur } from '@/lib/erreur'
import { pluriel } from '@/lib/texte/pluriel'
import { afficherPdf, fermerOngletPdf, ouvrirOngletPdf } from '@/lib/pdf/ouvrir'
import { fmtEuro, libelleAjustement, libelleCotisation, libelleMois, libelleMoyen } from '@/lib/financements/libelles'
import type { BilanChiffres } from '@/lib/financements/bilan'
import { detailBilan } from '@/app/dashboard/financements/bilans/actions'
import { genererBilanPdf } from './bilanPdf'

export interface OptionBilan { cle: string; libelle: string }

const heures = (h: number) => `${h.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h`

/** Encadre de l'ecran : bandeau de titre, contenu. */
function Encadre({ titre, children, className }: { titre: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-0 overflow-hidden flex flex-col ${className ?? ''}`}>
      <h2 className="encadre-titre m-0 text-xs font-bold uppercase tracking-widest">{titre}</h2>
      <div className="px-3 py-2 flex-1 min-h-0 flex flex-col gap-2">{children}</div>
    </section>
  )
}

/** Petite liste libelle / valeurs ; `total` en pied (sans survol). */
function Liste({ label, colonnes, lignes, total, max }: {
  label: string
  colonnes: string[]
  lignes: (string | number)[][]
  total?: (string | number)[]
  max?: string
}) {
  if (lignes.length === 0) return <p className="text-xs text-warm-700">Aucune donnée.</p>
  return (
    <div className={`liste list-scroll overflow-y-auto ${max ?? ''}`}>
      <table className="w-full text-left text-xs" aria-label={label}>
        <thead className="sticky top-0 z-10">
          <tr className="liste-entete border-b border-[var(--card-border)]">
            {colonnes.map((c, i) => <th key={c} scope="col" className={`list-th-compact ${i > 0 ? 'text-right' : ''}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-50">
          {lignes.map((l, i) => (
            <tr key={i}>
              {l.map((v, j) => <td key={j} className={`list-td px-2 ${j > 0 ? 'text-right tabular-nums text-secondary-800' : 'text-secondary-800'}`}>{v}</td>)}
            </tr>
          ))}
          {total && (
            <tr className="sans-survol font-semibold">
              {total.map((v, j) => <td key={j} className={`list-td px-2 ${j > 0 ? 'text-right tabular-nums' : ''} text-secondary-800`}>{v}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Chiffre({ label, valeur, ton }: { label: string; valeur: string; ton?: 'marque' | 'rouge' }) {
  const couleur = ton === 'marque'
    ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]'
    : ton === 'rouge' ? 'text-red-700' : 'text-secondary-800'
  return (
    <div className="rounded-lg border border-warm-100 px-3 py-2">
      <p className="stat-label">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${couleur}`}>{valeur}</p>
    </div>
  )
}

export default function BilansClient({ options, cle, chiffres, mention, etablissement }: {
  options: OptionBilan[]
  cle: string | null
  chiffres: BilanChiffres | null
  mention: string
  etablissement: { nom: string; logo: string | null; adresse: string | null }
}) {
  const router = useRouter()
  const { error: toastError } = useToast()
  const [enCours, setEnCours] = useState<'pdf' | 'excel' | null>(null)

  if (!cle || !chiffres) {
    return <div className="card text-center text-sm text-warm-700 py-10">Aucun bilan pour le moment.</div>
  }
  const b = chiffres
  const provisoire = cle === 'provisoire'
  const nomFichier = `Bilan_financier_${b.annee.label}${provisoire ? '_provisoire' : ''}`

  const ouvrirPdf = async () => {
    const onglet = ouvrirOngletPdf()   // AU CLIC, avant tout await
    setEnCours('pdf')
    try {
      const doc = await genererBilanPdf({
        etablissementNom: etablissement.nom, etablissementLogo: etablissement.logo,
        etablissementAdresse: etablissement.adresse, bilan: b, mention, provisoire,
      })
      afficherPdf(doc, `${nomFichier}.pdf`, onglet)
    } catch (e) {
      fermerOngletPdf(onglet)
      toastError(messageErreur(e) ?? 'Le PDF n’a pas pu être généré.')
    } finally {
      setEnCours(null)
    }
  }

  const telechargerExcel = async () => {
    setEnCours('excel')
    try {
      const res = await detailBilan(cle)
      if (res.error || !res.detail) { toastError(res.error ?? 'Détail indisponible.'); return }
      const { genererBilanExcel } = await import('./bilanExcel')
      await genererBilanExcel(b, res.detail, `${nomFichier}.xlsx`, provisoire)
    } catch (e) {
      toastError(messageErreur(e) ?? 'Le fichier Excel n’a pas pu être généré.')
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3 flex-shrink-0">
        <FloatSelect
          label="Année"
          compact
          aria-label="Choisir le bilan"
          wrapperClassName="w-fit"
          value={cle}
          onChange={e => router.push(`/dashboard/financements/bilans?bilan=${encodeURIComponent(e.target.value)}`)}
        >
          {options.map(o => <option key={o.cle} value={o.cle}>{o.libelle}</option>)}
        </FloatSelect>
        {provisoire && <Puce ton="attente">Provisoire</Puce>}
        <span className="text-xs text-warm-700">{mention}</span>
        <div className="ml-auto flex gap-2">
          <FloatButton variant="secondary" size="mini" loading={enCours === 'pdf'} disabled={enCours !== null} onClick={ouvrirPdf}>
            Bilan PDF
          </FloatButton>
          <FloatButton variant="secondary" size="mini" loading={enCours === 'excel'} disabled={enCours !== null} onClick={telechargerExcel}>
            Détail Excel
          </FloatButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto list-scroll grid gap-2 lg:grid-cols-3 content-start">
        <Encadre titre="Synthèse">
          <div className="grid grid-cols-2 gap-2">
            <Chiffre label="Encaissé" valeur={fmtEuro(b.cotisations.encaisse)} ton="marque" />
            <Chiffre label="Autres revenus" valeur={fmtEuro(b.autres_revenus.total)} />
            <Chiffre label="Dépenses" valeur={fmtEuro(b.depenses.total)} ton="rouge" />
            <Chiffre label="Coût du personnel" valeur={fmtEuro(b.personnel.total)} ton="rouge" />
          </div>
          <Chiffre label="Résultat" valeur={fmtEuro(b.resultat)} ton={b.resultat < 0 ? 'rouge' : 'marque'} />
        </Encadre>

        <Encadre titre="Cotisations">
          <div className="grid grid-cols-2 gap-2">
            <Chiffre label="Facturé" valeur={fmtEuro(b.cotisations.facture)} />
            <Chiffre label="Reste dû" valeur={fmtEuro(b.cotisations.reste_du)} />
            <Chiffre label="Trop-perçu" valeur={fmtEuro(b.cotisations.trop_percu)} />
            <Chiffre label="Recouvrement" valeur={`${b.cotisations.taux} % · ${pluriel(b.cotisations.foyers, 'foyer')}`} />
          </div>
          <Liste label="Par cotisation" colonnes={['Cotisation', 'Inscrits', 'Facturé']}
            lignes={b.cotisations.par_cotisation.map(c => [libelleCotisation(c.libelle, c.adulte), c.inscrits, fmtEuro(c.facture)])} />
          {b.ajustements.length > 0 && (
            <Liste label="Ajustements" colonnes={['Ajustement', 'Nombre', 'Montant']}
              lignes={b.ajustements.map(a => [libelleAjustement(a.type), a.nombre, fmtEuro(a.montant)])} />
          )}
        </Encadre>

        <Encadre titre="Encaissements">
          <Liste label="Encaissements par mois" colonnes={['Mois', 'Encaissé']} max="max-h-64"
            lignes={b.encaissements.par_mois.map(m => [libelleMois(m.mois), fmtEuro(m.montant)])}
            total={['Total', fmtEuro(b.cotisations.encaisse)]} />
          <Liste label="Encaissements par moyen de paiement" colonnes={['Moyen de paiement', 'Encaissé']}
            lignes={b.encaissements.par_moyen.map(m => [libelleMoyen(m.moyen), fmtEuro(m.montant)])} />
        </Encadre>

        <Encadre titre="Dépenses">
          <Liste label="Dépenses par catégorie" colonnes={['Catégorie', 'Montant']}
            lignes={b.depenses.par_categorie.map(c => [c.libelle, fmtEuro(c.montant)])}
            total={['Total', fmtEuro(b.depenses.total)]} />
          <Liste label="Dépenses par mois" colonnes={['Mois', 'Montant']} max="max-h-48"
            lignes={b.depenses.par_mois.map(m => [libelleMois(m.mois), fmtEuro(m.montant)])} />
        </Encadre>

        <Encadre titre="Autres revenus">
          <Liste label="Autres revenus par source" colonnes={['Source', 'Montant']}
            lignes={b.autres_revenus.par_source.map(s => [s.libelle, fmtEuro(s.montant)])}
            total={['Total', fmtEuro(b.autres_revenus.total)]} />
        </Encadre>

        <Encadre titre="Coût du personnel">
          <Liste label="Coût par type de présence" colonnes={['Type', 'Heures', 'Coût']}
            lignes={b.personnel.par_type.map(t => [t.type, heures(t.heures), fmtEuro(t.cout)])}
            total={['Total', heures(b.personnel.heures), fmtEuro(b.personnel.total)]} />
          <Liste label="Coût par personne" colonnes={['Personne', 'Heures', 'Coût']} max="max-h-64"
            lignes={b.personnel.par_personne.map(p => [`${p.nom} · ${p.type}`, heures(p.heures), fmtEuro(p.cout)])} />
          {b.personnel.sans_taux.length > 0 && (
            <p role="alert" className="text-xs text-amber-700">
              Heures sans taux (comptées 0 €) : {b.personnel.sans_taux.map(s => `${s.code} ${heures(s.heures)}`).join(', ')}
            </p>
          )}
        </Encadre>
      </div>
    </div>
  )
}
