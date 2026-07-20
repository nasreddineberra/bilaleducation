// Moteur d'audit de cloture d'annee (serveur).
// Une fonction par etape → { blocking, anomalies, items[], summary }.
// Les liens `href` renvoient vers le module pour corriger.

import { getFamilyFinancials } from '@/lib/financements/family-financials'
import { classInfoOf } from '@/components/dashboard/classInfo'

export interface AuditItem {
  label: string
  /** Classe affichee apres le nom (avec tooltip `classInfo`). */
  className?: string
  /** Tooltip d'infos classe : « Civilité NOM Prénom · Cotisation · Niveau · horaires ». */
  classInfo?: string
  detail?: string
  href?: string
}
export interface AuditResult {
  blocking: boolean
  anomalies: number
  items: AuditItem[]
  summary: string
}

export interface YearCtx {
  etablissementId: string
  yearId: string
  yearLabel: string
  startDate: string | null
  endDate: string | null
  periodIds: string[]
  periodLabels: Record<string, string>
}

const ITEMS_CAP = 100

function eur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
function nom(last?: string | null, first?: string | null): string {
  return `${last ?? ''} ${first ?? ''}`.trim() || '(sans nom)'
}
function cap<T>(arr: T[]): T[] { return arr.slice(0, ITEMS_CAP) }

// ─── 1. Affectations (bloquant) : eleves actifs sans classe de l'annee ──────
export async function auditAffectations(supabase: any, ctx: YearCtx): Promise<AuditResult> {
  const { data: activeStudents } = await supabase
    .from('students').select('id, first_name, last_name, student_number')
    .eq('is_active', true).eq('etablissement_id', ctx.etablissementId)

  const { data: enrolled } = await supabase
    .from('enrollments').select('student_id, classes!inner(academic_year)')
    .eq('status', 'active').eq('classes.academic_year', ctx.yearLabel)

  const affected = new Set((enrolled ?? []).map((e: any) => e.student_id))
  const unassigned = (activeStudents ?? []).filter((s: any) => !affected.has(s.id))

  return {
    blocking: true,
    anomalies: unassigned.length,
    items: cap(unassigned.map((s: any) => ({
      label: nom(s.last_name, s.first_name),
      detail: s.student_number ?? 'Non affecté',
      href: '/dashboard/affectation',
    }))),
    summary: unassigned.length === 0
      ? 'Tous les élèves actifs sont affectés à une classe de l’année.'
      : `${unassigned.length} élève(s) actif(s) sans classe cette année.`,
  }
}

// ─── 2. Absences (avertissement) : non justifiees en attente ────────────────
export async function auditAbsences(supabase: any, ctx: YearCtx): Promise<AuditResult> {
  if (ctx.periodIds.length === 0) {
    return { blocking: false, anomalies: 0, items: [], summary: 'Aucune période configurée.' }
  }
  // Meme definition que le compteur de la feuille d'appel : type 'absence' (ni
  // 'retard' ni 'authorized_absence') ET non justifiee.
  const { data: abs } = await supabase
    .from('absences')
    .select('student_id, period_id, students:student_id(first_name, last_name), classes:class_id(name, level, day_of_week, start_time, end_time, cotisation_types:cotisation_type_id(label), class_teachers(is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name)))')
    .in('period_id', ctx.periodIds).eq('is_justified', false).eq('absence_type', 'absence')

  const byStudent = new Map<string, { name: string; count: number; perPeriod: Map<string, number>; cls: any }>()
  for (const a of (abs ?? []) as any[]) {
    const cur = byStudent.get(a.student_id) ?? { name: nom(a.students?.last_name, a.students?.first_name), count: 0, perPeriod: new Map<string, number>(), cls: a.classes }
    cur.count++
    cur.perPeriod.set(a.period_id, (cur.perPeriod.get(a.period_id) ?? 0) + 1)
    byStudent.set(a.student_id, cur)
  }
  const list = [...byStudent.values()].sort((x, y) => y.count - x.count)
  const total = (abs ?? []).length

  // Detail par periode, dans l'ordre des periodes de l'annee (ex. « S1 : 1 · S2 : 2 »).
  const perPeriodLabel = (m: Map<string, number>) =>
    ctx.periodIds.filter(pid => m.has(pid)).map(pid => `${ctx.periodLabels[pid] ?? '?'} : ${m.get(pid)}`).join(' · ')

  return {
    blocking: false,
    anomalies: total,
    items: cap(list.map(s => ({
      label: s.name,
      className: s.cls?.name,
      classInfo: classInfoOf(s.cls),
      detail: `${s.count} non justifiée(s) · ${perPeriodLabel(s.perPeriod)}`,
      href: '/dashboard/absences',
    }))),
    summary: total === 0
      ? 'Aucune absence non justifiée en attente.'
      : `${total} absence(s) non justifiée(s) · ${list.length} élève(s).`,
  }
}

