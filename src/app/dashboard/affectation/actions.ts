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
    // Garde : on ne retire pas un eleve tant qu'il reste des donnees sur le duo
    // eleve/classe (notes, absences, appreciations, bulletins). Message nomme.
    const blocked = new Set<string>()
    const { data: evals } = await supabase.from('evaluations').select('id').eq('class_id', classId)
    const evalIds = (evals ?? []).map((e: any) => e.id)
    if (evalIds.length > 0) {
      const { data } = await supabase.from('grades').select('student_id').in('student_id', toRemove).in('evaluation_id', evalIds)
      for (const r of (data ?? []) as any[]) blocked.add(r.student_id)
    }
    for (const tbl of ['absences', 'bulletin_appreciations', 'bulletin_archives']) {
      const { data } = await supabase.from(tbl).select('student_id').eq('class_id', classId).in('student_id', toRemove)
      for (const r of (data ?? []) as any[]) blocked.add(r.student_id)
    }
    if (blocked.size > 0) {
      const { data: st } = await supabase.from('students').select('last_name, first_name').in('id', [...blocked])
      const names = (st ?? []).map((s: any) => `${s.last_name} ${s.first_name}`).join(', ')
      return { error: `Impossible de retirer : ${names}. Des notes, absences ou bulletins existent pour cette classe — supprimez-les d'abord.` }
    }

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
    // Garde : idem adultes — pas de retrait tant qu'il reste des donnees sur le duo.
    const removeSet = new Set(toRemove)
    const parentIds = [...new Set(toRemove.map(id => parseTutorId(id).parent_id))]
    const blocked = new Set<string>() // cles composites `parent-tutor`
    const { data: evals } = await supabase.from('evaluations').select('id').eq('class_id', classId)
    const evalIds = (evals ?? []).map((e: any) => e.id)
    if (evalIds.length > 0) {
      const { data } = await supabase.from('adult_grades').select('parent_id, tutor_number').in('parent_id', parentIds).in('evaluation_id', evalIds)
      for (const r of (data ?? []) as any[]) { const k = `${r.parent_id}-${r.tutor_number}`; if (removeSet.has(k)) blocked.add(k) }
    }
    for (const tbl of ['adult_bulletin_appreciations', 'adult_bulletin_archives']) {
      const { data } = await supabase.from(tbl).select('parent_id, tutor_number').eq('class_id', classId).in('parent_id', parentIds)
      for (const r of (data ?? []) as any[]) { const k = `${r.parent_id}-${r.tutor_number}`; if (removeSet.has(k)) blocked.add(k) }
    }
    if (blocked.size > 0) {
      const bParentIds = [...new Set([...blocked].map(k => parseTutorId(k).parent_id))]
      const { data: ps } = await supabase.from('parents').select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name').in('id', bParentIds)
      const pmap = new Map((ps ?? []).map((p: any) => [p.id, p]))
      const names = [...blocked].map(k => {
        const { parent_id, tutor_number } = parseTutorId(k)
        const p: any = pmap.get(parent_id)
        if (!p) return k
        return tutor_number === 2 ? `${p.tutor2_last_name} ${p.tutor2_first_name}` : `${p.tutor1_last_name} ${p.tutor1_first_name}`
      }).join(', ')
      return { error: `Impossible de retirer : ${names}. Des notes ou bulletins existent pour cette classe — supprimez-les d'abord.` }
    }

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
