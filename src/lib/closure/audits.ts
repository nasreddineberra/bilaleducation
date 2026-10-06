// Moteur d'audit de cloture d'annee (serveur).
// Une fonction par etape → { blocking, anomalies, items[], summary }.
// Les liens `href` renvoient vers le module pour corriger.

import { getFamilyFinancials } from '@/lib/financements/family-financials'
import { classInfoOf } from '@/components/dashboard/classInfo'
// La REGLE DE PRESENTATION vit a part : un module feuille, sans alias `@/`,
// donc eprouvable par `node --test` (ce fichier ne l'est pas, il interroge la base).
import { ordonnerAnomalies, type AuditItem } from './ordre'
export type { AuditItem }

export interface AuditResult {
  blocking: boolean
  anomalies: number
  items: AuditItem[]
  summary: string
  /**
   * Nombre de recapitulatifs `family_fees` perimes, donc REPARABLES d un clic
   * (audit « financements » seul). L ecran s en sert pour decider d afficher le
   * bouton — plutot que de deviner en lisant le texte des items, ce qui casserait
   * a la premiere reformulation.
   */
  aRafraichir?: number
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

function eur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
function nom(last?: string | null, first?: string | null): string {
  return `${last ?? ''} ${first ?? ''}`.trim() || '(sans nom)'
}

/**
 * Le lien « Corriger » d'un foyer, qui OUVRE sa fiche de reglement.
 *
 * `reglements/page.tsx` lit `?parent=` et le passe en `initialParentId` : la
 * capacite existait, l'audit ne s'en servait pas et deposait tout le monde sur
 * la meme page vide.
 */
function lienFoyer(parentId: string): string {
  return `/dashboard/financements/reglements?parent=${parentId}`
}

// ─── 1. Affectations (bloquant) : participants sans classe de l'annee ───────
//
// ELEVES **ET** ADULTES. L'audit ne regardait que `students` : un adulte inscrit
// aux cours mais jamais affecte passait donc INVISIBLE d'un bout a l'autre de la
// cloture — sans classe, il n'a ni evaluation a noter, ni bulletin attendu, ni
// cotisation facturee, si bien que les cinq autres audits se taisaient aussi.
// C'est precisement l'audit cense l'attraper qui l'ignorait.
export async function auditAffectations(supabase: any, ctx: YearCtx): Promise<AuditResult> {
  const [{ data: activeStudents }, { data: enrolled }, { data: parents }, { data: adultEnrolled }] = await Promise.all([
    supabase.from('students').select('id, first_name, last_name, student_number')
      .eq('is_active', true).eq('etablissement_id', ctx.etablissementId),
    supabase.from('enrollments').select('student_id, classes!inner(academic_year)')
      .eq('status', 'active').eq('classes.academic_year', ctx.yearLabel),
    // Le vivier des adultes, tel que le construit l'ecran « Affectations adultes » :
    // un tuteur coche « inscrit aux cours adultes ».
    supabase.from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor1_adult_courses, tutor2_last_name, tutor2_first_name, tutor2_adult_courses')
      .eq('etablissement_id', ctx.etablissementId),
    supabase.from('parent_class_enrollments').select('parent_id, tutor_number, classes!inner(academic_year)')
      .eq('status', 'active').eq('classes.academic_year', ctx.yearLabel),
  ])

  // ── Eleves ──
  const affected = new Set((enrolled ?? []).map((e: any) => e.student_id))
  const unassigned = (activeStudents ?? []).filter((s: any) => !affected.has(s.id))

  // ── Adultes ── (cle participant unifiee : `parentId-tutorNumber`)
  const adultAffected = new Set((adultEnrolled ?? []).map((e: any) => `${e.parent_id}-${e.tutor_number}`))
  const adultesNonAffectes: { label: string }[] = []
  for (const p of (parents ?? []) as any[]) {
    if (p.tutor1_adult_courses && !adultAffected.has(`${p.id}-1`)) {
      adultesNonAffectes.push({ label: nom(p.tutor1_last_name, p.tutor1_first_name) })
    }
    if (p.tutor2_adult_courses && p.tutor2_last_name && !adultAffected.has(`${p.id}-2`)) {
      adultesNonAffectes.push({ label: nom(p.tutor2_last_name, p.tutor2_first_name) })
    }
  }

  const total = unassigned.length + adultesNonAffectes.length
  const parts: string[] = []
  if (unassigned.length > 0) parts.push(`${unassigned.length} élève(s) actif(s) sans classe`)
  if (adultesNonAffectes.length > 0) parts.push(`${adultesNonAffectes.length} adulte(s) inscrit(s) aux cours sans classe`)

  return {
    blocking: true,
    anomalies: total,
    items: ordonnerAnomalies([
      ...unassigned.map((s: any) => ({
        label: nom(s.last_name, s.first_name),
        detail: s.student_number ?? 'Non affecté',
        href: '/dashboard/affectation',
      })),
      ...adultesNonAffectes.map(a => ({
        label: `${a.label} (adulte)`,
        detail: 'Non affecté',
        href: '/dashboard/affectation/adultes',
      })),
    ]),
    summary: total === 0
      ? 'Tous les participants actifs sont affectés à une classe de l’année.'
      : parts.join(' · ') + ' cette année.',
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
  // ── Adultes ──
  // Leur assiduité vit dans `adult_absences` : `absences.student_id` pointe vers
  // `students`, un tuteur ne peut pas y figurer. Sans ce second volet, l'audit
  // déclarerait « aucune absence en attente » sur des cours adultes entiers.
  const { data: absA } = await supabase
    .from('adult_absences')
    .select('parent_id, tutor_number, period_id, parents:parent_id(tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name), classes:class_id(name, level, day_of_week, start_time, end_time, cotisation_types:cotisation_type_id(label), class_teachers(is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name)))')
    .in('period_id', ctx.periodIds).eq('is_justified', false).eq('absence_type', 'absence')

  for (const a of (absA ?? []) as any[]) {
    const cle = `${a.parent_id}-${a.tutor_number}`
    const nomA = a.tutor_number === 2
      ? nom(a.parents?.tutor2_last_name, a.parents?.tutor2_first_name)
      : nom(a.parents?.tutor1_last_name, a.parents?.tutor1_first_name)
    const cur = byStudent.get(cle) ?? { name: `${nomA} (adulte)`, count: 0, perPeriod: new Map<string, number>(), cls: a.classes }
    cur.count++
    cur.perPeriod.set(a.period_id, (cur.perPeriod.get(a.period_id) ?? 0) + 1)
    byStudent.set(cle, cur)
  }

  // Plus de tri par nombre d'absences : `runAuditFor` ordonne par libelle.
  const list = [...byStudent.values()]
  const total = (abs ?? []).length + (absA ?? []).length

  // Detail par periode, dans l'ordre des periodes de l'annee (ex. « S1 : 1 · S2 : 2 »).
  const perPeriodLabel = (m: Map<string, number>) =>
    ctx.periodIds.filter(pid => m.has(pid)).map(pid => `${ctx.periodLabels[pid] ?? '?'} : ${m.get(pid)}`).join(' · ')

  return {
    blocking: false,
    anomalies: total,
    items: ordonnerAnomalies(list.map(s => ({
      label: s.name,
      className: s.cls?.name,
      classInfo: classInfoOf(s.cls),
      detail: `${s.count} non justifiée(s) · ${perPeriodLabel(s.perPeriod)}`,
      href: '/dashboard/absences',
    }))),
    summary: total === 0
      ? 'Aucune absence non justifiée en attente.'
      : `${total} absence(s) non justifiée(s) · ${list.length} participant(s).`,
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
    items: ordonnerAnomalies(items),
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

  // Cet audit est la GARANTIE sur laquelle s'appuie l'archivage de cloture :
  // celui-ci n'agrege plus que des bulletins, il faut donc qu'ils existent tous.
  const total = studentMissing + adultMissing
  const parts: string[] = []
  if (studentMissing > 0) parts.push(`${studentMissing} élève(s)`)
  if (adultMissing > 0) parts.push(`${adultMissing} adulte(s)`)

  return {
    blocking: true,
    anomalies: total,
    items: ordonnerAnomalies(items),
    summary: total === 0
      ? 'Élèves et adultes ont tous leurs bulletins archivés, sur toutes les périodes.'
      : `Bulletins manquants : ${parts.join(' · ')}.`,
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
    items: ordonnerAnomalies(noEntry.map((s: any) => ({ label: nom(s.last_name, s.first_name), detail: 'aucune saisie sur l’année', href: '/dashboard/temps-presence' }))),
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
  // Plus de tri par montant : `runAuditFor` ordonne par libelle. `fin.rows` est
  // deja alphabetique, mais on ne s'appuie pas dessus — le tri central fait foi.
  const debtors = fin.rows.filter(r => r.remaining > 0)
  const overpaid = fin.rows.filter(r => r.remaining < 0)

  // ── SECOND VOLET : les recapitulatifs PERIMES ────────────────────────────
  //
  // Motif du 9 aout, ou l'audit « Absences » a reçu un second volet plutot
  // qu'une etape de plus : meme module, meme preoccupation.
  //
  // `family_fees.total_due` n'est reecrit qu'a l'occasion d'une ecriture
  // (paiement, ajustement). Si les inscriptions d'un foyer changent et que rien
  // ne suit, il reste sur l'ancienne valeur. L'ecran ne le montre pas — il
  // recalcule pour l'annee en cours — mais DES LA BASCULE c'est le stocke qui
  // fait foi : `reglements/page.tsx` ne charge plus les inscriptions des annees
  // passees, et « le vif prime » y fait gagner la ligne `family_fees` MEME sur
  // l'archive. Un montant perime devient donc ce qui est reclame, durablement.
  //
  // C'est le seul endroit de l'application d'ou cet ecart est visible : nulle
  // part ailleurs on ne compare le vivant au stocke.
  const perimes = fin.rows.filter(r =>
    r.storedDue !== null && Math.abs(r.storedDue - r.totalDue) >= 0.01)

  // Sans ligne du tout : l'ARCHIVE les rattrape (elle construit ses lignes
  // depuis les inscriptions, pas depuis `family_fees`). On les signale donc
  // sans les compter en anomalie — le risque n'existe que pour une annee qui
  // ne serait jamais archivee.
  //
  // ── ET ON NE LES LISTE PAS A PART ────────────────────────────────────────
  //
  // Un foyer sans dossier n'a aucun versement enregistre, donc `remaining`
  // vaut tout son du : il est TOUJOURS deja dans `debtors`. Les deux listes se
  // recouvrent entierement, et la premiere version affichait donc la meme
  // famille DEUX FOIS, avec le meme montant (vu a l'ecran le 06/10). La
  // mention rejoint la ligne de debiteur au lieu d'en creer une seconde.
  const sansDossier = fin.rows.filter(r => r.storedDue === null && r.totalDue > 0)
  const sansDossierIds = new Set(sansDossier.map(r => r.parentId))

  const parts: string[] = []
  if (debtors.length > 0) parts.push(`${debtors.length} foyer(s) débiteur(s) · reste ${eur(fin.kpi.outstanding)}`)
  if (overpaid.length > 0) parts.push(`${overpaid.length} trop-perçu(s)`)
  if (perimes.length > 0)  parts.push(`${perimes.length} récapitulatif(s) à rafraîchir`)
  if (sansDossier.length > 0) parts.push(`${sansDossier.length} foyer(s) sans dossier ouvert`)

  return {
    blocking: false,
    // Les perimes COMPTENT comme anomalies : c'est ce qui les rend reparables
    // depuis l'ecran, et ce qui empeche de cloturer sans les avoir vus.
    anomalies: debtors.length + perimes.length,
    aRafraichir: perimes.length,
    // « Corriger » MENE AU FOYER, pas au module. L'ecran accepte `?parent=`
    // depuis toujours (`reglements/page.tsx`), le lien ne s'en servait pas :
    // l'audit nommait sept familles et chaque clic deposait sur la meme page,
    // devant « Selectionnez une famille ». Signale a l'ecran le 06/10.
    items: ordonnerAnomalies([
      ...perimes.map(r => ({
        label: r.parentLabel,
        detail: `montant enregistré ${eur(r.storedDue!)} au lieu de ${eur(r.totalDue)} · à rafraîchir`,
        href: lienFoyer(r.parentId),
      })),
      ...debtors.map(r => ({
        label: r.parentLabel,
        detail: sansDossierIds.has(r.parentId)
          ? `reste ${eur(r.remaining)} · aucun dossier ouvert (l’archivage le couvre)`
          : `reste ${eur(r.remaining)}`,
        href: lienFoyer(r.parentId),
      })),
    ]),
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
