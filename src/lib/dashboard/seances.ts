/**
 * LES SEANCES D'UNE JOURNEE, VUES PAR LE TABLEAU DE BORD.
 *
 * Le tableau de bord pose trois questions a l'emploi du temps : « qu'est-ce qui
 * a lieu aujourd'hui », « qu'est-ce qui reste a valider » et « quelle part des
 * presences attendues a ete honoree ». La resolution complete de l'EDT
 * (couleurs, salles, horaires modifies, vue mois) vit dans son composant ; elle
 * n'est pas recopiee ici. Comme `lib/edt/creneaux-du-jour.ts`, ce module ne
 * garde que la question posee — pour TOUTES les classes, la ou l'autre suit un
 * seul enseignant.
 *
 * Module PUR (seul import : la regle « qui assure la seance », pure elle aussi) :
 * les jours fermes, les absences du personnel et les titulaires sont passes en
 * fonctions, ce qui le rend eprouvable par `node --test`.
 * L'enseignant d'une seance est DEDUIT (`lib/edt/seance.ts`), jamais lu sur le
 * creneau.
 * Dates en `AAAA-MM-JJ`, heures en `HH:MM` : la comparaison de chaines est exacte.
 */

import { enseignantDeSeance, salleDeSeance, type TitulaireDe } from '../edt/seance.ts'

export type { TitulaireDe }

export interface SlotSource {
  id: string
  class_id: string
  day_of_week: number | null
  start_time: string
  end_time: string
  slot_type: string
  is_recurring: boolean
  slot_date: string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean
  room_id?: string | null
}

export interface ExceptionSource {
  schedule_slot_id: string
  exception_date: string
  exception_type: string
  remplacant_teacher_id?: string | null
  override_room_id?: string | null
  /** Remplacant d'une absence (`fusionnerDecisions`). */
  remplacant_profil_id?: string | null
}

export interface ValidationSource {
  schedule_slot_id: string
  validation_date: string
}

export type StatutSeance = 'validee' | 'a_valider' | 'en_cours' | 'a_venir' | 'annulee'

export interface Seance {
  slotId: string
  classId: string
  date: string
  debut: string
  fin: string
  slotType: string
  /** Enseignant qui assure REELLEMENT la seance (le remplacant s'il y en a un). */
  teacherId: string | null
  /** Titulaire du creneau. */
  titulaireId: string | null
  remplacement: boolean
  /** Remplacant designe par une absence (`profiles.id`), fiche enseignant ou non. */
  remplacantProfileId: string | null
  annulee: boolean
  /** Salle reellement utilisee ce jour-la (changee pour cette seance, sinon celle du creneau). */
  roomId: string | null
}

function jourSemaine(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** Jour suivant, en composantes locales (jamais `toISOString`). */
export function jourSuivant(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const n = new Date(y, m - 1, d + 1)
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function aLieuCeJour(s: SlotSource, date: string): boolean {
  if (!s.is_active) return false
  if (!s.is_recurring) return s.slot_date === date
  if (s.day_of_week !== jourSemaine(date)) return false
  // Fenetre d'effet : deux creneaux successifs ne sont pas un doublon.
  if (s.effective_from && date < s.effective_from) return false
  if (s.effective_until && date > s.effective_until) return false
  return true
}

/**
 * Seances d'une date, toutes classes confondues, triees par heure de debut.
 * Les seances ANNULEES sont rendues (marquees) : la direction doit les voir.
 */
export function seancesDuJour(
  slots: SlotSource[],
  exceptions: ExceptionSource[],
  titulaireDe: TitulaireDe,
  date: string,
  /** Salle de la classe (« meme salle pour tous les creneaux »), pour la salle de la seance. */
  salleDeClasse: (classId: string) => string | null = () => null,
): Seance[] {
  return slots
    .filter(s => aLieuCeJour(s, date))
    .map(s => {
      const ex = exceptions.find(e => e.schedule_slot_id === s.id && e.exception_date === date)
      const qui = enseignantDeSeance(s.class_id, date, ex, titulaireDe)
      return {
        slotId: s.id,
        classId: s.class_id,
        date,
        debut: s.start_time.slice(0, 5),
        fin: s.end_time.slice(0, 5),
        slotType: s.slot_type,
        teacherId: qui.teacherId,
        titulaireId: qui.titulaireId,
        remplacement: qui.remplacement,
        remplacantProfileId: qui.remplacantProfileId,
        annulee: qui.annulee,
        roomId: salleDeSeance(s, ex, salleDeClasse(s.class_id)),
      }
    })
    .sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin))
}

/**
 * Statut d'une seance a l'instant (`aujourdhui`, `maintenant`).
 * « A valider » = terminee et sans validation ; une seance du jour qui n'est
 * pas finie n'est pas encore en retard.
 */
export function statutSeance(
  s: Seance,
  validees: Set<string>,
  aujourdhui: string,
  maintenant: string,
): StatutSeance {
  if (s.annulee) return 'annulee'
  if (validees.has(cleValidation(s.slotId, s.date))) return 'validee'
  if (s.date < aujourdhui || (s.date === aujourdhui && s.fin <= maintenant)) return 'a_valider'
  if (s.date === aujourdhui && s.debut <= maintenant) return 'en_cours'
  return 'a_venir'
}

export function cleValidation(slotId: string, date: string): string {
  return `${slotId}|${date}`
}

