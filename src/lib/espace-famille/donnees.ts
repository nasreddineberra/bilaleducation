import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { titulaireActuel } from '@/lib/teachers/titulaire'
import { nomCompletEnseignant } from '@/lib/teachers/nom'

/**
 * LECTURES DE L'ESPACE FAMILLE (docs/ESPACE-FAMILLE.md, lot 6). Client SESSION :
 * la base ne rend que le foyer du compte (`foyer_du_compte`, regles du lot 2) ;
 * les tables a donnee interne passent par les fonctions `famille_*`.
 * Formes DEDUITES des requetes, jamais recopiees.
 */
type Client = SupabaseClient<Database>

export type EnfantFamille = Awaited<ReturnType<typeof chargerEnfants>>[number]
export type DevoirFamille = Awaited<ReturnType<typeof chargerDevoirs>>['devoirs'][number]
export type AbsenceFamille = Awaited<ReturnType<typeof chargerAbsences>>[number]

/** Enfants du foyer, leur classe de l'annee et son titulaire en poste. */
export async function chargerEnfants(supabase: Client) {
  const [{ data: enfants }, { data: enseignants }] = await Promise.all([
    supabase.rpc('famille_enfants'),
    supabase.rpc('famille_enseignants'),
  ])
  return (enfants ?? []).map(e => {
    const titulaire = titulaireActuel((enseignants ?? []).filter(t => t.class_id === e.class_id))
    return {
      ...e,
      /** Parti : inactif, ou plus d'affectation active cette annee. */
      parti: !e.is_active || !e.inscription_active,
      titulaire: titulaire ? nomCompletEnseignant(titulaire) : null,
    }
  })
}

/**
 * Devoirs des classes du compte (enfants et cours adultes) et suivi « fait » du
 * foyer. `homework` est ouvert au parent sur `classes_du_compte()` (lot 1).
 */
export async function chargerDevoirs(supabase: Client) {
  const [{ data: devoirs }, { data: suivi }] = await Promise.all([
    supabase
      .from('homework')
      .select('id, class_id, title, subject, homework_type, due_date, description_html, teacher_id, created_at, classes:class_id(name, cotisation_types(is_adult))')
      .order('due_date', { ascending: true }),
    supabase.from('homework_status').select('homework_id, student_id, is_seen, is_done'),
  ])
  return { devoirs: devoirs ?? [], suivi: suivi ?? [] }
}

/** Absences et retards de l'annee des enfants actifs, avec leur commentaire (decision du 03/11). */
export async function chargerAbsences(supabase: Client) {
  const { data } = await supabase
    .from('absences')
    .select('id, student_id, class_id, absence_date, absence_type, is_justified, comment, justification_comment')
    .order('absence_date', { ascending: false })
  return data ?? []
}

/** Un enfant ACTIF, affecte cette annee : seul concerne par devoirs, absences, emploi du temps. */
export function enfantsActifs(enfants: EnfantFamille[]): EnfantFamille[] {
  return enfants.filter(e => !e.parti && !!e.class_id)
}
