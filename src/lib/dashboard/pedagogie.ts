import type { SupabaseClient } from '@supabase/supabase-js'
import type { JourFerie, VacationPeriod } from '@/types/database'
import { intitulePropre } from '@/lib/edt/intitule'
import { indexTitulaires, affectationsDesClasses } from '@/lib/edt/seance'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import { nomEnseignantCivilite } from '@/lib/teachers/nom'
import {
  seancesDuJour, statutSeance, seancesAValider, tauxAssiduite, ensembleValidations, jourSuivant,
  seancesSousAbsence, type SlotSource, type ExceptionSource,
} from './seances'
import { moyenneSur20, avancementSaisie, type AvancementSaisie, type NoteSaisie } from './notes'
import type { AnneeRef, SeanceAffichee } from './direction'
import { chargerAbsencesFenetre, chargerAlerteAbsences, type AlerteAbsences } from '@/lib/absences-enseignants/tableau-de-bord'

/**
 * DONNEES DU TABLEAU DE BORD RESPONSABLE PEDAGOGIQUE.
 *
 * Client de SESSION uniquement : la RLS verifie l'ecole ET le role (le
 * responsable pedagogique lit notes, absences, bulletins, cahier de texte,
 * emploi du temps et temps de presence de toute l'ecole). Aucun chiffre
 * financier ni cout ici.
 *
 * Les calculs de seances, d'assiduite et de moyenne sont ceux des autres
 * tableaux de bord (`seances.ts`, `notes.ts`) : un seul calcul par chiffre.
 */

export interface SeancePedago extends SeanceAffichee {
  /** Une seance est renseignee au cahier de texte ce jour-la pour la classe. */
  cahier: boolean
}

export interface DonneesPedagogie {
  aujourdhui: string
  fermeture: string | null
  /** Saisie des notes de la periode, toutes classes. */
  saisie: AvancementSaisie | null
  bulletins: { archives: number; effectif: number; appreciations: number } | null
  assiduite: { taux: number; attendues: number; absences: number } | null
  absencesMois: number | null
  absencesMoisNonJustifiees: number | null
  tendance: number[]
  seances: SeancePedago[]
  aTraiter: {
    seancesAValider: number
    evaluationsSansNote: number | null
    evaluationsIncompletes: number | null
    /** Absences d'enseignant en cours ou a venir, et leurs seances a decider (lot 3). */
    absencesEnseignants: AlerteAbsences | null
    classesSansCahier: number
    classesSansEvaluation: number | null
  }
  classes: { id: string; name: string; adulte: boolean; professeur: string; saisie: AvancementSaisie; moyenne: number | null }[]
  aSuivre: {
    absences: { id: string; nom: string; classe: string; nb: number }[]
    moyennes: { id: string; nom: string; classe: string; moyenne: number }[]
  }
  evaluations: { id: string; titre: string; classe: string; date: string; jours: number }[]
  equipe: { cle: string; enseignant: string; date: string; classes: string; statut: 'a_decider' | 'remplacee'; remplacant: string | null }[]
}

const cle = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function decaler(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return cle(new Date(y, m - 1, d + n))
}

