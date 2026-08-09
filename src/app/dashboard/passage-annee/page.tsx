import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'
import PassageAnneeClient, { type AnneeEtat } from '@/components/passage-annee/PassageAnneeClient'

/**
 * PASSAGE D'ANNÉE — page permanente.
 *
 * Ce n'est pas un assistant qu'on démarre : c'est un tableau de santé de l'année.
 * Les six audits se relancent quand on veut, y compris en pleine année, et la
 * clôture n'est qu'une action de plus, en bas, gardée par une date et par le
 * passage des six audits.
 *
 * Garde de rôle SUR LA PAGE et pas seulement sur le lien de la barre latérale :
 * une adresse se tape.
 */
export default async function PassageAnneePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (!['admin', 'direction'].includes(effectiveRole(me) ?? '')) redirect('/dashboard')

  // Année en cours : c'est elle qu'on prépare à passer.
  const { data: year } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date, is_current, closed_at, closed_by, archived_at, purged_at, purge_intent')
    .eq('is_current', true)
    .maybeSingle()

  if (!year) {
    return (
      <div className="animate-fade-in">
        <div className="card p-6 max-w-xl">
          <h2 className="text-sm font-bold text-secondary-800">Aucune année en cours</h2>
          <p className="mt-1 text-xs text-warm-700">
            Activez une année scolaire dans <strong>Paramètres → Année scolaire</strong> pour préparer son passage.
          </p>
        </div>
      </div>
    )
  }

  const [{ data: audits }, { data: closedBy }, { data: precedentes }] = await Promise.all([
    supabase
      .from('year_audits')
      .select('step_key, anomalies_count, recap_json, audited_at')
      .eq('school_year_id', year.id),
    year.closed_by
      ? supabase.from('profiles').select('civilite, last_name, first_name').eq('id', year.closed_by).maybeSingle()
      : Promise.resolve({ data: null }),
    // Années closes mais pas encore archivées : sans ce rappel, une année clôturée
    // puis remplacée par N+1 n'aurait plus aucun écran d'où lancer son archivage.
    supabase
      .from('school_years')
      .select('id, label, closed_at, archived_at, purged_at')
      .eq('is_current', false)
      .not('closed_at', 'is', null)
      .order('label', { ascending: false }),
  ])

  const etat: AnneeEtat = {
    id:           year.id,
    label:        year.label,
    startDate:    year.start_date ?? null,
    endDate:      year.end_date ?? null,
    closedAt:     year.closed_at ?? null,
    closedByNom:  closedBy
      ? [closedBy.civilite, closedBy.last_name, closedBy.first_name].filter(Boolean).join(' ').trim()
      : null,
    archivedAt:   year.archived_at ?? null,
    purgedAt:     year.purged_at ?? null,
    purgeIntent:  (year.purge_intent as 'purge' | 'keep' | null) ?? null,
  }

  return (
    <PassageAnneeClient
      annee={etat}
      audits={(audits ?? []).map((a: any) => ({
        stepKey:   a.step_key,
        anomalies: a.anomalies_count,
        recap:     a.recap_json ?? null,
        auditedAt: a.audited_at,
      }))}
      precedentes={(precedentes ?? []).map((p: any) => ({
        id: p.id, label: p.label, closedAt: p.closed_at, archivedAt: p.archived_at, purgedAt: p.purged_at,
      }))}
    />
  )
}
