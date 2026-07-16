import type { jsPDF as JsPDFType } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Couleurs (alignees sur bulletinPdf) ─────────────────────────────────────
const COLORS = {
  secondary: [46, 69, 80] as [number, number, number],   // #2e4550
  headerBg:  [240, 245, 248] as [number, number, number],
  gray:      [120, 120, 120] as [number, number, number],
}

export interface AttestationLine {
  nom:     string   // NOM Prenom (eleve) ou tuteur (adulte)
  detail:  string   // classe / activite
  montant: number
}

export interface AttestationPdfInput {
  etablissementNom:      string
  etablissementLogo:     string | null
  etablissementAdresse:  string | null
  etablissementTelephone: string | null
  tutorNames:            string[]   // tuteur(s) choisi(s), "NOM Prenom"
  yearLabel:             string
  lines:                 AttestationLine[]
  reduction:             number     // total reductions/avoirs (valeur positive), 0 si aucune
  total:                 number     // montant net regle (= total du)
  dateStr:               string     // jj/mm/aaaa
}

function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

/** Genere l'attestation de paiement et la retourne en base64 (pour pièce jointe email). */
export async function generateAttestationPdfBase64(input: AttestationPdfInput): Promise<string> {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const doc: JsPDFType = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // ── En-tete (identique aux bulletins) : logo + nom/adresse a gauche, titre a droite ──
  let logoBase64: string | null = null
  if (input.etablissementLogo) logoBase64 = await loadImageAsBase64(input.etablissementLogo)
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', margin, y, 20, 20) } catch { /* logo optionnel */ }
  }
  const logoOffset = logoBase64 ? 25 : 0

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text(input.etablissementNom, margin + logoOffset, y + 7)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  const infoLines: string[] = []
  if (input.etablissementAdresse) infoLines.push(input.etablissementAdresse)
  if (input.etablissementTelephone) infoLines.push(`Tél : ${input.etablissementTelephone}`)
  infoLines.forEach((line, i) => doc.text(line, margin + logoOffset, y + 12 + i * 4))

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text('ATTESTATION DE PAIEMENT', pageWidth - margin, y + 5, { align: 'right' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text(`Année ${input.yearLabel}`, pageWidth - margin, y + 11, { align: 'right' })

  y += 25
  doc.setDrawColor(...COLORS.secondary)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 12

  // Corps : phrase de certification.
  const qui = input.tutorNames.length > 1
    ? `${input.tutorNames.slice(0, -1).join(', ')} et ${input.tutorNames[input.tutorNames.length - 1]}`
    : (input.tutorNames[0] ?? '')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(40, 40, 40)
  const aOnt = input.tutorNames.length > 1 ? 'ont' : 'a'
  const intro =
    `L'établissement mentionné ci-dessus atteste que ${qui} ${aOnt} réglé l'intégralité des cotisations ` +
    `dues au titre des inscriptions pour des activités culturelles et linguistiques listées ci-dessous ` +
    `pour l'année scolaire ${input.yearLabel}, pour un montant total de ${fmtEur(input.total)}.`
  const introLines = doc.splitTextToSize(intro, pageWidth - margin * 2)
  doc.text(introLines, margin, y)
  y += introLines.length * 6 + 6

  // Tableau des inscriptions.
  const body = input.lines.map(l => [l.nom, l.detail, fmtEur(l.montant)])
  if (input.reduction > 0) body.push(['Réduction / avoir', '', `- ${fmtEur(input.reduction)}`])

  autoTable(doc, {
    startY: y,
    head: [['Inscription', 'Classe / activité', 'Montant']],
    body,
    foot: [['', 'Total réglé', fmtEur(input.total)]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.5, textColor: [40, 40, 40] },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.secondary, fontStyle: 'bold' },
    footStyles: { fillColor: COLORS.headerBg, textColor: COLORS.secondary, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right' } },
    margin: { left: margin, right: margin },
  })

  y = (doc as any).lastAutoTable.finalY + 16

  // Pied : date + mention.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(40, 40, 40)
  doc.text(`Le ${input.dateStr},`, margin, y)
  y += 6
  doc.text('Pour faire valoir ce que de droit, établi ce jour en 1 exemplaire.', margin, y)

  // Sortie base64 (sans prefixe data URI).
  const dataUri = doc.output('datauristring')
  return dataUri.split(',')[1] ?? ''
}