function ecartJours(de: string, a: string): number {
  const [y1, m1, d1] = de.split('-').map(Number)
  const [y2, m2, d2] = a.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

/** Moyenne sous laquelle un eleve est signale (sur 20). */
const SEUIL_MOYENNE = 8

export async function chargerDonneesPedagogie(
  supabase: SupabaseClient,
  annee: AnneeRef | null,
  periodeId: string | null,
  aujourdhui: string,
  maintenant: string,
): Promise<DonneesPedagogie> {
  const debutMois = `${aujourdhui.slice(0, 8)}01`
  const il30j = decaler(aujourdhui, -29)
  const il14j = decaler(aujourdhui, -13)
  const dans7j = decaler(aujourdhui, 6)
  const dans14j = decaler(aujourdhui, 14)
  const duValider = annee?.start_date && annee.start_date > il30j ? annee.start_date : il30j
  const duExceptions = [debutMois, duValider, il14j].sort()[0]

  // ── Vague 1 ────────────────────────────────────────────────────────────────
  const [
    anneeRes, classesRes, slotsRes, teachersRes,
    absMoisRes, absTendanceRes, absPeriodeRes, evalsPeriodeRes, evalsAVenirRes, cahierRes,
    archivesRes, archivesAdRes, apprRes, apprAdRes,
  ] = await Promise.all([
    annee ? supabase.from('school_years').select('vacations, jours_feries').eq('id', annee.id).maybeSingle() : Promise.resolve({ data: null }),
    annee
      ? supabase.from('classes').select('id, name, cotisation_types(is_adult), class_teachers(teacher_id, is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name))').eq('academic_year', annee.label).order('name')
      : Promise.resolve({ data: [] }),
    annee
      ? supabase.from('schedule_slots')
          .select('id, class_id, teacher_id, day_of_week, start_time, end_time, slot_type, is_recurring, slot_date, effective_from, effective_until, is_active, cours(nom_fr), libelle, unites_enseignement(nom_fr)')
          .eq('school_year_id', annee.id).eq('is_active', true)
      : Promise.resolve({ data: [] }),
    supabase.from('teachers').select('id, user_id, civilite, first_name, last_name'),
    supabase.from('absences').select('student_id, class_id, absence_date, is_justified').neq('absence_type', 'retard').gte('absence_date', debutMois).lte('absence_date', aujourdhui),
    supabase.from('absences').select('absence_date').neq('absence_type', 'retard').gte('absence_date', il30j).lte('absence_date', aujourdhui),
    periodeId
      ? supabase.from('absences').select('student_id, students:student_id(first_name, last_name), classes:class_id(name)').neq('absence_type', 'retard').eq('period_id', periodeId)
      : Promise.resolve({ data: [] }),
    periodeId
      ? supabase.from('evaluations').select('id, class_id, max_score, evaluation_date').eq('period_id', periodeId)
      : Promise.resolve({ data: [] }),
    supabase.from('evaluations').select('id, title, class_id, evaluation_date').gt('evaluation_date', aujourdhui).lte('evaluation_date', dans14j).order('evaluation_date').limit(12),
    annee?.start_date
      ? supabase.from('class_journal').select('class_id, session_date').gte('session_date', annee.start_date).lte('session_date', aujourdhui)
      : Promise.resolve({ data: [] }),
    periodeId ? supabase.from('bulletin_archives').select('student_id').eq('period_id', periodeId) : Promise.resolve({ data: [] }),
    periodeId ? supabase.from('adult_bulletin_archives').select('parent_id, tutor_number').eq('period_id', periodeId) : Promise.resolve({ data: [] }),
    periodeId ? supabase.from('bulletin_appreciations').select('student_id, appreciation').eq('period_id', periodeId) : Promise.resolve({ data: [] }),
    periodeId ? supabase.from('adult_bulletin_appreciations').select('parent_id, tutor_number, appreciation').eq('period_id', periodeId) : Promise.resolve({ data: [] }),
  ])

  const vacations = ((anneeRes as any).data?.vacations ?? []) as VacationPeriod[]
  const feries = ((anneeRes as any).data?.jours_feries ?? []) as JourFerie[]
  const estFerme = (d: string) => jourFerme(d, vacations, feries) !== null
  const fermeAujourdhui = jourFerme(aujourdhui, vacations, feries)

  const classesList = ((classesRes as any).data ?? []) as any[]
  // Qui assure une seance : DEDUIT des titulaires (lib/edt/seance.ts), jamais lu sur le creneau.
  const titulaireDe = indexTitulaires(affectationsDesClasses(classesList))
  const classIds = classesList.map(c => c.id)
  const nomClasse = new Map(classesList.map(c => [c.id as string, c.name as string]))
  const slotsRaw = ((slotsRes as any).data ?? []) as any[]
  const slots = slotsRaw as SlotSource[]
  const slotIds = slots.map(s => s.id)
  const teachers = ((teachersRes as any).data ?? []) as any[]
  const teacherParId = new Map(teachers.map(t => [t.id, t]))
  const evalsPeriode = ((evalsPeriodeRes as any).data ?? []) as any[]
  const evalIds = evalsPeriode.map(e => e.id)

  // ── Vague 2 ────────────────────────────────────────────────────────────────
  const [elevesRes, adultesRes, exceptionsRes, validationsRes, absEns, notesRes, notesAdRes] = await Promise.all([
    classIds.length
      ? supabase.from('enrollments').select('student_id, class_id, students:student_id(first_name, last_name)').eq('status', 'active').in('class_id', classIds)
      : Promise.resolve({ data: [] }),
    classIds.length ? supabase.from('parent_class_enrollments').select('parent_id, tutor_number, class_id').eq('status', 'active').in('class_id', classIds) : Promise.resolve({ data: [] }),
    slotIds.length
      ? supabase.from('schedule_exceptions').select('schedule_slot_id, exception_date, exception_type, override_start_time, override_end_time, override_teacher_id').in('schedule_slot_id', slotIds).gte('exception_date', duExceptions).lte('exception_date', dans7j)
      : Promise.resolve({ data: [] }),
    slotIds.length
      ? supabase.from('schedule_validations').select('schedule_slot_id, validation_date').in('schedule_slot_id', slotIds).gte('validation_date', duValider)
      : Promise.resolve({ data: [] }),
    // Absences d'enseignant et leurs decisions (lot 3), plus Temps de presence.
    chargerAbsencesFenetre(supabase, slotIds, duExceptions, dans7j),
    evalIds.length ? supabase.from('grades').select('evaluation_id, student_id, score, comment, is_absent').in('evaluation_id', evalIds) : Promise.resolve({ data: [] }),
    evalIds.length ? supabase.from('adult_grades').select('evaluation_id, parent_id, tutor_number, score, comment, is_absent').in('evaluation_id', evalIds) : Promise.resolve({ data: [] }),
  ])

  // ── Effectifs ──────────────────────────────────────────────────────────────
  const inscriptions = ((elevesRes as any).data ?? []) as any[]
  const adultes = ((adultesRes as any).data ?? []) as any[]
  const parClasseEleves: Record<string, number> = {}
  for (const r of inscriptions) parClasseEleves[r.class_id] = (parClasseEleves[r.class_id] ?? 0) + 1
  const parClasseAdultes: Record<string, number> = {}
  for (const r of adultes) parClasseAdultes[r.class_id] = (parClasseAdultes[r.class_id] ?? 0) + 1
  const effectif = (id: string) => (parClasseEleves[id] ?? 0) + (parClasseAdultes[id] ?? 0)

  // ── Absences d'enseignant (lot 3) ──────────────────────────────────────────
  const estAbsent = absEns.estAbsent
  const nomProf = (id: string | null) => nomEnseignantCivilite(teacherParId.get(id ?? ''))
  // Celui qui assure : sa fiche enseignant, sinon le remplacant designe par l'absence.
  const nomAssure = (s: { teacherId: string | null; remplacantProfileId: string | null }) =>
    nomProf(s.teacherId) || absEns.nomRemplacant(s.remplacantProfileId)

  // ── Seances du jour, avec l'etat du cahier de texte ────────────────────────
  // Decisions d'absence fondues (lib/edt/seance.ts).
  const enseignantDuProfil = (p: string) => teachers.find(t => t.user_id === p)?.id ?? null
  const exceptions = absEns.fusionner(((exceptionsRes as any).data ?? []) as ExceptionSource[], enseignantDuProfil)
  const validations = ((validationsRes as any).data ?? []) as any[]
  const validees = ensembleValidations(validations)
  const coursParSlot = new Map(slotsRaw.map(s => [s.id, intitulePropre(s)]))
  const cahier = ((cahierRes as any).data ?? []) as any[]
  const cahierDuJour = new Set(cahier.filter(j => j.session_date === aujourdhui).map(j => j.class_id))

  const seances: SeancePedago[] = fermeAujourdhui
    ? []
    : seancesDuJour(slots, exceptions, titulaireDe, aujourdhui).map(s => ({
        id: s.slotId,
        debut: s.debut,
        fin: s.fin,
        classe: nomClasse.get(s.classId) ?? '',
        cours: coursParSlot.get(s.slotId) ?? null,
        enseignant: nomAssure(s),
        titulaire: s.remplacement ? nomProf(s.titulaireId) : null,
        effectif: effectif(s.classId),
        statut: statutSeance(s, validees, aujourdhui, maintenant),
        remplacement: s.remplacement,
        cahier: cahierDuJour.has(s.classId),
      }))

  const aValider = seancesAValider(slots, exceptions, titulaireDe, validations, duValider, aujourdhui, maintenant, estFerme, estAbsent)

  // ── Assiduite du mois (eleves : classes non adultes) ───────────────────────
  const effectifEleves: Record<string, number> = {}
  for (const c of classesList) if (!c.cotisation_types?.is_adult) effectifEleves[c.id] = parClasseEleves[c.id] ?? 0
  const absMois = ((absMoisRes as any).data ?? null) as any[] | null
  const assiduite = tauxAssiduite(slots, exceptions, titulaireDe, effectifEleves, absMois ?? [], debutMois, aujourdhui, maintenant, estFerme)
  const parJour: Record<string, number> = {}
  for (const a of (((absTendanceRes as any).data ?? []) as any[])) {
    const k = String(a.absence_date).slice(0, 10)
    parJour[k] = (parJour[k] ?? 0) + 1
  }
  const tendance: number[] = []
  for (let d = il30j; d <= aujourdhui; d = jourSuivant(d)) tendance.push(parJour[d] ?? 0)

  // ── Notes de la periode : avancement de la saisie (`notes.ts`) ─────────────
  const notesEleves = ((notesRes as any).data ?? []) as any[]
  const notesAdultes = ((notesAdRes as any).data ?? []) as any[]
  const notes = [...notesEleves, ...notesAdultes]
  const bareme = new Map(evalsPeriode.map(e => [e.id as string, Number(e.max_score ?? 0)]))
  const evalClasse = new Map(evalsPeriode.map(e => [e.id as string, e.class_id as string]))
  const inscritsParClasse = new Map<string, Set<string>>()
  const inscrire = (classe: string, cle: string) => {
    if (!inscritsParClasse.has(classe)) inscritsParClasse.set(classe, new Set())
    inscritsParClasse.get(classe)!.add(cle)
  }
  for (const r of inscriptions) inscrire(r.class_id, r.student_id)
  for (const r of adultes) inscrire(r.class_id, `${r.parent_id}-${r.tutor_number}`)
  const notesSaisie: NoteSaisie[] = [
    ...notesEleves.map(n => ({ evaluation_id: n.evaluation_id, apprenant: n.student_id, score: n.score, comment: n.comment, is_absent: n.is_absent })),
    ...notesAdultes.map(n => ({ evaluation_id: n.evaluation_id, apprenant: `${n.parent_id}-${n.tutor_number}`, score: n.score, comment: n.comment, is_absent: n.is_absent })),
  ]
  const saisie = periodeId ? avancementSaisie(evalsPeriode, notesSaisie, inscritsParClasse, aujourdhui) : null

  // ── Bulletins de la periode ────────────────────────────────────────────────
  const effectifTotal = inscriptions.length + adultes.length
  const rempli = (a: any) => typeof a.appreciation === 'string' && a.appreciation.replace(/<[^>]*>/g, '').trim() !== ''
  const bulletins = periodeId
    ? {
        archives: new Set((((archivesRes as any).data ?? []) as any[]).map(a => a.student_id)).size
          + new Set((((archivesAdRes as any).data ?? []) as any[]).map(a => `${a.parent_id}-${a.tutor_number}`)).size,
        effectif: effectifTotal,
        appreciations: new Set((((apprRes as any).data ?? []) as any[]).filter(rempli).map(a => a.student_id)).size
          + new Set((((apprAdRes as any).data ?? []) as any[]).filter(rempli).map(a => `${a.parent_id}-${a.tutor_number}`)).size,
      }
    : null

  // ── Avancement par classe ──────────────────────────────────────────────────
  const classes = classesList.map(c => {
    const evals = evalsPeriode.filter(e => e.class_id === c.id)
    return {
      id: c.id,
      name: c.name,
      adulte: !!c.cotisation_types?.is_adult,
      professeur: nomEnseignantCivilite(((c.class_teachers ?? []) as any[]).find(ct =>
        ct.is_main_teacher
        && (!ct.effective_from || ct.effective_from <= aujourdhui)
        && (!ct.effective_until || ct.effective_until >= aujourdhui))?.teachers),
      saisie: avancementSaisie(evals, notesSaisie, inscritsParClasse, aujourdhui),
      moyenne: moyenneSur20(notes.filter(n => evalClasse.get(n.evaluation_id) === c.id), bareme),
    }
  })

  // ── A traiter ──────────────────────────────────────────────────────────────
  // Classes qui ont eu cours ces 14 jours sans aucune seance au cahier de texte.
  const cahierRecent = new Set(cahier.filter(j => j.session_date >= il14j).map(j => j.class_id))
  const ontEuCours = new Set<string>()
  for (let d = il14j; d <= aujourdhui; d = jourSuivant(d)) {
    if (estFerme(d)) continue
    for (const s of seancesDuJour(slots, exceptions, titulaireDe, d)) {
      if (!s.annulee && (d < aujourdhui || s.debut <= maintenant)) ontEuCours.add(s.classId)
    }
  }
  const classesSansCahier = [...ontEuCours].filter(id => !cahierRecent.has(id)).length

  // Equipe : seances des 7 prochains jours touchees par une absence.
  // `a_remplacer` de `seancesSousAbsence` = l'absent n'est ni remplace ni excuse
  // de sa seance : elle est « a decider » (lot 3).
  const sousAbsence = seancesSousAbsence(slots, exceptions, titulaireDe, aujourdhui, dans7j, estFerme, estAbsent)
  const parAbsence = new Map<string, DonneesPedagogie['equipe'][number] & { _classes: Set<string> }>()
  for (const { seance: s, statut, absentId } of sousAbsence) {
    const etat = statut === 'a_remplacer' ? 'a_decider' as const : 'remplacee' as const
    const k = `${absentId}|${s.date}|${etat}`
    const e = parAbsence.get(k) ?? {
      cle: k, enseignant: nomProf(absentId), date: s.date, classes: '', statut: etat,
      remplacant: etat === 'remplacee' ? nomAssure(s) : null, _classes: new Set<string>(),
    }
    e._classes.add(nomClasse.get(s.classId) ?? '')
    parAbsence.set(k, e)
  }
  const equipe = [...parAbsence.values()]
    .map(({ _classes, ...e }) => ({ ...e, classes: [..._classes].filter(Boolean).join(', ') }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.statut === b.statut ? 0 : a.statut === 'a_decider' ? -1 : 1))

  // ── Eleves a suivre ────────────────────────────────────────────────────────
  const parEleve = new Map<string, { nom: string; classe: string; nb: number }>()
  for (const a of (((absPeriodeRes as any).data ?? []) as any[])) {
    const e = parEleve.get(a.student_id) ?? { nom: `${a.students?.last_name ?? ''} ${a.students?.first_name ?? ''}`.trim(), classe: a.classes?.name ?? '', nb: 0 }
    e.nb++
    parEleve.set(a.student_id, e)
  }
  const absencesASuivre = [...parEleve.entries()]
    .filter(([, e]) => e.nb >= 3)
    .sort((a, b) => b[1].nb - a[1].nb || a[1].nom.localeCompare(b[1].nom))
    .slice(0, 5)
    .map(([id, e]) => ({ id, ...e }))

  const inscriptionParEleve = new Map(inscriptions.map(r => [r.student_id as string, r]))
  const notesParEleve = new Map<string, any[]>()
  for (const n of notesEleves) {
    if (!notesParEleve.has(n.student_id)) notesParEleve.set(n.student_id, [])
    notesParEleve.get(n.student_id)!.push(n)
  }
  const moyennesASuivre = [...notesParEleve.entries()]
    .map(([id, ns]) => ({ id, moyenne: moyenneSur20(ns, bareme), r: inscriptionParEleve.get(id) }))
    .filter((e): e is { id: string; moyenne: number; r: any } => e.moyenne !== null && e.moyenne < SEUIL_MOYENNE && !!e.r)
    .sort((a, b) => a.moyenne - b.moyenne)
    .slice(0, 5)
    .map(e => ({
      id: e.id,
      nom: `${e.r.students?.last_name ?? ''} ${e.r.students?.first_name ?? ''}`.trim(),
      classe: nomClasse.get(e.r.class_id) ?? '',
      moyenne: e.moyenne,
    }))

  return {
    aujourdhui,
    fermeture: fermeAujourdhui ? (fermeAujourdhui.label ?? fermeAujourdhui.titre) : null,
    saisie,
    bulletins,
    assiduite,
    absencesMois: absMois ? absMois.length : null,
    absencesMoisNonJustifiees: absMois ? absMois.filter(a => !a.is_justified).length : null,
    tendance,
    seances,
    aTraiter: {
      seancesAValider: aValider.length,
      evaluationsSansNote: saisie ? saisie.passeesSansNote : null,
      evaluationsIncompletes: saisie ? saisie.incompletes : null,
      absencesEnseignants: await chargerAlerteAbsences(supabase, slots, titulaireDe, estFerme, `${aujourdhui}T${maintenant}`),
      classesSansCahier,
      classesSansEvaluation: periodeId ? classesList.filter(c => !evalsPeriode.some(e => e.class_id === c.id)).length : null,
    },
    classes,
    aSuivre: { absences: absencesASuivre, moyennes: moyennesASuivre },
    evaluations: (((evalsAVenirRes as any).data ?? []) as any[]).filter(e => nomClasse.has(e.class_id)).map(e => ({
      id: e.id, titre: e.title, classe: nomClasse.get(e.class_id) ?? '', date: e.evaluation_date, jours: ecartJours(aujourdhui, e.evaluation_date),
    })),
    equipe,
  }
}
