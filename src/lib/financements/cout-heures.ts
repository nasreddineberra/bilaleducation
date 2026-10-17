// Cout des heures du personnel sur l'annee — SOURCE UNIQUE.
//
// staff_time_entries x presence_type_rates. Partage par la Situation financiere
// et le tableau de bord comptable : le solde affiche des deux cotes doit etre
// le meme chiffre.

type SB = { from: (table: string) => any }

export interface AnneeCout {
  id: string
  start_date?: string | null
  end_date?: string | null
}

export interface CoutHeures {
  total: number
  byMonth: { month: string; cost: number }[]
  byType: { label: string; cost: number }[]
  /** Heures dont le type n'a aucun taux (comptees 0 €), a signaler. */
  unratedTypes: { code: string; hours: number }[]
}

export async function chargerCoutHeures(supabase: SB, annee: AnneeCout): Promise<CoutHeures> {
  const [
    { data: timeEntries },
    { data: presenceTypes },
    { data: presenceTypeRates },
  ] = await Promise.all([
    // Bornes REELLES de l'annee scolaire. On lisait `label.split('-')` + un
    // 01/08 en dur : ca supposait un libelle « AAAA-AAAA » et une annee courant
    // d'aout a aout — faux des qu'elle va de septembre a juin.
    supabase
      .from('staff_time_entries')
      .select('entry_type, duration_minutes, entry_date')
      .gte('entry_date', annee.start_date)
      .lte('entry_date', annee.end_date)
      .gt('duration_minutes', 0),

    // Pas de filtre `is_active` : un type desactive en cours d'annee a pu servir
    // a des heures deja saisies — les valoriser reste juste.
    supabase
      .from('presence_types')
      .select('id, code, label, is_absence')
      .eq('school_year_id', annee.id),

    supabase
      .from('presence_type_rates')
      .select('presence_type_id, rate')
      .eq('school_year_id', annee.id),
  ])

  // Map code (uppercase) -> taux horaire + libelle lisible.
  // `staff_time_entries.entry_type` porte le CODE du type de presence (et non son
  // libelle) — confusion a l'origine du bug EDT du 15/07.
  const rateByCode: Record<string, number> = {}
  const labelByCode: Record<string, string> = {}
  // Les types d'ABSENCE ont leur taux FORCE a 0 et le champ desactive (regle du
  // 1er juillet) : une heure d'absence vaut zero par nature, elle n'est pas une
  // heure oubliee. Sans ce releve, la banniere « sans taux » les signalait a
  // CHAQUE fois et renvoyait parametrer un taux que l'interface interdit de
  // saisir — vu a l'ecran le 24 septembre.
  const absenceCodes = new Set<string>()
  for (const pt of (presenceTypes ?? []) as any[]) {
    const code = pt.code.toUpperCase()
    const rate = ((presenceTypeRates ?? []) as any[]).find((r: any) => r.presence_type_id === pt.id)?.rate ?? 0
    rateByCode[code]  = Number(rate)
    labelByCode[code] = pt.label ?? code
    if (pt.is_absence) absenceCodes.add(code)
  }

  const costByMonth: Record<string, number> = {}
  const costByType: Record<string, number> = {}
  let total = 0

  // Heures dont le type n'a aucun taux : elles comptaient pour 0 € EN SILENCE,
  // sous-evaluant le cout sans le moindre signal. On les tient pour les
  // remonter a l'utilisateur (banniere).
  const unratedHoursByCode: Record<string, number> = {}

  for (const e of (timeEntries ?? []) as any[]) {
    const hours = e.duration_minutes / 60
    const code  = String(e.entry_type ?? '').toUpperCase()
    const rate  = rateByCode[code]

    if (rate === undefined || rate <= 0) {
      // Une absence ne se valorise pas : on ne la compte ni au cout, ni au
      // signalement.
      if (!absenceCodes.has(code)) {
        unratedHoursByCode[code] = (unratedHoursByCode[code] ?? 0) + hours
      }
      continue
    }

    const cost = hours * rate
    total += cost
    const monthKey = e.entry_date.slice(0, 7) // YYYY-MM
    costByMonth[monthKey] = (costByMonth[monthKey] ?? 0) + cost

    const typeLabel = labelByCode[code] ?? code
    costByType[typeLabel] = (costByType[typeLabel] ?? 0) + cost
  }

  return {
    total,
    byMonth: Object.entries(costByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cost]) => ({ month, cost })),
    byType: Object.entries(costByType)
      .map(([label, cost]) => ({ label, cost }))
      .sort((a, b) => b.cost - a.cost),
    unratedTypes: Object.entries(unratedHoursByCode)
      .map(([code, hours]) => ({ code, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours),
  }
}
