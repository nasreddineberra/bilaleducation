import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Cached dashboard data for the dashboard layout.
 * Ces fonctions utilisent `createAdminClient()` (service role key)
 * au lieu de `createClient()` car `unstable_cache` ne peut pas
 * appeler `cookies()` à l'intérieur d'une fonction cachée.
 * Voir : https://nextjs.org/docs/app/api-reference/functions/unstable_cache
 */

// ─── Profile (per user, cache 1h) ─────────────────────────────────────────────

export const getCachedProfile = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return profile
  },
  ['dashboard-profile'],
  { tags: ['profile'] },
)

// ─── Etablissement info (cache 6h) ───────────────────────────────────────────

export const getCachedEtablissement = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('etablissements')
      .select('nom, logo_url')
      .single()
    return data
  },
  ['dashboard-etablissement'],
  { tags: ['etablissement'], revalidate: 21600 },
)

// ─── Current school year (cache 24h) ─────────────────────────────────────────

export const getCachedCurrentYear = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('school_years')
      .select('id, label')
      .eq('is_current', true)
      .maybeSingle()
    return data
  },
  ['dashboard-school-year'],
  { tags: ['school-year'], revalidate: 86400 },
)

// ─── Dashboard stats counts (cache 5 min) ─────────────────────────────────────

export const getCachedAdminStats = unstable_cache(
  async (etablissementId: string) => {
    const supabase = createAdminClient()

    const [
      studentsActive,
      studentsTotal,
      teachersActive,
      classesCount,
      enrollmentsActive,
      parentsCount,
      absencesMonth,
      absencesUnjustified,
      announcementsMonth,
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('etablissement_id', etablissementId),
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('etablissement_id', etablissementId),
      supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('etablissement_id', etablissementId),
      supabase.from('classes').select('*', { count: 'exact', head: true }).eq('etablissement_id', etablissementId),
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('etablissement_id', etablissementId),
      supabase.from('parents').select('*', { count: 'exact', head: true }).eq('etablissement_id', etablissementId),
      supabase.from('absences').select('*', { count: 'exact', head: true }).gte('absence_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).eq('etablissement_id', etablissementId),
      supabase.from('absences').select('*', { count: 'exact', head: true }).eq('is_justified', false).eq('etablissement_id', etablissementId),
      supabase.from('announcements').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).eq('etablissement_id', etablissementId),
    ])

    return {
      studentsActive: studentsActive.count ?? 0,
      studentsTotal: studentsTotal.count ?? 0,
      teachersActive: teachersActive.count ?? 0,
      classesCount: classesCount.count ?? 0,
      enrollmentsActive: enrollmentsActive.count ?? 0,
      parentsCount: parentsCount.count ?? 0,
      absencesMonth: absencesMonth.count ?? 0,
      absencesUnjustified: absencesUnjustified.count ?? 0,
      announcementsMonth: announcementsMonth.count ?? 0,
    }
  },
  ['dashboard-admin-stats'],
  { tags: ['dashboard-stats'], revalidate: 300 },
)
