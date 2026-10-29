import type { SupabaseClient } from '@supabase/supabase-js'
import type { FeeStatus, JourFerie, VacationPeriod } from '@/types/database'
import { intitulePropre } from '@/lib/edt/intitule'
import { indexTitulaires, affectationsDesClasses } from '@/lib/edt/seance'
import { getFamilyFinancials } from '@/lib/financements/family-financials'
import { compterBaseFacturable } from '@/lib/tenant/base-facturable'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import { nomEnseignantCivilite } from '@/lib/teachers/nom'
import { seanceDeClasse } from '@/components/dashboard/classInfo'
import { chargerAbsencesFenetre, chargerAlerteAbsences, type AlerteAbsences } from '@/lib/absences-enseignants/tableau-de-bord'
import {
  seancesDuJour, statutSeance, seancesAValider, tauxAssiduite, ensembleValidations, jourSuivant,
  type SlotSource, type ExceptionSource, type StatutSeance,
} from './seances'

/**
 * DONNEES DU TABLEAU DE BORD DIRECTION / ADMIN.
 *
 * ┌─ SECURITE : TOUT PASSE PAR LE CLIENT DE SESSION ──────────────────────────┐
 * │ Chaque lecture ci-dessous est soumise a la RLS : l'ecole ET le role sont  │
 * │ verifies par la base, pas par ce fichier. Les compteurs passaient avant   │
 * │ par `getCachedAdminStats` (service-role, sans RLS) : le cloisonnement y   │
 * │ tenait a un filtre ecrit a la main sur chaque requete, et le role n'etait │
 * │ verifie par personne d'autre que la page. Aucune requete ici ne filtre    │
 * │ l'ecole a la main, et aucune n'utilise le client admin.                   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Les comptages `head` rendent `count: null` sans erreur sur une requete
 * impossible : ils sont rendus `null` (affiche « - »), jamais `?? 0`.
 */

export interface AnneeRef {
  id: string
  label: string
  start_date: string | null
  end_date: string | null
}

export interface SeanceAffichee {
  id: string
  debut: string
  fin: string
  classe: string
  cours: string | null
  enseignant: string
  titulaire: string | null
  effectif: number
  statut: StatutSeance
  remplacement: boolean
}

export interface DonneesDirection {
  aujourdhui: string
  fermeture: string | null
  inscrits: { eleves: number; adultes: number; total: number } | null
  limite: number | null
  nouveauxCeMois: number | null
  finances: {
    billed: number
    collected: number
    outstanding: number
    rate: number
    counts: Record<FeeStatus, number>
    familles: number
    mensuel: { key: string; label: string; encaisse: number }[]
  } | null
  assiduite: { taux: number; attendues: number; absences: number } | null
  absencesMois: number | null
  absencesMoisNonJustifiees: number | null
  tendance: { label: string; justified: number; unjustified: number }[]
  aSurveiller: { id: string; nom: string; classe: string; nb: number }[]
  seances: SeanceAffichee[]
  aTraiter: {
    famillesSansPaiement: number | null
    absencesNonJustifiees: number | null
    seancesAValider: number
    evaluationsSansNote: number
    fichesIncompletes: number | null
    /** Absences d'enseignant en cours ou a venir, et leurs seances a decider (lot 3). */
    absencesEnseignants: AlerteAbsences | null
  }
  classes: { name: string; enrolled: number; max: number; adulte: boolean; professeur: string; seance: string }[]
}

const cle = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** `AAAA-MM-JJ` decale de `n` jours, en composantes locales. */
function decaler(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return cle(new Date(y, m - 1, d + n))
}

