import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReglementsShell from '@/components/financements/ReglementsShell'
import { isFinanceRole } from '@/lib/financements/roles'
import { feeStatus } from '@/lib/financements/compute'
import { AlertTriangle } from 'lucide-react'
import { effectiveRole } from '@/lib/auth/effective-role'
import { chargerDeparts } from '@/lib/financements/departs'

export default async function FinancementsPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  const { parent: initialParentId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (!isFinanceRole(effectiveRole(me))) redirect('/dashboard')

  // Année en cours
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date')
    .eq('is_current', true)
    .single()

  if (!currentYear) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in">
        <AlertTriangle size={36} className="text-warm-700" />
        <p className="text-sm text-warm-700">Aucune annee scolaire en cours.</p>
      </div>
    )
  }

  // Parents ayant au moins un élève actif inscrit cette année
  // On récupère : parent info + ses élèves actifs + classe + cotisation_type
  const { data: parents } = await supabase
    .from('parents')
    .select(`
      id,
      tutor1_last_name,
      tutor1_first_name,
      tutor2_last_name,
      tutor2_first_name,
      tutor1_adult_courses,
      tutor2_adult_courses,
      tutor1_relationship,
      tutor2_relationship,
      situation_familiale,
      students!inner (
        id,
        first_name,
        last_name,
        created_at,
        is_active,
        enrollments!inner (
          id,
          status,
          class_id,
          classes!inner (
            id,
            name,
            academic_year,
            cotisation_type_id,
            day_of_week,
            start_time,
            end_time,
            class_teachers (
              is_main_teacher,
              teachers ( civilite, first_name, last_name )
            ),
            cotisation_types (
              id, label, amount, registration_fee, sibling_discount, sibling_discount_same_type, max_installments
            )
          )
        )
      )
    `)
    .eq('students.is_active', true)
    .eq('students.enrollments.status', 'active')
    .eq('students.enrollments.classes.academic_year', currentYear.label)
    .order('tutor1_last_name')
    .order('tutor1_first_name')

  // Inscriptions adultes (cours parents/tuteurs) — BORNEES A L'ANNEE, comme le
  // dossier financier : le passage d'annee conserve les inscriptions actives, sans
  // ce filtre la cotisation de l'an passe s'ajouterait au du de l'annee en cours.
  const { data: adultEnrollments } = await supabase
    .from('parent_class_enrollments')
    .select(`
      parent_id, tutor_number,
      classes!inner (
        id, name, academic_year, day_of_week, start_time, end_time,
        class_teachers (
          is_main_teacher,
          teachers ( civilite, first_name, last_name )
        ),
        cotisation_types (
          id, label, amount, registration_fee, max_installments
        )
      )
    `)
    .eq('status', 'active')
    .eq('classes.academic_year', currentYear.label)

  // Departs de l'annee (inscription `withdrawn`) : l'enfant ou l'adulte parti
  // reste dans le calcul de son foyer, selon la regle de l'ecole.
  const departs = await chargerDeparts(supabase, currentYear)

  // Parents inscrits en cours adultes (ou partis) mais sans élève actif cette année
  const existingParentIds = new Set((parents ?? []).map((p: any) => p.id))
  const adultParentIds = [...new Set([
    ...(adultEnrollments ?? []).map((ae: any) => ae.parent_id),
    ...departs.eleves.map(e => e.parent_id).filter((id): id is string => !!id),
    ...departs.adultes.map(a => a.parent_id),
  ])]
    .filter(id => !existingParentIds.has(id))

  let additionalParents: any[] = []
  if (adultParentIds.length > 0) {
    const { data } = await supabase
      .from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name, tutor1_adult_courses, tutor2_adult_courses, tutor1_relationship, tutor2_relationship, situation_familiale')
      .in('id', adultParentIds)
      .order('tutor1_last_name')
      .order('tutor1_first_name')
    additionalParents = (data ?? []).map(p => ({ ...p, students: [] }))
  }

  // Family fees existants pour cette année
  const { data: familyFees } = await supabase
    .from('family_fees')
    .select(`
      *,
      fee_adjustments (*),
      fee_installments (*)
    `)
    .eq('school_year_id', currentYear.id)
    .order('created_at')

  // Foyers qui ont un dossier de cotisation cette annee mais PLUS AUCUNE inscription
  // active (enfant retire de sa classe, depart en cours d'annee). Sans eux, la
  // famille disparaissait de l'ecran alors que ses paiements restent en base : plus
  // moyen de les voir, de rembourser ni d'etablir une attestation.
  const dejaListes = new Set([...existingParentIds, ...adultParentIds])
  const sansInscriptionIds = [...new Set((familyFees ?? []).map((f: any) => f.parent_id))]
    .filter(id => !dejaListes.has(id))
  let parentsSansInscription: any[] = []
  if (sansInscriptionIds.length > 0) {
    const { data } = await supabase
      .from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name, tutor1_adult_courses, tutor2_adult_courses, tutor1_relationship, tutor2_relationship, situation_familiale')
      .in('id', sansInscriptionIds)
    parentsSansInscription = (data ?? []).map(p => ({ ...p, students: [], sansInscription: true }))
  }

  // Chaque enfant parti rejoint les eleves de son foyer (avec `depart`).
  const allParents = [...(parents ?? []), ...additionalParents, ...parentsSansInscription]
    .map((p: any) => {
      const partis = departs.eleves.filter(e => e.parent_id === p.id)
      return partis.length ? { ...p, students: [...(p.students ?? []), ...partis] } : p
    })
    .sort((a, b) => a.tutor1_last_name.localeCompare(b.tutor1_last_name) || a.tutor1_first_name.localeCompare(b.tutor1_first_name))

  // Historique des communications comptables (relance / attestation) de l'annee.
  const { data: communications } = await supabase
    .from('financement_communications')
    .select('id, parent_id, type, subject, recipients, status, sent_at, sent_by')
    .eq('school_year_id', currentYear.id)
    .order('sent_at', { ascending: false })

  // Mouvements d'inscription de l'annee (affectations, retraits, statut), ecrits
  // par la base elle-meme (`add-mouvements-inscription.sql`). Lecture seule.
  const { data: mouvements } = await supabase
    .from('mouvements_inscription')
    .select('id, parent_id, student_id, tutor_number, class_id, sens, motif, survenu_le, date_effet, classe_nom, auteur_nom, regle, decision, students:student_id(last_name, first_name), parents:parent_id(tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
    .eq('school_year_id', currentYear.id)
    .order('survenu_le', { ascending: false })

  // Departs encore comptes : seuls eux portent un montant et une decision.
  const departsRetenusIds = new Set(
    [...departs.eleves, ...departs.adultes].map(d => d.depart.mouvementId).filter(Boolean),
  )

  // Etablissement (en-tete de l'attestation PDF, identique aux bulletins).
  const { data: etablissement } = await supabase
    .from('etablissements')
    .select('nom, logo_url, adresse, telephone, contact')
    .single()

  // ── 6c : années PASSÉES ──────────────────────────────────────────────────
  // Dettes vives (family_fees != année en cours) + archive (family_year_finance).
  // Règle : on ne paie jamais dans l'archive ; les impayés restent vifs et payables.
  const [{ data: pastFeesRaw }, { data: archiveFin }] = await Promise.all([
    supabase.from('family_fees')
      .select('id, parent_id, school_year_id, total_due, fee_installments(amount_paid, paid_date, payment_method, receipt_number), school_years:school_year_id(label), parents:parent_id(tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
      .neq('school_year_id', currentYear.id),
    supabase.from('family_year_finance').select('parent_id, year_label, total_due, total_paid, remaining, status, installments_json'),
  ])

  const nom = (p: any) => [p?.tutor1_last_name, p?.tutor1_first_name].filter(Boolean).join(' ')
    + (p?.tutor2_last_name ? ` / ${[p.tutor2_last_name, p.tutor2_first_name].filter(Boolean).join(' ')}` : '')

  // Dettes vives par foyer+année (source de vérité)
  type YearEntry = { yearLabel: string; totalDue: number; totalPaid: number; remaining: number; status: string; installments: any[] }
  const liveByKey = new Map<string, { feeId: string; yearId: string; parentLabel: string } & YearEntry>()
  const pastDebts: any[] = []
  for (const f of (pastFeesRaw ?? []) as any[]) {
    const insts = (f.fee_installments ?? [])
    const paid = insts.reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0)
    const totalDue = Number(f.total_due || 0)
    const remaining = totalDue - paid
    const yearLabel = f.school_years?.label ?? '?'
    const parentLabel = nom(f.parents)
    const installments = insts.filter((i: any) => Number(i.amount_paid) > 0)
      .map((i: any) => ({ date: i.paid_date, montant: Number(i.amount_paid), moyen: i.payment_method, reference: i.receipt_number }))
    liveByKey.set(`${f.parent_id}|${yearLabel}`, { feeId: f.id, yearId: f.school_year_id, parentLabel, yearLabel, totalDue, totalPaid: paid, remaining, status: feeStatus(paid, totalDue), installments })
    if (remaining > 0) {
      pastDebts.push({
        feeId: f.id, parentId: f.parent_id, parentLabel, yearId: f.school_year_id, yearLabel,
        totalDue, totalPaid: paid, remaining, installmentCount: insts.length,
      })
    }
  }
  pastDebts.sort((a, b) => (b.yearLabel).localeCompare(a.yearLabel) || b.remaining - a.remaining)

  // Historique par foyer (vif si dispo, sinon archive)
  const familyHistory: Record<string, YearEntry[]> = {}
  const pushEntry = (pid: string, e: YearEntry) => { (familyHistory[pid] ??= []).push(e) }
  const seen = new Set<string>()
  for (const [key, v] of liveByKey) {
    const pid = key.split('|')[0]
    pushEntry(pid, v); seen.add(key)
  }
  for (const a of (archiveFin ?? []) as any[]) {
    const key = `${a.parent_id}|${a.year_label}`
    if (seen.has(key)) continue // le vif prime
    pushEntry(a.parent_id, {
      yearLabel: a.year_label, totalDue: Number(a.total_due || 0), totalPaid: Number(a.total_paid || 0),
      remaining: Number(a.remaining || 0), status: a.status ?? 'pending', installments: a.installments_json ?? [],
    })
  }
  for (const pid of Object.keys(familyHistory)) familyHistory[pid].sort((x, y) => y.yearLabel.localeCompare(x.yearLabel))

  return (
    <div className="h-full animate-fade-in">
      <ReglementsShell
        currentYear={currentYear}
        parents={allParents as any[]}
        adultEnrollments={[...(adultEnrollments ?? []), ...departs.adultes] as any[]}
        familyFees={(familyFees ?? []) as any[]}
        communications={(communications ?? []) as any[]}
        mouvements={((mouvements ?? []) as any[]).map(m => ({ ...m, retenu: departsRetenusIds.has(m.id) }))}
        etablissement={(etablissement ?? null) as any}
        initialParentId={initialParentId}
        familyHistory={familyHistory}
        canDeleteComms={isFinanceRole(effectiveRole(me))}
        pastDebts={pastDebts}
      />
    </div>
  )
}