// ─── 3. Notes (bloquant) : couverture + notes manquantes (eleves + adultes) ──
// Deux anomalies : (a) une classe avec participants qui n'a AUCUNE evaluation sur
// une periode ; (b) une evaluation incomplete (notes < participants inscrits).
// Les classes sans participant sont ignorees.
export async function auditNotes(supabase: any, ctx: YearCtx): Promise<AuditResult> {
  if (ctx.periodIds.length === 0) {
    return { blocking: true, anomalies: 0, items: [], summary: 'Aucune période configurée.' }
  }
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, level, day_of_week, start_time, end_time, cotisation_types:cotisation_type_id(label, is_adult), class_teachers(is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name))')
    .eq('academic_year', ctx.yearLabel)
  const classList = (classes ?? []) as any[]
  if (classList.length === 0) {
    return { blocking: true, anomalies: 0, items: [], summary: 'Aucune classe cette année.' }
  }
  const classIds = classList.map(c => c.id)

  const [{ data: enr }, { data: pce }, { data: evals }] = await Promise.all([
    supabase.from('enrollments').select('class_id, student_id').eq('status', 'active').in('class_id', classIds),
    supabase.from('parent_class_enrollments').select('class_id, parent_id, tutor_number').eq('status', 'active').in('class_id', classIds),
    supabase.from('evaluations').select('id, title, class_id, period_id').in('period_id', ctx.periodIds).in('class_id', classIds),
  ])

  // Participants ACTUELS par classe (cles : student_id pour eleves, `parent-tutor` pour adultes).
  const studentsByClass = new Map<string, Set<string>>()
  for (const e of (enr ?? []) as any[]) {
    if (!studentsByClass.has(e.class_id)) studentsByClass.set(e.class_id, new Set())
    studentsByClass.get(e.class_id)!.add(e.student_id)
  }
  const adultsByClass = new Map<string, Set<string>>()
  for (const p of (pce ?? []) as any[]) {
    if (!adultsByClass.has(p.class_id)) adultsByClass.set(p.class_id, new Set())
    adultsByClass.get(p.class_id)!.add(`${p.parent_id}-${p.tutor_number}`)
  }

  const classById = new Map(classList.map(c => [c.id, c]))
  const isAdultOf = (c: any) => !!c?.cotisation_types?.is_adult
  const currentSet = (c: any): Set<string> => (isAdultOf(c) ? adultsByClass.get(c.id) : studentsByClass.get(c.id)) ?? new Set()
  const partOf = (c: any) => currentSet(c).size

  const evalList = (evals ?? []) as any[]
  const evalIds = evalList.map(e => e.id)
  const [{ data: g }, { data: ag }] = await Promise.all([
    evalIds.length ? supabase.from('grades').select('evaluation_id, student_id, score, comment, is_absent').in('evaluation_id', evalIds) : Promise.resolve({ data: [] }),
    evalIds.length ? supabase.from('adult_grades').select('evaluation_id, parent_id, tutor_number, score, comment, is_absent').in('evaluation_id', evalIds) : Promise.resolve({ data: [] }),
  ])

  const hasValue = (r: any) => r.score !== null || r.comment !== null || r.is_absent
  // Notes VALORISEES, restreintes aux participants ACTUELS (ignore les notes orphelines).
  const gradedSet = new Map<string, Set<string>>()
  for (const e of evalList) gradedSet.set(e.id, new Set())
  const evalClass = new Map(evalList.map(e => [e.id, classById.get(e.class_id)]))
  for (const r of (g ?? []) as any[]) {
    const c = evalClass.get(r.evaluation_id)
    if (!c || isAdultOf(c) || !hasValue(r)) continue
    if (currentSet(c).has(r.student_id)) gradedSet.get(r.evaluation_id)!.add(r.student_id)
  }
  for (const r of (ag ?? []) as any[]) {
    const c = evalClass.get(r.evaluation_id)
    if (!c || !isAdultOf(c) || !hasValue(r)) continue
    const key = `${r.parent_id}-${r.tutor_number}`
    if (currentSet(c).has(key)) gradedSet.get(r.evaluation_id)!.add(key)
  }

  const evalCP = new Set(evalList.map(e => `${e.class_id}|${e.period_id}`))
  const periodLabel = (id: string) => ctx.periodLabels[id] ?? '?'
  const periodOrder = new Map(ctx.periodIds.map((id, i) => [id, i]))

  // Anomalies avec cle de tri (periode croissante, puis classe).
  type Anom = { pOrder: number; className: string; item: AuditItem }
  const anoms: Anom[] = []
  let missingClasses = 0
  let incompleteEvals = 0
  let totalMissing = 0

  // (a) Classes avec participants sans evaluation sur une periode (1 ligne par periode)
  for (const c of classList) {
    if (partOf(c) === 0) continue
    const missPeriods = ctx.periodIds.filter(pid => !evalCP.has(`${c.id}|${pid}`))
    if (missPeriods.length > 0) missingClasses++
    for (const pid of missPeriods) {
      anoms.push({
        pOrder: periodOrder.get(pid) ?? 99,
        className: c.name,
        item: { label: c.name, classInfo: classInfoOf(c), detail: `aucune évaluation · ${periodLabel(pid)}`, href: '/dashboard/grades' },
      })
    }
  }

  // (b) Evaluations incompletes (notes des participants ACTUELS < inscrits)
  for (const e of evalList) {
    const c = classById.get(e.class_id)
    const expected = partOf(c)
    if (expected === 0) continue
    const have = gradedSet.get(e.id)!.size
    if (have < expected) {
      incompleteEvals++
      totalMissing += expected - have
      anoms.push({
        pOrder: periodOrder.get(e.period_id) ?? 99,
        className: c?.name ?? '',
        item: { label: c?.name ?? '', classInfo: classInfoOf(c), detail: `${e.title} · ${periodLabel(e.period_id)} · ${have}/${expected} notes`, href: '/dashboard/grades' },
      })
    }
  }

  // Tri : periode croissante, puis classe.
  anoms.sort((a, b) => a.pOrder - b.pOrder || a.className.localeCompare(b.className))
  const items = anoms.map(a => a.item)

  const parts: string[] = []
  if (missingClasses > 0) parts.push(`${missingClasses} classe(s) sans évaluation sur une période`)
  if (incompleteEvals > 0) parts.push(`${incompleteEvals} évaluation(s) incomplète(s) · ${totalMissing} note(s) manquante(s)`)

  return {
    blocking: true,
    anomalies: items.length,
    items: cap(items),
    summary: items.length === 0
      ? 'Chaque classe a des évaluations notées sur toutes les périodes.'
      : parts.join(' · ') + '.',
  }
}

