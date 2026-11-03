import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { chargerAbsences, chargerDevoirs, chargerEnfants, enfantsActifs } from '@/lib/espace-famille/donnees'

/**
 * DONNEES DU TABLEAU DE BORD PARENT (espace famille, lot 6). Memes lectures que
 * les ecrans de l'espace (`lib/espace-famille/donnees.ts`) : la base ne rend que
 * le foyer du compte. Plus de notes (decision 2 : seulement par les bulletins).
 */
export type DonneesParent = Awaited<ReturnType<typeof chargerDonneesParent>>

const SEMAINE = 7

export async function chargerDonneesParent(supabase: SupabaseClient<Database>, aujourdhui: string) {
  const [enfants, { devoirs, suivi }, absences] = await Promise.all([
    chargerEnfants(supabase),
    chargerDevoirs(supabase),
    chargerAbsences(supabase),
  ])
  const actifs = enfantsActifs(enfants)

  // Devoirs a rendre dans les 7 jours, par enfant concerne (sa classe), non faits.
  const [a, m, j] = aujourdhui.split('-').map(Number)
  const fin = new Date(a, m - 1, j + SEMAINE)
  const limite = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`
  const aRendre = devoirs
    .filter(d => d.due_date >= aujourdhui && d.due_date <= limite)
    .flatMap(d => actifs
      .filter(e => e.class_id === d.class_id)
      .map(e => ({ devoir: d, enfant: e, fait: suivi.some(s => s.homework_id === d.id && s.student_id === e.id && s.is_done) })))
    .filter(x => !x.fait)

  const prenom = new Map(enfants.map(e => [e.id, e.first_name]))
  return {
    enfants,
    aRendre,
    absences: absences.map(x => ({ ...x, prenom: prenom.get(x.student_id) ?? '' })),
    nonJustifiees: absences.filter(x => x.absence_type === 'absence' && !x.is_justified).length,
  }
}
