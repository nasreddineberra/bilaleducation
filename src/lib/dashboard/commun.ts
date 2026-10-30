import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * EN-TETE COMMUN DES TABLEAUX DE BORD : periode courante, notifications non lues
 * et les 3 plus recentes. Lectures de `app/dashboard/page.tsx` deplacees ici pour
 * que `DashboardHeader` tire son type de la requete (sortie des `any`, lot 8).
 */

export type EnTeteTableauDeBord = Awaited<ReturnType<typeof chargerEnTete>>
export type NotifRecente = EnTeteTableauDeBord['recentNotifs'][number]

const RECENTE = 'id, is_read, created_at, announcements!inner(id, title, channel, published_at, profiles:published_by(first_name, last_name))' as const

export async function chargerEnTete(
  supabase: SupabaseClient<Database>,
  userId: string,
  anneeId: string | null,
) {
  // Periode courante : le drapeau `is_current` prime ; repli sur la premiere.
  const { data: periodRows } = anneeId
    ? await supabase
        .from('periods')
        .select('id, label, is_current, order_index')
        .eq('school_year_id', anneeId)
        .order('order_index', { ascending: true })
    : { data: null }
  const periodes = periodRows ?? []
  const currentPeriod = periodes.find(p => p.is_current) ?? periodes[0] ?? null

  // « email seul » exclu de la cloche in-app (jointure inner + filtre canal).
  const { count: staffUnread } = await supabase
    .from('announcement_staff_recipients')
    .select('id, announcements!inner(channel)', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .eq('is_read', false)
    .neq('announcements.channel', 'email')

  const { data: parentLink } = await supabase
    .from('parents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  let parentUnreadCount = 0
  if (parentLink) {
    const { count } = await supabase
      .from('announcement_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentLink.id)
      .eq('is_read', false)
    parentUnreadCount = count ?? 0
  }

  // `is_read = false` porte DANS la requete : la liste prenait les 3 plus
  // recentes toutes confondues, puis le composant ecartait les lues — le
  // bandeau annoncait donc un nombre et pouvait n'afficher aucune ligne.
  const { data: recentStaff } = await supabase
    .from('announcement_staff_recipients')
    .select(RECENTE)
    .eq('profile_id', userId)
    .eq('is_read', false)
    .neq('announcements.channel', 'email')
    .order('created_at', { ascending: false })
    .limit(3)

  // Cote PARENT, les notifications vivent dans `announcement_recipients` (cle
  // parent_id) et non dans la table staff : le compteur les additionnait alors
  // que la liste ne les voyait jamais — bandeau « 3 non lues », aucune ligne.
  const { data: recentParent } = parentLink
    ? await supabase
        .from('announcement_recipients')
        .select(RECENTE)
        .eq('parent_id', parentLink.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] }

  const recentNotifs = [
    ...(recentStaff ?? []).map(n => ({ ...n, recipientType: 'staff' as const })),
    ...(recentParent ?? []).map(n => ({ ...n, recipientType: 'parent' as const })),
  ]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 3)

  return {
    periodes,
    currentPeriod,
    parentId: parentLink?.id ?? null,
    unreadNotifs: (staffUnread ?? 0) + parentUnreadCount,
    recentNotifs,
  }
}
