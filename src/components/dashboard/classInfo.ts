// Libelle d'infos de classe : « Civilité NOM Prénom · Cotisation · Niveau · Jour HH:MM-HH:MM »
// L'enseignant = titulaire (is_main_teacher) ACTIF aujourd'hui. NOM avant Prénom (regle app).
// NB : `classes.day_of_week` est une chaine ('monday', ...), pas un smallint.

import { nomCompletEnseignant } from '@/lib/teachers/nom'

/** Ce que les libelles lisent d'une classe : toute ligne `classes` (ou sa jointure) convient. */
type ClasseInfo = {
  level?: string | null
  day_of_week?: string | null
  start_time?: string | null
  end_time?: string | null
  cotisation_types?: { label?: string | null } | null
  class_teachers?: {
    is_main_teacher: boolean | null
    effective_from?: string | null
    effective_until?: string | null
    teachers?: { civilite?: string | null; first_name: string; last_name: string } | null
  }[] | null
} | null | undefined

const DAY_STR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi',
  friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Titulaire actif de la classe (Civilité NOM Prénom), ou '' si aucun. */
function mainTeacherLabel(c: ClasseInfo): string {
  const today = todayKey()
  const ct = (c?.class_teachers ?? []).find(x =>
    x.is_main_teacher &&
    (!x.effective_from || x.effective_from <= today) &&
    (!x.effective_until || x.effective_until >= today)
  )
  return nomCompletEnseignant(ct?.teachers)
}

/**
 * Meme libelle, mais avec le titulaire fourni a part — utile quand il ne vient
 * pas de `class_teachers` imbrique (ex. fiche eleve : prop `mainTeachers`).
 */
export function classInfoWithTeacher(c: ClasseInfo, teacher: string): string {
  if (!c) return ''
  const parts: string[] = []
  if (teacher) parts.push(teacher)
  if (c.cotisation_types?.label) parts.push(c.cotisation_types.label)
  if (c.level) parts.push(`Niveau ${c.level}`)
  const seance = seanceDeClasse(c)
  if (seance) parts.push(seance)
  return parts.join(' · ')
}

/** « Samedi 09:00-12:00 » (jour et horaire de la classe), ou '' s'ils manquent. */
export function seanceDeClasse(c: Pick<NonNullable<ClasseInfo>, 'day_of_week' | 'start_time' | 'end_time'> | null | undefined): string {
  if (!c?.day_of_week || !c?.start_time) return ''
  const day = DAY_STR[c.day_of_week] ?? c.day_of_week
  return `${day} ${c.start_time.slice(0, 5)}${c.end_time ? `-${c.end_time.slice(0, 5)}` : ''}`
}

export function classInfoOf(c: ClasseInfo): string {
  return classInfoWithTeacher(c, mainTeacherLabel(c))
}
