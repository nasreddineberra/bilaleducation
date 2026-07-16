// Signature de mail auto-inseree (editable) au bas du corps des communications.
// Cordialement + coordonnees de l'etablissement : nom, adresse, telephone, contact.
// Rendue en HTML pour le RichTextEditor (parents + staff).

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface EtabSignatureFields {
  nom?: string | null
  adresse?: string | null
  telephone?: string | null
  contact?: string | null
}

/**
 * Construit la signature HTML (deux lignes vides pour rediger au-dessus, puis
 * « Cordialement, » et les coordonnees renseignees). Seules les lignes presentes
 * sont rendues.
 */
export function buildSignatureHtml(etab: EtabSignatureFields | null | undefined): string {
  const lines = [
    etab?.nom,
    etab?.adresse,
    etab?.telephone ? `Tél : ${etab.telephone}` : null,
    etab?.contact,
  ].filter((l): l is string => !!l && !!l.trim())

  const sig = ['Cordialement,', ...lines].map(escapeHtml).join('<br>')
  return `<p></p><p></p><p>${sig}</p>`
}
