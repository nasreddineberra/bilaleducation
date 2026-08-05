import type { jsPDF as JsPDFType } from 'jspdf'
import autoTable from 'jspdf-autotable'
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

// ─── Police arabe ────────────────────────────────────────────────────────────
//
// jsPDF ne connait que des polices latines : sans TTF embarque, tout caractere
// arabe sort vide. On charge Noto Sans Arabic depuis /public AU MOMENT de
// generer le PDF — jamais dans le bundle, la generation etant deja en import
// dynamique. Le resultat est mis en cache : plusieurs bulletins d'affilee ne
// retelechargent pas la police.

const AR_FONT_NAME = 'NotoSansArabic'

// LES DEUX GRAISSES sont necessaires : les en-tetes d'UE du tableau sont en
// `fontStyle: 'bold'`, et une graisse non enregistree fait retomber jsPDF sur
// une police absente — le texte arabe sort alors en charabia.
const AR_FONT_FILES: Record<'normal' | 'bold', string> = {
  normal: 'NotoSansArabic-Regular.ttf',
  bold:   'NotoSansArabic-Bold.ttf',
}

const arFontCache: Partial<Record<'normal' | 'bold', string | null>> = {}

async function loadArabicFont(style: 'normal' | 'bold'): Promise<string | null> {
  if (arFontCache[style] !== undefined) return arFontCache[style] ?? null
  try {
    const res = await fetch(`/fonts/${AR_FONT_FILES[style]}`)
    if (!res.ok) { arFontCache[style] = null; return null }
    const buf = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
    arFontCache[style] = btoa(bin)
  } catch {
    arFontCache[style] = null
  }
  return arFontCache[style] ?? null
}

/** Enregistre la police arabe (normal + gras) aupres du document.
 *  Renvoie false si indisponible : le bulletin sort alors en francais seul
 *  plutot que de casser. */
async function registerArabicFont(doc: JsPDFType): Promise<boolean> {
  const [normal, bold] = await Promise.all([loadArabicFont('normal'), loadArabicFont('bold')])
  if (!normal || !bold) return false
  try {
    doc.addFileToVFS(AR_FONT_FILES.normal, normal)
    doc.addFont(AR_FONT_FILES.normal, AR_FONT_NAME, 'normal')
    doc.addFileToVFS(AR_FONT_FILES.bold, bold)
    doc.addFont(AR_FONT_FILES.bold, AR_FONT_NAME, 'bold')
    return true
  } catch {
    return false
  }
}

/** Met le texte arabe en formes contextuelles (liaison des lettres).
 *  Sans cette etape, jsPDF dessine des lettres detachees et illisibles. */
function shapeArabic(doc: JsPDFType, s: string): string {
  const fn = (doc as unknown as { processArabic?: (v: string) => string }).processArabic
  return typeof fn === 'function' ? fn.call(doc, s) : s
}

/** Vrai si la chaine contient de l'arabe (bloc de base ou formes de presentation). */
const hasArabic = (s: string | null | undefined) =>
  !!s && /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s)

/** « Lecture · القراءة » : les deux noms sur une meme ligne.
 *  L'arabe est mis en formes contextuelles ; sans police chargee on rend le
 *  francais seul, plutot qu'une suite de carres. */
function bilingual(doc: JsPDFType, fr: string, ar: string | null | undefined, fontReady: boolean): string {
  if (!fontReady || !hasArabic(ar)) return fr
  return `${fr} · ${shapeArabic(doc, (ar as string).trim())}`
}

/** Style de police a appliquer a UNE cellule selon son contenu.
 *  Jamais au tableau entier : Noto Sans Arabic n'a pas les etoiles ★ ☆ des
 *  evaluations etoilees, qui doivent rester dans la police latine. */
