'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'

export type StudentStatusRow = {
  id:           string
  name:         string
  className:    string | null   // classe de l'année en cours si affecté
  classTooltip: string | null   // « Mme Djamila BELAÏD · MATERNELLE · Samedi 09:00-12:00 »
  enrolled:     boolean         // inscrit dans une classe de l'année en cours
  is_active:    boolean
}

type ClassInfo = { name: string; tooltip: string }

// Map student_id → infos classe (année en cours) pour les inscrits actifs.
async function currentYearEnrollment(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: currentYear } = await supabase
    .from('school_years').select('label').eq('is_current', true).single()
  const yearLabel = currentYear?.label ?? ''

  const infoByStudent = new Map<string, ClassInfo>()
  if (!yearLabel) return { yearLabel, infoByStudent }

  const { data: yearClasses } = await supabase
    .from('classes')
    .select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label)')
    .eq('academic_year', yearLabel)
  const classes = yearClasses ?? []
  if (classes.length === 0) return { yearLabel, infoByStudent }

  const classIds = classes.map(c => c.id)

  // Prof principal actif de chaque classe
  const { data: cts } = await supabase
    .from('class_teachers')
    .select('class_id, teachers(civilite, first_name, last_name)')
    .eq('is_main_teacher', true)
    .is('effective_until', null)
    .in('class_id', classIds)
  const teacherByClass = new Map<string, { civilite: string | null; first_name: string; last_name: string }>()
  for (const ct of (cts ?? []) as any[]) {
    if (ct.teachers) teacherByClass.set(ct.class_id, ct.teachers)
  }

  // Construire le libellé tooltip par classe
  const tooltipByClass = new Map<string, string>()
  for (const c of classes as any[]) {
    const parts: string[] = []
    const t = teacherByClass.get(c.id)
    if (t) parts.push(`${t.civilite ? t.civilite + ' ' : ''}${t.last_name} ${t.first_name}`.trim())
    if (c.cotisation_types?.label) parts.push(c.cotisation_types.label)
    if (c.level) parts.push(c.level)
    if (c.day_of_week && c.start_time && c.end_time) {
      parts.push(`${c.day_of_week} ${String(c.start_time).slice(0, 5)}-${String(c.end_time).slice(0, 5)}`)
    } else if (c.day_of_week) {
      parts.push(c.day_of_week)
    }
    tooltipByClass.set(c.id, parts.join(' · '))
  }
  const nameById = new Map(classes.map(c => [c.id, c.name as string]))

  // Inscriptions actives → première classe de l'année par élève
  const { data: enr } = await supabase
    .from('enrollments')
    .select('student_id, class_id')
    .eq('status', 'active')
    .in('class_id', classIds)
  for (const e of enr ?? []) {
    if (!infoByStudent.has(e.student_id)) {
      infoByStudent.set(e.student_id, {
        name:    nameById.get(e.class_id) ?? '',
        tooltip: tooltipByClass.get(e.class_id) ?? '',
      })
    }
  }

  return { yearLabel, infoByStudent }
}

// Liste de TOUS les apprenants avec classe (si affecté année en cours) + statut.
export async function getStudentsForStatusModal(): Promise<{
  error?: string; yearLabel?: string; students?: StudentStatusRow[]
}> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }
  const supabase = await createClient()

  const { yearLabel, infoByStudent } = await currentYearEnrollment(supabase)
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, is_active')
    .order('last_name').order('first_name')

  const rows: StudentStatusRow[] = (students ?? []).map(s => {
    const info = infoByStudent.get(s.id)
    return {
      id:           s.id,
      name:         `${s.last_name} ${s.first_name}`,
      className:    info?.name ?? null,
      classTooltip: info?.tooltip || null,
      enrolled:     !!info,
      is_active:    s.is_active,
    }
  })
  return { yearLabel, students: rows }
}

// Sauvegarde des changements de statut. Un inscrit ne peut pas etre inactive
// (toute tentative est ignoree cote serveur, par securite).
export async function saveStudentsActive(
  updates: { id: string; is_active: boolean }[],
): Promise<{ error?: string; activated?: number; deactivated?: number }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }
  if (!updates || updates.length === 0) return { activated: 0, deactivated: 0 }

  const supabase = await createClient()
  const { infoByStudent } = await currentYearEnrollment(supabase)

  const clean   = updates.filter(u => !(u.is_active === false && infoByStudent.has(u.id)))
  const toTrue  = clean.filter(u => u.is_active).map(u => u.id)
  const toFalse = clean.filter(u => !u.is_active).map(u => u.id)

  if (toTrue.length > 0) {
    const { error } = await supabase.from('students').update({ is_active: true }).in('id', toTrue)
    if (error) return { error: "Erreur lors de l'activation des apprenants." }
  }
  if (toFalse.length > 0) {
    const { error } = await supabase.from('students').update({ is_active: false }).in('id', toFalse)
    if (error) return { error: 'Erreur lors de la désactivation des apprenants.' }
  }
  if (toTrue.length + toFalse.length > 0) {
    await logAudit(supabase, {
      action: 'UPDATE',
      entityType: 'students',
      description: `Mise à jour des statuts apprenants : ${toTrue.length} activé(s), ${toFalse.length} désactivé(s).`,
    })
  }
  return { activated: toTrue.length, deactivated: toFalse.length }
}

