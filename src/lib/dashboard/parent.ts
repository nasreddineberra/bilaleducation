import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { chargerAbsences, chargerDevoirs, chargerParticipants, choixParticipants } from '@/lib/espace-famille/donnees'
import { situationFoyer, type DonneesFinancesFoyer } from '@/lib/espace-famille/finances'
import { foyerDuCompte } from '@/lib/parents/foyer'

/**
 * DONNEES DU TABLEAU DE BORD PARENT (espace famille, lot 6). Memes lectures que
 * les ecrans de l'espace (`lib/espace-famille/`) : la base ne rend que le foyer
 * du compte. Enfants et cours adulte du tuteur fusionnes (decision du 03/11).
 * Plus de notes (decision 2 : seulement par les bulletins).
 */
export type DonneesParent = Awaited<ReturnType<typeof chargerDonneesParent>>

const SEMAINE = 7

export async function chargerDonneesParent(supabase: SupabaseClient<Database>, aujourdhui: string) {
  const [{ enfants, participants }, { devoirs, suivi }, { data: suiviAdulte }, absences, { data: finances }, foyer] = await Promise.all([
    chargerParticipants(supabase),
    chargerDevoirs(supabase),
    supabase.from('adult_homework_status').select('homework_id, parent_id, tutor_number, is_done'),
    chargerAbsences(supabase),
    supabase.rpc('famille_finances'),
    foyerDuCompte(supabase),
  ])

  // Devoirs a rendre dans les 7 jours, par participant de la classe, non faits.
  const [a, m, j] = aujourdhui.split('-').map(Number)
  const fin = new Date(a, m - 1, j + SEMAINE)
  const limite = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`
  const aRendre = devoirs
    .filter(d => d.due_date >= aujourdhui && d.due_date <= limite)
    .flatMap(d => participants
      .filter(p => p.classId === d.class_id)
      .map(p => ({
        devoir: d,
        participant: p,
        fait: p.adulte
          ? (suiviAdulte ?? []).some(s => s.homework_id === d.id && s.parent_id === p.parentId && s.tutor_number === p.tutorNumber && s.is_done)
          : suivi.some(s => s.homework_id === d.id && s.student_id === p.studentId && s.is_done),
      })))
    .filter(x => !x.fait)

  const libelle = new Map(choixParticipants(participants).map(c => [c.valeur, c.libelle]))
  const situation = finances && foyer ? situationFoyer(finances as unknown as DonneesFinancesFoyer, foyer) : null
  return {
    enfants,
    plusieurs: choixParticipants(participants).length > 1,
    aRendre,
    absences: absences.map(x => ({ ...x, qui: libelle.get(x.groupe) ?? '' })),
    nonJustifiees: absences.filter(x => x.absence_type === 'absence' && !x.is_justified).length,
    reste: situation ? situation.financier.remaining : null,
  }
}
