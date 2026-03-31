import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SchoolYearForm from '@/components/annee-scolaire/SchoolYearForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditAnneeScolairePage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const [{ data: schoolYear }, { data: etablissement }] = await Promise.all([
    supabase
      .from('school_years')
      .select(`
        *,
        periods ( * ),
        eval_type_configs ( * )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('etablissements')
      .select('week_start_day')
      .single(),
  ])

  if (!schoolYear) notFound()

  // Vérifie si des notes ont été saisies pour cette année
  const { data: periodRows } = await supabase
    .from('periods')
    .select('id')
    .eq('school_year_id', id)
  const periodIds = (periodRows ?? []).map((p: { id: string }) => p.id)

  // Détermine les types verrouillés :
  // - gradedEvalTypes : des notes ont été saisies
  // - usedEvalTypes   : des gabarits existent mais sans note
  // Pour 'scored', on distingue scored_10 / scored_20 via max_score.
  type EvalRow = { id: string; eval_kind: string | null; max_score: number | null }

  function resolveFormType(e: EvalRow): string {
    if (e.eval_kind === 'scored') return e.max_score === 10 ? 'scored_10' : 'scored_20'
    return e.eval_kind as string
  }

  let gradedEvalTypes: string[] = []
  let usedEvalTypes:   string[] = []

  if (periodIds.length > 0) {
    const { data: evalRows } = await supabase
      .from('evaluations')
      .select('id, eval_kind, max_score')
      .in('period_id', periodIds)
      .not('eval_kind', 'is', null)

    if ((evalRows ?? []).length > 0) {
      const evalIds = (evalRows ?? []).map((e: EvalRow) => e.id)

      const { data: gradesRows } = await supabase
        .from('grades')
        .select('evaluation_id')
        .in('evaluation_id', evalIds)

      const gradedEvalIds = new Set((gradesRows ?? []).map((g: { evaluation_id: string }) => g.evaluation_id))

      const gradedSet = new Set<string>()
      const usedSet   = new Set<string>()

      for (const e of evalRows ?? []) {
        const ft = resolveFormType(e)
        if (gradedEvalIds.has(e.id)) gradedSet.add(ft)
        else usedSet.add(ft)
      }

      // Un type "utilisé" qui a aussi des notes passe en "gradé"
      usedSet.forEach(ft => { if (gradedSet.has(ft)) usedSet.delete(ft) })

      gradedEvalTypes = [...gradedSet]
      usedEvalTypes   = [...usedSet]
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/annee-scolaire"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <SchoolYearForm schoolYear={schoolYear} weekStartDay={etablissement?.week_start_day ?? 1} gradedEvalTypes={gradedEvalTypes} usedEvalTypes={usedEvalTypes} />

    </div>
  )
}
