import type { jsPDF as JsPDFType } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { textePdf } from '@/lib/pdf/nombres'
import { finDuTableau } from '@/lib/pdf/tableau'
import { libelleRole } from '@/lib/auth/role-labels'
import { presentationParModule, ROLES_PRESENTATION } from '@/lib/aide'
import type { OptionsEcole, Procedure } from '@/lib/aide/types'

// Guide d'utilisation en PDF (02/11) : page de garde et sommaire, PRESENTATION
// de l'application (chaque fonctionnalite et les roles qui y accedent, pour tout
// lecteur), puis les procedures LISIBLES par le role qui l'edite, dans l'ordre du
// menu Aide (la mise en route de la direction en tete). Meme contenu que l'ecran,
// en texte simple (les « ... » des noms de boutons restent des guillemets).

const ENCRE: [number, number, number] = [31, 46, 53]
const DOUX:  [number, number, number] = [110, 110, 110]

export async function genererGuidePdf(procedures: Procedure[], etablissement: string, options: OptionsEcole): Promise<JsPDFType> {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const doc: JsPDFType = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const largeur = doc.internal.pageSize.getWidth()
  const hauteur = doc.internal.pageSize.getHeight()
  const marge = 18
  const utile = largeur - 2 * marge
  let y = marge

  const place = (h: number) => { if (y + h > hauteur - 16) { doc.addPage(); y = marge } }
  const ecrire = (texte: string, o: { taille?: number; gras?: boolean; couleur?: [number, number, number]; retrait?: number; apres?: number } = {}) => {
    const taille = o.taille ?? 9.5
    doc.setFont('helvetica', o.gras ? 'bold' : 'normal')
    doc.setFontSize(taille)
    doc.setTextColor(...(o.couleur ?? ENCRE))
    const retrait = o.retrait ?? 0
    const lignes: string[] = doc.splitTextToSize(textePdf(texte), utile - retrait)
    const hLigne = taille * 0.45
    for (const l of lignes) { place(hLigne); doc.text(l, marge + retrait, y); y += hLigne }
    y += o.apres ?? 1.2
  }
  const titreSection = (t: string) => { y += 1.5; place(12); ecrire(t.toUpperCase(), { taille: 8.5, gras: true, couleur: DOUX, apres: 1.5 }) }

  // Page de garde
  y = 70
  ecrire('Guide d’utilisation', { taille: 22, gras: true, apres: 4 })
  ecrire(etablissement, { taille: 12, couleur: DOUX, apres: 2 })
  ecrire(`Édité le ${new Date().toLocaleDateString('fr-FR')}`, { taille: 9, couleur: DOUX, apres: 10 })
  ecrire('Sommaire', { taille: 11, gras: true, apres: 2 })
  ecrire('Présentation de l’application', { taille: 10, retrait: 2, apres: 0.8 })
  for (const p of procedures) ecrire(`${p.module} · ${p.titre}`, { taille: 10, retrait: 2, apres: 0.8 })

  // Presentation : toutes les fonctionnalites, quel que soit le lecteur, avec les
  // roles qui y accedent (un point = acces).
  doc.addPage(); y = marge
  ecrire('Présentation de l’application', { taille: 16, gras: true, apres: 2 })
  ecrire('Chaque fonctionnalité, rangée comme dans le menu, avec ce à quoi elle sert et les rôles qui y ont accès (•). '
    + 'L’administrateur a partout les droits de la direction. Les familles n’ont pas encore de compte.', { apres: 3 })
  const colonnesRoles = Object.fromEntries(ROLES_PRESENTATION.map((_, i) => [i + 2, { halign: 'center' as const, cellWidth: 16 }]))
  for (const m of presentationParModule(options)) {
    titreSection(m.module)
    autoTable(doc, {
      startY: y,
      margin: { left: marge, right: marge },
      head: [['Fonctionnalité', 'À quoi elle sert', ...ROLES_PRESENTATION.map(r => libelleRole(r, 'court'))]],
      body: m.fonctionnalites.map(f => [
        textePdf(f.titre), textePdf(f.resume), ...ROLES_PRESENTATION.map(r => (f.roles.includes(r) ? '•' : '')),
      ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.4, textColor: ENCRE, valign: 'middle' },
      headStyles: { fillColor: [240, 245, 248], textColor: ENCRE, fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold' }, ...colonnesRoles },
    })
    y = finDuTableau(doc) + 4
  }

  for (const p of procedures) {
    doc.addPage(); y = marge
    ecrire(p.titre, { taille: 16, gras: true, apres: 1 })
    ecrire(`Menu : ${p.acces}`, { taille: 8.5, couleur: DOUX, apres: 3 })
    ecrire(p.resume, { apres: 3 })

    titreSection('Pas à pas')
    for (const t of p.taches) {
      place(14)
      ecrire(t.titre, { taille: 10.5, gras: true, apres: 1.2 })
      t.etapes.forEach((e, i) => ecrire(`${i + 1}.  ${e}`, { retrait: 3 }))
      for (const a of t.aSavoir ?? []) ecrire(a, { taille: 8.5, couleur: DOUX, retrait: 6 })
      y += 2
    }
    if (p.regles?.length) {
      titreSection('Règles à connaître')
      for (const r of p.regles) ecrire(`•  ${r.texte}`, { retrait: 2 })
    }
    if (p.grise?.length) {
      titreSection('Un bouton est grisé ou absent')
      for (const g of p.grise) {
        ecrire(g.element, { gras: true, apres: 0.6 })
        ecrire(`${g.raison} ${g.solution}`, { retrait: 2, apres: 2 })
      }
    }
    if (p.faq?.length) {
      titreSection('Questions fréquentes')
      for (const f of p.faq) {
        ecrire(f.question, { gras: true, apres: 0.6 })
        ecrire(f.reponse, { retrait: 2, apres: 2 })
      }
    }
  }

  const pages = doc.getNumberOfPages()
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...DOUX)
    doc.text(textePdf(`Guide d’utilisation · ${etablissement} · page ${i - 1} / ${pages - 1}`), largeur - marge, hauteur - 8, { align: 'right' })
  }
  return doc
}
