// Donnees de Communications — LECTURES des pages, deplacees ici pour que
// `SentMessagesClient`, `MessageDetailClient` et `NewMessageClient` tirent leurs
// types de ces requetes au lieu de les recopier (sortie des `any`, lot 7).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { titulaireActuel, libelleTitulaires } from '@/lib/teachers/titulaire'
import { nomCompletEnseignant } from '@/lib/teachers/nom'

type Client = SupabaseClient<Database>

export type MessageEnvoye = Awaited<ReturnType<typeof chargerMessagesEnvoyes>>[number]
export type DetailMessage = NonNullable<Awaited<ReturnType<typeof chargerMessage>>>
export type NouveauMessage = Awaited<ReturnType<typeof chargerNouveauMessage>>
export type ClasseMessage = NouveauMessage['classes'][number]
export type ParentMessage = NouveauMessage['parents'][number]

type AffectationTitulaire = {
  is_main_teacher: boolean | null
  effective_from: string | null
  teachers: { civilite: string | null; first_name: string; last_name: string } | null
}

/** Historique (message deja envoye) : « initial puis remplacant » (decision du 30/10). */
function titulairesHistorique(affectations: AffectationTitulaire[] | null | undefined): string | null {
  return libelleTitulaires((affectations ?? [])
    .filter(a => a.is_main_teacher && a.teachers)
    .map(a => ({ nom: nomCompletEnseignant(a.teachers), du: a.effective_from })))
}

const MESSAGES = 'id, title, announcement_type, target_class_id, channel, recipient_count, published_at, sent_at, published_by, profiles:published_by(first_name, last_name), classes:classes!target_class_id(name, cotisation_types(label), class_teachers(is_main_teacher, effective_from, teachers(civilite, first_name, last_name)))' as const

/** Messages envoyes (liste de Communications), plus recent en premier. */
export async function chargerMessagesEnvoyes(supabase: Client, etablissementId: string) {
  const { data } = await supabase
    .from('announcements')
    .select(MESSAGES)
    .eq('etablissement_id', etablissementId)
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  return (data ?? []).map(({ classes, ...m }) => ({
    ...m,
    classe: classes
      ? { name: classes.name, cotisation: classes.cotisation_types?.label ?? null, titulaires: titulairesHistorique(classes.class_teachers) }
      : null,
  }))
}

const MESSAGE = '*, profiles:published_by(first_name, last_name, email), classes:classes!target_class_id(name, day_of_week, start_time, end_time, cotisation_types(label), class_teachers(is_main_teacher, effective_from, teachers(civilite, first_name, last_name)))' as const

/** Detail d'un message envoye. `null` si introuvable (ou hors etablissement). */
export async function chargerMessage(supabase: Client, id: string, etablissementId: string) {
  const { data } = await supabase
    .from('announcements')
    .select(MESSAGE)
    .eq('id', id)
    .eq('etablissement_id', etablissementId)
    .single()
  if (!data) return null

  const [{ data: parentRecipients }, { data: staffRecipients }, { data: attachments }] = await Promise.all([
    supabase
      .from('announcement_recipients')
      .select('id, email, email_status, is_read, parent_id, parents:parent_id(tutor1_last_name, tutor1_first_name)')
      .eq('announcement_id', id),
    supabase
      .from('announcement_staff_recipients')
      .select('id, email, email_status, is_read, profile_id, profiles:profile_id(first_name, last_name, role)')
      .eq('announcement_id', id),
    // Bucket prive : l'URL est signee au clic, pour 60 s (`ouvrirPieceJointe`),
    // jamais au rendu de la page.
    supabase
      .from('announcement_attachments')
      .select('id, file_path, file_name, file_size')
      .eq('announcement_id', id),
  ])

  const { classes, ...message } = data
  return {
    message: {
      ...message,
      classe: classes
        ? {
            name: classes.name, day_of_week: classes.day_of_week, start_time: classes.start_time, end_time: classes.end_time,
            cotisation: classes.cotisation_types?.label ?? null,
            titulaires: titulairesHistorique(classes.class_teachers),
          }
        : null,
    },
    parentRecipients: parentRecipients ?? [],
    staffRecipients:  staffRecipients ?? [],
    attachments:      attachments ?? [],
  }
}

const CLASSES = 'id, name, level, day_of_week, start_time, end_time, cotisation_types(label, is_adult), class_teachers(is_main_teacher, effective_until, teachers(civilite, first_name, last_name))' as const

/**
 * Ecran d'envoi aux parents : classes de l'annee, foyers, participants par classe.
 * Le decoupage des participants reproduit EXACTEMENT la resolution serveur
 * (`actions.ts`) : sans lui, le compteur afficherait autre chose que ce qui part.
 */
export async function chargerNouveauMessage(supabase: Client, yearLabel: string | null) {
  let classQuery = supabase.from('classes').select(CLASSES).order('name')
  if (yearLabel) classQuery = classQuery.eq('academic_year', yearLabel)
  const { data: classData } = await classQuery

  // Temps reel : le titulaire EN POSTE (jamais un ancien). Regle du select classe :
  // « CODE · Civilite NOM Prenom · COTISATION ».
  const classes = (classData ?? []).map(({ cotisation_types, class_teachers, ...c }) => ({
    ...c,
    titulaire: nomCompletEnseignant(titulaireActuel(class_teachers)?.teachers) || null,
    cotisation_label: cotisation_types?.label ?? null,
    is_adult: !!cotisation_types?.is_adult,
  }))

  // Liste complete : seul « Tous les parents enregistres » atteint les non-inscrits.
  const { data: parentData } = await supabase
    .from('parents')
    .select('id, tutor1_last_name, tutor1_first_name, tutor1_email, tutor2_last_name, tutor2_first_name, tutor2_email')
    .order('tutor1_last_name')

  // Une classe adulte n'a pas d'eleves : ses participants sont les tuteurs
  // inscrits, et seul le tuteur inscrit est servi (`tutorNumber`). Pour une
  // classe d'enfants, on sert le foyer (`tutorNumber: null`).
  const classParticipants: Record<string, { parentId: string; tutorNumber: number | null }[]> = {}
  const enrolledParentIds = new Set<string>()

  const adultClassIds = classes.filter(c => c.is_adult).map(c => c.id)
  const childClassIds = classes.filter(c => !c.is_adult).map(c => c.id)

  const [{ data: enrollments }, { data: adultEnrollments }] = await Promise.all([
    childClassIds.length > 0
      ? supabase.from('enrollments').select('class_id, students(parent_id)').in('class_id', childClassIds).eq('status', 'active')
      : Promise.resolve({ data: [] }),
    adultClassIds.length > 0
      ? supabase.from('parent_class_enrollments').select('class_id, parent_id, tutor_number').in('class_id', adultClassIds).eq('status', 'active')
      : Promise.resolve({ data: [] }),
  ])

  const add = (classId: string, parentId: string | null | undefined, tutorNumber: number | null) => {
    if (!parentId) return
    const liste = (classParticipants[classId] ??= [])
    if (!liste.some(p => p.parentId === parentId && p.tutorNumber === tutorNumber)) liste.push({ parentId, tutorNumber })
    enrolledParentIds.add(parentId)
  }
  for (const e of enrollments ?? []) add(e.class_id, e.students?.parent_id, null)
  for (const a of adultEnrollments ?? []) add(a.class_id, a.parent_id, a.tutor_number)

  return {
    classes,
    parents: parentData ?? [],
    classParticipants,
    enrolledParentIds: [...enrolledParentIds],
  }
}
