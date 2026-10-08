import { createAdminClient } from '@/lib/supabase/admin'
import FacturationClient, { type Releve } from './FacturationClient'

/**
 * Releves mensuels de la base facturable (eleves actifs + adultes inscrits),
 * figes le 1er de chaque mois par pg_cron (migration `add-releves-facturation`).
 * Table serveur uniquement : lue en service-role, la garde est celle du layout.
 */
export default async function FacturationPage({ searchParams }: { searchParams: Promise<{ ecole?: string }> }) {
  const { ecole } = await searchParams
  const supabase = createAdminClient()

  const { data: ecoles } = await supabase
    .from('etablissements')
    .select('id, nom')
    .order('nom', { ascending: true })

  const choisie = (ecoles ?? []).find(e => e.id === ecole) ?? (ecoles ?? [])[0] ?? null

  const { data: releves } = choisie
    ? await supabase
        .from('releves_facturation')
        .select('mois, eleves_actifs, adultes_inscrits, limite, releve_le')
        .eq('etablissement_id', choisie.id)
        .order('mois', { ascending: false })
    : { data: [] }

  return (
    <FacturationClient
      ecoles={ecoles ?? []}
      ecoleId={choisie?.id ?? null}
      releves={(releves ?? []) as Releve[]}
    />
  )
}
