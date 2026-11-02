import type { jsPDF as JsPDFType } from 'jspdf'
import { textePdf } from '@/lib/pdf/nombres'
import type { Procedure } from '@/lib/aide/types'

// Guide d'utilisation en PDF (02/11) : les procedures LISIBLES par le role qui
// l'edite, dans l'ordre du menu Aide. Meme contenu que l'ecran, en texte simple
// (les « ... » des noms de boutons restent des guillemets).

const ENCRE: [number, number, number] = [31, 46, 53]
const DOUX:  [number, number, number] = [110, 110, 110]

export async function genererGuidePdf(procedures: Procedure[], etablissement: string): Promise<JsPDFType> {
  const { default: jsPDF } = await import('jspdf')
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
  for (const p of procedures) ecrire(`${p.module} · ${p.titre}`, { taille: 10, retrait: 2, apres: 0.8 })

  for (const p of procedures) {
    doc.addPage(); y = marge
    ecrire(p.titre, { taille: 16, gras: true, apres: 1 })
    ecrire(`Menu : ${p.acces}`, { taille: 8.5, couleur: DOUX, apres: 3 })
    ecrire(p.resume, { apres: 3 })

    if (p.droits?.length) {
      titreSection('Qui peut faire quoi')
      for (const d of p.droits) ecrire(`•  ${d.texte}`, { retrait: 2 })
    }
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