export function ensembleValidations(validations: ValidationSource[]): Set<string> {
  return new Set(validations.map(v => cleValidation(v.schedule_slot_id, String(v.validation_date).slice(0, 10))))
}

/**
 * Seances terminees et non validees entre `du` et `aujourdhui` inclus.
 *
 * Exclues : les jours fermes (vacances, feries), les seances annulees, et
 * celles dont l'enseignant est marque absent — la base refuse de les valider
 * (`guard-presence-absence-exclusivity`), les compter les rendrait eternelles.
 */
export function seancesAValider(
  slots: SlotSource[],
  exceptions: ExceptionSource[],
  titulaireDe: TitulaireDe,
  validations: ValidationSource[],
  du: string,
  aujourdhui: string,
  maintenant: string,
  estFerme: (date: string) => boolean,
  estAbsent: (teacherId: string | null, date: string, debut: string, fin: string) => boolean = () => false,
): Seance[] {
  const validees = ensembleValidations(validations)
  const resultat: Seance[] = []
  for (let date = du; date <= aujourdhui; date = jourSuivant(date)) {
    if (estFerme(date)) continue
    for (const s of seancesDuJour(slots, exceptions, titulaireDe, date)) {
      if (statutSeance(s, validees, aujourdhui, maintenant) !== 'a_valider') continue
      if (estAbsent(s.teacherId, date, s.debut, s.fin)) continue
      resultat.push(s)
    }
  }
  return resultat
}

/**
 * Assiduite des eleves sur une plage : part des presences attendues honorees.
 *
 * Presence attendue = un eleve inscrit dans une classe, un jour ou cette classe
 * a eu cours (jour ouvert, seance non annulee, deja commencee). La feuille
 * d'appel se tient par classe et par jour : deux creneaux le meme jour ne font
 * qu'une presence attendue. Les effectifs sont ceux du jour du calcul — une
 * approximation assumee sur un mois, sans incidence sur l'ordre de grandeur.
 *
 * Rend `null` sans presence attendue : « 100 % » sur une ecole sans cours
 * serait un chiffre invente.
 */
export function tauxAssiduite(
  slots: SlotSource[],
  exceptions: ExceptionSource[],
  titulaireDe: TitulaireDe,
  effectifParClasse: Record<string, number>,
  absences: { student_id: string; class_id: string; absence_date: string }[],
  du: string,
  aujourdhui: string,
  maintenant: string,
  estFerme: (date: string) => boolean,
): { taux: number; attendues: number; absences: number } | null {
  const joursDeClasse = new Set<string>()
  for (let date = du; date <= aujourdhui; date = jourSuivant(date)) {
    if (estFerme(date)) continue
    for (const s of seancesDuJour(slots, exceptions, titulaireDe, date)) {
      if (s.annulee || !(s.classId in effectifParClasse)) continue
      if (date === aujourdhui && s.debut > maintenant) continue
      joursDeClasse.add(`${s.classId}|${date}`)
    }
  }

  let attendues = 0
  for (const cle of joursDeClasse) attendues += effectifParClasse[cle.split('|')[0]] ?? 0
  if (attendues === 0) return null

  // Une absence ne compte que sur un jour de classe retenu, et une seule fois
  // par eleve et par jour.
  const vues = new Set<string>()
  for (const a of absences) {
    const date = String(a.absence_date).slice(0, 10)
    if (!joursDeClasse.has(`${a.class_id}|${date}`)) continue
    vues.add(`${a.student_id}|${a.class_id}|${date}`)
  }
  const nb = Math.min(vues.size, attendues)
  return { taux: Math.round((1 - nb / attendues) * 1000) / 10, attendues, absences: nb }
}

/**
 * Seances touchees par l'absence d'un enseignant entre `du` et `au` inclus.
 *
 * - `a_remplacer` : l'enseignant qui doit ASSURER la seance (le titulaire, ou le
 *   remplacant deja designe) est marque absent ;
 * - `remplacee` : le titulaire est absent et un autre enseignant, present, est
 *   designe sur la seance.
 * Les jours fermes et les seances annulees ne sont pas des absences a traiter.
 */
export function seancesSousAbsence(
  slots: SlotSource[],
  exceptions: ExceptionSource[],
  titulaireDe: TitulaireDe,
  du: string,
  au: string,
  estFerme: (date: string) => boolean,
  estAbsent: (teacherId: string | null, date: string, debut: string, fin: string) => boolean,
): { seance: Seance; statut: 'a_remplacer' | 'remplacee'; absentId: string }[] {
  const resultat: { seance: Seance; statut: 'a_remplacer' | 'remplacee'; absentId: string }[] = []
  for (let date = du; date <= au; date = jourSuivant(date)) {
    if (estFerme(date)) continue
    for (const s of seancesDuJour(slots, exceptions, titulaireDe, date)) {
      if (s.annulee) continue
      if (s.teacherId && estAbsent(s.teacherId, date, s.debut, s.fin)) {
        resultat.push({ seance: s, statut: 'a_remplacer', absentId: s.teacherId })
      } else if (s.remplacement && s.titulaireId && estAbsent(s.titulaireId, date, s.debut, s.fin)) {
        resultat.push({ seance: s, statut: 'remplacee', absentId: s.titulaireId })
      }
    }
  }
  return resultat
}
