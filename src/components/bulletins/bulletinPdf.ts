import type { jsPDF as JsPDFType } from 'jspdf'
import type { BulletinData } from './BulletinsClient'

// ─── Couleurs ─────────────────────────────────────────────────────────────────

const COLORS = {
  primary:    [80, 117, 131] as [number, number, number],   // #507583
  secondary:  [46, 69, 80]  as [number, number, number],    // #2e4550
  accent:     [24, 170, 153] as [number, number, number],   // #18aa99
  headerBg:   [240, 245, 248] as [number, number, number],
  ueBg:       [230, 240, 245] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  black:      [30, 30, 30]   as [number, number, number],
  gray:       [120, 120, 120] as [number, number, number],
  lightGray:  [200, 200, 200] as [number, number, number],
  greenText:  [22, 163, 74]  as [number, number, number],
  amberText:  [180, 130, 10] as [number, number, number],
  redText:    [220, 38, 38]  as [number, number, number],
}

// ─── Chargement du logo en base64 ────────────────────────────────────────────

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

// ─── Génération d'un bulletin PDF ────────────────────────────────────────────

async function renderBulletin(doc: JsPDFType, data: BulletinData, startY: number = 0): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = startY + margin

  // ── En-tête établissement ──────────────────────────────────────────────────

  // Logo (si disponible)
  let logoBase64: string | null = null
  if (data.etablissement.logo_url) {
    logoBase64 = await loadImageAsBase64(data.etablissement.logo_url)
  }

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, y, 20, 20)
    } catch {
      // Ignore logo errors
    }
  }

  const logoOffset = logoBase64 ? 25 : 0

  // Nom de l'établissement
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text(data.etablissement.nom, margin + logoOffset, y + 7)

  // Adresse + téléphone
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  const infoLines: string[] = []
  if (data.etablissement.adresse) infoLines.push(data.etablissement.adresse)
  if (data.etablissement.telephone) infoLines.push(`Tél : ${data.etablissement.telephone}`)
  infoLines.forEach((line, i) => {
    doc.text(line, margin + logoOffset, y + 12 + i * 4)
  })

  // Titre du bulletin (aligné à droite)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text("BULLETIN D'\u00C9VALUATION", pageWidth - margin, y + 5, { align: 'right' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text(`${data.periodLabel} – ${data.yearLabel}`, pageWidth - margin, y + 11, { align: 'right' })

  y += 25

  // Ligne de séparation
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ── Informations élève ─────────────────────────────────────────────────────

  doc.setFillColor(...COLORS.headerBg)
  doc.roundedRect(margin, y, contentWidth, 27, 2, 2, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text('Élève :', margin + 4, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(`${data.student.last_name} ${data.student.first_name}`, margin + 22, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('N° matricule :', margin + 4, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text(data.student.student_number, margin + 36, y + 13)

  // Colonne droite
  doc.setFont('helvetica', 'bold')
  doc.text('Classe :', margin + contentWidth / 2, y + 6)
  doc.setFont('helvetica', 'normal')
  const classInfo = data.classSchedule
    ? `${data.className} ${data.classSchedule}`
    : data.className
  doc.text(classInfo, margin + contentWidth / 2 + 20, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('Scolarité :', margin + contentWidth / 2, y + 13)
  doc.setFont('helvetica', 'normal')
  const scolariteInfo = [data.cotisationLabel, data.classLevel ? `Niveau ${data.classLevel}` : null].filter(Boolean).join(' ')
  doc.text(scolariteInfo, margin + contentWidth / 2 + 26, y + 13)

  doc.setFont('helvetica', 'bold')
  doc.text('Enseignant :', margin + contentWidth / 2, y + 20)
  doc.setFont('helvetica', 'normal')
  doc.text(data.teacherName || '–', margin + contentWidth / 2 + 28, y + 20)

  y += 32

  // ── Légende diagnostique (au-dessus du tableau) ────────────────────────────

  if (data.diagnosticLegend) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLORS.gray)
    doc.text(data.diagnosticLegend, margin, y + 3)
    y += 7
  }

  // ── Tableau des notes par UE ───────────────────────────────────────────────

  // Déterminer si la colonne Coeff. est pertinente (au moins une éval scored)
  const allLines = data.ueBlocks.flatMap(b => b.lines)
  const hasScored = allLines.some(l => l.evalKind === 'scored')

  const tableBody: any[][] = []

  for (const block of data.ueBlocks) {
    // Ligne d'en-tête UE
    const ueLabel = block.moduleName
      ? `${block.ueName} › ${block.moduleName}`
      : block.ueName

    if (hasScored) {
      tableBody.push([
        { content: ueLabel, colSpan: 2, styles: { fillColor: COLORS.ueBg, fontStyle: 'bold', fontSize: 8, textColor: COLORS.secondary } },
        {
          content: block.studentAvg != null ? `Moy. ${block.studentAvg.toFixed(2)}` : '',
          styles: { fillColor: COLORS.ueBg, fontStyle: 'bold', halign: 'center', fontSize: 7, textColor: COLORS.secondary }
        },
        { content: '', styles: { fillColor: COLORS.ueBg } },
        {
          content: block.classAvg != null ? `Moy. ${block.classAvg.toFixed(2)}` : '',
          styles: { fillColor: COLORS.ueBg, halign: 'center', fontSize: 7, textColor: COLORS.gray }
        },
        {
          content: block.classMin != null && block.classMax != null ? `${block.classMin.toFixed(1)} / ${block.classMax.toFixed(1)}` : '–',
          styles: { fillColor: COLORS.ueBg, halign: 'center', fontSize: 7, textColor: COLORS.gray }
        },
      ])
    } else {
      tableBody.push([
        { content: ueLabel, colSpan: 2, styles: { fillColor: COLORS.ueBg, fontStyle: 'bold', fontSize: 8, textColor: COLORS.secondary } },
        { content: '', styles: { fillColor: COLORS.ueBg } },
      ])
    }

    // Lignes de cours
    for (const line of block.lines) {
      let noteDisplay = '–'
      if (line.isAbsent) {
        noteDisplay = 'ABS'
      } else if (line.evalKind === 'diagnostic') {
        noteDisplay = line.diagnosticLabel ?? '–'
      } else if (line.evalKind === 'stars') {
        noteDisplay = line.starsScore != null ? '★'.repeat(line.starsScore) + '☆'.repeat(Math.max(0, 5 - line.starsScore)) : '–'
      } else if (line.score != null) {
        noteDisplay = `${line.score}/${line.maxScore ?? 20}`
      }

      if (hasScored) {
        tableBody.push([
          { content: '', styles: { cellWidth: 3 } },
          line.coursName,
          { content: noteDisplay, styles: { halign: 'center', fontStyle: line.isAbsent ? 'italic' : 'normal', textColor: line.isAbsent ? COLORS.redText : COLORS.black } },
          { content: line.evalKind === 'scored' ? `×${line.coefficient}` : '', styles: { halign: 'center', fontSize: 7, textColor: COLORS.gray } },
          '',
          '',
        ])
      } else {
        tableBody.push([
          { content: '', styles: { cellWidth: 3 } },
          line.coursName,
          { content: noteDisplay, styles: { halign: 'center', fontStyle: line.isAbsent ? 'italic' : 'normal', textColor: line.isAbsent ? COLORS.redText : COLORS.black } },
        ])
      }
    }
  }

  const tableHead: any[] = hasScored
    ? [
        { content: '', styles: { cellWidth: 3 } },
        { content: 'Matière', styles: { halign: 'left' } },
        { content: 'Note', styles: { halign: 'center' } },
        { content: 'Coeff.', styles: { halign: 'center' } },
        { content: 'Moy. classe', styles: { halign: 'center' } },
        { content: 'Min / Max', styles: { halign: 'center' } },
      ]
    : [
        { content: '', styles: { cellWidth: 3 } },
        { content: 'Matière', styles: { halign: 'left' } },
        { content: 'Note', styles: { halign: 'center' } },
      ]

  const colStyles: Record<number, any> = hasScored
    ? {
        0: { cellWidth: 3 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
      }
    : {
        0: { cellWidth: 3 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'center' },
      }

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [tableHead],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontSize: 7,
      fontStyle: 'bold',
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.2,
      textColor: COLORS.black,
    },
    columnStyles: colStyles,
  })

  // Position après le tableau
  y = (doc as any).lastAutoTable.finalY + 8

  // ── Appréciation ──────────────────────────────────────────────────────────

  if (data.appreciation) {
    // Vérifier s'il reste assez de place
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage()
      y = margin
    }

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.secondary)
    doc.text('Appréciation :', margin, y + 4)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.black)
    const appreciationLines = doc.splitTextToSize(data.appreciation, contentWidth - 30)
    doc.text(appreciationLines, margin + 28, y + 4)
    y += 6 + appreciationLines.length * 4
  }

  // ── Résumé général ─────────────────────────────────────────────────────────

  // Vérifier s'il reste assez de place, sinon nouvelle page
  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage()
    y = margin
  }

  // Bloc résumé
  doc.setFillColor(...COLORS.headerBg)
  doc.roundedRect(margin, y, contentWidth, 30, 2, 2, 'F')

  // Moyenne générale
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text('Moyenne générale :', margin + 4, y + 8)

  if (data.generalAvg != null) {
    doc.setTextColor(...COLORS.secondary)
    doc.setFontSize(14)
    doc.text(`${data.generalAvg.toFixed(2)} / 20`, margin + 50, y + 8)
  } else {
    doc.setTextColor(...COLORS.gray)
    doc.text('–', margin + 50, y + 8)
  }

  // Moyennes classe
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.secondary)
  doc.text(
    `Classe – Moy : ${data.classGeneralAvg?.toFixed(2) ?? '–'} | Min : ${data.classGeneralMin?.toFixed(2) ?? '–'} | Max : ${data.classGeneralMax?.toFixed(2) ?? '–'}`,
    margin + 4, y + 16
  )

  // Absences (colonne droite)
  doc.setFont('helvetica', 'bold')
  doc.text('Absences', margin + contentWidth / 2 + 10, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Total : ${data.absCount}`, margin + contentWidth / 2 + 10, y + 15)
  doc.text(`Non justifiées : ${data.absUnjustifiedCount}`, margin + contentWidth / 2 + 10, y + 20)
  doc.text(`Retards : ${data.retardCount}`, margin + contentWidth / 2 + 10, y + 25)

  y += 36

  // ── Pied de page ───────────────────────────────────────────────────────────

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.lightGray)
  doc.text(
    `BULLETIN D'\u00C9VALUATION ${data.periodLabel} – ${data.yearLabel}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: 'center' }
  )
}

// ─── Export : bulletin individuel ────────────────────────────────────────────

export async function generateBulletinPDF(data: BulletinData): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable') // Patches jsPDF prototype
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await renderBulletin(doc, data)
  doc.save(`Bulletin_${data.student.last_name}_${data.student.first_name}_${data.periodLabel.replace(/\s/g, '_')}.pdf`)
}

// ─── Export : bulletin individuel en Blob (pour archivage) ───────────────────

export async function generateBulletinBlob(data: BulletinData): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable') // Patches jsPDF prototype
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await renderBulletin(doc, data)
  return doc.output('blob')
}

// ─── Export : tous les bulletins dans un seul PDF ────────────────────────────

export async function generateAllBulletinsPDF(allData: BulletinData[], className: string): Promise<void> {
  if (allData.length === 0) return
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable') // Patches jsPDF prototype
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  for (let i = 0; i < allData.length; i++) {
    if (i > 0) doc.addPage()
    await renderBulletin(doc, allData[i])
  }

  const periodLabel = allData[0].periodLabel.replace(/\s/g, '_')
  doc.save(`Bulletins_${className}_${periodLabel}.pdf`)
}
