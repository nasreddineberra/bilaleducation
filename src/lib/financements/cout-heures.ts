// Cout des heures du personnel sur l'annee — SOURCE UNIQUE.
//
// staff_time_entries x presence_type_rates. Partage par la Situation financiere
// et le tableau de bord comptable : le solde affiche des deux cotes doit etre
// le meme chiffre.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { nomEnseignant } from '@/lib/teachers/nom'
import { libelleRole } from '@/lib/auth/role-labels'

export interface AnneeCout {
  id: string
  start_date?: string | null
  end_date?: string | null
}

export interface CoutHeures {
  total: number
  byMonth: { month: string; cost: number }[]
  byType: { label: string; cost: number; hours: number }[]
  /** Heures valorisees par personne et par type (bilan annuel : la purge efface les saisies). */
  byPerson: { nom: string; role: string; type: string; hours: number; cost: number }[]
  /** Heures dont le type n'a aucun taux (comptees 0 €), a signaler. */
  unratedTypes: { code: string; hours: number }[]
}

export async function chargerCoutHeures(supabase: SupabaseClient<Database>, annee: AnneeCout): Promise<CoutHeures> {
  // Sans bornes, aucune heure a valoriser (la lecture bornee par NULL rendait deja vide).
  if (!annee.start_date || !annee.end_date) return { total: 0, byMonth: [], byType: [], byPerson: [], unratedTypes: [] }
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
      .select('profile_id, entry_type, duration_minutes, entry_date')
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
  for (const pt of presenceTypes ?? []) {
    const code = pt.code.toUpperCase()
    const rate = (presenceTypeRates ?? []).find(r => r.presence_type_id === pt.id)?.rate ?? 0
    rateByCode[code]  = Number(rate)
    labelByCode[code] = pt.label ?? code
    if (pt.is_absence) absenceCodes.add(code)
  }

  const costByMonth: Record<string, number> = {}
  const costByType: Record<string, number> = {}
  const hoursByType: Record<string, number> = {}
  const parPersonne = new Map<string, { profileId: string; type: string; hours: number; cost: number }>()
  let total = 0

  // Heures dont le type n'a aucun taux : elles comptaient pour 0 € EN SILENCE,
  // sous-evaluant le cout sans le moindre signal. On les tient pour les
  // remonter a l'utilisateur (banniere).
  const unratedHoursByCode: Record<string, number> = {}

  for (const e of timeEntries ?? []) {
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
    hoursByType[typeLabel] = (hoursByType[typeLabel] ?? 0) + hours

    const cle = `${e.profile_id}|${typeLabel}`
    const p = parPersonne.get(cle) ?? { profileId: e.profile_id, type: typeLabel, hours: 0, cost: 0 }
    p.hours += hours
    p.cost += cost
    parPersonne.set(cle, p)
  }

  const ids = [...new Set([...parPersonne.values()].map(p => p.profileId))]
  const { data: profils } = ids.length
    ? await supabase.from('profiles').select('id, first_name, last_name, role').in('id', ids)
    : { data: [] }
  const profilParId = new Map((profils ?? []).map(p => [p.id, p]))
  const byPerson = [...parPersonne.values()].map(p => {
    const profil = profilParId.get(p.profileId)
    return {
      nom: profil ? nomEnseignant(profil) : '?',
      role: libelleRole(profil?.role),
      type: p.type,
      hours: Math.round(p.hours * 100) / 100,
      cost: p.cost,
    }
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.type.localeCompare(b.type, 'fr'))

  return {
    total,
    byMonth: Object.entries(costByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cost]) => ({ month, cost })),
    byType: Object.entries(costByType)
      .map(([label, cost]) => ({ label, cost, hours: Math.round((hoursByType[label] ?? 0) * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost),
    byPerson,
    unratedTypes: Object.entries(unratedHoursByCode)
      .map(([code, hours]) => ({ code, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours),
  }
}
