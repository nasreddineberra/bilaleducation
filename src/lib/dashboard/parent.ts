import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * DONNEES DU TABLEAU DE BORD PARENT (dormant en V1 : comptes parents suspendus).
 * Lectures de `app/dashboard/page.tsx` deplacees ici pour que `DashboardParent`
 * tire ses types des requetes (sortie des `any`, lot 8).
 */

export type DonneesParent = Awaited<ReturnType<typeof chargerDonneesParent>>

export async function chargerDonneesParent(
  supabase: SupabaseClient<Database>,
  parentId: string | null,
  anneeLabel: string | null,
  aujourdhui: string,
) {
  if (!parentId) {
    return { children: [], recentGrades: [], recentAbsences: [], familyFee: null, upcomingHomework: [] }
  }

  const [{ data: students }, { data: grades }, { data: absences }, { data: fee }] = await Promise.all([
    supabase.from('students').select('id, first_name, last_name, gender, photo_url, enrollments(class_id, status, classes:class_id(name, academic_year))').eq('parent_id', parentId).eq('is_active', true),
    // `!inner` OBLIGATOIRE : un filtre sur une ressource imbriquee est
    // IGNORE par PostgREST sans jointure interne. Mesure avant correction :
    // 12 notes renvoyees au lieu de 3 — celles des enfants d'autres familles.
    supabase.from('grades').select('id, score, evaluations:evaluation_id(title, max_score, evaluation_date), students:student_id!inner(first_name, last_name, parent_id)').eq('students.parent_id', parentId).order('created_at', { ascending: false }).limit(5),
    supabase.from('absences').select('id, absence_date, absence_type, is_justified, students:student_id!inner(first_name, last_name, parent_id)').neq('absence_type', 'retard').eq('students.parent_id', parentId).order('absence_date', { ascending: false }).limit(5),
    supabase.from('family_fees').select('id, total_due, status').eq('parent_id', parentId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Temps reel : la classe de l'ANNEE EN COURS (affectation active), jamais une
  // classe passee ou quittee (meme regle que la carte fratrie, 30/10).
  const children = (students ?? []).map(({ enrollments, ...s }) => {
    const enCours = enrollments.find(e => e.status === 'active' && e.classes?.academic_year === anneeLabel)
    return { ...s, classe: enCours ? { id: enCours.class_id, name: enCours.classes?.name ?? '' } : null }
  })

  const classIds = [...new Set(children.flatMap(c => (c.classe ? [c.classe.id] : [])))]
  const { data: hw } = classIds.length > 0
    ? await supabase
        .from('homework')
        .select('id, title, homework_type, due_date, subject, classes:class_id(name)')
        .in('class_id', classIds)
        .gte('due_date', aujourdhui)
        .order('due_date', { ascending: true })
        .limit(5)
    : { data: [] }

  return {
    children,
    recentGrades:     grades ?? [],
    recentAbsences:   absences ?? [],
    familyFee:        fee,
    upcomingHomework: hw ?? [],
  }
}