// ─── Suppression d'un apprenant ────────────────────────────────────────────
//
// DOCTRINE STRICTE (arbitrage du 13 septembre) : on ne supprime qu'une fiche
// VIERGE. La moindre ligne rattachee renvoie vers « Rendre inactif ».
//
// La garantie vit dans le declencheur `trg_guard_student_delete` : cette liste
// ne sert qu'a EXPLIQUER a l'utilisateur, avant qu'il ne clique.
//
// Les deux cles en SET NULL (`notifications`, `student_year_history`) ne sont
// pas comptees : ces lignes survivent a la suppression, simplement detachees.
export async function getStudentDeleteDeps(id: string): Promise<{
  affectations: number
  evaluation:   number
  vieScolaire:  number
  documents:    number
  erreur?:      string
}> {
  const supabase = await createClient()
  const head = { count: 'exact' as const, head: true }

  const r = await Promise.all([
    supabase.from('enrollments').select('id', head).eq('student_id', id),
    supabase.from('grades').select('id', head).eq('student_id', id),
    supabase.from('bulletin_archives').select('id', head).eq('student_id', id),
    supabase.from('bulletin_appreciations').select('id', head).eq('student_id', id),
    supabase.from('absences').select('id', head).eq('student_id', id),
    supabase.from('student_warnings').select('id', head).eq('student_id', id),
    supabase.from('homework_status').select('id', head).eq('student_id', id),
    supabase.from('student_documents').select('id', head).eq('student_id', id),
  ])

  // PIEGE POSTGREST : sur un comptage `head`, une requete impossible (table
  // absente, colonne renommee) repond 204 avec `count: null` et `error: null`.
  // Un `?? 0` transformerait donc une PANNE en « aucune donnee rattachee »,
  // c'est-a-dire en feu vert pour supprimer. Le signal est `count === null`.
  if (r.some(x => x.count === null)) {
    return {
      affectations: 0, evaluation: 0, vieScolaire: 0, documents: 0,
      erreur: 'Impossible de verifier les donnees rattachees a cet apprenant.',
    }
  }

  const [enrollments, grades, archives, appreciations, absences, warnings, homework, documents] = r
  const n = (x: { count: number | null }) => x.count ?? 0

  return {
    affectations: n(enrollments),
    evaluation:   n(grades) + n(archives) + n(appreciations),
    vieScolaire:  n(absences) + n(warnings) + n(homework),
    documents:    n(documents),
  }
}

export async function deleteStudent(id: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  const { data: cible } = await supabase
    .from('students')
    .select('last_name, first_name, student_number')
    .eq('id', id)
    .maybeSingle()
  if (!cible) return { error: 'Apprenant introuvable.' }

  // Recompte cote SERVEUR : la modale a pu etre ouverte il y a dix minutes, et
  // cette action reste appelable directement. Le declencheur refuserait de
  // toute facon, mais autant rendre un message clair plutot qu'une erreur SQL.
  const deps = await getStudentDeleteDeps(id)
  if (deps.erreur) return { error: deps.erreur }
  if (deps.affectations + deps.evaluation + deps.vieScolaire + deps.documents > 0) {
    return { error: 'Des données sont rattachées à cet apprenant. Rendez-le inactif plutôt que de le supprimer.' }
  }

  // Tracer AVANT d'effacer : après coup, il n'y a plus rien à décrire.
  await logAudit(supabase, {
    action:      'DELETE',
    entityType:  'students',
    entityId:    id,
    description: `Suppression de l'apprenant ${cible.last_name} ${cible.first_name} (${cible.student_number})`,
    oldData:     cible as Record<string, unknown>,
  })

  // `.select()` : une suppression écartée par la RLS ne lève PAS d'erreur,
  // elle supprime zéro ligne. Sans cela, un refus ressemblerait à un succès.
  const { data: supprimes, error } = await supabase
    .from('students').delete().eq('id', id).select('id')

  if (error) return { error: 'Erreur lors de la suppression de l\'apprenant.' }
  if (!supprimes || supprimes.length === 0) {
    return { error: 'La suppression n\'a pas été autorisée.' }
  }
  return {}
}

/** Rend un apprenant actif ou inactif, une fiche à la fois.
 *
 *  Distinct de `saveStudentsActive`, qui ÉCARTE SILENCIEUSEMENT la
 *  désactivation d'un apprenant affecté à une classe de l'année : sur une
 *  action unitaire, ce silence passerait pour un succès. Ici on le dit.
 */
export async function setStudentActive(id: string, active: boolean): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  if (!active) {
    const { infoByStudent } = await currentYearEnrollment(supabase)
    const classe = infoByStudent.get(id)
    if (classe) {
      return { error: `Cet apprenant est affecté à la classe ${classe.name}. Retirez-le de sa classe avant de le rendre inactif.` }
    }
  }

  const { data, error } = await supabase
    .from('students').update({ is_active: active }).eq('id', id).select('last_name, first_name')

  if (error || !data || data.length === 0) {
    return { error: 'Erreur lors de la mise à jour du statut.' }
  }

  await logAudit(supabase, {
    action:      'UPDATE',
    entityType:  'students',
    entityId:    id,
    description: `${data[0].last_name} ${data[0].first_name} rendu ${active ? 'actif' : 'inactif'}`,
  })
  return {}
}
