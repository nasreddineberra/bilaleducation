import { createAdminClient } from '@/lib/supabase/admin'
import FacturationClient, { type Releve, type LigneEnsemble } from './FacturationClient'

/**
 * Releves mensuels de la base facturable (eleves actifs + adultes inscrits),
 * figes le 1er de chaque mois par pg_cron (migration `add-releves-facturation`).
 * Table serveur uniquement : lue en service-role, la garde est celle du layout.
 *
 * Deux vues (23/10) : « Tous » par defaut, une ligne par ecole pour le dernier
 * mois releve ; une ecole choisie, son detail mois par mois. L'ecole de
 * demonstration n'est jamais facturee : hors de « Tous », en fin de selecteur.
 */
export default async function FacturationPage({ searchParams }: { searchParams: Promise<{ ecole?: string }> }) {
  const { ecole } = await searchParams
  const supabase = createAdminClient()

  const { data: brutes } = await supabase
    .from('etablissements')
    .select('id, nom, est_demo')
    .order('nom', { ascending: true })
  const ecoles = [...(brutes ?? []).filter(e => !e.est_demo), ...(brutes ?? []).filter(e => e.est_demo)]
  const choisie = ecoles.find(e => e.id === ecole) ?? null

  // ── Vue « Tous » : le dernier mois releve et le precedent (pour les ecarts) ──
  if (!choisie) {
    const { data: dernier } = await supabase
      .from('releves_facturation').select('mois').order('mois', { ascending: false }).limit(1).maybeSingle()

    let mois: string | null = null
    let lignes: LigneEnsemble[] = []
    if (dernier?.mois) {
      mois = dernier.mois
      // Mois precedent, en UTC : `mois` est une date pure (1er du mois).
      const d = new Date(`${dernier.mois}T00:00:00Z`)
      d.setUTCMonth(d.getUTCMonth() - 1)
      const precedent = d.toISOString().slice(0, 10)

      const { data: releves } = await supabase
        .from('releves_facturation')
        .select('etablissement_id, mois, eleves_actifs, adultes_inscrits, limite, releve_le, prix_inscrit, forfait')
        .in('mois', [dernier.mois, precedent])

      // Une ligne par ecole ayant un releve ce mois-la (la demonstration exclue).
      lignes = ecoles.filter(e => !e.est_demo).flatMap(e => {
        const r = (releves ?? []).find(x => x.etablissement_id === e.id && x.mois === dernier.mois)
        if (!r) return []
        const prec = (releves ?? []).find(x => x.etablissement_id === e.id && x.mois === precedent)
        return [{ id: e.id, nom: e.nom, r: r as Releve, prec: prec as Releve | undefined }]
      })
    }

    return (
      <FacturationClient
        ecoles={ecoles}
        ecoleId={null}
        ensemble={{ mois, lignes }}
        releves={[]}
        annees={[]}
      />
    )
  }

  // ── Une ecole : son detail mois par mois ──
  const { data: releves } = await supabase
    .from('releves_facturation')
    .select('mois, eleves_actifs, adultes_inscrits, limite, releve_le, prix_inscrit, forfait')
    .eq('etablissement_id', choisie.id)
    .order('mois', { ascending: false })

  // Les annees scolaires de l ecole servent a totaliser les montants par annee.
  const { data: annees } = await supabase
    .from('school_years')
    .select('label, start_date, end_date')
    .eq('etablissement_id', choisie.id)

  return (
    <FacturationClient
      annees={annees ?? []}
      ecoles={ecoles}
      ecoleId={choisie.id}
      releves={(releves ?? []) as Releve[]}
    />
  )
}