// ─── 4. Bulletins (bloquant) : chaque participant × chaque période ──────────
export async function auditBulletins(supabase: any, ctx: YearCtx): Promise<AuditResult> {
  if (ctx.periodIds.length === 0) {
    return { blocking: true, anomalies: 0, items: [], summary: 'Aucune période configurée.' }
  }
  const periodLabel = (id: string) => ctx.periodLabels[id] ?? '?'
  const items: AuditItem[] = []

  // ── Élèves ──
  const { data: enr } = await supabase
    .from('enrollments')
    .select('student_id, students:student_id(first_name, last_name, is_active), classes!inner(academic_year)')
    .eq('status', 'active').eq('classes.academic_year', ctx.yearLabel)
  const students = new Map<string, string>() // id -> nom
  for (const e of (enr ?? []) as any[]) {
    if (e.students?.is_active) students.set(e.student_id, nom(e.students?.last_name, e.students?.first_name))
  }
  const studentIds = [...students.keys()]

  let studentMissing = 0
  if (studentIds.length > 0) {
    const { data: ba } = await supabase
      .from('bulletin_archives').select('student_id, period_id')
      .in('period_id', ctx.periodIds).in('student_id', studentIds)
    const have = new Set((ba ?? []).map((b: any) => `${b.student_id}|${b.period_id}`))
    for (const [sid, name] of students) {
      const miss = ctx.periodIds.filter(pid => !have.has(`${sid}|${pid}`))
      if (miss.length > 0) {
        studentMissing++
        items.push({ label: name, detail: `manque ${miss.map(periodLabel).join(', ')}`, href: '/dashboard/bulletins' })
      }
    }
  }

  // ── Adultes (participants de classes adultes) ──
  const { data: pce } = await supabase
    .from('parent_class_enrollments')
    .select('parent_id, tutor_number, class_id, classes!inner(academic_year, cotisation_types:cotisation_type_id(is_adult)), parents:parent_id(tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
    .eq('status', 'active').eq('classes.academic_year', ctx.yearLabel)
  const adults = (pce ?? []).filter((p: any) => p.classes?.cotisation_types?.is_adult)

  let adultMissing = 0
  if (adults.length > 0) {
    const { data: aba } = await supabase
      .from('adult_bulletin_archives').select('parent_id, tutor_number, class_id, period_id')
      .in('period_id', ctx.periodIds)
    const have = new Set((aba ?? []).map((b: any) => `${b.parent_id}|${b.tutor_number}|${b.class_id}|${b.period_id}`))
    for (const p of adults as any[]) {
      const name = p.tutor_number === 2
        ? nom(p.parents?.tutor2_last_name, p.parents?.tutor2_first_name)
        : nom(p.parents?.tutor1_last_name, p.parents?.tutor1_first_name)
      const miss = ctx.periodIds.filter(pid => !have.has(`${p.parent_id}|${p.tutor_number}|${p.class_id}|${pid}`))
      if (miss.length > 0) {
        adultMissing++
        items.push({ label: `${name} (adulte)`, detail: `manque ${miss.map(periodLabel).join(', ')}`, href: '/dashboard/bulletins' })
      }
    }
  }

  const total = studentMissing + adultMissing
  return {
    blocking: true,
    anomalies: total,
    items: cap(items),
    summary: total === 0
      ? 'Chaque participant a ses bulletins pour toutes les périodes.'
      : `${total} participant(s) avec des bulletins manquants.`,
  }
}

// ─── 5. Temps de présence (avertissement) : personnel sans saisie ───────────
export async function auditTempsPresence(supabase: any, ctx: YearCtx): Promise<AuditResult> {
  const { data: staff } = await supabase
    .from('profiles').select('id, first_name, last_name')
    .eq('etablissement_id', ctx.etablissementId)
    .in('role', ['direction', 'comptable', 'secretaire', 'responsable_pedagogique', 'enseignant'])

  let q = supabase.from('staff_time_entries').select('profile_id')
  if (ctx.startDate) q = q.gte('entry_date', ctx.startDate)
  if (ctx.endDate) q = q.lte('entry_date', ctx.endDate)
  const { data: entries } = await q
  const withEntries = new Set((entries ?? []).map((e: any) => e.profile_id))

  const noEntry = (staff ?? []).filter((s: any) => !withEntries.has(s.id))
  return {
    blocking: false,
    anomalies: noEntry.length,
    items: cap(noEntry.map((s: any) => ({ label: nom(s.last_name, s.first_name), detail: 'aucune saisie sur l’année', href: '/dashboard/temps-presence' }))),
    summary: noEntry.length === 0
      ? 'Tout le personnel a au moins une saisie de présence.'
      : `${noEntry.length} membre(s) du personnel sans aucune saisie.`,
  }
}

// ─── 6. Financements (avertissement) : foyers non soldés + trop-perçus ──────
export async function auditFinancements(supabase: any, ctx: YearCtx): Promise<AuditResult> {
  const fin = await getFamilyFinancials(supabase, {
    id: ctx.yearId, label: ctx.yearLabel, start_date: ctx.startDate, end_date: ctx.endDate,
  })
  const debtors = fin.rows.filter(r => r.remaining > 0).sort((a, b) => b.remaining - a.remaining)
  const overpaid = fin.rows.filter(r => r.remaining < 0)

  const parts: string[] = []
  if (debtors.length > 0) parts.push(`${debtors.length} foyer(s) débiteur(s) · reste ${eur(fin.kpi.outstanding)}`)
  if (overpaid.length > 0) parts.push(`${overpaid.length} trop-perçu(s)`)

  return {
    blocking: false,
    anomalies: debtors.length,
    items: cap(debtors.map(r => ({ label: r.parentLabel, detail: `reste ${eur(r.remaining)}`, href: '/dashboard/financements/reglements' }))),
    summary: parts.length === 0 ? 'Tous les foyers sont soldés.' : parts.join(' · ') + '.',
  }
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────
const AUDITS: Record<string, (supabase: any, ctx: YearCtx) => Promise<AuditResult>> = {
  affectations:   auditAffectations,
  absences:       auditAbsences,
  notes:          auditNotes,
  bulletins:      auditBulletins,
  temps_presence: auditTempsPresence,
  financements:   auditFinancements,
}

export async function runAuditFor(stepKey: string, supabase: any, ctx: YearCtx): Promise<AuditResult> {
  const fn = AUDITS[stepKey]
  if (!fn) return { blocking: false, anomalies: 0, items: [], summary: 'Audit inconnu.' }
  return fn(supabase, ctx)
}
