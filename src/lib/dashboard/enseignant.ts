import type { SupabaseClient } from '@supabase/supabase-js'
import type { JourFerie, VacationPeriod } from '@/types/database'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import {
  seancesDuJour, statutSeance, seancesAValider, tauxAssiduite, ensembleValidations, jourSuivant,
  type SlotSource, type ExceptionSource, type StatutSeance, type Seance,
} from './seances'
import type { AnneeRef } from './direction'

/**
 * DONNEES DU TABLEAU DE BORD ENSEIGNANT.
 *
 * ┌─ SECURITE ───────────────────────────────────────────────────────────────┐
 * │ Client de SESSION uniquement : la RLS borne deja l'enseignant a ses      │
 * │ classes (absences, evaluations, notes, eleves, devoirs), a ses propres   │
 * │ validations et a ses propres heures.                                     │
 * │ EXCEPTION VOULUE de la RLS : l'emploi du temps de TOUTE l'ecole lui est  │
 * │ lisible (document collectif, decision du 29/09). Ce fichier filtre donc  │
 * │ explicitement les seances sur l'enseignant qui les assure — le sien, ou  │
 * │ celui qu'il remplace —, comme le fait l'ecran Emploi du temps.           │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

export interface SeanceEnseignant {
  id: string
  classId: string
  date: string
  debut: string
  fin: string
  classe: string
  cours: string | null
  statut: StatutSeance
  remplacement: boolean
}

export interface DonneesEnseignant {
  aujourdhui: string
  /** Aucune fiche enseignant active liee au compte. */
  sansFiche: boolean
  prochaine: (SeanceEnseignant & {
    salle: string | null
    adulte: boolean
    effectif: number
    devoir: string | null
    absentsDerniereFois: number | null
    quand: string
  }) | null
  eleves: number
  seancesAValider: number
  notesASaisir: number
  seancesDuJour: number
  semaine: { date: string; aujourdhui: boolean; ferme: string | null; seances: SeanceEnseignant[] }[]
  classes: { id: string; name: string; titulaire: boolean; adulte: boolean; effectif: number; assiduite: number | null; moyenne: number | null }[]
  devoirs: { id: string; titre: string; classe: string; date: string; jours: number }[]
  aSuivre: { id: string; nom: string; classe: string; motif: string; nb: number | null }[]
  heures: { realiseesMin: number; prevuesMin: number; parType: { label: string; min: number }[] }
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

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const VIDE = (aujourdhui: string, sansFiche: boolean): DonneesEnseignant => ({
  aujourdhui, sansFiche, prochaine: null, eleves: 0, seancesAValider: 0, notesASaisir: 0, seancesDuJour: 0,
  semaine: [], classes: [], devoirs: [], aSuivre: [], heures: { realiseesMin: 0, prevuesMin: 0, parType: [] },
})

