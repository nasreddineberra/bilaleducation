import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import CoursTree from '@/components/cours/CoursTree'
import { getCurrentYear } from '@/lib/cache/dashboard'

export default async function CoursPage() {
  const supabase        = await createClient()
  const h               = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // L'année en cours d'abord : elle borne le comptage des gabarits ci-dessous.
  // Séquentiel à dessein — filtrer côté serveur exige son libellé, et l'autre
  // voie (tout charger puis trier ici) ramènerait un jour l'intégralité des
  // évaluations de toutes les années pour n'en garder qu'une.
  const currentYear = await getCurrentYear()

  const [{ data: ues }, { data: modules }, { data: cours }, { data: gabarits }] = await Promise.all([
    supabase.from('unites_enseignement').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours_modules').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours').select('*').order('order_index').order('nom_fr'),

    // UNE seule requête, quel que soit le nombre de cours — le comptage se fait
    // ensuite en mémoire. `!inner` est indispensable sur un filtre de ressource
    // imbriquée : sans lui PostgREST l'ignore et renvoie toutes les années.
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
    <CoursTree
      ues={ues ?? []}
      modules={modules ?? []}
      cours={cours ?? []}
      etablissementId={etablissementId}
      currentYearLabel={currentYear?.label ?? null}
      gabaritsParCours={gabaritsParCours}
    />
  )
}
