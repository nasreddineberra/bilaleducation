import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { JourFerie, VacationPeriod } from '@/types/database'
import { intitulePropre } from '@/lib/edt/intitule'
import { indexTitulaires, affectationsDesClasses } from '@/lib/edt/seance'
import { compterBaseFacturable } from '@/lib/tenant/base-facturable'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import { nomEnseignantCivilite } from '@/lib/teachers/nom'
import { seanceDeClasse } from '@/components/dashboard/classInfo'
import { seancesDuJour, statutSeance, ensembleValidations, type SlotSource } from './seances'
import type { AnneeRef, SeanceAffichee } from './direction'
import type { ClasseRemplissage } from '@/components/dashboard/tdb'
import { chargerAbsencesFenetre, chargerAlerteAbsences, type AlerteAbsences } from '@/lib/absences-enseignants/tableau-de-bord'

/**
 * DONNEES DU TABLEAU DE BORD SECRETAIRE.
 *
 * Client de SESSION uniquement : la RLS verifie l'ecole ET le role. Aucun
 * chiffre financier.
 *
 * Il n'existe pas d'« appel fait » en base : une feuille d'appel n'ecrit que
 * des absences, et un appel ou tout le monde est present n'ecrit rien. Le
 * tableau de bord montre donc les ABSENTS SAISIS, jamais un appel fait ou non.
 */

export interface SeanceSecretaire extends SeanceAffichee {
  /** Absences saisies aujourd'hui dans la classe (retards exclus). */
  absents: number
}

export interface DonneesSecretaire {
  aujourdhui: string
  fermeture: string | null
  inscrits: { eleves: number; adultes: number; total: number } | null
  foyers: number | null
  nouveauxCeMois: number | null
  sansClasse: { id: string; nom: string }[] | null
  elevesActifs: number | null
  absences30j: { total: number; nonJustifiees: number } | null
  absentsDuJour: { id: string; nom: string; classe: string; justifiee: boolean; retard: boolean; nbPeriode: number }[]
  seances: SeanceSecretaire[]
  aTraiter: {
    fichesIncompletes: number | null
    enseignantsSansCompte: number | null
    /** Absences d'enseignant en cours ou a venir, et leurs seances a decider (lot 3). */
    absencesEnseignants: AlerteAbsences | null
  }
  derniersInscrits: { cle: string; id: string | null; nom: string; numero: string | null; date: string; classe: string | null; adulte: boolean }[]
  classes: ClasseRemplissage[]
}

const cle = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function decaler(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return cle(new Date(y, m - 1, d + n))
}

