import type { Ton } from '@/components/dashboard/tdb'

// Types de devoir : pastilles `Puce` de la charte (21/10). Le bleu « Exercice »
// etait hors charte. Source unique pour la liste et la modale de detail.
export const TYPES_DEVOIR: Record<string, { label: string; ton: Ton }> = {
  exercice: { label: 'Exercice', ton: 'info' },
  lecon:    { label: 'Leçon',    ton: 'ok' },
  expose:   { label: 'Exposé',   ton: 'remplacement' },
  autre:    { label: 'Autre',    ton: 'neutre' },
}

export const typeDevoir = (t: string | null | undefined) => TYPES_DEVOIR[t ?? ''] ?? TYPES_DEVOIR.autre

/** `AAAA-MM-JJ` (ou horodatage) -> Date LOCALE : `new Date('AAAA-MM-JJ')` est lu en UTC. */
export const dateLocale = (d: string) => new Date(String(d).slice(0, 10) + 'T00:00')

/** Date de rendu passee (strictement avant aujourd'hui). */
export const rendPasse = (d: string) => dateLocale(d) < new Date(new Date().toDateString())

/** Aujourd'hui en `AAAA-MM-JJ` local (jamais `toISOString()`). */
export function aujourdhui(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
