/**
 * ASSIDUITE D'UNE PERSONNE SUR L'ANNEE EN COURS — resolution unique.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────┐
 * │ Deux ecrans montrent ces chiffres : l'onglet Assiduite de la fiche        │
 * │ enseignant (lu par l'encadrement) et l'encadre « Mon temps de presence »  │
 * │ de Mon compte (lu par l'interesse).                                       │
 * │                                                                           │
 * │ Ils doivent afficher la MEME chose, et pas parce qu'on y aura veille :    │
 * │ parce qu'ils appellent la meme fonction. Recopier le calcul, c'est le     │
 * │ motif qui a produit un resultat comptable different dans trois sous-menus │
 * │ de Financements, corrige dans un seul pendant un mois.                    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Resolue COTE SERVEUR : le navigateur n'a pas a recevoir la table des saisies
 * pour en extraire trois chiffres, et les noms des collegues ne transitent que
 * sous la forme deja composee.
 */

import type { createClient } from '@/lib/supabase/server'
import { findPresenceType } from './format'

type Sb = Awaited<ReturnType<typeof createClient>>

export interface AbsenceLigne {
  id: string
  /** `AAAA-MM-JJ`. */
  date: string
  start: string
  end: string
  minutes: number
  motif: string | null
  /** `NOM Prenom` des personnes qui ont assure le creneau. */
  remplacants: string[]
}

export interface RemplacementLigne {
  id: string
  date: string
  start: string
  end: string
  minutes: number
  /** `NOM Prenom` de la personne remplacee, ou null si son compte a disparu. */
  remplace: string | null
}

export interface MoisAssure {
  /** `AAAA-MM`, pour la cle de rendu. */
  cle: string
  /** `Juil. 26`. */
  libelle: string
  minutes: number
}

export interface Assiduite {
  /** Une fiche sans compte de connexion ne pointe pas : il n'y a rien a montrer. */
  hasAccount: boolean
  yearLabel: string | null
  workedMinutes: number
  absenceMinutes: number
  mois: MoisAssure[]
  absences: AbsenceLigne[]
  remplacements: RemplacementLigne[]
}

const VIDE: Assiduite = {
  hasAccount: false,
  yearLabel: null,
  workedMinutes: 0,
  absenceMinutes: 0,
  mois: [],
  absences: [],
  remplacements: [],
}

const MOIS_COURTS = [
  'Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.',
]

/** Une heure Postgres revient en `HH:MM:SS` ; l'affichage n'en veut que `HH:MM`. */
const hhmm = (t: string | null) => t?.slice(0, 5) ?? ''

/**
 * Les mois couverts par l'annee scolaire, de sa date de debut a sa date de fin.
 *
 * ENGENDRES depuis les bornes reelles, jamais supposes : l'annee en cours court
 * du 1er juillet au 4 juillet suivant, soit TREIZE mois. Ecrire « septembre a
 * juin » serait la faute deja payee le 17 juillet, ou une borne fabriquee a
 * partir du libelle (`${label.split('-')[0]}-08-01`) supposait une annee qui
 * commence en aout.
 *
 * Arithmetique de nombres, sans aucun objet `Date` : rien a decaler.
 */
