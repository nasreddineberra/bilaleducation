import type { Cell, Row, Sheet } from 'write-excel-file/browser'
import { libelleAjustement, libelleMoyen } from '@/lib/financements/libelles'
import type { BilanChiffres } from '@/lib/financements/bilan'
import type { DetailBilan } from '@/lib/financements/bilan-donnees'
import { libelleMois } from './bilanPdf'

// Excel de detail du bilan financier, pour la comptabilite (02/11) : une feuille
// de synthese, puis une ligne par paiement, ajustement, depense, revenu, et le
// cout du personnel par personne (fige dans le bilan : la purge efface les
// saisies de Temps de presence).

const EUROS = '#,##0.00 €'
const entete = (libelles: string[]): Row => libelles.map(v => ({ value: v, fontWeight: 'bold' as const, backgroundColor: '#F0F5F8' }))
const euros = (n: number): Cell => ({ value: n, type: Number, format: EUROS })
// AAAA-MM-JJ -> date locale (jamais `new Date('AAAA-MM-JJ')`, qui est en UTC).
const date = (d: string | null): Cell => d ? { value: new Date(`${d.slice(0, 10)}T00:00`), type: Date, format: 'dd/mm/yyyy' } : null
const texte = (v: string | null | undefined): Cell => v ?? null

export async function genererBilanExcel(bilan: BilanChiffres, detail: DetailBilan, nomFichier: string, provisoire: boolean) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const b = bilan

  const synthese: Row[] = [
    [{ value: `Bilan financier ${b.annee.label}${provisoire ? ' (provisoire)' : ''}`, fontWeight: 'bold' }],
    [],
    entete(['Poste', 'Montant']),
    ['Cotisations facturées', euros(b.cotisations.facture)],
    ['Cotisations encaissées', euros(b.cotisations.encaisse)],
    ['Reste dû', euros(b.cotisations.reste_du)],
    ['Trop-perçu', euros(b.cotisations.trop_percu)],
    ['Autres revenus', euros(b.autres_revenus.total)],
    ['Dépenses', euros(b.depenses.total)],
    ['Coût du personnel', euros(b.personnel.total)],
    [{ value: 'Résultat', fontWeight: 'bold' }, { value: b.resultat, type: Number, format: EUROS, fontWeight: 'bold' }],
    [],
    entete(['Mois', 'Encaissé']),
    ...b.encaissements.par_mois.map((m): Row => [libelleMois(m.mois), euros(m.montant)]),
    [],
    entete(['Moyen de paiement', 'Encaissé']),
    ...b.encaissements.par_moyen.map((m): Row => [libelleMoyen(m.moyen), euros(m.montant)]),
  ]

  const feuilles: Sheet<Blob>[] = [
    { sheet: 'Synthèse', data: synthese, columns: [{ width: 28 }, { width: 16 }] },
    {
      sheet: 'Paiements', stickyRowsCount: 1, columns: [{ width: 12 }, { width: 30 }, { width: 14 }, { width: 14 }, { width: 18 }],
      data: [entete(['Date', 'Foyer', 'Montant', 'Moyen', 'Référence']),
        ...detail.paiements.map((p): Row => [date(p.date), p.foyer, euros(p.montant), libelleMoyen(p.moyen), texte(p.reference)])],
    },
    {
      sheet: 'Ajustements', stickyRowsCount: 1, columns: [{ width: 12 }, { width: 30 }, { width: 16 }, { width: 30 }, { width: 14 }],
      data: [entete(['Date', 'Foyer', 'Type', 'Libellé', 'Montant']),
        ...detail.ajustements.map((a): Row => [date(a.date), a.foyer, libelleAjustement(a.type), texte(a.libelle), euros(a.montant)])],
    },
    {
      sheet: 'Dépenses', stickyRowsCount: 1, columns: [{ width: 12 }, { width: 30 }, { width: 20 }, { width: 14 }, { width: 30 }],
      data: [entete(['Date', 'Libellé', 'Catégorie', 'Montant', 'Notes']),
        ...detail.depenses.map((d): Row => [date(d.date), d.libelle, texte(d.categorie), euros(d.montant), texte(d.notes)])],
    },
    {
      sheet: 'Autres revenus', stickyRowsCount: 1, columns: [{ width: 12 }, { width: 30 }, { width: 20 }, { width: 14 }, { width: 30 }],
      data: [entete(['Date', 'Libellé', 'Source', 'Montant', 'Notes']),
        ...detail.revenus.map((r): Row => [date(r.date), r.libelle, texte(r.source), euros(r.montant), texte(r.notes)])],
    },
    {
      sheet: 'Personnel', stickyRowsCount: 1, columns: [{ width: 28 }, { width: 22 }, { width: 22 }, { width: 10 }, { width: 14 }],
      data: [entete(['Personne', 'Rôle', 'Type de présence', 'Heures', 'Coût']),
        ...b.personnel.par_personne.map((p): Row => [p.nom, p.role, p.type, { value: p.heures, type: Number, format: '0.00' }, euros(p.cout)])],
    },
  ]

  await writeXlsxFile(feuilles).toFile(nomFichier)
}
