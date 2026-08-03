import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Données du tableau de bord.
 *
 * Les fonctions RÉELLEMENT cachées utilisent `createAdminClient()` (service
 * role) et non `createClient()`, car `unstable_cache` interdit l'appel à
 * `cookies()` à l'intérieur d'une fonction cachée.
 * Voir : https://nextjs.org/docs/app/api-reference/functions/unstable_cache
 *
 * CONSÉQUENCE À NE JAMAIS PERDRE DE VUE : le service role contourne la RLS.
 * Toute requête cachée doit donc porter son propre cloisonnement — soit un
 * `etablissement_id` sur la table, soit une jointure `!inner` vers une table
 * qui le porte. Une clause oubliée fuit d'un établissement à l'autre.
 */

// ─── Profil (par utilisateur, cache 1 h) ─────────────────────────────────────

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

// ─── Établissement (cache 6 h) ───────────────────────────────────────────────

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

// ─── Année scolaire en cours (NON cachée, volontairement) ────────────────────

/**
 * Année scolaire en cours.
 *
 * **Délibérément sans cache.** Elle l'a été 24 h, avec le tag `school-year` —
 * qui n'était invalidé nulle part, car l'année est écrite depuis un composant
 * CLIENT (`SchoolYearForm`) où aucun `updateTag` ne peut s'accrocher. Après un
 * changement d'année en cours, tout le tableau de bord travaillait donc sur
 * l'ancienne pendant 24 h : périodes, calcul financier, compteurs d'évaluations
 * et de bulletins sont tous bornés sur cette valeur.
 *
 * Le calcul est une requête d'UNE ligne sur trois colonnes : le cache ne faisait
 * économiser presque rien, et coûtait une journée entière de chiffres faux.
 *
 * Bénéfice second : hors `unstable_cache`, on peut utiliser le client SESSION,
 * donc la RLS cloisonne l'établissement — ce que la version cachée, en service
 * role et sans filtre, ne faisait pas.
 */
export async function getCurrentYear() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date')
    .eq('is_current', true)
    .maybeSingle()
  return data
}

// ─── Compteurs du tableau de bord admin (cache 5 min) ────────────────────────

/** Clé de date en composantes LOCALES. `toISOString()` bascule en UTC et
 *  décale la borne d'un jour sur un fuseau négatif (piège déjà payé sur le
 *  module Temps de présence). */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const getCachedAdminStats = unstable_cache(
  async (
    etablissementId: string,
    yearLabel: string | null,
    yearStart: string | null,
    yearEnd: string | null,
  ) => {
    const supabase = createAdminClient()

    const now = new Date()
    const monthStart = dayKey(new Date(now.getFullYear(), now.getMonth(), 1))
    const monthEnd = dayKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))

    // Inscriptions : `enrollments` et `parent_class_enrollments` ne portent PAS
    // de colonne `etablissement_id` — l'ancienne requête filtrait sur une
    // colonne inexistante et retombait donc silencieusement sur 0. Le
    // cloisonnement ET le bornage à l'année passent par la classe.
    const enrolFilter = (table: string) =>
      supabase
        .from(table)
        .select('id, classes!inner(etablissement_id, academic_year)', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('classes.etablissement_id', etablissementId)
        .eq('classes.academic_year', yearLabel)

    // Absences : bornes closes (le mois COURANT, pas « depuis le 1er »), et
    // retards exclus — la table ne connaît que 'absence' et 'retard', or la
    // carte s'intitule « Absences » et le reste de l'écran les exclut déjà.
    const absMonth = () =>
      supabase.from('absences').select('*', { count: 'exact', head: true })
        .eq('etablissement_id', etablissementId)
        .neq('absence_type', 'retard')
        .gte('absence_date', monthStart)
        .lt('absence_date', monthEnd)

    const [
      studentsActive,
      studentsTotal,
      teachersActive,
      classesCount,
      enrollmentsStudents,
      enrollmentsAdults,
      absencesMonth,
      absencesUnjustifiedMonth,
      absencesUnjustifiedYear,
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('etablissement_id', etablissementId),
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('etablissement_id', etablissementId),
      supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('etablissement_id', etablissementId),
      yearLabel
        ? supabase.from('classes').select('*', { count: 'exact', head: true }).eq('etablissement_id', etablissementId).eq('academic_year', yearLabel)
        : Promise.resolve({ count: 0 }),
      yearLabel ? enrolFilter('enrollments') : Promise.resolve({ count: 0 }),
      yearLabel ? enrolFilter('parent_class_enrollments') : Promise.resolve({ count: 0 }),
      absMonth(),
      absMonth().eq('is_justified', false),
      // « À traiter » : un pense-bête ne se limite pas au mois — une absence de
      // septembre non justifiée reste à traiter. Borné à l'ANNÉE en cours.
      yearStart && yearEnd
        ? supabase.from('absences').select('*', { count: 'exact', head: true })
            .eq('etablissement_id', etablissementId)
            .eq('is_justified', false)
            .neq('absence_type', 'retard')
            .gte('absence_date', yearStart)
            .lte('absence_date', yearEnd)
        : Promise.resolve({ count: 0 }),
    ])

    return {
      studentsActive: studentsActive.count ?? 0,
      studentsTotal: studentsTotal.count ?? 0,
      teachersActive: teachersActive.count ?? 0,
      classesCount: classesCount.count ?? 0,
      enrollmentsStudents: enrollmentsStudents.count ?? 0,
      enrollmentsAdults: enrollmentsAdults.count ?? 0,
      absencesMonth: absencesMonth.count ?? 0,
      absencesUnjustifiedMonth: absencesUnjustifiedMonth.count ?? 0,
      absencesUnjustifiedYear: absencesUnjustifiedYear.count ?? 0,
    }
  },
  ['dashboard-admin-stats'],
  { tags: ['dashboard-stats'], revalidate: 60 },
)
