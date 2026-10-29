// Donnees de l'ecran Reglements — LECTURES de la page, deplacees ici pour que
// les ecrans (`ReglementsShell`, `FinancementsClient`) tirent leurs types de ces
// requetes (`DonneesReglements`) au lieu de les recopier. Le calcul reste dans
// `compute.ts` ; rien n'est calcule ici hormis l'historique des annees passees.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { ArchivePaiement } from '@/types/json'
import { feeStatus } from './compute'
import { chargerDeparts } from './departs'

export type DonneesReglements = Awaited<ReturnType<typeof chargerReglements>>
export type ParentReglement = DonneesReglements['parents'][number]
export type AdulteReglement = DonneesReglements['adultEnrollments'][number]
export type DossierReglement = DonneesReglements['familyFees'][number]
export type MouvementReglement = DonneesReglements['mouvements'][number]

/** Une annee d'un foyer dans l'historique (vif si dispo, sinon archive). */
export type AnneeFoyer = {
  yearLabel: string
  totalDue: number
  totalPaid: number
  remaining: number
  status: string
  installments: ArchivePaiement[]
}

/** Dette vive d'une annee passee (onglet « Impayes annees precedentes »). */
export type DetteAnterieure = {
  feeId: string
  parentId: string
  parentLabel: string
  yearId: string
  yearLabel: string
  totalDue: number
  totalPaid: number
  remaining: number
  installmentCount: number
}

const PARENT = 'id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name, tutor1_adult_courses, tutor2_adult_courses, tutor1_relationship, tutor2_relationship, situation_familiale' as const

export async function chargerReglements(
  supabase: SupabaseClient<Database>,
  currentYear: { id: string; label: string },
) {
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
            level,
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
        id, name, level, academic_year, day_of_week, start_time, end_time,
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
  const existingParentIds = new Set((parents ?? []).map(p => p.id))
  const adultParentIds = [...new Set([
    ...(adultEnrollments ?? []).map(ae => ae.parent_id),
    ...departs.eleves.map(e => e.parent_id).filter((id): id is string => !!id),
    ...departs.adultes.map(a => a.parent_id),
  ])]
    .filter(id => !existingParentIds.has(id))

  // Foyers ajoutes a ceux qui ont un eleve actif : meme forme, sans eleve.
  type Foyer = Omit<NonNullable<typeof parents>[number], 'students'> & {
    students: NonNullable<typeof parents>[number]['students']
    sansInscription?: boolean
  }
  let additionalParents: Foyer[] = []
  if (adultParentIds.length > 0) {
    const { data } = await supabase
      .from('parents')
      .select(PARENT)
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
  const sansInscriptionIds = [...new Set((familyFees ?? []).map(f => f.parent_id))]
    .filter(id => !dejaListes.has(id))
  let parentsSansInscription: Foyer[] = []
  if (sansInscriptionIds.length > 0) {
    const { data } = await supabase
      .from('parents')
      .select(PARENT)
      .in('id', sansInscriptionIds)
    parentsSansInscription = (data ?? []).map(p => ({ ...p, students: [], sansInscription: true }))
  }

  // Chaque enfant parti rejoint les eleves de son foyer (avec `depart`) ; un
  // enfant present porte `depart: null`.
  const allParents = ([...(parents ?? []), ...additionalParents, ...parentsSansInscription] as Foyer[])
    .map(p => ({
      ...p,
      students: [
        ...(p.students ?? []).map(s => ({ ...s, depart: null })),
        ...departs.eleves.filter(e => e.parent_id === p.id),
      ],
    }))
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

  const nom = (p: { tutor1_last_name: string | null; tutor1_first_name: string | null; tutor2_last_name: string | null; tutor2_first_name: string | null } | null) =>
    [p?.tutor1_last_name, p?.tutor1_first_name].filter(Boolean).join(' ')
    + (p?.tutor2_last_name ? ` / ${[p.tutor2_last_name, p.tutor2_first_name].filter(Boolean).join(' ')}` : '')

  // Dettes vives par foyer+année (source de vérité)
  const liveByKey = new Map<string, { feeId: string; yearId: string; parentLabel: string } & AnneeFoyer>()
  const pastDebts: DetteAnterieure[] = []
  for (const f of pastFeesRaw ?? []) {
    const insts = f.fee_installments ?? []
    const paid = insts.reduce((s, i) => s + Number(i.amount_paid || 0), 0)
    const totalDue = Number(f.total_due || 0)
    const remaining = totalDue - paid
    const yearLabel = f.school_years?.label ?? '?'
    const parentLabel = nom(f.parents)
    const installments = insts.filter(i => Number(i.amount_paid) > 0)
      .map(i => ({ date: i.paid_date, montant: Number(i.amount_paid), moyen: i.payment_method, reference: i.receipt_number }))
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
  const familyHistory: Record<string, AnneeFoyer[]> = {}
  const pushEntry = (pid: string, e: AnneeFoyer) => { (familyHistory[pid] ??= []).push(e) }
  const seen = new Set<string>()
  for (const [key, v] of liveByKey) {
    const pid = key.split('|')[0]
    pushEntry(pid, v); seen.add(key)
  }
  for (const a of archiveFin ?? []) {
    // Foyer supprime depuis (cle remise a NULL) : plus de fiche ou l'afficher.
    if (!a.parent_id) continue
    const key = `${a.parent_id}|${a.year_label}`
    if (seen.has(key)) continue // le vif prime
    pushEntry(a.parent_id, {
      yearLabel: a.year_label, totalDue: Number(a.total_due || 0), totalPaid: Number(a.total_paid || 0),
      remaining: Number(a.remaining || 0), status: a.status ?? 'pending', installments: a.installments_json ?? [],
    })
  }
  for (const pid of Object.keys(familyHistory)) familyHistory[pid].sort((x, y) => y.yearLabel.localeCompare(x.yearLabel))

  return {
    parents: allParents,
    // Un adulte present porte `depart: null`, comme un enfant.
    adultEnrollments: [...(adultEnrollments ?? []).map(ae => ({ ...ae, depart: null })), ...departs.adultes],
    familyFees: familyFees ?? [],
    communications: communications ?? [],
    mouvements: (mouvements ?? []).map(m => ({ ...m, retenu: departsRetenusIds.has(m.id) })),
    etablissement: etablissement ?? null,
    familyHistory,
    pastDebts,
  }
}
