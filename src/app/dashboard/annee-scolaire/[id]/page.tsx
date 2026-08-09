import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SchoolYearForm from '@/components/annee-scolaire/SchoolYearForm'
import CurrentPeriodCard from '@/components/annee-scolaire/CurrentPeriodCard'
import PurgeYearCard from '@/components/annee-scolaire/PurgeYearCard'
import { effectiveRole } from '@/lib/auth/effective-role'

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
    ? await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
    : { data: null }
  const isAdminDir = ['admin', 'direction'].includes(effectiveRole(me) ?? '')
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

  // Purge : disponible sur une année ARCHIVÉE et NON courante. L'état de clôture
  // vit désormais sur l'année elle-même (`school_years`), plus dans une table
  // annexe — il est donc déjà là, sans requête supplémentaire.
  const showPurge = isAdminDir && !schoolYear.is_current && !!schoolYear.archived_at

  // Auteur de la clôture : l'année ne porte que son identifiant.
  const { data: closedBy } = schoolYear.closed_by
    ? await supabase.from('profiles').select('civilite, last_name, first_name').eq('id', schoolYear.closed_by).maybeSingle()
    : { data: null }
  const closedByNom = closedBy
    ? [closedBy.civilite, closedBy.last_name, closedBy.first_name].filter(Boolean).join(' ').trim()
    : null

  const formEl = (
    <SchoolYearForm
      schoolYear={schoolYear}
      weekStartDay={etablissement?.week_start_day ?? 1}
      gradedEvalTypes={gradedEvalTypes}
      usedEvalTypes={usedEvalTypes}
      anotherYearIsCurrent={anotherYearIsCurrent}
      closedByNom={closedByNom}
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

        {/* L'assistant de clôture ne vit plus ici : il a sa propre page,
            « Clôture → Passage d'année ». Cette fiche décrit l'année ; elle ne
            pilote pas son passage. */}
      </div>

      <div className="space-y-4">
        {formEl}
        {showPurge && (
          <div className="max-w-2xl">
            <PurgeYearCard
              yearId={schoolYear.id}
              yearLabel={schoolYear.label}
              purgedAt={schoolYear.purged_at}
              purgeIntent={schoolYear.purge_intent}
            />
          </div>
        )}
      </div>

    </div>
  )
}
