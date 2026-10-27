import type { SupabaseClient } from '@supabase/supabase-js'
import type { JourFerie, VacationPeriod } from '@/types/database'
import { intitulePropre } from '@/lib/edt/intitule'
import { compterBaseFacturable } from '@/lib/tenant/base-facturable'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import { nomEnseignantCivilite } from '@/lib/teachers/nom'
import { seanceDeClasse } from '@/components/dashboard/classInfo'
import { seancesDuJour, statutSeance, ensembleValidations, type SlotSource, type ExceptionSource } from './seances'
import type { AnneeRef, SeanceAffichee } from './direction'
import type { ClasseRemplissage } from '@/components/dashboard/tdb'

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
  supabase: SupabaseClient,
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
      ? supabase.from('classes').select('id, name, max_students, day_of_week, start_time, end_time, cotisation_types(is_adult), class_teachers(is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name))').eq('academic_year', annee.label).order('name')
      : Promise.resolve({ data: [] }),
    annee
      ? supabase.from('schedule_slots')
          .select('id, class_id, teacher_id, day_of_week, start_time, end_time, slot_type, is_recurring, slot_date, effective_from, effective_until, is_active, cours(nom_fr), libelle, unites_enseignement(nom_fr)')
          .eq('school_year_id', annee.id).eq('is_active', true)
      : Promise.resolve({ data: [] }),
    supabase.from('teachers').select('id, user_id, is_active, civilite, first_name, last_name'),
    supabase.from('students').select('id, first_name, last_name, student_number, created_at').eq('is_active', true),
    annee
      ? supabase.from('enrollments').select('student_id, class_id, classes!inner(academic_year)').eq('status', 'active').eq('classes.academic_year', annee.label)
      : Promise.resolve({ data: [] }),
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

  const vacations = ((anneeRes as any).data?.vacations ?? []) as VacationPeriod[]
  const feries = ((anneeRes as any).data?.jours_feries ?? []) as JourFerie[]
  const fermeAujourdhui = jourFerme(aujourdhui, vacations, feries)

  const classesList = ((classesRes as any).data ?? []) as any[]
  const nomClasse = new Map(classesList.map(c => [c.id as string, c.name as string]))
  const slotsRaw = ((slotsRes as any).data ?? []) as any[]
  const slots = slotsRaw as SlotSource[]
  const slotIds = slots.map(s => s.id)
  const teachers = ((teachersRes as any).data ?? []) as any[]
  const teacherParId = new Map(teachers.map(t => [t.id, t]))
  const docKeys = (((docConfigsRes as any).data ?? []) as any[]).map(d => d.doc_key)
  const eleves = ((elevesRes as any).error ? null : ((elevesRes as any).data ?? [])) as any[] | null

  // ── Vague 2 ────────────────────────────────────────────────────────────────
  const [exceptionsRes, validationsRes, docsRes] = await Promise.all([
    slotIds.length
      ? supabase.from('schedule_exceptions').select('schedule_slot_id, exception_date, exception_type, override_start_time, override_end_time, override_teacher_id').in('schedule_slot_id', slotIds).eq('exception_date', aujourdhui)
      : Promise.resolve({ data: [] }),
    slotIds.length
      ? supabase.from('schedule_validations').select('schedule_slot_id, validation_date').in('schedule_slot_id', slotIds).eq('validation_date', aujourdhui)
      : Promise.resolve({ data: [] }),
    docKeys.length ? supabase.from('student_documents').select('student_id, doc_type_key').in('doc_type_key', docKeys) : Promise.resolve({ data: [] }),
  ])

  // ── Effectifs et classe active de chaque eleve ─────────────────────────────
  const inscriptions = ((inscriptionsRes as any).data ?? []) as any[]
  const adultes = ((adultesRes as any).data ?? []) as any[]
  const classeEleve = new Map(inscriptions.map(r => [r.student_id as string, r.class_id as string]))
  const effectif: Record<string, number> = {}
  for (const r of [...inscriptions, ...adultes]) effectif[r.class_id] = (effectif[r.class_id] ?? 0) + 1

  const classes: ClasseRemplissage[] = classesList.map(c => ({
    name: c.name,
    enrolled: effectif[c.id] ?? 0,
    max: c.max_students ?? 30,
    adulte: !!c.cotisation_types?.is_adult,
    professeur: nomEnseignantCivilite(((c.class_teachers ?? []) as any[]).find(ct =>
      ct.is_main_teacher
      && (!ct.effective_from || ct.effective_from <= aujourdhui)
      && (!ct.effective_until || ct.effective_until >= aujourdhui))?.teachers),
    seance: seanceDeClasse(c),
  }))

  const nomEleve = (s: any) => `${s?.last_name ?? ''} ${s?.first_name ?? ''}`.trim()

  // ── Sans classe : eleve actif sans inscription active dans une classe de l'annee ──
  const sansClasse = eleves && !(inscriptionsRes as any).error
    ? eleves.filter(e => !classeEleve.has(e.id))
        .sort((a, b) => nomEleve(a).localeCompare(nomEleve(b)))
        .map(e => ({ id: e.id as string, nom: nomEleve(e) }))
    : null

  // ── Absences ───────────────────────────────────────────────────────────────
  const abs30 = (abs30Res as any).error ? null : (((abs30Res as any).data ?? []) as any[])
  const nbPeriode: Record<string, number> = {}
  for (const a of (((absPeriodeRes as any).data ?? []) as any[])) nbPeriode[a.student_id] = (nbPeriode[a.student_id] ?? 0) + 1
  const absJour = ((absJourRes as any).data ?? []) as any[]
  const absentsDuJour = absJour
    .map(a => ({
      id: a.student_id as string,
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
  const exceptions = ((exceptionsRes as any).data ?? []) as ExceptionSource[]
  const validees = ensembleValidations(((validationsRes as any).data ?? []) as any[])
  const coursParSlot = new Map(slotsRaw.map(s => [s.id, intitulePropre(s)]))
  const nomProf = (id: string | null) => nomEnseignantCivilite(teacherParId.get(id ?? ''))
  const seances: SeanceSecretaire[] = fermeAujourdhui
    ? []
    : seancesDuJour(slots, exceptions, aujourdhui).map(s => ({
        id: s.slotId,
        debut: s.debut,
        fin: s.fin,
        classe: nomClasse.get(s.classId) ?? '',
        cours: coursParSlot.get(s.slotId) ?? null,
        enseignant: nomProf(s.teacherId),
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
    for (const d of (((docsRes as any).data ?? []) as any[])) {
      if (!docsParEleve.has(d.student_id)) docsParEleve.set(d.student_id, new Set())
      docsParEleve.get(d.student_id)!.add(d.doc_type_key)
    }
    fichesIncompletes = eleves.filter(e => docKeys.some(k => !docsParEleve.get(e.id)?.has(k))).length
  }

  // ── Derniers inscrits : eleves (date de creation de la fiche) et adultes ───
  const recentsEleves = (eleves ?? [])
    .map(e => ({
      cle: `e-${e.id}`, id: e.id as string, nom: nomEleve(e), numero: e.student_number ?? null,
      date: String(e.created_at ?? '').slice(0, 10),
      classe: classeEleve.has(e.id) ? nomClasse.get(classeEleve.get(e.id)!) ?? null : null,
      adulte: false,
    }))
  const recentsAdultes = (((recentsAdultesRes as any).data ?? []) as any[]).map(r => {
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

  const n1 = (nouveauxEleves as any).count as number | null
  const n2 = (nouveauxAdultes as any).count as number | null

  return {
    aujourdhui,
    fermeture: fermeAujourdhui ? (fermeAujourdhui.label ?? fermeAujourdhui.titre) : null,
    inscrits,
    foyers: (foyersRes as any).count ?? null,
    nouveauxCeMois: n1 === null || n2 === null ? null : n1 + n2,
    sansClasse,
    elevesActifs: eleves ? eleves.length : null,
    absences30j: abs30 ? { total: abs30.length, nonJustifiees: abs30.filter(a => !a.is_justified).length } : null,
    absentsDuJour,
    seances,
    aTraiter: {
      fichesIncompletes,
      enseignantsSansCompte: (teachersRes as any).error ? null : teachers.filter(t => t.is_active && !t.user_id).length,
    },
    derniersInscrits,
    classes,
  }
}