export async function chargerDonneesEnseignant(
  supabase: SupabaseClient,
  userId: string,
  annee: AnneeRef | null,
  periodeId: string | null,
  aujourdhui: string,
  maintenant: string,
): Promise<DonneesEnseignant> {
  // Resolution FIABLE : par user_id (et non par email, qui peut diverger).
  const { data: teacher } = await supabase
    .from('teachers').select('id').eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (!teacher || !annee) return VIDE(aujourdhui, !teacher)
  const moi = teacher.id as string

  const debutMois = `${aujourdhui.slice(0, 8)}01`
  const [ay, am] = aujourdhui.split('-').map(Number)
  const finMois = cle(new Date(ay, am, 0)) // dernier jour du mois (inclus)
  const il30j = decaler(aujourdhui, -29)
  const duValider = annee.start_date && annee.start_date > il30j ? annee.start_date : il30j
  const horizon = decaler(aujourdhui, 14)
  const du = debutMois < duValider ? debutMois : duValider
  const au = finMois > horizon ? finMois : horizon

  // ── Vague 1 ────────────────────────────────────────────────────────────────
  const [anneeRes, etabRes, ctRes, slotsRes, typesRes, heuresRes] = await Promise.all([
    supabase.from('school_years').select('vacations, jours_feries').eq('id', annee.id).maybeSingle(),
    supabase.from('etablissements').select('week_start_day').maybeSingle(),
    supabase.from('class_teachers')
      .select('class_id, is_main_teacher, effective_from, effective_until, classes!inner(id, name, academic_year, cotisation_types(is_adult))')
      .eq('teacher_id', moi).eq('classes.academic_year', annee.label),
    supabase.from('schedule_slots')
      .select('id, class_id, teacher_id, day_of_week, start_time, end_time, slot_type, is_recurring, slot_date, effective_from, effective_until, is_active, cours(nom_fr), rooms(name), classes(name, cotisation_types(is_adult)))')
      .eq('school_year_id', annee.id).eq('is_active', true),
    supabase.from('presence_types').select('code, label, is_absence').eq('school_year_id', annee.id),
    // `profile_id` explicite en plus de la RLS : un enseignant qui cumulerait
    // un jour un role de gestion verrait sinon les heures de toute l'equipe.
    supabase.from('staff_time_entries').select('entry_type, entry_date, start_time, end_time, duration_minutes')
      .eq('profile_id', userId).gte('entry_date', du).lte('entry_date', finMois),
  ])

  const vacations = ((anneeRes.data as any)?.vacations ?? []) as VacationPeriod[]
  const feries = ((anneeRes.data as any)?.jours_feries ?? []) as JourFerie[]
  const fermeLabel = (d: string) => {
    const f = jourFerme(d, vacations, feries)
    return f ? (f.label ?? f.titre) : null
  }
  const estFerme = (d: string) => fermeLabel(d) !== null

  // Mes classes AUJOURD'HUI (titulaire ou remplacant, fenetre d'effet).
  const affectations = ((ctRes.data ?? []) as any[]).filter(ct =>
    (!ct.effective_from || ct.effective_from <= aujourdhui) && (!ct.effective_until || ct.effective_until >= aujourdhui))
  const mesClasses = new Map<string, { name: string; titulaire: boolean; adulte: boolean }>()
  for (const ct of affectations) {
    const prev = mesClasses.get(ct.class_id)
    mesClasses.set(ct.class_id, {
      name: ct.classes?.name ?? '',
      titulaire: (prev?.titulaire ?? false) || !!ct.is_main_teacher,
      adulte: !!ct.classes?.cotisation_types?.is_adult,
    })
  }
  const classIds = [...mesClasses.keys()]

  const slotsRaw = (slotsRes.data ?? []) as any[]
  const slots = slotsRaw as SlotSource[]
  const infoSlot = new Map(slotsRaw.map(s => [s.id, s]))
  const types = (typesRes.data ?? []) as any[]
  const codesAbsence = new Set(types.filter(t => t.is_absence).map(t => String(t.code).toUpperCase()))

  // ── Vague 2 ────────────────────────────────────────────────────────────────
  const surMesClasses = classIds.length > 0
  const [exRes, valRes, inscrRes, adultesRes, absRes, evalsRes, devoirsRes] = await Promise.all([
    slots.length
      ? supabase.from('schedule_exceptions')
          .select('schedule_slot_id, exception_date, exception_type, override_start_time, override_end_time, override_teacher_id')
          .in('schedule_slot_id', slots.map(s => s.id)).gte('exception_date', du).lte('exception_date', au)
      : Promise.resolve({ data: [] }),
    // Mes validations seulement (RLS : `profile_id = auth.uid()` pour un enseignant).
    supabase.from('schedule_validations').select('schedule_slot_id, validation_date').eq('profile_id', userId).gte('validation_date', du),
    surMesClasses
      ? supabase.from('enrollments').select('student_id, class_id, enrollment_date, students:student_id(first_name, last_name)').eq('status', 'active').in('class_id', classIds)
      : Promise.resolve({ data: [] }),
    surMesClasses
      ? supabase.from('parent_class_enrollments').select('class_id').eq('status', 'active').in('class_id', classIds)
      : Promise.resolve({ data: [] }),
    surMesClasses
      ? supabase.from('absences').select('student_id, class_id, absence_date, period_id, students:student_id(first_name, last_name)')
          .neq('absence_type', 'retard').in('class_id', classIds).gte('absence_date', annee.start_date ?? du)
      : Promise.resolve({ data: [] }),
    surMesClasses && periodeId
      ? supabase.from('evaluations').select('id, class_id, max_score, evaluation_date').eq('period_id', periodeId).in('class_id', classIds)
      : Promise.resolve({ data: [] }),
    surMesClasses
      ? supabase.from('homework').select('id, title, due_date, class_id').in('class_id', classIds).gte('due_date', aujourdhui).order('due_date').limit(4)
      : Promise.resolve({ data: [] }),
  ])

  const exceptions = (exRes.data ?? []) as ExceptionSource[]
  const validations = (valRes.data ?? []) as any[]
  const validees = ensembleValidations(validations)
  const evals = (evalsRes.data ?? []) as any[]

  // ── Vague 3 : notes des evaluations de la periode ─────────────────────────
  const evalIds = evals.map(e => e.id)
  const [notesRes, notesAdRes] = evalIds.length
    ? await Promise.all([
        supabase.from('grades').select('evaluation_id, score, is_absent').in('evaluation_id', evalIds),
        supabase.from('adult_grades').select('evaluation_id, score, is_absent').in('evaluation_id', evalIds),
      ])
    : [{ data: [] }, { data: [] }]
  const notes = [...((notesRes.data ?? []) as any[]), ...((notesAdRes.data ?? []) as any[])]

  // ── Effectifs ──────────────────────────────────────────────────────────────
  const inscriptions = (inscrRes.data ?? []) as any[]
  const effectif: Record<string, number> = {}
  for (const r of [...inscriptions, ...((adultesRes.data ?? []) as any[])]) effectif[r.class_id] = (effectif[r.class_id] ?? 0) + 1

  // ── Mes seances ────────────────────────────────────────────────────────────
  const absencesMoi = ((heuresRes.data ?? []) as any[]).filter(e => codesAbsence.has(String(e.entry_type).toUpperCase()))
  const jeSuisAbsent = (_t: string | null, date: string, debut: string, fin: string) =>
    absencesMoi.some(a => a.entry_date === date
      && (!a.start_time || !a.end_time || (a.start_time.slice(0, 5) < fin && a.end_time.slice(0, 5) > debut)))

  const miennes = (date: string): Seance[] =>
    estFerme(date) ? [] : seancesDuJour(slots, exceptions, date).filter(s => s.teacherId === moi)

  const versAffichage = (s: Seance): SeanceEnseignant => ({
    id: `${s.slotId}|${s.date}`,
    classId: s.classId,
    date: s.date,
    debut: s.debut,
    fin: s.fin,
    classe: infoSlot.get(s.slotId)?.classes?.name ?? mesClasses.get(s.classId)?.name ?? '',
    cours: infoSlot.get(s.slotId)?.cours?.nom_fr ?? null,
    statut: statutSeance(s, validees, aujourdhui, maintenant),
    remplacement: s.remplacement,
  })

  const aValider = seancesAValider(slots, exceptions, validations, duValider, aujourdhui, maintenant, estFerme, jeSuisAbsent)
    .filter(s => s.teacherId === moi)

  // Prochaine seance : la premiere non annulee qui n'est pas terminee.
  let prochaine: DonneesEnseignant['prochaine'] = null
  for (let d = aujourdhui; d <= horizon && !prochaine; d = jourSuivant(d)) {
    const s = miennes(d).find(x => !x.annulee && (d > aujourdhui || x.fin > maintenant))
    if (!s) continue
    const info = infoSlot.get(s.slotId)
    const devoir = ((devoirsRes.data ?? []) as any[]).find(h => h.class_id === s.classId && h.due_date === d)
    // Absents a la seance precedente de cette classe (derniere date d'appel).
    const datesAbs = ((absRes.data ?? []) as any[]).filter(a => a.class_id === s.classId && a.absence_date < d).map(a => a.absence_date as string)
    const derniere = datesAbs.sort().at(-1) ?? null
    const ecart = ecartJours(aujourdhui, d)
    const quand = d === aujourdhui
      ? (s.debut <= maintenant ? 'En cours' : `Dans ${fmtAttente(minutes(s.debut) - minutes(maintenant))}`)
      : ecart === 1 ? 'Demain' : new Date(`${d}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    prochaine = {
      ...versAffichage(s),
      salle: info?.rooms?.name ?? null,
      adulte: !!(info?.classes?.cotisation_types?.is_adult ?? mesClasses.get(s.classId)?.adulte),
      effectif: effectif[s.classId] ?? 0,
      devoir: devoir?.title ?? null,
      absentsDerniereFois: derniere ? datesAbs.filter(x => x === derniere).length : null,
      quand,
    }
  }

  // Semaine en cours : jours ou j'ai cours, plus aujourd'hui.
  const debutSemaineIdx = Number((etabRes.data as any)?.week_start_day ?? 1)
  const [ty, tm, td] = aujourdhui.split('-').map(Number)
  const dow = new Date(ty, tm - 1, td).getDay()
  const lundi = decaler(aujourdhui, -((dow - debutSemaineIdx + 7) % 7))
  const semaine: DonneesEnseignant['semaine'] = []
  for (let i = 0; i < 7; i++) {
    const d = decaler(lundi, i)
    const seances = miennes(d).map(versAffichage)
    if (seances.length > 0 || d === aujourdhui) {
      semaine.push({ date: d, aujourdhui: d === aujourdhui, ferme: fermeLabel(d), seances })
    }
  }

  // ── Classes : effectif, assiduite du mois, moyenne de la periode ───────────
  const absences = (absRes.data ?? []) as any[]
  const absMois = absences.filter(a => a.absence_date >= debutMois)
  const evalParId = new Map(evals.map(e => [e.id, e]))
  const classes = classIds.map(id => {
    const c = mesClasses.get(id)!
    const t = c.adulte ? null : tauxAssiduite(
      slots.filter(s => s.class_id === id), exceptions, { [id]: effectif[id] ?? 0 },
      absMois.filter(a => a.class_id === id), debutMois, aujourdhui, maintenant, estFerme)
    const sur20 = notes
      .filter(n => evalParId.get(n.evaluation_id)?.class_id === id && !n.is_absent && n.score !== null)
      .map(n => {
        const max = Number(evalParId.get(n.evaluation_id)?.max_score ?? 0)
        return max > 0 ? (Number(n.score) / max) * 20 : null
      })
      .filter((v): v is number => v !== null)
    return {
      id, name: c.name, titulaire: c.titulaire, adulte: c.adulte, effectif: effectif[id] ?? 0,
      assiduite: t ? t.taux : null,
      moyenne: sur20.length ? Math.round((sur20.reduce((s, v) => s + v, 0) / sur20.length) * 10) / 10 : null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  // ── Notes a saisir : evaluations passees de la periode sans aucune note ────
  const notees = new Set(notes.map(n => n.evaluation_id))
  const notesASaisir = evals.filter(e => e.evaluation_date && e.evaluation_date <= aujourdhui && !notees.has(e.id)).length

  // ── Devoirs a venir ───────────────────────────────────────────────────────
  const devoirs = ((devoirsRes.data ?? []) as any[]).map(h => ({
    id: h.id, titre: h.title, classe: mesClasses.get(h.class_id)?.name ?? '', date: h.due_date, jours: ecartJours(aujourdhui, h.due_date),
  }))

  // ── Eleves a suivre : 3 absences et plus sur la periode, nouveaux arrivants ─
  const parEleve = new Map<string, { nom: string; classe: string; nb: number }>()
  for (const a of absences) {
    if (!periodeId || a.period_id !== periodeId) continue
    const e = parEleve.get(a.student_id) ?? { nom: `${a.students?.last_name ?? ''} ${a.students?.first_name ?? ''}`.trim(), classe: mesClasses.get(a.class_id)?.name ?? '', nb: 0 }
    e.nb++
    parEleve.set(a.student_id, e)
  }
  const assidus = [...parEleve.entries()].filter(([, e]) => e.nb >= 3)
    .sort((a, b) => b[1].nb - a[1].nb).slice(0, 4)
    .map(([id, e]) => ({ id, nom: e.nom, classe: e.classe, motif: 'absences sur la période', nb: e.nb }))
  const il21j = decaler(aujourdhui, -21)
  const nouveaux = inscriptions
    .filter(r => r.enrollment_date && r.enrollment_date >= il21j && r.enrollment_date <= aujourdhui)
    .slice(0, 6 - assidus.length)
    .map(r => ({
      id: r.student_id,
      nom: `${r.students?.last_name ?? ''} ${r.students?.first_name ?? ''}`.trim(),
      classe: mesClasses.get(r.class_id)?.name ?? '',
      motif: `arrivé le ${r.enrollment_date.slice(8, 10)}/${r.enrollment_date.slice(5, 7)}`,
      nb: null,
    }))

  // ── Mes heures du mois ────────────────────────────────────────────────────
  const heuresMois = ((heuresRes.data ?? []) as any[]).filter(e => e.entry_date >= debutMois && !codesAbsence.has(String(e.entry_type).toUpperCase()))
  const parType = new Map<string, number>()
  for (const e of heuresMois) {
    const label = types.find(t => String(t.code).toUpperCase() === String(e.entry_type).toUpperCase())?.label ?? e.entry_type
    parType.set(label, (parType.get(label) ?? 0) + Number(e.duration_minutes ?? 0))
  }
  let prevuesMin = 0
  for (let d = debutMois; d <= finMois; d = jourSuivant(d)) {
    for (const s of miennes(d)) if (!s.annulee) prevuesMin += minutes(s.fin) - minutes(s.debut)
  }

  return {
    aujourdhui,
    sansFiche: false,
    prochaine,
    eleves: classes.reduce((s, c) => s + c.effectif, 0),
    seancesAValider: aValider.length,
    notesASaisir,
    seancesDuJour: miennes(aujourdhui).filter(s => !s.annulee).length,
    semaine,
    classes,
    devoirs,
    aSuivre: [...assidus, ...nouveaux],
    heures: {
      realiseesMin: heuresMois.reduce((s, e) => s + Number(e.duration_minutes ?? 0), 0),
      prevuesMin,
      parType: [...parType.entries()].map(([label, min]) => ({ label, min })).sort((a, b) => b.min - a.min),
    },
  }
}

function fmtAttente(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}
