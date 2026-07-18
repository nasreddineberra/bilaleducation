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
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
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
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
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
