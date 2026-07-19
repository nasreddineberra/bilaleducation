// Libelle d'infos de classe : « Civilité NOM Prénom · Cotisation · Niveau · Jour HH:MM-HH:MM »
// L'enseignant = titulaire (is_main_teacher) ACTIF aujourd'hui. NOM avant Prénom (regle app).
// NB : `classes.day_of_week` est une chaine ('monday', ...), pas un smallint.

const DAY_STR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi',
  friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Titulaire actif de la classe (Civilité NOM Prénom), ou '' si aucun. */
function mainTeacherLabel(c: any): string {
  const today = todayKey()
  const ct = (c?.class_teachers ?? []).find((x: any) =>
    x.is_main_teacher &&
    (!x.effective_from || x.effective_from <= today) &&
    (!x.effective_until || x.effective_until >= today)
  )
  const t = ct?.teachers
  if (!t) return ''
  return `${t.civilite ? t.civilite + ' ' : ''}${t.last_name} ${t.first_name}`.trim()
}

export function classInfoOf(c: any): string {
  if (!c) return ''
  const parts: string[] = []
  const teacher = mainTeacherLabel(c)
  if (teacher) parts.push(teacher)
  if (c.cotisation_types?.label) parts.push(c.cotisation_types.label)
  if (c.level) parts.push(`Niveau ${c.level}`)
  if (c.day_of_week && c.start_time) {
    const day = DAY_STR[c.day_of_week] ?? c.day_of_week
    parts.push(`${day} ${String(c.start_time).slice(0, 5)}${c.end_time ? `-${String(c.end_time).slice(0, 5)}` : ''}`)
  }
  return parts.join(' · ')
}