export async function chargerDonneesSecretaire(
  supabase: SupabaseClient<Database>,
  annee: AnneeRef | null,
  periodeId: string | null,
  aujourdhui: string,
  maintenant: string,
): Promise<DonneesSecretaire> {
  const debutMois = `${aujourdhui.slice(0, 8)}01`
  const [ay, am] = aujourdhui.split('-').map(Number)
  const finMois = cle(new Date(ay, am, 1)) // 1er du mois suivant (exclu)
  const il30j = decaler(aujourdhui, -29)

  // ── Vague 1 ────────────────────────────────────────────────────────────────
  const [
    anneeRes, inscrits, foyersRes, nouveauxEleves, nouveauxAdultes,
    classesRes, slotsRes, teachersRes, elevesRes, inscriptionsRes, adultesRes,
    abs30Res, absJourRes, absPeriodeRes, docConfigsRes, recentsAdultesRes,
  ] = await Promise.all([
    annee ? supabase.from('school_years').select('vacations, jours_feries').eq('id', annee.id).maybeSingle() : Promise.resolve({ data: null }),
    compterBaseFacturable(supabase),
    supabase.from('parents').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('enrollment_date', debutMois).lt('enrollment_date', finMois),
    supabase.from('parent_class_enrollments').select('id', { count: 'exact', head: true }).gte('enrollment_date', debutMois).lt('enrollment_date', finMois),
    annee
      ? supabase.from('classes').select('id, name, max_students, day_of_week, start_time, end_time, cotisation_types(is_adult), class_teachers(teacher_id, is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name))').eq('academic_year', annee.label).order('name')
      : Promise.resolve({ data: [] }),
    annee
      ? supabase.from('schedule_slots')
          .select('id, class_id, day_of_week, start_time, end_time, slot_type, is_recurring, slot_date, effective_from, effective_until, is_active, cours(nom_fr), libelle, unites_enseignement(nom_fr)')
          .eq('school_year_id', annee.id).eq('is_active', true)
      : Promise.resolve({ data: [] }),
    supabase.from('teachers').select('id, user_id, is_active, civilite, first_name, last_name'),
    supabase.from('students').select('id, first_name, last_name, student_number, created_at').eq('is_active', true),
    annee
      ? supabase.from('enrollments').select('student_id, class_id, classes!inner(academic_year)').eq('status', 'active').eq('classes.academic_year', annee.label)
      : Promise.resolve({ data: [], error: null }),
    annee
      ? supabase.from('parent_class_enrollments').select('class_id, classes!inner(academic_year)').eq('status', 'active').eq('classes.academic_year', annee.label)
      : Promise.resolve({ data: [] }),
    supabase.from('absences').select('is_justified').neq('absence_type', 'retard').gte('absence_date', il30j).lte('absence_date', aujourdhui),
    supabase.from('absences').select('student_id, class_id, absence_type, is_justified, students:student_id(first_name, last_name)').eq('absence_date', aujourdhui),
    periodeId
      ? supabase.from('absences').select('student_id').neq('absence_type', 'retard').eq('period_id', periodeId)
      : Promise.resolve({ data: [] }),
    supabase.from('document_type_configs').select('doc_key').eq('is_required', true),
    annee
      ? supabase.from('parent_class_enrollments')
          .select('parent_id, tutor_number, enrollment_date, created_at, class_id, classes!inner(name, academic_year), parents:parent_id(tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
          .eq('status', 'active').eq('classes.academic_year', annee.label)
          .order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
  ])

  const vacations: VacationPeriod[] = (anneeRes.data?.vacations ?? [])
  const feries: JourFerie[] = (anneeRes.data?.jours_feries ?? [])
  const fermeAujourdhui = jourFerme(aujourdhui, vacations, feries)

  const classesList = (classesRes.data ?? [])
  // Qui assure une seance : DEDUIT des titulaires (lib/edt/seance.ts), jamais lu sur le creneau.
  const titulaireDe = indexTitulaires(affectationsDesClasses(classesList))
  const nomClasse = new Map(classesList.map(c => [c.id, c.name]))
  const slotsRaw = (slotsRes.data ?? [])
  const slots: SlotSource[] = slotsRaw
  const slotIds = slots.map(s => s.id)
  const teachers = (teachersRes.data ?? [])
  const teacherParId = new Map(teachers.map(t => [t.id, t]))
  const docKeys = (docConfigsRes.data ?? []).map(d => d.doc_key)
  const eleves = elevesRes.error ? null : (elevesRes.data ?? [])

  // ── Vague 2 ────────────────────────────────────────────────────────────────
  const [exceptionsRes, validationsRes, docsRes, absEns] = await Promise.all([
    slotIds.length
      ? supabase.from('schedule_exceptions').select('schedule_slot_id, exception_date, exception_type').in('schedule_slot_id', slotIds).eq('exception_date', aujourdhui)
      : Promise.resolve({ data: [] }),
    slotIds.length
      ? supabase.from('schedule_validations').select('schedule_slot_id, validation_date').in('schedule_slot_id', slotIds).eq('validation_date', aujourdhui)
      : Promise.resolve({ data: [] }),
    docKeys.length ? supabase.from('student_documents').select('student_id, doc_type_key').in('doc_type_key', docKeys) : Promise.resolve({ data: [] }),
    // Decisions d'absence du jour (lot 3) : qui assure les seances d'aujourd'hui.
    chargerAbsencesFenetre(supabase, slotIds, aujourdhui, aujourdhui),
  ])

  // ── Effectifs et classe active de chaque eleve ─────────────────────────────
  const inscriptions = (inscriptionsRes.data ?? [])
  const adultes = (adultesRes.data ?? [])
  const classeEleve = new Map(inscriptions.map(r => [r.student_id, r.class_id]))
  const effectif: Record<string, number> = {}
  for (const r of [...inscriptions, ...adultes]) effectif[r.class_id] = (effectif[r.class_id] ?? 0) + 1

  const classes: ClasseRemplissage[] = classesList.map(c => ({
    name: c.name,
    enrolled: effectif[c.id] ?? 0,
    max: c.max_students ?? 30,
    adulte: !!c.cotisation_types?.is_adult,
    professeur: nomEnseignantCivilite((c.class_teachers ?? []).find(ct =>
      ct.is_main_teacher
      && (!ct.effective_from || ct.effective_from <= aujourdhui)
      && (!ct.effective_until || ct.effective_until >= aujourdhui))?.teachers),
    seance: seanceDeClasse(c),
  }))

  const nomEleve = (s: { last_name: string | null; first_name: string | null } | null | undefined) => `${s?.last_name ?? ''} ${s?.first_name ?? ''}`.trim()

  // ── Sans classe : eleve actif sans inscription active dans une classe de l'annee ──
  const sansClasse = eleves && !inscriptionsRes.error
    ? eleves.filter(e => !classeEleve.has(e.id))
        .sort((a, b) => nomEleve(a).localeCompare(nomEleve(b)))
        .map(e => ({ id: e.id, nom: nomEleve(e) }))
    : null

  // ── Absences ───────────────────────────────────────────────────────────────
  const abs30 = abs30Res.error ? null : (abs30Res.data ?? [])
  const nbPeriode: Record<string, number> = {}
  for (const a of (absPeriodeRes.data ?? [])) nbPeriode[a.student_id] = (nbPeriode[a.student_id] ?? 0) + 1
  const absJour = (absJourRes.data ?? [])
  const absentsDuJour = absJour
    .map(a => ({
      id: a.student_id,
      nom: nomEleve(a.students),
      classe: nomClasse.get(a.class_id) ?? '',
      justifiee: !!a.is_justified,
      retard: a.absence_type === 'retard',
      nbPeriode: nbPeriode[a.student_id] ?? 0,
    }))
    .sort((a, b) => Number(a.justifiee) - Number(b.justifiee) || a.nom.localeCompare(b.nom))
  const absentsParClasse: Record<string, number> = {}
  for (const a of absJour) if (a.absence_type !== 'retard') absentsParClasse[a.class_id] = (absentsParClasse[a.class_id] ?? 0) + 1

  // ── Journee en cours ───────────────────────────────────────────────────────
  const enseignantDuProfil = (p: string) => teachers.find(t => t.user_id === p)?.id ?? null
  const exceptions = absEns.fusionner(exceptionsRes.data ?? [], enseignantDuProfil)
  const validees = ensembleValidations(validationsRes.data ?? [])
  const coursParSlot = new Map(slotsRaw.map(s => [s.id, intitulePropre(s)]))
  const nomProf = (id: string | null) => nomEnseignantCivilite(teacherParId.get(id ?? ''))
  const seances: SeanceSecretaire[] = fermeAujourdhui
    ? []
    : seancesDuJour(slots, exceptions, titulaireDe, aujourdhui).map(s => ({
        id: s.slotId,
        debut: s.debut,
        fin: s.fin,
        classe: nomClasse.get(s.classId) ?? '',
        cours: coursParSlot.get(s.slotId) ?? null,
        enseignant: nomProf(s.teacherId) || absEns.nomRemplacant(s.remplacantProfileId),
        titulaire: s.remplacement ? nomProf(s.titulaireId) : null,
        effectif: effectif[s.classId] ?? 0,
        statut: statutSeance(s, validees, aujourdhui, maintenant),
        remplacement: s.remplacement,
        absents: absentsParClasse[s.classId] ?? 0,
      }))

  // ── Fiches incompletes : eleves actifs sans tous les documents requis ──────
  let fichesIncompletes: number | null = null
  if (docKeys.length && eleves) {
    const docsParEleve = new Map<string, Set<string>>()
    for (const d of (docsRes.data ?? [])) {
      if (!docsParEleve.has(d.student_id)) docsParEleve.set(d.student_id, new Set())
      docsParEleve.get(d.student_id)!.add(d.doc_type_key)
    }
    fichesIncompletes = eleves.filter(e => docKeys.some(k => !docsParEleve.get(e.id)?.has(k))).length
  }

  // ── Derniers inscrits : eleves (date de creation de la fiche) et adultes ───
  const recentsEleves = (eleves ?? [])
    .map(e => ({
      cle: `e-${e.id}`, id: e.id, nom: nomEleve(e), numero: e.student_number ?? null,
      date: String(e.created_at ?? '').slice(0, 10),
      classe: classeEleve.has(e.id) ? nomClasse.get(classeEleve.get(e.id)!) ?? null : null,
      adulte: false,
    }))
  const recentsAdultes = (recentsAdultesRes.data ?? []).map(r => {
    const p = r.parents
    const nom = r.tutor_number === 2
      ? `${p?.tutor2_last_name ?? ''} ${p?.tutor2_first_name ?? ''}`.trim()
      : `${p?.tutor1_last_name ?? ''} ${p?.tutor1_first_name ?? ''}`.trim()
    return {
      cle: `a-${r.parent_id}-${r.tutor_number}-${r.class_id}`, id: null, nom, numero: null,
      date: String(r.created_at ?? r.enrollment_date ?? '').slice(0, 10),
      classe: r.classes?.name ?? null,
      adulte: true,
    }
  })
  const derniersInscrits = [...recentsEleves, ...recentsAdultes]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)

  const n1 = nouveauxEleves.count
  const n2 = nouveauxAdultes.count

  return {
    aujourdhui,
    fermeture: fermeAujourdhui ? (fermeAujourdhui.label ?? fermeAujourdhui.titre) : null,
    inscrits,
    foyers: foyersRes.count ?? null,
    nouveauxCeMois: n1 === null || n2 === null ? null : n1 + n2,
    sansClasse,
    elevesActifs: eleves ? eleves.length : null,
    absences30j: abs30 ? { total: abs30.length, nonJustifiees: abs30.filter(a => !a.is_justified).length } : null,
    absentsDuJour,
    seances,
    aTraiter: {
      fichesIncompletes,
      enseignantsSansCompte: teachersRes.error ? null : teachers.filter(t => t.is_active && !t.user_id).length,
      absencesEnseignants: await chargerAlerteAbsences(supabase, slots, titulaireDe,
        d => jourFerme(d, vacations, feries) !== null, `${aujourdhui}T${maintenant}`),
    },
    derniersInscrits,
    classes,
  }
}
