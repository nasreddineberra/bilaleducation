import { createClient } from '@/lib/supabase/server'
import ReferentielColonnes from '@/components/cours/ReferentielColonnes'
import { getCurrentYear } from '@/lib/cache/dashboard'

/**
 * ┌─ PAGE DE TEST — TEMPORAIRE ─────────────────────────────────────────────┐
 * │ Prototype du référentiel en TROIS COLONNES, sur données réelles, sans   │
 * │ toucher à l'écran en service (`/dashboard/cours`).                      │
 * │                                                                          │
 * │ À SUPPRIMER une fois la présentation arbitrée : soit elle remplace       │
 * │ l'arbre, soit elle est abandonnée. Même méthode que `test-login` et      │
 * │ `test-polices`, tous deux supprimés après leur choix.                   │
 * │                                                                          │
 * │ Les actions (ajouter / modifier / supprimer) sont INERTES : le sujet est │
 * │ la lisibilité, pas la reprise du CRUD.                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export default async function ReferentielTestPage() {
  const supabase = await createClient()

  const currentYear = await getCurrentYear()

  const [{ data: ues }, { data: modules }, { data: cours }, { data: gabarits }] = await Promise.all([
    supabase.from('unites_enseignement').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours_modules').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours').select('*').order('order_index').order('nom_fr'),
    currentYear
      ? supabase
          .from('evaluations')
          .select('cours_id, classes!inner(academic_year)')
          .eq('classes.academic_year', currentYear.label)
          .not('cours_id', 'is', null)
      : Promise.resolve({ data: [] }),
  ])

  const gabaritsParCours = (gabarits ?? []).reduce<Record<string, number>>((acc, g) => {
    const id = (g as { cours_id: string | null }).cours_id
    if (id) acc[id] = (acc[id] ?? 0) + 1
    return acc
  }, {})

  return (
    <ReferentielColonnes
      ues={ues ?? []}
      modules={modules ?? []}
      cours={cours ?? []}
      gabaritsParCours={gabaritsParCours}
      anneeLabel={currentYear?.label ?? null}
    />
  )
}
