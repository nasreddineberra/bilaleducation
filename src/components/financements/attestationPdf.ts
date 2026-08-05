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
  /**
   * Vrai quand SEULE UNE PARTIE des inscriptions du foyer figure sur
   * l'attestation (cas d'un remboursement par un comite d'entreprise, qui ne
   * prend en charge que les cours des enfants, par exemple).
   *
   * Change la PHRASE DE CERTIFICATION : on ne peut pas attester de
   * « l'integralite des cotisations » en n'en listant qu'une partie. Le document
   * part a un tiers qui rembourse sur cette base — l'exactitude n'est pas
   * cosmetique ici.
   */
  partial:               boolean
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
  doc.text(input.etablissementNom, margin + logoOffset, y + 7)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  const infoLines: string[] = []
  if (input.etablissementAdresse) infoLines.push(input.etablissementAdresse)
  if (input.etablissementTelephone) infoLines.push(`Tél : ${input.etablissementTelephone}`)
  infoLines.forEach((line, i) => doc.text(line, margin + logoOffset, y + 12 + i * 4))

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text('ATTESTATION DE PAIEMENT', pageWidth - margin, y + 7, { align: 'right' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray)
  doc.text(`Année ${input.yearLabel}`, pageWidth - margin, y + 12, { align: 'right' })

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
  // Deux variations INDEPENDANTES dans cette phrase.
  //
  // 1. « l'intégralité » disparaît sur une attestation PARTIELLE : on ne peut
  //    pas attester du tout en n'en listant qu'une partie. Le document part à un
  //    tiers qui rembourse sur cette base.
  // 2. Le NOMBRE de lignes retenues commande cotisation/cotisations, due/dues,
  //    l'inscription/les inscriptions — une attestation d'une seule inscription
  //    est un cas courant.
  //
  // « listées ci-dessous » ne varie PAS : l'accord se fait sur « activités
  // culturelles et linguistiques », toujours au pluriel dans la phrase.
  const pluriel = input.lines.length > 1
  const cotis   = pluriel ? 'cotisations' : 'cotisation'
  const portee  = input.partial
    ? `${pluriel ? 'les' : 'la'} ${cotis}`
    : `l'intégralité ${pluriel ? 'des' : 'de la'} ${cotis}`
  const dues         = pluriel ? 'dues' : 'due'
  const inscriptions = pluriel ? 'des inscriptions' : "de l'inscription"

  const intro =
    `L'établissement mentionné ci-dessus atteste que ${qui} ${aOnt} réglé ${portee} ` +
    `${dues} au titre ${inscriptions} pour des activités culturelles et linguistiques listées ci-dessous ` +
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
