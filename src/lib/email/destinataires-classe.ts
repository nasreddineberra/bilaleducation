import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export type Dest = { parent_id: string; emailsOverride?: string[]; nom: string }

/**
 * Les foyers a prevenir pour une classe (devoir, seance annulee), UN PAR FOYER.
 *
 * Extrait a son 2e usage (suppression, puis modification) : recopier une
 * resolution de destinataires, c est le motif qui a produit le calcul comptable
 * divergent dans trois sous-menus le 17 juillet.
 *
 * CLASSE ADULTE : les participants sont des TUTEURS (`parent_class_enrollments`),
 * et l on ecrit au seul tuteur inscrit — d ou `emailsOverride`. CLASSE ENFANTS :
 * un foyer peut avoir plusieurs enfants dans la classe, ses prenoms sont donc
 * reunis sur une seule ligne plutot que d envoyer deux fois le meme message.
 */
export async function destinatairesDeLaClasse(
  supabase: SupabaseClient<Database>,
  classId: string,
  isAdult: boolean,
): Promise<Dest[]> {
  const destinataires: Dest[] = []

  if (isAdult) {
    const { data: participants } = await supabase
      .from('parent_class_enrollments')
      .select('parent_id, tutor_number, parents:parent_id(tutor1_email, tutor2_email, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
      .eq('class_id', classId)
      .eq('status', 'active')

    for (const p of (participants ?? []) as any[]) {
      const t = p.tutor_number === 2 ? 2 : 1
      const email = p.parents?.[`tutor${t}_email`]
      const nom = `${p.parents?.[`tutor${t}_last_name`] ?? ''} ${p.parents?.[`tutor${t}_first_name`] ?? ''}`.trim()
      destinataires.push({ parent_id: p.parent_id, emailsOverride: email ? [email] : [], nom })
    }
  } else {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('students:student_id(parent_id, last_name, first_name)')
      .eq('class_id', classId)
      .eq('status', 'active')

    const parFoyer = new Map<string, string[]>()
    for (const e of (enrollments ?? []) as any[]) {
      const st = e.students
      if (!st?.parent_id) continue
      const liste = parFoyer.get(st.parent_id) ?? []
      liste.push(`${st.last_name} ${st.first_name}`)
      parFoyer.set(st.parent_id, liste)
    }
    for (const [parent_id, noms] of parFoyer) destinataires.push({ parent_id, nom: noms.join(' · ') })
  }

  return destinataires
}
