// Departs en cours d'annee — CHARGEMENT PARTAGE.
//
// Un enfant (ou un adulte) qui part garde son inscription, passee en `withdrawn`
// avec sa date (`declarer_depart_*`, `add-depart-en-cours-annee.sql`). Les
// ecrans financiers ne lisaient que les inscriptions ACTIVES : sans ce module,
// sa cotisation disparaissait du du, quelle que soit la regle de l'ecole.
//
// Ce module rend les departs de l'annee DANS LA FORME que ces ecrans lisent deja
// (eleve -> enrollments[0].classes.cotisation_types ; adulte -> classes.
// cotisation_types), avec en plus `depart` : la date, la regle figee au depart
// et la decision « au cas par cas ». Le calcul reste dans `compute.ts`
// (`lignesCotisation`).
//
// Un enfant parti puis REVENU dans l'annee (reaffecte, dans la meme classe ou une
// autre) ne compte qu'une fois : sa classe active prend le relais et le depart
// sort du calcul (il reste dans les mouvements). Parti plusieurs fois : seul le
// DERNIER depart compte. Meme regle pour un adulte (decision du 26/10), cours
// adultes seulement : un adulte reinscrit a un cours ne paie plus celui qu'il a quitte.
//
// La regle vient du MOUVEMENT (`mouvements_inscription`, lu par la direction,
// l'admin et la comptabilite) ; s'il manque, la regle par defaut s'applique
// (`REGLE_PAR_DEFAUT`).

import { REGLE_PAR_DEFAUT, departsRetenus, type DepartLike, type DecisionAjustement, type RegleAjustement } from './compute'

type SB = { from: (table: string) => any }

export interface DepartCharge extends DepartLike {
  /** Id du mouvement « depart » : sert a la decision au cas par cas. */
  mouvementId: string | null
}

export interface EleveParti {
  id: string
  parent_id: string | null
  first_name: string
  last_name: string
  created_at: string | null
  is_active: boolean
  enrollments: any[]
  depart: DepartCharge
}

export interface AdultePartie {
  parent_id: string
  tutor_number: 1 | 2
  classes: any
  depart: DepartCharge
}

const CT = 'id, label, amount, registration_fee, sibling_discount, sibling_discount_same_type, max_installments, is_adult'
const CLASSE = `id, name, level, academic_year, day_of_week, start_time, end_time,
  class_teachers ( is_main_teacher, teachers ( civilite, first_name, last_name ) ),
  cotisation_types ( ${CT} )`

export async function chargerDeparts(
  supabase: SB,
  annee: { id: string; label: string },
): Promise<{ eleves: EleveParti[]; adultes: AdultePartie[] }> {
  const [{ data: enr }, { data: pce }, { data: mvts }, { data: actifs }, { data: adultesActifs }] = await Promise.all([
    supabase.from('enrollments')
      .select(`id, status, class_id, date_depart, students!inner ( id, parent_id, first_name, last_name, created_at, is_active ), classes!inner ( ${CLASSE} )`)
      .eq('status', 'withdrawn')
      .eq('classes.academic_year', annee.label),
    supabase.from('parent_class_enrollments')
      .select(`parent_id, tutor_number, class_id, date_depart, classes!inner ( ${CLASSE} )`)
      .eq('status', 'withdrawn')
      .eq('classes.academic_year', annee.label),
    supabase.from('mouvements_inscription')
      .select('id, student_id, parent_id, tutor_number, class_id, regle, decision, survenu_le')
      .eq('school_year_id', annee.id)
      .eq('motif', 'depart')
      .order('survenu_le', { ascending: false }),
    supabase.from('enrollments')
      .select('student_id, classes!inner ( academic_year )')
      .eq('status', 'active')
      .eq('classes.academic_year', annee.label),
    supabase.from('parent_class_enrollments')
      .select('parent_id, tutor_number, classes!inner ( academic_year, cotisation_types ( is_adult ) )')
      .eq('status', 'active')
      .eq('classes.academic_year', annee.label),
  ])
  const revenus = new Set(((actifs ?? []) as any[]).map(a => a.student_id))
  const tuteur = (a: any) => `${a.parent_id}-${a.tutor_number}`
  const adultesRevenus = new Set(((adultesActifs ?? []) as any[])
    .filter(a => a.classes?.cotisation_types?.is_adult).map(tuteur))

  // Le DERNIER depart de chaque participant dans chaque classe (un enfant parti,
  // revenu puis reparti : seul le dernier compte).
  const mvtPar = new Map<string, any>()
  for (const m of (mvts ?? []) as any[]) {
    const cle = m.student_id ? `e:${m.student_id}:${m.class_id}` : `a:${m.parent_id}-${m.tutor_number}:${m.class_id}`
    if (!mvtPar.has(cle)) mvtPar.set(cle, m)
  }
  const depart = (cle: string, date: string | null): DepartCharge => {
    const m = mvtPar.get(cle)
    return {
      date:        date ?? '',
      regle:       (m?.regle ?? REGLE_PAR_DEFAUT) as RegleAjustement,
      decision:    (m?.decision ?? null) as DecisionAjustement | null,
      mouvementId: m?.id ?? null,
    }
  }

  const eleves: EleveParti[] = departsRetenus((enr ?? []) as any[], e => e.students.id, revenus).map(e => ({
    id:          e.students.id,
    parent_id:   e.students.parent_id,
    first_name:  e.students.first_name,
    last_name:   e.students.last_name,
    created_at:  e.students.created_at,
    is_active:   e.students.is_active,
    enrollments: [{ id: e.id, status: e.status, class_id: e.class_id, classes: e.classes }],
    depart:      depart(`e:${e.students.id}:${e.class_id}`, e.date_depart),
  }))

  const adultes: AdultePartie[] = departsRetenus(
    ((pce ?? []) as any[]).filter(a => a.classes?.cotisation_types?.is_adult), tuteur, adultesRevenus,
  ).map(a => ({
    parent_id:    a.parent_id,
    tutor_number: a.tutor_number,
    classes:      a.classes,
    depart:       depart(`a:${a.parent_id}-${a.tutor_number}:${a.class_id}`, a.date_depart),
  }))

  return { eleves, adultes }
}