const arFont = (label: string) => (hasArabic(label) ? { font: AR_FONT_NAME } : {})

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

  // Police arabe : enregistree une fois par document. Si elle manque, le
  // bulletin sort en francais seul au lieu d'echouer.
  const arFontReady = await registerArabicFont(doc)

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
  // En-tete homogeneise a 12 POINTS : le nom d'etablissement et le titre du
  // document partagent la meme taille ET la meme ligne de base (y + 7). Le nom
  // etait en 16 et le titre en 14, sur deux hauteurs differentes.
  //
  // Ce n'est pas cosmetique : le nom partage sa ligne avec le titre aligne a
  // droite, donc la LONGUEUR DU TITRE commande la place laissee au nom. A 16
  // points, « ATTESTATION DE PAIEMENT » ne laissait que 81 mm, soit 25
  // caracteres. A 12, il reste 91 mm pour un nom qui n'en consomme plus que 76
  // sur 30 caracteres.
  doc.setFontSize(12)
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
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text("BULLETIN D'\u00C9VALUATION", pageWidth - margin, y + 7, { align: 'right' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text(`${data.periodLabel} · ${data.yearLabel}`, pageWidth - margin, y + 12, { align: 'right' })

  y += 25

  // Ligne de séparation
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ── Informations élève ─────────────────────────────────────────────────────

  // Hauteur AJUSTEE au contenu : la colonne de gauche peut n'avoir qu'une ligne
  // (un adulte n'a pas de matricule) et la scolarité peut être vide. Une hauteur
  // fixe laissait alors une bande grise vide sous le texte.
  const scolariteInfo = [data.cotisationLabel, data.classLevel ? `Niveau ${data.classLevel}` : null]
    .filter(Boolean).join(' ')
  const leftRows  = 1 + (!data.isAdult && data.student.student_number ? 1 : 0)
  const rightRows = 1 + (scolariteInfo ? 1 : 0) + 1        // classe · scolarité · enseignant
  const infoRows  = Math.max(leftRows, rightRows)
  const infoBoxH  = 9 + (infoRows - 1) * 7

  doc.setFillColor(...COLORS.headerBg)
  doc.roundedRect(margin, y, contentWidth, infoBoxH, 2, 2, 'F')

  doc.setFontSize(9)
  // Valeurs alignees verticalement dans chaque colonne : un x FIXE par colonne
  // (aligne sur le label le plus large), au lieu de « juste apres le label ».
  const leftLabelX  = margin + 4
  const leftValueX  = margin + (data.isAdult ? 32 : 36)   // « N° matricule : » = le plus large
  const rightLabelX = margin + contentWidth / 2
  const rightValueX = margin + contentWidth / 2 + 28       // « Enseignant : » = le plus large

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text(data.isAdult ? 'Participant :' : 'Élève :', leftLabelX, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(`${data.student.last_name} ${data.student.first_name}`, leftValueX, y + 6)

  // N° matricule : uniquement pour les élèves (les adultes n'en ont pas)
  if (!data.isAdult && data.student.student_number) {
    doc.setFont('helvetica', 'bold')
    doc.text('N° matricule :', leftLabelX, y + 13)
    doc.setFont('helvetica', 'normal')
    doc.text(data.student.student_number, leftValueX, y + 13)
  }

  // Colonne droite : curseur, pour qu'« Enseignant » remonte si la scolarité
  // n'est pas renseignée, au lieu de laisser un trou.
  let rightY = y + 6
  const rightLine = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, rightLabelX, rightY)
    doc.setFont('helvetica', 'normal')
    doc.text(value, rightValueX, rightY)
    rightY += 7
  }

  rightLine('Classe :', data.classSchedule ? `${data.className} ${data.classSchedule}` : data.className)
  if (scolariteInfo) rightLine('Scolarité :', scolariteInfo)
  rightLine('Enseignant :', data.teacherName || '·')

  // Respiration commune de tout le corps du bulletin : le meme ecart separe
  // l'identite de la legende, la legende du tableau, puis le tableau de
  // l'encadre d'appreciation. Une seule constante — les quatre blocs ne peuvent
  // pas deriver les uns par rapport aux autres.
  const GAP = 3
  y += infoBoxH + GAP

  // ── Légende diagnostique (au-dessus du tableau) ────────────────────────────

  // Une seule ligne de légende, deux contenus indépendants :
  //   - à GAUCHE, la signification de « ABS », qui n'apparaît que si au moins
  //     une absence figure réellement dans le tableau ;
  //   - à DROITE, les acronymes diagnostiques, au-dessus de la colonne « Note ».
  // La ligne n'est tracée que si l'un des deux existe.
  const hasAbsentLine = data.ueBlocks.some(b => b.lines.some(l => l.isAbsent))

  if (data.diagnosticLegend || hasAbsentLine) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLORS.gray)
    if (hasAbsentLine) {
      doc.text('ABS : Absence', margin, y + 3)
    }
    if (data.diagnosticLegend) {
      doc.text(data.diagnosticLegend, pageWidth - margin, y + 3, { align: 'right' })
    }
    y += 3 + GAP
  }

  // ── Tableau des notes par UE ───────────────────────────────────────────────

  // Déterminer si la colonne Coeff. est pertinente (au moins une éval scored)
  const allLines = data.ueBlocks.flatMap(b => b.lines)
  const hasScored = allLines.some(l => l.evalKind === 'scored')

  const tableBody: any[][] = []
  // Texte arabe de chaque ligne, indexe sur la ligne de CORPS : il n'est pas
  // dans le contenu de la cellule (il serait aligne comme le francais), mais
  // dessine ensuite a droite par `didDrawCell`.
  const arabicByRow: Record<number, string> = {}

  for (const block of data.ueBlocks) {
    // Ligne d'en-tête UE
    // Deux chaines distinctes : le francais alimente la cellule, l'arabe est
    // dessine a droite. Les separateurs suivent chaque langue.
    const ueLabel = block.moduleName ? `${block.ueName} › ${block.moduleName}` : block.ueName
    // Separateur INVERSE cote arabe : le francais hierarchise avec « › », qui
    // pointe dans son sens de lecture ; l'arabe se lisant de droite a gauche,
    // c'est « ‹ » qui joue le meme role. Les deux glyphes existent dans la
    // police (verifie dans sa cmap, graisses normale et grasse).
    const ueArParts = [block.ueNameAr, block.moduleNameAr].filter(hasArabic) as string[]
    const ueArabic = arFontReady && ueArParts.length
      ? shapeArabic(doc, ueArParts.join(' ‹ '))
      : ''

    if (ueArabic) arabicByRow[tableBody.length] = ueArabic

    if (hasScored) {
      tableBody.push([
        { content: ueLabel, styles: { fillColor: COLORS.ueBg, fontStyle: 'bold', fontSize: 8, textColor: COLORS.secondary } },
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
          content: block.classMin != null && block.classMax != null ? `${block.classMin.toFixed(1)} / ${block.classMax.toFixed(1)}` : '·',
          styles: { fillColor: COLORS.ueBg, halign: 'center', fontSize: 7, textColor: COLORS.gray }
        },
      ])
    } else {
      tableBody.push([
        { content: ueLabel, styles: { fillColor: COLORS.ueBg, fontStyle: 'bold', fontSize: 8, textColor: COLORS.secondary } },
        { content: '', styles: { fillColor: COLORS.ueBg } },
      ])
    }

    // Lignes de cours
    for (const line of block.lines) {
      let noteDisplay = '·'
      if (line.isAbsent) {
        noteDisplay = 'ABS'
      } else if (line.evalKind === 'diagnostic') {
        noteDisplay = line.diagnosticLabel ?? '·'
      } else if (line.evalKind === 'stars') {
        noteDisplay = line.starsScore != null ? '★'.repeat(line.starsScore) + '☆'.repeat(Math.max(0, 5 - line.starsScore)) : '·'
      } else if (line.score != null) {
        noteDisplay = `${line.score}/${line.maxScore ?? 20}`
      }

      const lineArabic = arFontReady && hasArabic(line.coursNameAr)
        ? shapeArabic(doc, (line.coursNameAr as string).trim())
        : ''
      if (lineArabic) arabicByRow[tableBody.length] = lineArabic

      if (hasScored) {
        tableBody.push([
          {
            // Indentation par MARGE INTERIEURE : une colonne d'espacement
            // dessinait un filet vertical a gauche des cours (theme 'grid').
            content: line.coursName,
            styles: { cellPadding: { top: 1.2, right: 1.2, bottom: 1.2, left: 5 } },
          },
          { content: noteDisplay, styles: { halign: 'center', fontStyle: line.isAbsent ? 'italic' : 'normal', textColor: line.isAbsent ? COLORS.redText : COLORS.black } },
          { content: line.evalKind === 'scored' ? `×${line.coefficient}` : '', styles: { halign: 'center', fontSize: 7, textColor: COLORS.gray } },
          '',
          '',
        ])
      } else {
        tableBody.push([
          {
            // Indentation par MARGE INTERIEURE : une colonne d'espacement
            // dessinait un filet vertical a gauche des cours (theme 'grid').
            content: line.coursName,
            styles: { cellPadding: { top: 1.2, right: 1.2, bottom: 1.2, left: 5 } },
          },
          { content: noteDisplay, styles: { halign: 'center', fontStyle: line.isAbsent ? 'italic' : 'normal', textColor: line.isAbsent ? COLORS.redText : COLORS.black } },
        ])
      }
    }
  }

  const tableHead: any[] = hasScored
    ? [
        { content: 'Matière', styles: { halign: 'left' } },
        { content: 'Note', styles: { halign: 'center' } },
        { content: 'Coeff.', styles: { halign: 'center' } },
        { content: 'Moy. classe', styles: { halign: 'center' } },
        { content: 'Min / Max', styles: { halign: 'center' } },
      ]
    : [
        { content: 'Matière', styles: { halign: 'left' } },
        { content: 'Note', styles: { halign: 'center' } },
      ]

  const colStyles: Record<number, any> = hasScored
    ? {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
      }
    : {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 30, halign: 'center' },
      }

  autoTable(doc, {
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
    // L'arabe est dessine APRES la cellule, aligne sur son bord droit : le
    // francais garde l'alignement a gauche, les deux se lisent chacun de son
    // cote. `content` ne peut pas produire ce double alignement.
    didDrawCell: (d: any) => {
      if (d.section !== 'body' || d.column.index !== 0) return
      const ar = arabicByRow[d.row.index]
      if (!ar) return
      const prevFont = doc.getFont()
      const prevSize = doc.getFontSize()
      const isUeRow = d.row.raw?.[0]?.styles?.fillColor === COLORS.ueBg
      doc.setFont(AR_FONT_NAME, isUeRow ? 'bold' : 'normal')
      doc.setFontSize(isUeRow ? 8 : 7.5)
      doc.setTextColor(...(isUeRow ? COLORS.secondary : COLORS.black))
      // Indentation MIROIR de celle du francais : les cours sont decales de la
      // marge de leur en-tete d'UE (5 mm a gauche cote francais, donc le meme
      // ecart depuis le bord droit cote arabe).
      const rightPad = isUeRow ? 2 : 2 + (5 - 1.2)
      doc.text(ar, d.cell.x + d.cell.width - rightPad, d.cell.y + d.cell.height / 2 + 1, { align: 'right' })
      doc.setFont(prevFont.fontName, prevFont.fontStyle)
      doc.setFontSize(prevSize)
    },
  })

  // Position après le tableau : même respiration que partout ailleurs.
  y = (doc as any).lastAutoTable.finalY + GAP

  // ── Résumé : moyenne, absences et appréciation dans un SEUL encadré ────────
  //
  // Une seule ligne par information, deux tailles de police en tout (libellé en
  // gras 9, valeurs en 8). Sans aucune évaluation NOTÉE (bulletin purement
  // diagnostique), la moyenne générale n'a pas de sens : sa colonne disparaît et
  // les absences occupent toute la largeur.

  // L'appréciation est un texte LIBRE : l'enseignant peut y écrire en arabe,
  // seul ou mêlé au français. On bascule alors toute la ligne sur la police
  // arabe — elle couvre aussi le latin accentué, donc une phrase bilingue reste
  // d'un seul tenant. Le découpage se fait AVANT de dessiner le cadre, dont la
  // hauteur en dépend.
  const rawAppr  = data.appreciation ?? ''
  const apprIsAr = hasArabic(rawAppr) && arFontReady
  const apprFont = apprIsAr ? AR_FONT_NAME : 'helvetica'
  doc.setFont(apprFont, 'normal')
  doc.setFontSize(8)
  const apprLines: string[] = rawAppr.trim()
    ? doc.splitTextToSize(apprIsAr ? shapeArabic(doc, rawAppr) : rawAppr, contentWidth - 32)
    : []

  const boxHeight = 11 + Math.max(1, apprLines.length) * 4 + 2

  // Nouvelle page si le cadre ne tient plus.
  if (y + boxHeight > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage()
    y = margin
  }

  doc.setFillColor(...COLORS.headerBg)
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'F')

  // Appréciation en TÊTE de l'encadré : c'est le commentaire de l'enseignant, il
  // se lit avant les chiffres. Les lignes de moyenne et d'absences se placent
  // donc en dessous, décalées de la hauteur réellement occupée.
  const apprY = y + 7
  const lineY = apprY + Math.max(1, apprLines.length) * 4 + 3
  const absX  = hasScored ? margin + contentWidth / 2 + 4 : margin + 4

  // Appréciation : toujours présente, même vide — sur un bulletin imprimé, la
  // place doit rester réservée pour une remarque manuscrite.
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text('Appréciation :', margin + 4, apprY)

  doc.setFontSize(8)
  doc.setTextColor(...COLORS.black)
  // Sans appréciation, on laisse la place VIDE : un filet d'appui ressemblait à
  // une valeur manquante plus qu'à un espace à remplir.
  if (apprLines.length > 0) {
    doc.setFont(apprFont, 'normal')
    doc.text(apprLines, margin + 28, apprY)
  }

  if (hasScored) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.secondary)
    doc.text('Moyenne générale :', margin + 4, lineY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const moy = data.generalAvg != null ? `${data.generalAvg.toFixed(2)} / 20` : '·'
    const cls = `Classe : ${data.classGeneralAvg?.toFixed(2) ?? '·'}`
      + ` (min ${data.classGeneralMin?.toFixed(2) ?? '·'} · max ${data.classGeneralMax?.toFixed(2) ?? '·'})`
    doc.text(`${moy}   ·   ${cls}`, margin + 34, lineY)
  }

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text('Absences', absX, lineY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    `Total : ${data.absCount}   ·   Non justifiées : ${data.absUnjustifiedCount}   ·   Retards : ${data.retardCount}`,
    absX + 18, lineY
  )

  // Rendre la main à la police latine pour la suite du document.
  doc.setFont('helvetica', 'normal')

  y += boxHeight + 6

  // ── Pied de page ───────────────────────────────────────────────────────────

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.lightGray)
  doc.text(
    `BULLETIN D'\u00C9VALUATION ${data.periodLabel} · ${data.yearLabel}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: 'center' }
  )
}

// ─── Nommage des fichiers ────────────────────────────────────────────────────

/** Nettoie un fragment de nom de fichier : espaces en tirets bas, caracteres
 *  interdits par les systemes de fichiers retires. Sans cela, une periode
 *  « Semestre 1 » ou une classe « MAT-SM/BD1 » produirait un nom bancal. */
const fileChunk = (s: string) =>
  (s ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')

// ─── Export : bulletin individuel ────────────────────────────────────────────

export async function generateBulletinPDF(data: BulletinData): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable') // Patches jsPDF prototype
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await renderBulletin(doc, data)
  // NOM_Prenom_Annee_Periode
  doc.save([
    fileChunk(data.student.last_name),
    fileChunk(data.student.first_name),
    fileChunk(data.yearLabel),
    fileChunk(data.periodLabel),
  ].filter(Boolean).join('_') + '.pdf')
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

  // Annee_Periode_Classe
  doc.save([
    fileChunk(allData[0].yearLabel),
    fileChunk(allData[0].periodLabel),
    fileChunk(className),
  ].filter(Boolean).join('_') + '.pdf')
}
