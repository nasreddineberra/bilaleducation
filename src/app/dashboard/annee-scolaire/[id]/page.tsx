import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SchoolYearForm from '@/components/annee-scolaire/SchoolYearForm'
import CurrentPeriodCard from '@/components/annee-scolaire/CurrentPeriodCard'
import ClotureClient from '@/components/annee-scolaire/ClotureClient'
import PrepareNextYearButton from '@/components/annee-scolaire/PrepareNextYearButton'

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

  // Role de l'utilisateur : seuls admin/direction modifient la periode en cours.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const isAdminDir = me?.role === 'admin' || me?.role === 'direction'
  // La periode en cours ne se regle que sur l'annee EN COURS.
  const canEditPeriod = isAdminDir && !!schoolYear.is_current

  // Une AUTRE annee est-elle deja « en cours » ? (bloque l'activation de celle-ci)
  const { count: otherCurrentCount } = await supabase
    .from('school_years')
    .select('id', { count: 'exact', head: true })
    .eq('is_current', true)
    .neq('id', id)
  const anotherYearIsCurrent = (otherCurrentCount ?? 0) > 0

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

  // Cloture d'annee : affichee en colonne droite pour l'annee EN COURS (admin/direction).
  let closure: any = null
  let closureSteps: any[] = []
  const showClosure = isAdminDir && !!schoolYear.is_current
  if (showClosure) {
    const { data: c } = await supabase
      .from('year_closure').select('*').eq('school_year_id', schoolYear.id).maybeSingle()
    closure = c
    if (c) {
      const { data: s } = await supabase
        .from('year_closure_steps').select('*').eq('closure_id', c.id).order('order_index')
      closureSteps = s ?? []
    }
  }

  const formEl = (
    <SchoolYearForm
      schoolYear={schoolYear}
      weekStartDay={etablissement?.week_start_day ?? 1}
      gradedEvalTypes={gradedEvalTypes}
      usedEvalTypes={usedEvalTypes}
      anotherYearIsCurrent={anotherYearIsCurrent}
      currentPeriodSlot={
        <CurrentPeriodCard
          schoolYearId={schoolYear.id}
          periods={schoolYear.periods ?? []}
          canEdit={canEditPeriod}
        />
      }
    />
  )

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/annee-scolaire"
          className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
        >
          <ChevronLeft size={15} />
          Retour à la liste
        </Link>

        {isAdminDir && schoolYear.is_current && (
          <PrepareNextYearButton currentYearId={schoolYear.id} yearLabel={schoolYear.label} />
        )}
      </div>

      {showClosure ? (
        <div className="flex flex-col xl:flex-row gap-6 items-start">
          <div className="w-full xl:w-auto xl:flex-shrink-0">{formEl}</div>
          <div className="w-full xl:flex-1 xl:min-w-0">
            <ClotureClient yearLabel={schoolYear.label} closure={closure} steps={closureSteps} />
          </div>
        </div>
      ) : (
        formEl
      )}

    </div>
  )
}
