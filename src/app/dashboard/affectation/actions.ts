'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'

// Enregistre les affectations d'une classe (élèves) : ajouts + retraits, tracés au journal.
export async function saveStudentEnrollments(
  classId: string,
  toAdd: string[],
  toRemove: string[],
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique'])
  if (roleError) return { error: roleError }
  if (!classId) return { error: 'Classe non spécifiée.' }

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  if (toAdd.length > 0) {
    const rows = toAdd.map(student_id => ({
      student_id,
      class_id:        classId,
      status:          'active' as const,
      enrollment_date: today,
    }))
    const { error } = await supabase.from('enrollments').upsert(rows, { onConflict: 'student_id,class_id' })
    if (error) return { error: "Erreur lors de l'ajout des inscriptions." }
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('class_id', classId)
      .in('student_id', toRemove)
    if (error) return { error: 'Erreur lors du retrait des inscriptions.' }
  }

  if (toAdd.length + toRemove.length > 0) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
    await logAudit(supabase, {
      action:      'UPDATE',
      entityType:  'enrollments',
      entityId:    classId,
      description: `Affectation classe ${cls?.name ?? classId} : ${toAdd.length} ajout(s), ${toRemove.length} retrait(s).`,
    })
  }

  return {}
}

// ─── Affectation des adultes (tuteurs) ────────────────────────────────────────
// Les identifiants sont composites : `${parent_id}-${tutor_number}`. Table parent_class_enrollments.
function parseTutorId(id: string): { parent_id: string; tutor_number: number } {
  const sep = id.lastIndexOf('-')
  return { parent_id: id.slice(0, sep), tutor_number: parseInt(id.slice(sep + 1), 10) }
}

export async function saveParentEnrollments(
  classId: string,
  toAdd: string[],
  toRemove: string[],
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique'])
  if (roleError) return { error: roleError }
  if (!classId) return { error: 'Classe non spécifiée.' }

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  if (toRemove.length > 0) {
    for (const id of toRemove) {
      const { parent_id, tutor_number } = parseTutorId(id)
      const { error } = await supabase
        .from('parent_class_enrollments')
        .delete()
        .eq('class_id', classId)
        .eq('parent_id', parent_id)
        .eq('tutor_number', tutor_number)
      if (error) return { error: 'Erreur lors du retrait des inscriptions.' }
    }
  }

  if (toAdd.length > 0) {
    const rows = toAdd.map(id => {
      const { parent_id, tutor_number } = parseTutorId(id)
      return { parent_id, class_id: classId, tutor_number, status: 'active' as const, enrollment_date: today }
    })
    const { error } = await supabase.from('parent_class_enrollments').insert(rows)
    if (error) return { error: "Erreur lors de l'ajout des inscriptions." }
  }

  if (toAdd.length + toRemove.length > 0) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
    await logAudit(supabase, {
      action:      'UPDATE',
      entityType:  'parent_class_enrollments',
      entityId:    classId,
      description: `Affectation cours adulte ${cls?.name ?? classId} : ${toAdd.length} ajout(s), ${toRemove.length} retrait(s).`,
    })
  }

  return {}
}
