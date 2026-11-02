import type { jsPDF as JsPDFType } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { finDuTableau } from '@/lib/pdf/tableau'
import { libelleAjustement, libelleCotisation, libelleMois, libelleMoyen } from '@/lib/financements/libelles'
import { eurosPdf, nombrePdf, textePdf } from '@/lib/pdf/nombres'
import type { BilanChiffres } from '@/lib/financements/bilan'

// Bilan financier annuel en PDF, pour la comptabilite (02/11). Memes chiffres que
// l'ecran « Bilans annuels » : ceux de `bilans_financiers` pour une annee
// archivee, le calcul a la volee pour l'annee en cours (marque PROVISOIRE).

const COLORS = {
  secondary: [46, 69, 80] as [number, number, number],
  headerBg:  [240, 245, 248] as [number, number, number],
  gray:      [120, 120, 120] as [number, number, number],
  red:       [179, 38, 30] as [number, number, number],
}

export interface BilanPdfInput {
  etablissementNom:     string
  etablissementLogo:    string | null
  etablissementAdresse: string | null
  bilan:                BilanChiffres
  /** « Établi le 30/06/2026 par DUPONT Ali », ou « Provisoire au 02/11/2026 ». */
  mention:              string
  provisoire:           boolean
}

const heures = (h: number) => `${nombrePdf(h)} h`

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

export async function genererBilanPdf(input: BilanPdfInput): Promise<JsPDFType> {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const doc: JsPDFType = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const b = input.bilan

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let y = margin

  // ── En-tete (comme l'attestation) ──
  const logo = input.etablissementLogo ? await loadImageAsBase64(input.etablissementLogo) : null
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, y, 20, 20, undefined, 'FAST') } catch { /* logo optionnel */ }
  }
  const logoOffset = logo ? 25 : 0
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text(textePdf(input.etablissementNom), margin + logoOffset, y + 7)
  if (input.etablissementAdresse) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    doc.text(input.etablissementAdresse, margin + logoOffset, y + 12)
  }
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text('BILAN FINANCIER', pageWidth - margin, y + 7, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text(`Année ${b.annee.label}`, pageWidth - margin, y + 12, { align: 'right' })
  if (input.provisoire) doc.setTextColor(...COLORS.red)
  doc.text(input.mention, pageWidth - margin, y + 17, { align: 'right' })

  y += 25
  doc.setDrawColor(...COLORS.secondary)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  const titre = (t: string) => {
    if (y > pageHeight - 40) { doc.addPage(); y = margin }
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.secondary)
    doc.text(t, margin, y + 4)
    y += 6
  }
  const tableau = (head: string[], body: (string | number)[][], droite: number[] = [], foot?: (string | number)[]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [head],
      body: body.length > 0 ? body : [[{ content: 'Aucune donnée.', colSpan: head.length }]],
      foot: foot ? [foot] : undefined,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.6, textColor: [40, 40, 40] },
      headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.secondary, fontStyle: 'bold' },
      footStyles: { fillColor: COLORS.headerBg, textColor: COLORS.secondary, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(droite.map(i => [i, { halign: 'right' as const }])),
    })
    y = finDuTableau(doc) + 6
  }

  // ── 1. Synthese ──
  titre('Synthèse')
  tableau(['', 'Montant'], [
    ['Cotisations encaissées', eurosPdf(b.cotisations.encaisse)],
    ['Autres revenus', eurosPdf(b.autres_revenus.total)],
    ['Dépenses', `- ${eurosPdf(b.depenses.total)}`],
    ['Coût du personnel', `- ${eurosPdf(b.personnel.total)}`],
  ], [1], ['Résultat', eurosPdf(b.resultat)])

  // ── 2. Cotisations ──
  titre('Cotisations')
  tableau(['Facturé', 'Encaissé', 'Reste dû', 'Trop-perçu', 'Foyers', 'Recouvrement'], [[
    eurosPdf(b.cotisations.facture), eurosPdf(b.cotisations.encaisse), eurosPdf(b.cotisations.reste_du),
    eurosPdf(b.cotisations.trop_percu), b.cotisations.foyers, `${b.cotisations.taux} %`,
  ]], [0, 1, 2, 3, 4, 5])
  tableau(['Cotisation', 'Inscrits', 'Facturé'],
    b.cotisations.par_cotisation.map(c => [libelleCotisation(c.libelle, c.adulte), c.inscrits, eurosPdf(c.facture)]),
    [1, 2])
  if (b.ajustements.length > 0) {
    tableau(['Ajustement', 'Nombre', 'Montant'],
      b.ajustements.map(a => [libelleAjustement(a.type), a.nombre, eurosPdf(a.montant)]), [1, 2])
  }

  // ── 3. Encaissements ──
  titre('Encaissements')
  tableau(['Mois', 'Encaissé'], b.encaissements.par_mois.map(m => [libelleMois(m.mois), eurosPdf(m.montant)]), [1])
  tableau(['Moyen de paiement', 'Encaissé'], b.encaissements.par_moyen.map(m => [libelleMoyen(m.moyen), eurosPdf(m.montant)]), [1])

  // ── 4. Autres revenus et depenses ──
  titre('Autres revenus')
  tableau(['Source', 'Montant'], b.autres_revenus.par_source.map(s => [s.libelle, eurosPdf(s.montant)]), [1],
    ['Total', eurosPdf(b.autres_revenus.total)])
  titre('Dépenses')
  tableau(['Catégorie', 'Montant'], b.depenses.par_categorie.map(c => [c.libelle, eurosPdf(c.montant)]), [1],
    ['Total', eurosPdf(b.depenses.total)])
  tableau(['Mois', 'Dépenses'], b.depenses.par_mois.map(m => [libelleMois(m.mois), eurosPdf(m.montant)]), [1])

  // ── 5. Personnel ──
  titre('Coût du personnel')
  tableau(['Type de présence', 'Heures', 'Coût'], b.personnel.par_type.map(t => [t.type, heures(t.heures), eurosPdf(t.cout)]), [1, 2],
    ['Total', heures(b.personnel.heures), eurosPdf(b.personnel.total)])
  tableau(['Personne', 'Rôle', 'Type', 'Heures', 'Coût'],
    b.personnel.par_personne.map(p => [p.nom, p.role, p.type, heures(p.heures), eurosPdf(p.cout)]), [3, 4])
  tableau(['Mois', 'Coût'], b.personnel.par_mois.map(m => [libelleMois(m.mois), eurosPdf(m.montant)]), [1])
  if (b.personnel.sans_taux.length > 0) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.red)
    doc.text(`Heures sans taux (comptées 0 €) : ${b.personnel.sans_taux.map(s => `${s.code} ${heures(s.heures)}`).join(', ')}`, margin, y)
    y += 6
  }

  // Pied de page : numero de page.
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    doc.text(`Bilan financier ${b.annee.label} · page ${i} / ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }
  return doc
}
