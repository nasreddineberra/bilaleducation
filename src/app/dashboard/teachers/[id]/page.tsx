import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TeacherDetail from '@/components/teachers/TeacherDetail'
import { findPresenceType } from '@/lib/temps-presence/format'
import type { TeacherDocument } from '@/types/database'
import type { AbsenceLigne, RemplacementLigne } from '@/components/teachers/TeacherAttendance'

interface Props {
  params: Promise<{ id: string }>
}

/** Une heure Postgres revient en `HH:MM:SS` ; l'affichage n'en veut que `HH:MM`. */
const hhmm = (t: string | null) => t?.slice(0, 5) ?? ''

export default async function EditTeacherPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single()

  if (!teacher) notFound()

  // Documents lies (peut etre vide / null si la migration n'est pas encore passee)
  const { data: documents } = await supabase
    .from('teacher_documents')
    .select('id, etablissement_id, teacher_id, category, label, file_url, file_name, expires_at, created_at')
    .eq('teacher_id', id)
    .order('created_at', { ascending: false })

  // ══ ASSIDUITE ═════════════════════════════════════════════════════════════
  //
  // Resolue ICI plutot que dans le composant : la page a acces aux noms et aux
  // types de presence, et le navigateur n'a pas a recevoir la table des saisies
  // pour en extraire trois chiffres.
  //
  // Le compte de connexion est le pivot : `staff_time_entries.profile_id` est un
  // `profiles.id`, pas un `teachers.id`. Une fiche sans compte n'a donc aucune
  // presence rattachee — et la question ne se pose meme pas.
  const profileId: string | null = teacher.user_id ?? null

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date')
    .eq('is_current', true)
    .maybeSingle()

  let workedMinutes = 0
  let absenceMinutes = 0
  const absences: AbsenceLigne[] = []
  const remplacements: RemplacementLigne[] = []

  if (profileId && currentYear) {
    // UNE requete pour les deux faces : ses propres saisies (heures et absences)
    // ET les remplacements que d'autres ont assures POUR lui. Deux appels
    // separes n'apporteraient rien qu'un aller-retour de plus.
    const { data: entries } = await supabase
      .from('staff_time_entries')
      .select('id, profile_id, entry_date, entry_type, start_time, end_time, duration_minutes, is_replacement, replaced_profile_id, absence_reason')
      .or(`profile_id.eq.${profileId},replaced_profile_id.eq.${profileId}`)
      .gte('entry_date', currentYear.start_date)
      .lte('entry_date', currentYear.end_date)
      .order('entry_date', { ascending: false })
      .order('start_time', { ascending: false })

    const lignes = entries ?? []

    // Types de presence de l'annee : ils portent `is_absence`, seul juge de ce
    // qui est une absence. Tester `entry_type === 'absence'` serait faux depuis
    // que la colonne porte le CODE de l'etablissement (`AB.`, `CRS`…).
    const { data: presenceTypes } = await supabase
      .from('presence_types')
      .select('code, is_absence')
      .eq('school_year_id', currentYear.id)

    const types = presenceTypes ?? []

    // Noms des collegues cites : celui qui a remplace, celui qui a ete remplace.
    // NOM avant Prenom, sans exception.
    const autresIds = Array.from(new Set(
      lignes.flatMap(e => [e.profile_id, e.replaced_profile_id])
        .filter((x): x is string => !!x && x !== profileId)
    ))
    const { data: autres } = autresIds.length
      ? await supabase.from('profiles').select('id, first_name, last_name').in('id', autresIds)
      : { data: [] }
    const nomParProfil = Object.fromEntries(
      (autres ?? []).map(p => [p.id, `${p.last_name ?? ''} ${p.first_name ?? ''}`.trim()])
    )

    // ── Ses propres saisies ────────────────────────────────────────────────
    const siennes = lignes.filter(e => e.profile_id === profileId)

    // Les remplacements assures POUR lui, indexes par creneau. Aucune cle
    // etrangere ne relie l'absence a son remplacement : le lien est le CRENEAU
    // (meme date, memes horaires), c'est ainsi que la modale les ecrit.
    const remplacantsParCreneau: Record<string, string[]> = {}
    for (const e of lignes) {
      if (e.replaced_profile_id !== profileId || e.profile_id === profileId) continue
      const cle = `${e.entry_date}|${hhmm(e.start_time)}|${hhmm(e.end_time)}`
      const nom = nomParProfil[e.profile_id]
      if (nom) (remplacantsParCreneau[cle] ??= []).push(nom)
    }

    for (const e of siennes) {
      const estAbsence = findPresenceType(types, e.entry_type)?.is_absence ?? false

      if (estAbsence) {
        absenceMinutes += e.duration_minutes
        const cle = `${e.entry_date}|${hhmm(e.start_time)}|${hhmm(e.end_time)}`
        absences.push({
          id: e.id,
          date: e.entry_date,
          start: hhmm(e.start_time),
          end: hhmm(e.end_time),
          minutes: e.duration_minutes,
          motif: e.absence_reason,
          remplacants: remplacantsParCreneau[cle] ?? [],
        })
      } else {
        // Tout ce qui n'est pas une absence est du temps assure — y compris un
        // code retire des types depuis la saisie. L'additionner par type connu
        // perdrait ces heures-la.
        workedMinutes += e.duration_minutes

        if (e.is_replacement) {
          remplacements.push({
            id: e.id,
            date: e.entry_date,
            start: hhmm(e.start_time),
            end: hhmm(e.end_time),
            minutes: e.duration_minutes,
            remplace: e.replaced_profile_id ? (nomParProfil[e.replaced_profile_id] ?? null) : null,
          })
        }
      }
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/teachers"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <TeacherDetail
        teacher={teacher}
        documents={(documents ?? []) as TeacherDocument[]}
        assiduite={{
          hasAccount: !!profileId,
          yearLabel: currentYear?.label ?? null,
          workedMinutes,
          absenceMinutes,
          absences,
          remplacements,
        }}
      />

    </div>
  )
}
