import type { jsPDF as JsPDFType } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Couleurs (alignees sur bulletinPdf) ─────────────────────────────────────
const COLORS = {
  secondary: [46, 69, 80] as [number, number, number],   // #2e4550
  accent:    [24, 170, 153] as [number, number, number], // #18aa99
  headerBg:  [240, 245, 248] as [number, number, number],
  gray:      [120, 120, 120] as [number, number, number],
  redText:   [220, 38, 38] as [number, number, number],
  footBg:    [235, 240, 243] as [number, number, number],
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface StaffTimePdfRow {
  name: string
  typeMinutes: Record<string, number>
  absenceDays: number
  cost: number
}

export interface StaffTimePdfInput {
  etablissementNom: string
  etablissementLogo: string | null
  periodLabel: string                             // ex. "Juillet 2026" ou "Année scolaire 2025-2026"
  // types non-absence, dans l'ordre ; rate/color pour la legende des taux (si showCosts)
  typeColumns: { code: string; label: string; rate: number; color?: string }[]
  rows: StaffTimePdfRow[]
  totals: { typeMinutes: Record<string, number>; absenceDays: number; cost: number }
  showCosts: boolean
}

// ─── Helpers de formatage (dupliques volontairement, isoles du composant) ─────
function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function fmtDays(n: number): string {
  return `${n.toLocaleString('fr-FR')}j`
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
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
  } catch {
    return null
  }
}

// ─── Generation du recapitulatif PDF ──────────────────────────────────────────
export async function generateStaffTimePDF(input: StaffTimePdfInput): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable') // patch prototype (coherent avec bulletinPdf)
  const doc: JsPDFType = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  // En-tete : logo + nom etablissement
  let logoBase64: string | null = null
  if (input.etablissementLogo) logoBase64 = await loadImageAsBase64(input.etablissementLogo)
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', margin, y, 18, 18) } catch { /* logo optionnel */ }
  }
  const logoOffset = logoBase64 ? 23 : 0

  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text(input.etablissementNom, margin + logoOffset, y + 6)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.accent)
  doc.text(`Récapitulatif des temps de présence · ${input.periodLabel}`, margin + logoOffset, y + 13)

  let headerBottom = y + (logoBase64 ? 22 : 18)

  // Legende des taux horaires (haut a droite) — uniquement si couts visibles.
  if (input.showCosts) {
    const rated = input.typeColumns.filter(c => c.rate > 0)
    if (rated.length > 0) {
      const rightX = pageWidth - margin
      let ry = y + 3
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.gray)
      doc.text('Taux horaires', rightX, ry, { align: 'right' })
      ry += 4
      doc.setFont('helvetica', 'normal')
      for (const c of rated) {
        const rgb = c.color ? hexToRgb(c.color) : null
        doc.setTextColor(...(rgb ?? COLORS.gray))
        doc.text(`${c.label} : ${fmtEur(c.rate)}/h`, rightX, ry, { align: 'right' })
        ry += 4
      }
      headerBottom = Math.max(headerBottom, ry)
    }
  }

  y = headerBottom

  // Tableau
  const head = [[
    'Personnel',
    ...input.typeColumns.map(c => c.label),
    'Absences',
    ...(input.showCosts ? ['Coût'] : []),
  ]]

  const body = input.rows.map(r => [
    r.name,
    ...input.typeColumns.map(c => {
      const mins = r.typeMinutes[c.code.toUpperCase()] ?? 0
      return mins > 0 ? fmtDuration(mins) : '·'
    }),
    r.absenceDays > 0 ? fmtDays(r.absenceDays) : '·',
    ...(input.showCosts ? [fmtEur(r.cost)] : []),
  ])

  const foot = [[
    'TOTAL',
    ...input.typeColumns.map(c => {
      const mins = input.totals.typeMinutes[c.code.toUpperCase()] ?? 0
      return mins > 0 ? fmtDuration(mins) : '·'
    }),
    input.totals.absenceDays > 0 ? fmtDays(input.totals.absenceDays) : '·',
    ...(input.showCosts ? [fmtEur(input.totals.cost)] : []),
  ]]

  const lastCol = head[0].length - 1

  autoTable(doc, {
    head,
    body,
    foot,
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2, lineColor: [225, 230, 233], lineWidth: 0.1, halign: 'center' },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.secondary, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: COLORS.footBg, textColor: COLORS.secondary, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'left' }, // Personnel a gauche ; heures / absences / cout centres
    },
    didParseCell: (data) => {
      // Colonne Absences en rouge (avant-derniere si couts, derniere sinon)
      const absCol = input.showCosts ? lastCol - 1 : lastCol
      if (data.column.index === absCol && data.section !== 'head') {
        data.cell.styles.textColor = COLORS.redText
      }
      if (data.column.index === 0 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // Pied de page : date de generation
  const generated = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text(`Généré le ${generated}`, margin, doc.internal.pageSize.getHeight() - 8)

  const safeLabel = input.periodLabel.replace(/\s/g, '_')
  doc.save(`Temps_de_presence_${safeLabel}.pdf`)
}
