// Affichage d'une periode d'absence (horodatages `AAAA-MM-JJTHH:MM`, heure de
// l'ecole). Journee entiere (00:00 / 23:59) : les heures ne s'ecrivent pas.
//   « 04/11/2026 »                         une journee entiere
//   « 04/11/2026-06/11/2026 »              plusieurs journees entieres
//   « 04/11/2026 · 10:00-12:00 »           dans la journee
//   « 04/11/2026 14:00-06/11/2026 12:00 »  sur plusieurs jours

function jour(h: string): string {
  const [y, m, d] = h.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function periodeAbsence(debut: string, fin: string): string {
  const memeJour = debut.slice(0, 10) === fin.slice(0, 10)
  const journees = debut.slice(11, 16) === '00:00' && fin.slice(11, 16) === '23:59'
  if (journees) return memeJour ? jour(debut) : `${jour(debut)}-${jour(fin)}`
  if (memeJour) return `${jour(debut)} · ${debut.slice(11, 16)}-${fin.slice(11, 16)}`
  return `${jour(debut)} ${debut.slice(11, 16)}-${jour(fin)} ${fin.slice(11, 16)}`
}
