import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { titulaireActuel } from '@/lib/teachers/titulaire'
import { nomCompletEnseignant } from '@/lib/teachers/nom'

/**
 * LECTURES DE L'ESPACE FAMILLE (docs/ESPACE-FAMILLE.md, lot 6). Client SESSION :
 * la base ne rend que le foyer du compte (`foyer_du_compte`, regles du lot 2) ;
 * les tables a donnee interne passent par les fonctions `famille_*`.
 * Formes DEDUITES des requetes, jamais recopiees.
 */
type Client = SupabaseClient<Database>

export type EnfantFamille = Awaited<ReturnType<typeof chargerEnfants>>[number]
export type DevoirFamille = Awaited<ReturnType<typeof chargerDevoirs>>['devoirs'][number]
export type AbsenceFamille = Awaited<ReturnType<typeof chargerAbsences>>[number]

/** Enfants du foyer, leur classe de l'annee et son titulaire en poste. */
export async function chargerEnfants(supabase: Client) {
  const [{ data: enfants }, { data: enseignants }] = await Promise.all([
    supabase.rpc('famille_enfants'),
    supabase.rpc('famille_enseignants'),
  ])
  return (enfants ?? []).map(e => {
    const titulaire = titulaireActuel((enseignants ?? []).filter(t => t.class_id === e.class_id))
    return {
      ...e,
      /** Parti : inactif, ou plus d'affectation active cette annee. */
      parti: !e.is_active || !e.inscription_active,
      titulaire: titulaire ? nomCompletEnseignant(titulaire) : null,
    }
  })
}

/**
 * Devoirs des classes du compte (enfants et cours adultes) et suivi « fait » du
 * foyer. `homework` est ouvert au parent sur `classes_du_compte()` (lot 1).
 */
export async function chargerDevoirs(supabase: Client) {
  const [{ data: devoirs }, { data: suivi }] = await Promise.all([
    supabase
      .from('homework')
      .select('id, class_id, title, subject, homework_type, due_date, description_html, teacher_id, created_at, classes:class_id(name, cotisation_types(is_adult))')
      .order('due_date', { ascending: true }),
    supabase.from('homework_status').select('homework_id, student_id, is_seen, is_done'),
  ])
  return { devoirs: devoirs ?? [], suivi: suivi ?? [] }
}

/**
 * Absences et retards de l'annee : enfants actifs ET cours adulte du tuteur
 * (fusionnes, decision du 03/11), avec leur commentaire. `groupe` = valeur du
 * selecteur (id de l'eleve, ou `moi`).
 */
export async function chargerAbsences(supabase: Client) {
  const COLONNES = 'id, class_id, absence_date, absence_type, is_justified, comment, justification_comment' as const
  const [{ data: enfants }, { data: adulte }] = await Promise.all([
    supabase.from('absences').select(`student_id, ${COLONNES}`),
    supabase.from('adult_absences').select(COLONNES),
  ])
  return [
    ...(enfants ?? []).map(a => ({ ...a, groupe: a.student_id })),
    ...(adulte ?? []).map(a => ({ ...a, groupe: CLE_MOI })),
  ].sort((a, b) => b.absence_date.localeCompare(a.absence_date))
}

/** Un enfant ACTIF, affecte cette annee : seul concerne par devoirs, absences, emploi du temps. */
export function enfantsActifs(enfants: EnfantFamille[]): EnfantFamille[] {
  return enfants.filter(e => !e.parti && !!e.class_id)
}

/**
 * PARTICIPANT de l'espace famille (decision du 03/11 : cours adulte FUSIONNE
 * avec les enfants) : un enfant actif, ou le tuteur connecte inscrit a un cours
 * adulte (« Moi »).
 */
export interface Participant {
  /** Unique : id de l'eleve, ou `moi-<classe>` (un tuteur peut suivre deux cours). */
  cle: string
  /** Valeur du selecteur : id de l'eleve, ou `moi` pour tous ses cours adultes. */
  groupe: string
  adulte: boolean
  /** Libelle court du selecteur : prenom de l'enfant, ou « Moi ». */
  libelle: string
  nom: string
  classId: string
  classeNom: string
  /** Eleve : son id (suivi des devoirs) ; adulte : son foyer et son numero de tuteur. */
  studentId: string | null
  parentId: string | null
  tutorNumber: 1 | 2 | null
}

export const CLE_MOI = 'moi'

/** Cours adulte du tuteur connecte, annee en cours (aucun si non inscrit). */
export async function chargerMonCours(supabase: Client) {
  const [{ data: inscriptions }, { data: classes }, { data: tuteur }, { data: foyer }] = await Promise.all([
    supabase.from('parent_class_enrollments').select('parent_id, tutor_number, class_id, status, classes:class_id(name)').eq('status', 'active'),
    supabase.rpc('classes_du_compte'),
    supabase.rpc('tuteur_du_compte'),
    supabase.rpc('famille_foyer'),
  ])
  const annee = new Set(classes ?? [])
  const moi = (foyer ?? []).find(t => t.tutor_number === tuteur)
  return (inscriptions ?? [])
    .filter(i => annee.has(i.class_id))
    .map(i => ({ ...i, nom: moi ? `${moi.last_name} ${moi.first_name}` : '' }))
}

/** Enfants actifs puis le tuteur s'il suit un cours adulte. */
export function participants(enfants: EnfantFamille[], monCours: Awaited<ReturnType<typeof chargerMonCours>>): Participant[] {
  return [
    ...enfantsActifs(enfants).map(e => ({
      cle: e.id, groupe: e.id, adulte: false, libelle: e.first_name, nom: `${e.last_name} ${e.first_name}`,
      classId: e.class_id as string, classeNom: e.classe_nom ?? '', studentId: e.id, parentId: null, tutorNumber: null,
    })),
    ...monCours.map(c => ({
      cle: `${CLE_MOI}-${c.class_id}`, groupe: CLE_MOI, adulte: true, libelle: 'Moi', nom: c.nom,
      classId: c.class_id, classeNom: c.classes?.name ?? '', studentId: null, parentId: c.parent_id,
      tutorNumber: (c.tutor_number === 2 ? 2 : 1) as 1 | 2,
    })),
  ]
}

/** Options du selecteur : un enfant chacun, « Moi » une fois. */
export function choixParticipants(ps: Participant[]): { valeur: string; libelle: string }[] {
  const vus = new Set<string>()
  return ps.filter(p => !vus.has(p.groupe) && vus.add(p.groupe)).map(p => ({ valeur: p.groupe, libelle: p.libelle }))
}

/** Participants du compte (enfants actifs et cours adulte). */
export async function chargerParticipants(supabase: Client) {
  const [enfants, monCours] = await Promise.all([chargerEnfants(supabase), chargerMonCours(supabase)])
  return { enfants, monCours, participants: participants(enfants, monCours) }
}