function moisEntre(start: string, end: string): { cle: string; libelle: string }[] {
  const [ys, ms] = start.split('-').map(Number)
  const [ye, me] = end.split('-').map(Number)
  const out: { cle: string; libelle: string }[] = []

  let y = ys
  let m = ms
  // Garde-fou : des bornes incoherentes (fin avant debut) ne doivent pas boucler
  // sans fin, et 24 mois couvrent largement toute annee scolaire plausible.
  for (let i = 0; i < 24 && (y < ye || (y === ye && m <= me)); i++) {
    out.push({
      cle: `${y}-${String(m).padStart(2, '0')}`,
      libelle: `${MOIS_COURTS[m - 1]} ${String(y).slice(2)}`,
    })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

/**
 * Assiduite de `profileId` sur l'annee scolaire en cours.
 *
 * `profileId` est un `profiles.id` — pas un `teachers.id`. C'est ce que porte
 * `staff_time_entries.profile_id`, et confondre les deux est le piege paye le
 * 10 juillet sur l'emploi du temps.
 *
 * Ce que la RLS ne laisse pas lire ne remonte pas : l'encadrement obtient tout,
 * un enseignant ses seules lignes. Aucune garde de role n'est posee ici, elle
 * ferait doublon avec la base et finirait par diverger d'elle.
 */
export async function chargerAssiduite(sb: Sb, profileId: string | null): Promise<Assiduite> {
  const { data: annee } = await sb
    .from('school_years')
    .select('id, label, start_date, end_date')
    .eq('is_current', true)
    .maybeSingle()

  if (!profileId || !annee) {
    return { ...VIDE, hasAccount: !!profileId, yearLabel: annee?.label ?? null }
  }

  // UNE requete pour les deux faces : ses propres saisies (heures et absences)
  // ET les remplacements que d'autres ont assures POUR lui. Deux appels
  // separes n'apporteraient rien qu'un aller-retour de plus.
  const { data: entries } = await sb
    .from('staff_time_entries')
    .select('id, profile_id, entry_date, entry_type, start_time, end_time, duration_minutes, is_replacement, replaced_profile_id, absence_reason')
    .or(`profile_id.eq.${profileId},replaced_profile_id.eq.${profileId}`)
    .gte('entry_date', annee.start_date)
    .lte('entry_date', annee.end_date)
    .order('entry_date', { ascending: false })
    .order('start_time', { ascending: false })

  const lignes = entries ?? []

  // Types de presence de l'annee : ils portent `is_absence`, seul juge de ce qui
  // est une absence. Tester `entry_type === 'absence'` serait faux depuis que la
  // colonne porte le CODE de l'etablissement (`AB.`, `CRS`…).
  const { data: presenceTypes } = await sb
    .from('presence_types')
    .select('code, is_absence')
    .eq('school_year_id', annee.id)

  const types = presenceTypes ?? []

  // Noms des collegues cites : celui qui a remplace, celui qui a ete remplace.
  // NOM avant Prenom, sans exception.
  const autresIds = Array.from(new Set(
    lignes.flatMap(e => [e.profile_id, e.replaced_profile_id])
      .filter((x): x is string => !!x && x !== profileId)
  ))
  const { data: autres } = autresIds.length
    ? await sb.from('profiles').select('id, first_name, last_name').in('id', autresIds)
    : { data: [] }
  const nomParProfil = Object.fromEntries(
    (autres ?? []).map(p => [p.id, `${p.last_name ?? ''} ${p.first_name ?? ''}`.trim()])
  )

  // Les remplacements assures POUR lui, indexes par creneau. Aucune cle etrangere
  // ne relie l'absence a son remplacement : le lien est le CRENEAU (meme date,
  // memes horaires), c'est ainsi que la modale de saisie les ecrit.
  const remplacantsParCreneau: Record<string, string[]> = {}
  for (const e of lignes) {
    if (e.replaced_profile_id !== profileId || e.profile_id === profileId) continue
    const cle = `${e.entry_date}|${hhmm(e.start_time)}|${hhmm(e.end_time)}`
    const nom = nomParProfil[e.profile_id]
    if (nom) (remplacantsParCreneau[cle] ??= []).push(nom)
  }

  const parMois: Record<string, number> = {}
  const absences: AbsenceLigne[] = []
  const remplacements: RemplacementLigne[] = []
  let workedMinutes = 0
  let absenceMinutes = 0

  for (const e of lignes.filter(x => x.profile_id === profileId)) {
    if (findPresenceType(types, e.entry_type)?.is_absence ?? false) {
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
      // Tout ce qui n'est pas une absence est du temps assure — y compris un code
      // retire des types depuis la saisie. L'additionner par type connu perdrait
      // ces heures-la.
      workedMinutes += e.duration_minutes
      const mois = e.entry_date.slice(0, 7)
      parMois[mois] = (parMois[mois] ?? 0) + e.duration_minutes

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

  return {
    hasAccount: true,
    yearLabel: annee.label,
    workedMinutes,
    absenceMinutes,
    mois: moisEntre(annee.start_date, annee.end_date)
      .map(m => ({ ...m, minutes: parMois[m.cle] ?? 0 })),
    absences,
    remplacements,
  }
}