export async function chargerDonneesDirection(
  supabase: SupabaseClient,
  annee: AnneeRef | null,
  periodeId: string | null,
  aujourdhui: string,
  maintenant: string,
): Promise<DonneesDirection> {
  const debutMois = `${aujourdhui.slice(0, 8)}01`
  const [ay, am] = aujourdhui.split('-').map(Number)
  const finMois = cle(new Date(ay, am, 1)) // 1er du mois suivant (exclu)
  const il30j = decaler(aujourdhui, -29)
  // Fenetre des seances a valider : 30 jours, jamais avant la rentree.
  const duValider = annee?.start_date && annee.start_date > il30j ? annee.start_date : il30j
  // Les exceptions servent aussi a l'assiduite du mois, qui peut commencer un
  // jour avant la fenetre de 30 jours (le 31 du mois).
  const duExceptions = debutMois < duValider ? debutMois : duValider

  // ── Vague 1 : tout ce qui ne depend de rien ────────────────────────────────
  const [
    anneeComplete, etab, inscrits, financials,
    nouveauxEleves, nouveauxAdultes,
    classesRes, slotsRes, teachersRes,
    absMoisRes, absTendanceRes, absNonJustAnRes, absPeriodeRes,
    evalsPeriodeRes, docConfigsRes,
  ] = await Promise.all([
    annee ? supabase.from('school_years').select('vacations, jours_feries').eq('id', annee.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('etablissements').select('max_students').maybeSingle(),
    compterBaseFacturable(supabase),
    annee ? getFamilyFinancials(supabase, annee) : Promise.resolve(null),
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
    supabase.from('teachers').select('id, user_id, civilite, first_name, last_name'),
    supabase.from('absences').select('student_id, class_id, absence_date, is_justified').neq('absence_type', 'retard').gte('absence_date', debutMois).lt('absence_date', finMois),
    supabase.from('absences').select('absence_date, is_justified').neq('absence_type', 'retard').gte('absence_date', il30j).lte('absence_date', aujourdhui),
    annee?.start_date && annee?.end_date
      ? supabase.from('absences').select('id', { count: 'exact', head: true }).eq('is_justified', false).neq('absence_type', 'retard').gte('absence_date', annee.start_date).lte('absence_date', annee.end_date)
      : Promise.resolve({ count: 0 }),
    periodeId
      ? supabase.from('absences').select('student_id, students:student_id(first_name, last_name), classes:class_id(name)').neq('absence_type', 'retard').eq('period_id', periodeId)
      : Promise.resolve({ data: [] }),
    periodeId
      ? supabase.from('evaluations').select('id, class_id').eq('period_id', periodeId).lte('evaluation_date', aujourdhui)
      : Promise.resolve({ data: [] }),
    supabase.from('document_type_configs').select('doc_key').eq('is_required', true),
  ])

  const vacations = ((anneeComplete as any).data?.vacations ?? []) as VacationPeriod[]
  const feries = ((anneeComplete as any).data?.jours_feries ?? []) as JourFerie[]
  const estFerme = (d: string) => jourFerme(d, vacations, feries) !== null
  const fermeAujourdhui = jourFerme(aujourdhui, vacations, feries)

  const classesList = ((classesRes as any).data ?? []) as any[]
  // Qui assure une seance : DEDUIT des titulaires (lib/edt/seance.ts), jamais lu sur le creneau.
  const titulaireDe = indexTitulaires(affectationsDesClasses(classesList))
  const classIds = classesList.map(c => c.id)
  const slotsRaw = ((slotsRes as any).data ?? []) as any[]
  const slots = slotsRaw as SlotSource[]
  const slotIds = slots.map(s => s.id)
  const teachers = ((teachersRes as any).data ?? []) as any[]
  const teacherParId = new Map(teachers.map(t => [t.id, t]))

  // ── Vague 2 : ce qui depend des classes, creneaux et evaluations ───────────
  const evalsPeriode = ((evalsPeriodeRes as any).data ?? []) as any[]
  const evalIds = evalsPeriode.map(e => e.id)
  const docKeys = (((docConfigsRes as any).data ?? []) as any[]).map(d => d.doc_key)

  const [eleves, adultes, exceptionsRes, validationsRes, absEns, notesRes, notesAdultesRes, elevesActifs, docsRes] = await Promise.all([
    classIds.length ? supabase.from('enrollments').select('class_id').eq('status', 'active').in('class_id', classIds) : Promise.resolve({ data: [] }),
    classIds.length ? supabase.from('parent_class_enrollments').select('class_id').eq('status', 'active').in('class_id', classIds) : Promise.resolve({ data: [] }),
    slotIds.length
      ? supabase.from('schedule_exceptions').select('schedule_slot_id, exception_date, exception_type').in('schedule_slot_id', slotIds).gte('exception_date', duExceptions).lte('exception_date', aujourdhui)
      : Promise.resolve({ data: [] }),
    slotIds.length
      ? supabase.from('schedule_validations').select('schedule_slot_id, validation_date').in('schedule_slot_id', slotIds).gte('validation_date', duValider)
      : Promise.resolve({ data: [] }),
    // Absences d'enseignant et leurs decisions (lot 3), plus Temps de presence.
    chargerAbsencesFenetre(supabase, slotIds, duExceptions, aujourdhui),
    evalIds.length ? supabase.from('grades').select('evaluation_id').in('evaluation_id', evalIds) : Promise.resolve({ data: [] }),
    evalIds.length ? supabase.from('adult_grades').select('evaluation_id').in('evaluation_id', evalIds) : Promise.resolve({ data: [] }),
    docKeys.length ? supabase.from('students').select('id').eq('is_active', true) : Promise.resolve({ data: [] }),
    docKeys.length ? supabase.from('student_documents').select('student_id, doc_type_key').in('doc_type_key', docKeys) : Promise.resolve({ data: [] }),
  ])

  // ── Effectifs ──────────────────────────────────────────────────────────────
  const compter = (rows: any[] | null) =>
    (rows ?? []).reduce<Record<string, number>>((m, r) => (m[r.class_id] = (m[r.class_id] ?? 0) + 1, m), {})
  const parClasseEleves = compter((eleves as any).data)
  const parClasseAdultes = compter((adultes as any).data)
  const effectif = (id: string) => (parClasseEleves[id] ?? 0) + (parClasseAdultes[id] ?? 0)

  const classes = classesList.map(c => ({
    name: c.name,
    enrolled: effectif(c.id),
    max: c.max_students ?? 30,
    adulte: !!c.cotisation_types?.is_adult,
    // Titulaire ACTIF aujourd'hui (jour de Paris), comme partout ailleurs.
    professeur: nomEnseignantCivilite(((c.class_teachers ?? []) as any[]).find(ct =>
      ct.is_main_teacher
      && (!ct.effective_from || ct.effective_from <= aujourdhui)
      && (!ct.effective_until || ct.effective_until >= aujourdhui))?.teachers),
    seance: seanceDeClasse(c),
  }))

  // ── Seances ────────────────────────────────────────────────────────────────
  // Decisions d'absence fondues : une seance remplacee ou annulee pour absence
  // se lit comme le reste (lib/edt/seance.ts).
  const enseignantDuProfil = (p: string) => teachers.find(t => t.user_id === p)?.id ?? null
  const exceptions = absEns.fusionner(((exceptionsRes as any).data ?? []) as ExceptionSource[], enseignantDuProfil)
  const validations = ((validationsRes as any).data ?? []) as any[]
  const validees = ensembleValidations(validations)
  const nomClasse = new Map(classesList.map(c => [c.id, c.name]))
  const coursParSlot = new Map(slotsRaw.map(s => [s.id, intitulePropre(s)]))

  const seances: SeanceAffichee[] = fermeAujourdhui
    ? []
    : seancesDuJour(slots, exceptions, titulaireDe, aujourdhui).map(s => ({
        id: s.slotId,
        debut: s.debut,
        fin: s.fin,
        classe: nomClasse.get(s.classId) ?? '',
        cours: coursParSlot.get(s.slotId) ?? null,
        enseignant: nomEnseignantCivilite(teacherParId.get(s.teacherId ?? '')) || absEns.nomRemplacant(s.remplacantProfileId),
        titulaire: s.remplacement ? nomEnseignantCivilite(teacherParId.get(s.titulaireId ?? '')) : null,
        effectif: effectif(s.classId),
        statut: statutSeance(s, validees, aujourdhui, maintenant),
        remplacement: s.remplacement,
      }))

  // Une seance dont le titulaire est absent sans decision ne se valide pas : la
  // compter la rendrait eternelle.
  const aValider = seancesAValider(slots, exceptions, titulaireDe, validations, duValider, aujourdhui, maintenant, estFerme, absEns.estAbsent)
  const absencesEnseignants = await chargerAlerteAbsences(supabase, slots, titulaireDe, estFerme, `${aujourdhui}T${maintenant}`)

  // ── Assiduite du mois (eleves : classes non adultes) ───────────────────────
  const effectifEleves: Record<string, number> = {}
  for (const c of classesList) if (!c.cotisation_types?.is_adult) effectifEleves[c.id] = parClasseEleves[c.id] ?? 0
  const absMois = ((absMoisRes as any).data ?? null) as any[] | null
  const assiduite = tauxAssiduite(slots, exceptions, titulaireDe, effectifEleves, absMois ?? [], debutMois, aujourdhui, maintenant, estFerme)

  // ── Tendance 30 jours ──────────────────────────────────────────────────────
  const parJour: Record<string, { justified: number; unjustified: number }> = {}
  for (const a of (((absTendanceRes as any).data ?? []) as any[])) {
    const k = String(a.absence_date).slice(0, 10)
    parJour[k] ??= { justified: 0, unjustified: 0 }
    if (a.is_justified) parJour[k].justified++
    else parJour[k].unjustified++
  }
  const tendance: DonneesDirection['tendance'] = []
  for (let d = il30j; d <= aujourdhui; d = jourSuivant(d)) {
    tendance.push({ label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, ...(parJour[d] ?? { justified: 0, unjustified: 0 }) })
  }

  // ── Eleves a surveiller : 3 absences et plus sur la periode ────────────────
  const parEleve = new Map<string, { nom: string; classe: string; nb: number }>()
  for (const a of (((absPeriodeRes as any).data ?? []) as any[])) {
    const e = parEleve.get(a.student_id) ?? { nom: `${a.students?.last_name ?? ''} ${a.students?.first_name ?? ''}`.trim(), classe: a.classes?.name ?? '', nb: 0 }
    e.nb++
    parEleve.set(a.student_id, e)
  }
  const aSurveiller = [...parEleve.entries()]
    .filter(([, e]) => e.nb >= 3)
    .sort((a, b) => b[1].nb - a[1].nb || a[1].nom.localeCompare(b[1].nom))
    .slice(0, 4)
    .map(([id, e]) => ({ id, ...e }))

  // ── Evaluations passees sans aucune note ───────────────────────────────────
  const notees = new Set([
    ...(((notesRes as any).data ?? []) as any[]).map(g => g.evaluation_id),
    ...(((notesAdultesRes as any).data ?? []) as any[]).map(g => g.evaluation_id),
  ])
  const evaluationsSansNote = evalsPeriode.filter(e => !notees.has(e.id)).length

  // ── Fiches incompletes : eleves actifs sans tous les documents requis ──────
  let fichesIncompletes: number | null = null
  if (docKeys.length) {
    const actifs = (((elevesActifs as any).data ?? []) as any[]).map(s => s.id)
    const docsParEleve = new Map<string, Set<string>>()
    for (const d of (((docsRes as any).data ?? []) as any[])) {
      if (!docsParEleve.has(d.student_id)) docsParEleve.set(d.student_id, new Set())
      docsParEleve.get(d.student_id)!.add(d.doc_type_key)
    }
    fichesIncompletes = actifs.filter(id => docKeys.some(k => !docsParEleve.get(id)?.has(k))).length
  }

  // ── Finances ───────────────────────────────────────────────────────────────
  // Pas d'echeancier previsionnel : une « echeance » est un paiement enregistre
  // (du = paye). Une serie « attendu » recopiait donc l'encaisse.
  const finances = financials
    ? {
        ...financials.kpi,
        familles: financials.rows.length,
        mensuel: financials.monthly.map(m => ({
          key: m.key,
          label: m.label.split(' ')[0],
          encaisse: m.amount,
        })),
      }
    : null

  // ── Assemblage ─────────────────────────────────────────────────────────────
  const n1 = (nouveauxEleves as any).count as number | null
  const n2 = (nouveauxAdultes as any).count as number | null

  return {
    aujourdhui,
    fermeture: fermeAujourdhui ? (fermeAujourdhui.label ?? fermeAujourdhui.titre) : null,
    inscrits,
    limite: (etab as any).data?.max_students ?? null,
    nouveauxCeMois: n1 === null || n2 === null ? null : n1 + n2,
    finances,
    assiduite,
    absencesMois: absMois ? absMois.length : null,
    absencesMoisNonJustifiees: absMois ? absMois.filter(a => !a.is_justified).length : null,
    tendance,
    aSurveiller,
    seances,
    aTraiter: {
      famillesSansPaiement: financials ? financials.kpi.counts.pending : null,
      absencesNonJustifiees: (absNonJustAnRes as any).count ?? null,
      seancesAValider: aValider.length,
      evaluationsSansNote,
      fichesIncompletes,
      absencesEnseignants,
    },
    classes,
  }
}
