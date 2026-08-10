import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import ReferentielColonnes from '@/components/cours/ReferentielColonnes'
import { getCurrentYear } from '@/lib/cache/dashboard'

/**
 * Référentiel des cours, en TROIS COLONNES.
 *
 * Remplace l'arbre à retraits du 10 août : la hiérarchie n'y tenait qu'à
 * quelques pixels d'indentation, et les cours — la seule chose que ce
 * référentiel décrit — n'apparaissaient qu'après deux dépliages. Prototypé sur
 * une page séparée, puis basculé ici une fois la présentation arbitrée.
 */
export default async function CoursPage() {
  const supabase = await createClient()
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''

  const currentYear = await getCurrentYear()

  const [{ data: ues }, { data: modules }, { data: cours }, { data: gabarits }] = await Promise.all([
    supabase.from('unites_enseignement').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours_modules').select('*').order('order_index').order('nom_fr'),
    // Les cours n'ont pas de rang : ils s'affichent par ordre alphabétique.
    // Le tri final se fait côté client, avec `localeCompare` en français — un
    // ORDER BY SQL classerait « Écriture » après « Zoologie ».
    supabase.from('cours').select('*').order('nom_fr'),
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
      etablissementId={etablissementId}
    />
  )
}
