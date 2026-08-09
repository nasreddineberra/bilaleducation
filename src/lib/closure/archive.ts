// Generation des snapshots d'archive de fin d'annee (Phase 3).
// Produit les lignes de `student_year_history` (participant x annee) et
// `family_year_finance` (foyer x annee), a inserer par l'action `archiveYear`.
//
// Moyenne et assiduite ne sont plus RECALCULEES : elles sont agregees depuis les
// BULLETINS ARCHIVES, qui portent desormais les chiffres imprimes sur le
// document. L'historique ne peut donc plus contredire les bulletins detenus par
// les familles - ce qui etait possible tant qu'on refaisait le calcul.

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
    { data: enr }, { data: pce }, { data: ba }, { data: aba },
    fin,
  ] = await Promise.all([
    supabase.from('enrollments')
      .select('student_id, class_id, students:student_id(first_name, last_name, student_number, parent_id, is_active)')
      .eq('status', 'active').in('class_id', classIds),
    supabase.from('parent_class_enrollments')
      .select('parent_id, tutor_number, class_id, parents:parent_id(tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
      .eq('status', 'active').in('class_id', classIds),
    // LES CHIFFRES VIENNENT DES BULLETINS ARCHIVES, plus d'un recalcul.
    //
    // Depuis le 10 aout, la ligne d'archive porte la moyenne et l'assiduite
    // IMPRIMEES sur le document. Trois consequences :
    //   · l'historique ne peut plus CONTREDIRE les bulletins que les familles
    //     detiennent — c'etait possible tant qu'on recalculait ;
    //   · quatre requetes disparaissent (evaluations, grades, adult_grades,
    //     absences, adult_absences) ;
    //   · les archives SURVIVENT a la purge (elles figurent explicitement dans
    //     la liste de ce qu'on conserve), la source reste donc disponible.
    //
    // La completude est garantie en amont : l'audit « Bulletins » est BLOQUANT,
    // la cloture n'aboutit que si chaque participant a ses bulletins sur toutes
    // les periodes. On ne derive donc jamais d'un archivage partiel.
    supabase.from('bulletin_archives')
      .select('id, student_id, period_id, file_path, moyenne_generale, absences_count, absences_unjustified')
      .in('period_id', ctx.periodIds),
    supabase.from('adult_bulletin_archives')
      .select('id, parent_id, tutor_number, period_id, file_path, moyenne_generale, absences_count, absences_unjustified')
      .in('period_id', ctx.periodIds),
    getFamilyFinancials(supabase, { id: ctx.yearId, label: ctx.yearLabel, start_date: ctx.startDate, end_date: ctx.endDate }),
  ])

  const students = ((enr ?? []) as any[]).filter(e => e.students?.is_active)
  const adults = ((pce ?? []) as any[]).filter(p => isAdultClass(classById.get(p.class_id)))

  /**
   * Agregation des bulletins d'un participant sur l'annee.
   *
   * La moyenne de l'annee est la moyenne des moyennes de PERIODE. Ce n'est pas
   * la meme chose qu'une moyenne ponderee sur toutes les evaluations — mais
   * c'est desormais la bonne : les seuls chiffres PUBLIES sont ceux des
   * bulletins, et l'historique doit dire ce qu'ils disent.
   *
   * `absences_count` compte les absences, `absences_unjustified` celles qui ne
   * sont pas justifiees : les justifiees s'en deduisent.
   */
  const agreger = (lignes: any[]) => {
    const moyennes = lignes.map(b => b.moyenne_generale).filter((m: any) => m != null).map(Number)
    let j = 0, nj = 0
    for (const b of lignes) {
      const tot = Number(b.absences_count ?? 0)
      const n   = Number(b.absences_unjustified ?? 0)
      nj += n
      j  += Math.max(0, tot - n)
    }
    return {
      moyenne: moyennes.length > 0
        ? Math.round((moyennes.reduce((a, b) => a + b, 0) / moyennes.length) * 100) / 100
        : null,
      j, nj,
    }
  }

  // Archives par participant (cle unifiee cote adulte).
  const archivesByStudent = new Map<string, any[]>()
  for (const b of (ba ?? []) as any[]) {
    if (!archivesByStudent.has(b.student_id)) archivesByStudent.set(b.student_id, [])
    archivesByStudent.get(b.student_id)!.push(b)
  }
  const archivesByAdult = new Map<string, any[]>()
  for (const b of (aba ?? []) as any[]) {
    const k = `${b.parent_id}-${b.tutor_number}`
    if (!archivesByAdult.has(k)) archivesByAdult.set(k, [])
    archivesByAdult.get(k)!.push(b)
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
    const a = agreger(archivesByStudent.get(e.student_id) ?? [])
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
      moyenne_generale: a.moyenne,
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
      moyenne_generale: agreger(archivesByAdult.get(key) ?? []).moyenne,
      absences_justified: agreger(archivesByAdult.get(key) ?? []).j,
      absences_unjustified: agreger(archivesByAdult.get(key) ?? []).nj,
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
