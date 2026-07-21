// Generation des snapshots d'archive de fin d'annee (Phase 3).
// Produit les lignes de `student_year_history` (participant x annee) et
// `family_year_finance` (foyer x annee), a inserer par l'action `archiveYear`.
//
// Moyenne generale = FIDELE AU BULLETIN : weightedAvg sur les evaluations `scored`
// (note/max normalisee /20, ponderee par `coefficient`), meme formule que
// BulletinsClient.

import { getFamilyFinancials } from '@/lib/financements/family-financials'
import { siblingDiscounts, lineTotal } from '@/lib/financements/compute'
import type { YearCtx } from './audits'

export interface ArchiveResult {
  studentRows: any[]
  familyRows: any[]
}

export async function generateArchive(supabase: any, ctx: YearCtx): Promise<ArchiveResult> {
  const periodLabel = (id: string) => ctx.periodLabels[id] ?? '?'

  // 1. Classes de l'annee (+ cotisation pour libelle / remise fratrie / adulte)
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, level, cotisation_type_id, cotisation_types:cotisation_type_id(label, is_adult, amount, registration_fee, sibling_discount, sibling_discount_same_type)')
    .eq('academic_year', ctx.yearLabel)
  const classList = (classes ?? []) as any[]
  const classById = new Map(classList.map(c => [c.id, c]))
  const classIds = classList.map(c => c.id)
  const isAdultClass = (c: any) => !!c?.cotisation_types?.is_adult

  if (classIds.length === 0) return { studentRows: [], familyRows: [] }

  // 2. Eleves actifs inscrits + 3. Adultes + 4. Evals scored + 5. Notes + 6. Absences + 7. Bulletins
  const [
    { data: enr }, { data: pce }, { data: evals },
    { data: abs }, { data: ba }, { data: aba },
    fin,
  ] = await Promise.all([
    supabase.from('enrollments')
      .select('student_id, class_id, students:student_id(first_name, last_name, student_number, parent_id, is_active)')
      .eq('status', 'active').in('class_id', classIds),
    supabase.from('parent_class_enrollments')
      .select('parent_id, tutor_number, class_id, parents:parent_id(tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
      .eq('status', 'active').in('class_id', classIds),
    supabase.from('evaluations')
      .select('id, class_id, max_score, coefficient')
      .in('class_id', classIds).in('period_id', ctx.periodIds).eq('eval_kind', 'scored'),
    supabase.from('absences')
      .select('student_id, is_justified').in('period_id', ctx.periodIds).eq('absence_type', 'absence'),
    supabase.from('bulletin_archives')
      .select('id, student_id, period_id, file_path').in('period_id', ctx.periodIds),
    supabase.from('adult_bulletin_archives')
      .select('id, parent_id, tutor_number, period_id, file_path').in('period_id', ctx.periodIds),
    getFamilyFinancials(supabase, { id: ctx.yearId, label: ctx.yearLabel, start_date: ctx.startDate, end_date: ctx.endDate }),
  ])

  const students = ((enr ?? []) as any[]).filter(e => e.students?.is_active)
  const adults = ((pce ?? []) as any[]).filter(p => isAdultClass(classById.get(p.class_id)))

  // Evals scored par classe
  const scoredByClass = new Map<string, any[]>()
  for (const e of (evals ?? []) as any[]) {
    if (!scoredByClass.has(e.class_id)) scoredByClass.set(e.class_id, [])
    scoredByClass.get(e.class_id)!.push(e)
  }
  const evalIds = ((evals ?? []) as any[]).map(e => e.id)

  const [{ data: g }, { data: ag }] = await Promise.all([
    evalIds.length ? supabase.from('grades').select('evaluation_id, student_id, score').in('evaluation_id', evalIds) : Promise.resolve({ data: [] }),
    evalIds.length ? supabase.from('adult_grades').select('evaluation_id, parent_id, tutor_number, score').in('evaluation_id', evalIds) : Promise.resolve({ data: [] }),
  ])
  const gradeMap = new Map<string, number>()
  for (const r of (g ?? []) as any[]) if (r.score != null) gradeMap.set(`${r.evaluation_id}:${r.student_id}`, Number(r.score))
  for (const r of (ag ?? []) as any[]) if (r.score != null) gradeMap.set(`${r.evaluation_id}:${r.parent_id}-${r.tutor_number}`, Number(r.score))

  // Moyenne generale ponderee (/20), fidele au bulletin.
  const weightedAvg = (key: string, scoredEvals: any[]): number | null => {
    const graded = scoredEvals
      .map(ev => {
        const score = gradeMap.get(`${ev.id}:${key}`)
        if (score == null || !ev.max_score) return null
        return { score, maxScore: Number(ev.max_score), coefficient: Number(ev.coefficient ?? 1) }
      })
      .filter(Boolean) as { score: number; maxScore: number; coefficient: number }[]
    if (graded.length === 0) return null
    const tc = graded.reduce((s, l) => s + l.coefficient, 0)
    if (tc <= 0) return null
    const ws = graded.reduce((s, l) => s + ((l.score / l.maxScore) * 20) * l.coefficient, 0)
    return Math.round((ws / tc) * 100) / 100
  }

  // Absences par eleve
  const absByStudent = new Map<string, { j: number; nj: number }>()
  for (const a of (abs ?? []) as any[]) {
    const cur = absByStudent.get(a.student_id) ?? { j: 0, nj: 0 }
    if (a.is_justified) cur.j++; else cur.nj++
    absByStudent.set(a.student_id, cur)
  }

  // Bulletins par participant
  const bullByStudent = new Map<string, any[]>()
  for (const b of (ba ?? []) as any[]) {
    if (!bullByStudent.has(b.student_id)) bullByStudent.set(b.student_id, [])
    bullByStudent.get(b.student_id)!.push({ period_label: periodLabel(b.period_id), archive_id: b.id, file_path: b.file_path })
  }
  const bullByAdult = new Map<string, any[]>()
  for (const b of (aba ?? []) as any[]) {
    const k = `${b.parent_id}-${b.tutor_number}`
    if (!bullByAdult.has(k)) bullByAdult.set(k, [])
    bullByAdult.get(k)!.push({ period_label: periodLabel(b.period_id), archive_id: b.id, file_path: b.file_path })
  }

  const finByParent = new Map(fin.rows.map(r => [r.parentId, r]))

  // ── student_year_history : eleves ──
  const studentRows: any[] = students.map((e: any) => {
    const c = classById.get(e.class_id)
    const a = absByStudent.get(e.student_id) ?? { j: 0, nj: 0 }
    const fr = e.students?.parent_id ? finByParent.get(e.students.parent_id) : null
    return {
      etablissement_id: ctx.etablissementId,
      school_year_id: ctx.yearId,
      year_label: ctx.yearLabel,
      participant_type: 'student',
      student_id: e.student_id,
      parent_id: null,
      tutor_number: null,
      last_name: e.students?.last_name ?? '',
      first_name: e.students?.first_name ?? '',
      student_number: e.students?.student_number ?? null,
      class_name: c?.name ?? null,
      level: c?.level ?? null,
      cotisation_label: c?.cotisation_types?.label ?? null,
      moyenne_generale: weightedAvg(e.student_id, scoredByClass.get(e.class_id) ?? []),
      absences_justified: a.j,
      absences_unjustified: a.nj,
      financial_status: fr?.status ?? null,
      total_due: fr?.totalDue ?? null,
      total_paid: fr?.totalPaid ?? null,
      bulletin_refs: bullByStudent.get(e.student_id) ?? [],
    }
  })

  // ── student_year_history : adultes ──
  const adultRows: any[] = adults.map((p: any) => {
    const c = classById.get(p.class_id)
    const key = `${p.parent_id}-${p.tutor_number}`
    const last = p.tutor_number === 2 ? p.parents?.tutor2_last_name : p.parents?.tutor1_last_name
    const first = p.tutor_number === 2 ? p.parents?.tutor2_first_name : p.parents?.tutor1_first_name
    const fr = finByParent.get(p.parent_id)
    return {
      etablissement_id: ctx.etablissementId,
      school_year_id: ctx.yearId,
      year_label: ctx.yearLabel,
      participant_type: 'adult',
      student_id: null,
      parent_id: p.parent_id,
      tutor_number: p.tutor_number,
      last_name: last ?? '',
      first_name: first ?? '',
      student_number: null,
      class_name: c?.name ?? null,
      level: c?.level ?? null,
      cotisation_label: c?.cotisation_types?.label ?? null,
      moyenne_generale: weightedAvg(key, scoredByClass.get(p.class_id) ?? []),
      absences_justified: 0,
      absences_unjustified: 0,
      financial_status: fr?.status ?? null,
      total_due: fr?.totalDue ?? null,
      total_paid: fr?.totalPaid ?? null,
      bulletin_refs: bullByAdult.get(key) ?? [],
    }
  })

  // ── family_year_finance : par foyer ──
  const { data: fees } = await supabase
    .from('family_fees')
    .select('parent_id, fee_installments(amount_paid, paid_date, payment_method, receipt_number), fee_adjustments(adjustment_type, label, amount, adjustment_date)')
    .eq('school_year_id', ctx.yearId)
  const feeByParent = new Map(((fees ?? []) as any[]).map(f => [f.parent_id, f]))

  // Regroupe les participants par foyer (pour identites + lignes de cotisation)
  const parentIds = [...new Set([
    ...students.map((e: any) => e.students?.parent_id).filter(Boolean),
    ...adults.map((p: any) => p.parent_id),
  ])]

  // Noms des tuteurs (foyer)
  const { data: parentsData } = parentIds.length
    ? await supabase.from('parents').select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name').in('id', parentIds)
    : { data: [] }
  const parentById = new Map(((parentsData ?? []) as any[]).map(p => [p.id, p]))

  // Lignes de cotisation par foyer (eleves avec remise fratrie + adultes)
  const studentsByParent = new Map<string, any[]>()
  for (const e of students as any[]) {
    const pid = e.students?.parent_id
    if (!pid) continue
    if (!studentsByParent.has(pid)) studentsByParent.set(pid, [])
    studentsByParent.get(pid)!.push(e)
  }
  const adultsByParent = new Map<string, any[]>()
  for (const p of adults as any[]) {
    if (!adultsByParent.has(p.parent_id)) adultsByParent.set(p.parent_id, [])
    adultsByParent.get(p.parent_id)!.push(p)
  }

  const familyRows: any[] = parentIds.map((pid: string) => {
    const fr = finByParent.get(pid)
    const fee = feeByParent.get(pid)
    const p = parentById.get(pid)

    const installments = ((fee?.fee_installments ?? []) as any[])
      .filter(i => Number(i.amount_paid) > 0)
      .map(i => ({ date: i.paid_date, montant: Number(i.amount_paid), moyen: i.payment_method, reference: i.receipt_number }))
    const adjustments = ((fee?.fee_adjustments ?? []) as any[])
      .map(a => ({ type: a.adjustment_type, label: a.label, montant: Number(a.amount), date: a.adjustment_date }))

    // Lignes de cotisation (memes regles que le helper partage)
    const famStudents = studentsByParent.get(pid) ?? []
    const cotis = famStudents.map((e: any) => classById.get(e.class_id)?.cotisation_types)
    const discounts = siblingDiscounts(cotis)
    const cotisations: any[] = []
    famStudents.forEach((e: any, i: number) => {
      const ct = classById.get(e.class_id)?.cotisation_types
      if (!ct) return
      cotisations.push({
        participant: `${e.students?.last_name ?? ''} ${e.students?.first_name ?? ''}`.trim(),
        cotisation_label: ct.label ?? null,
        total: lineTotal(ct, discounts[i]),
      })
    })
    for (const a of adultsByParent.get(pid) ?? []) {
      const ct = classById.get(a.class_id)?.cotisation_types
      if (!ct) continue
      const last = a.tutor_number === 2 ? a.parents?.tutor2_last_name : a.parents?.tutor1_last_name
      const first = a.tutor_number === 2 ? a.parents?.tutor2_first_name : a.parents?.tutor1_first_name
      cotisations.push({
        participant: `${last ?? ''} ${first ?? ''}`.trim(),
        cotisation_label: ct.label ?? null,
        total: lineTotal(ct),
      })
    }

    return {
      etablissement_id: ctx.etablissementId,
      school_year_id: ctx.yearId,
      year_label: ctx.yearLabel,
      parent_id: pid,
      tutor1_last_name: p?.tutor1_last_name ?? null,
      tutor1_first_name: p?.tutor1_first_name ?? null,
      tutor2_last_name: p?.tutor2_last_name ?? null,
      tutor2_first_name: p?.tutor2_first_name ?? null,
      total_due: fr?.totalDue ?? 0,
      total_paid: fr?.totalPaid ?? 0,
      remaining: fr?.remaining ?? 0,
      status: fr?.status ?? null,
      installments_json: installments,
      adjustments_json: adjustments,
      cotisations_json: cotisations,
    }
  })

  return { studentRows: [...studentRows, ...adultRows], familyRows }
}
