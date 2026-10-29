'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Clock, AlertTriangle, CalendarCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { useToast } from '@/lib/toast-context'
import type { VacationPeriod, JourFerie } from '@/types/database'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import { fmtDuration, findPresenceType } from '@/lib/temps-presence/format'
import { estTypeSaisissable } from '@/lib/temps-presence/saisie'
import TimeEntryModal from './TimeEntryModal'
import Tooltip from '@/components/ui/Tooltip'
import TruncatedText from '@/components/ui/TruncatedText'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import FormModal from '@/components/ui/FormModal'
import { generateStaffTimePDF } from './staffTimePdf'
import { ouvrirOngletPdf, fermerOngletPdf } from '@/lib/pdf/ouvrir'
import { usePetitEcran } from '@/hooks/usePetitEcran'
import { pluriel } from '@/lib/texte/pluriel'
import { accordGenre } from '@/lib/texte/genre'
import { genreCivilite } from '@/lib/teachers/nom'
import { barresDeLaSemaine, joursCouverts, type Barre } from '@/lib/temps-presence/barres-absences'
import type { AbsenceInformation, SeanceInformation } from '@/lib/absences-enseignants/contexte'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EntryType = string

export interface TimeEntry {
  id: string
  profile_id: string
  entry_date: string
  entry_type: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number
  is_replacement: boolean
  replaced_profile_id: string | null
  absence_reason: string | null
  notes: string | null
  recorded_by: string | null
}

interface PresenceType {
  id: string
  label: string
  code: string
  color: string
  is_absence: boolean
  /** `cours` | `activite` | `absence` pour les types RESERVES, sinon null. */
  reserved_kind?: string | null
}

interface PresenceTypeRate {
  presence_type_id: string
  rate: number
}

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface Props {
  currentUserId: string
  currentUserName: string
  role: string
  canSeeAll: boolean
  canWriteAll: boolean
  canSeeRecap: boolean
  staffList: StaffMember[]
  /**
   * Absences d'enseignant de l'annee, visibles de TOUT le personnel pour
   * information (29/10), motif compris : barres du calendrier, panneau du jour,
   * colonne Absences des recapitulatifs (heures des seances manquees).
   */
  absences?: AbsenceInformation[]
  /** Encadrement : le panneau du jour ouvre la fiche de l'absence (l'enseignant, les siennes). */
  peutOuvrirAbsence?: boolean
  vacations?: VacationPeriod[]
  feries?: JourFerie[]
  presenceTypes: PresenceType[]
  presenceTypeRates: PresenceTypeRate[]
  schoolYearId: string | null
  schoolYearLabel: string | null
  schoolYearStart: string | null // "YYYY-MM-DD"
  schoolYearEnd: string | null   // "YYYY-MM-DD"
  initialMonth?: string // format "YYYY-MM"
  etablissementNom: string
  etablissementLogo: string | null
}

// Styles inline derives de la couleur hex du type de presence
function entryStyle(color: string) {
  return {
    background: color + '22',
    color,
    borderColor: color + '55',
  }
}

function dotStyle(color: string) {
  return { backgroundColor: color }
}

// Absences d'enseignant dans le calendrier (29/10). Repli si l'ecole n'a pas de
// type reserve « absence » : le rouge des erreurs de la charte (Tailwind red-500).
const COULEUR_ABSENCE = '#ef4444'
/** Hauteur d'une barre d'absence (18 px) + son ecart (2 px). */
const HAUTEUR_BARRE = 20
/**
 * Ecart de 6 px entre la derniere barre d'une semaine et les pastilles d'heures :
 * 2 px sont deja dans `HAUTEUR_BARRE` (ecart entre deux barres).
 */
const ECART_PASTILLES = 4

/** `AAAA-MM-JJ` -> `04/11`. */
function fmtJourCourt(jour: string): string {
  return `${jour.slice(8, 10)}/${jour.slice(5, 7)}`
}

/** « le 04/11 · 08:00-18:00 » ou « du 04/11 08:00 au 06/11 18:00 ». */
function periodeAbsence(a: { debut: string; fin: string }): string {
  const [j1, h1] = [a.debut.slice(0, 10), a.debut.slice(11, 16)]
  const [j2, h2] = [a.fin.slice(0, 10), a.fin.slice(11, 16)]
  return j1 === j2
    ? `le ${fmtJourCourt(j1)} · ${h1}-${h2}`
    : `du ${fmtJourCourt(j1)} ${h1} au ${fmtJourCourt(j2)} ${h2}`
}

/** La part de l'absence qui tombe le jour `jour` : « 08:00-12:00 », « dès 14:00 », « Journée ». */
function periodeDuJour(a: { debut: string; fin: string }, jour: string): string {
  const debut = a.debut.slice(0, 10) === jour ? a.debut.slice(11, 16) : null
  const fin = a.fin.slice(0, 10) === jour ? a.fin.slice(11, 16) : null
  if (debut && fin) return `${debut}-${fin}`
  if (debut) return `dès ${debut}`
  if (fin) return `jusqu’à ${fin}`
  return 'Journée'
}

function texteDecision(se: SeanceInformation): string {
  return se.decision === 'remplacee' ? `Remplacée par ${se.remplacant ?? '·'}`
    : se.decision === 'annulee' ? 'Annulée'
    : 'À décider'
}

// Fallback si le type n'est pas trouve dans presence_types
const FALLBACK_COLOR = '#6b7280'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function fmtTime(t: string | null): string {
  return t?.slice(0, 5) ?? ''
}

function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function getInitials(first: string, last: string): string {
  return `${(last?.[0] ?? '').toUpperCase()}${(first?.[0] ?? '').toUpperCase()}`
}

function dateKey(d: Date): string {
  // Composantes LOCALES (pas toISOString/UTC) : sinon en fuseau UTC+ une date locale
  // a minuit bascule a la veille → decalage d'un jour dans le calendrier.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── Calendar helpers ────────────────────────────────────────────────────────

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const first = new Date(year, month, 1)
  // Start from Monday of the week containing the 1st
  const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1 // Monday=0
  const start = new Date(year, month, 1 - startDay)
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  return days
}

function getWeekDays(refDate: Date): Date[] {
  const day = refDate.getDay()
  const monday = new Date(refDate)
  monday.setDate(refDate.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
}

// ─── Calcul d'un recapitulatif (mutualise mensuel / annuel) ──────────────────
// `workedMinutes` : la somme des types NON-absence. Calculee ici et non
// recomposee a l'affichage — le rendu ne connait que `nonAbsenceTypes`, la liste
// des types de l'ANNEE EN COURS, alors que des saisies anciennes peuvent porter
// un code retire depuis. Les additionner a l'ecran perdrait ces heures-la.
// Les absences se comptent desormais en MINUTES, comme le travail : depuis que
// l'absence porte des horaires, la demi-journee n'a plus de sens. `absenceDetail`
// garde chaque absence pour l'infobulle — une somme d'heures ne dit pas QUAND.
// Depuis le lot 4, l'absence d'un enseignant vient de la page Absences
// enseignants : une ligne par SEANCE manquee (prop `absences`). Les absences
// saisies ici autrefois (`staff_time_entries`) restent lues.
interface AbsenceLigne { date: string; start: string; end: string; minutes: number }
interface RecapRow { profileId: string; name: string; typeMinutes: Record<string, number>; workedMinutes: number; absenceMinutes: number; absenceDetail: AbsenceLigne[]; cost: number }
interface RecapResult { rows: RecapRow[]; totals: { typeMinutes: Record<string, number>; workedMinutes: number; absenceMinutes: number; cost: number } }

function buildRecap(
  list: TimeEntry[],
  staffMap: Record<string, StaffMember>,
  presenceTypes: PresenceType[],
  rateByTypeId: Record<string, number>,
  seancesManquees: (AbsenceLigne & { profileId: string })[],
): RecapResult {
  const recapMap: Record<string, Record<string, number>> = {}
  // Absences : conservees ligne par ligne. La somme donne le total, le detail
  // alimente l'infobulle du recapitulatif.
  const absencesParProfil: Record<string, AbsenceLigne[]> = {}

  for (const e of list) {
    if (!recapMap[e.profile_id]) recapMap[e.profile_id] = {}

    const pt = findPresenceType(presenceTypes, e.entry_type)
    if (pt?.is_absence) {
      ;(absencesParProfil[e.profile_id] ??= []).push({
        date: e.entry_date,
        start: e.start_time?.slice(0, 5) ?? '',
        end: e.end_time?.slice(0, 5) ?? '',
        minutes: e.duration_minutes,
      })
    } else {
      const code = e.entry_type.toUpperCase()
      recapMap[e.profile_id][code] = (recapMap[e.profile_id][code] ?? 0) + e.duration_minutes
    }
  }

  for (const { profileId, ...a } of seancesManquees) {
    ;(absencesParProfil[profileId] ??= []).push(a)
  }

  const allProfileIds = new Set([...Object.keys(recapMap), ...Object.keys(absencesParProfil)])

  const rows = Array.from(allProfileIds).map(profileId => {
    const s = staffMap[profileId]
    const typeMinutes = recapMap[profileId] ?? {}
    const absenceDetail = (absencesParProfil[profileId] ?? [])
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    const absenceMinutes = absenceDetail.reduce((sum, a) => sum + a.minutes, 0)

    let cost = 0
    for (const pt of presenceTypes.filter(p => !p.is_absence)) {
      const mins = typeMinutes[pt.code.toUpperCase()] ?? 0
      const rate = rateByTypeId[pt.id] ?? 0
      cost += (mins / 60) * rate
    }

    return {
      profileId,
      name: s ? `${s.last_name} ${s.first_name}` : '·',
      typeMinutes,
      workedMinutes: Object.values(typeMinutes).reduce((a, b) => a + b, 0),
      absenceMinutes,
      absenceDetail,
      cost,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const totals = rows.reduce((t, r) => {
    const tm = { ...t.typeMinutes }
    for (const [code, mins] of Object.entries(r.typeMinutes)) {
      tm[code] = (tm[code] ?? 0) + mins
    }
    return {
      typeMinutes: tm,
      workedMinutes: t.workedMinutes + r.workedMinutes,
      absenceMinutes: t.absenceMinutes + r.absenceMinutes,
      cost: t.cost + r.cost,
    }
  }, { typeMinutes: {} as Record<string, number>, workedMinutes: 0, absenceMinutes: 0, cost: 0 })

  return { rows, totals }
}

// ─── Texte tronque avec tooltip UNIQUEMENT si le texte deborde ────────────────
// ─── Component ───────────────────────────────────────────────────────────────

export default function TempsPresenceClient({
  currentUserId, role, canSeeAll, canWriteAll, canSeeRecap,
  staffList, presenceTypes, presenceTypeRates, schoolYearId, initialMonth,
  absences = [], peutOuvrirAbsence = false,
  vacations = [], feries = [],
  schoolYearLabel, schoolYearStart, schoolYearEnd,
  etablissementNom, etablissementLogo,
}: Props) {
  const supabase = createClient()
  const toast = useToast()
  // enseignant voit ses propres couts (il ne voit que ses saisies).
  const canSeeCosts = ['admin', 'direction', 'comptable', 'enseignant'].includes(role)
  const petitEcran = usePetitEcran()
  const isRespPedago = role === 'responsable_pedagogique'
  // Peut SAISIR : admin/direction/secretaire pour tout le personnel, responsable
  // pedagogique pour les enseignants. Ni le comptable (lecture seule) ni
  // l'enseignant (qui valide depuis l'emploi du temps, pas ici).
  const canManage = canWriteAll || isRespPedago
  // Personnel selectionnable dans la modale, selon le perimetre d'ECRITURE.
  const assignableStaff = useMemo(() => {
    if (canWriteAll) return staffList
    if (isRespPedago) return staffList.filter(s => s.role === 'enseignant' || s.id === currentUserId)
    return []
  }, [canWriteAll, isRespPedago, staffList, currentUserId])

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(() => {
    if (initialMonth) {
      const [y, m] = initialMonth.split('-').map(Number)
      return new Date(y, m - 1, 1)
    }
    return new Date()
  })
  const [selectedDay, setSelectedDay] = useState<string>(dateKey(new Date()))
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [yearEntries, setYearEntries] = useState<TimeEntry[]>([]) // annee scolaire (recap annuel)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [memberFilter, setMemberFilter] = useState<string>('') // '' = tous
  const [recapModal, setRecapModal] = useState<'month' | 'year' | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Garde : sans annee scolaire OU sans type de presence configure, la saisie est
  // impossible (la modale n'aurait aucun type a choisir) → on bloque + on informe.
  const noTypes = presenceTypes.length === 0
  // Types configures, mais aucun qui se saisisse a la main (absence, cours et
  // activite viennent d'ailleurs) : bouton grise, sans le bandeau d'alerte.
  const aucunSaisissable = !presenceTypes.some(estTypeSaisissable)
  const canAdd = !!schoolYearId && !aucunSaisissable
  const addBlockReason = !schoolYearId
    ? 'Aucune année scolaire en cours'
    : noTypes
      ? 'Aucun type de présence configuré pour cette année'
      : null
  const raisonAjoutGrise = addBlockReason ?? (aucunSaisissable
    ? 'Aucun type de présence à saisir : cours et activités viennent de l’emploi du temps'
    : null)

  // Staff map for quick lookup
  const staffMap = useMemo(() => {
    const map: Record<string, StaffMember> = {}
    staffList.forEach(s => { map[s.id] = s })
    return map
  }, [staffList])

  // ── Fetch entries for current month ──────────────────────────────────
  const fetchEntries = useCallback(async () => {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-01`

    let query = supabase
      .from('staff_time_entries')
      .select('*')
      .gte('entry_date', startDate)
      .lt('entry_date', endDate)
      .order('entry_date')
      .order('start_time')

    // Seul l'enseignant est restreint — a ses propres lignes. La RLS dit la meme
    // chose ; ce filtre evite juste de demander ce qu'on n'obtiendra pas.
    if (!canSeeAll) query = query.eq('profile_id', currentUserId)

    const { data } = await query
    setEntries((data ?? []) as TimeEntry[])
  }, [year, month, canSeeAll, currentUserId, supabase])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // ── Fetch entries for the whole school year (recap annuel) ───────────
  const fetchYearEntries = useCallback(async () => {
    if (!schoolYearStart || !schoolYearEnd) { setYearEntries([]); return }

    let query = supabase
      .from('staff_time_entries')
      .select('*')
      .gte('entry_date', schoolYearStart)
      .lte('entry_date', schoolYearEnd)

    if (!canSeeAll) query = query.eq('profile_id', currentUserId)

    const { data } = await query
    setYearEntries((data ?? []) as TimeEntry[])
  }, [schoolYearStart, schoolYearEnd, canSeeAll, currentUserId, supabase])

  useEffect(() => { fetchYearEntries() }, [fetchYearEntries])

  // Regle projet : AUCUNE modale ne se ferme sur Echap ni sur un clic hors
  // fenetre — uniquement par X / Annuler. (Pas de handler clavier ici.)

  // ── Navigation ──────────────────────────────────────────────────────
  const prev = () => {
    if (viewMode === 'month') setCurrentDate(new Date(year, month - 1, 1))
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7))
  }
  const next = () => {
    if (viewMode === 'month') setCurrentDate(new Date(year, month + 1, 1))
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7))
  }

  // ── Filtre par membre (client, s'applique calendrier + recap) ────────
  const filteredEntries = useMemo(
    () => (memberFilter ? entries.filter(e => e.profile_id === memberFilter) : entries),
    [entries, memberFilter],
  )

  // ── Entries indexed by date ─────────────────────────────────────────
  const entriesByDate = useMemo(() => {
    const map: Record<string, TimeEntry[]> = {}
    for (const e of filteredEntries) {
      if (!map[e.entry_date]) map[e.entry_date] = []
      map[e.entry_date].push(e)
    }
    return map
  }, [filteredEntries])

  // ── Day panel data ──────────────────────────────────────────────────
  const dayEntries = useMemo(() => entriesByDate[selectedDay] ?? [], [entriesByDate, selectedDay])
  const dayByStaff = useMemo(() => {
    const map: Record<string, TimeEntry[]> = {}
    for (const e of dayEntries) {
      if (!map[e.profile_id]) map[e.profile_id] = []
      map[e.profile_id].push(e)
    }
    return map
  }, [dayEntries])

  // Map presence_type_id -> rate pour calcul cout
  const rateByTypeId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of presenceTypeRates) map[r.presence_type_id] = r.rate
    return map
  }, [presenceTypeRates])

  // ── Recap mensuel + annuel (memes calculs, jeux de donnees differents) ──
  const filteredYearEntries = useMemo(
    () => (memberFilter ? yearEntries.filter(e => e.profile_id === memberFilter) : yearEntries),
    [yearEntries, memberFilter],
  )
  // Seances manquees : du mois affiche pour le recap mensuel, de l'annee
  // scolaire pour l'annuel, avec le meme filtre par membre.
  const moisCle = `${year}-${String(month + 1).padStart(2, '0')}`
  // Toutes pour qui lit tout le personnel ; les siennes pour l'enseignant, dont
  // le recapitulatif ne porte que ses propres heures.
  const absencesSeances = useMemo(
    () => absences.flatMap(a => a.profileId && (canSeeAll || a.profileId === currentUserId)
      ? a.seances.map(se => ({ profileId: a.profileId as string, date: se.date, start: se.start, end: se.end, minutes: se.minutes }))
      : []),
    [absences, canSeeAll, currentUserId],
  )
  const seancesFiltrees = useMemo(
    () => (memberFilter ? absencesSeances.filter(a => a.profileId === memberFilter) : absencesSeances),
    [absencesSeances, memberFilter],
  )
  const seancesDuMois = useMemo(
    () => seancesFiltrees.filter(a => a.date.startsWith(moisCle)),
    [seancesFiltrees, moisCle],
  )
  const seancesDeLAnnee = useMemo(
    () => seancesFiltrees.filter(a =>
      (!schoolYearStart || a.date >= schoolYearStart) && (!schoolYearEnd || a.date <= schoolYearEnd)),
    [seancesFiltrees, schoolYearStart, schoolYearEnd],
  )
  const monthlyRecap = useMemo(
    () => buildRecap(filteredEntries, staffMap, presenceTypes, rateByTypeId, seancesDuMois),
    [filteredEntries, staffMap, presenceTypes, rateByTypeId, seancesDuMois],
  )
  const annualRecap = useMemo(
    () => buildRecap(filteredYearEntries, staffMap, presenceTypes, rateByTypeId, seancesDeLAnnee),
    [filteredYearEntries, staffMap, presenceTypes, rateByTypeId, seancesDeLAnnee],
  )

  // ── Calendar cells ──────────────────────────────────────────────────
  const calDays = viewMode === 'month' ? getMonthDays(year, month) : getWeekDays(currentDate)
  const todayKey = dateKey(new Date())

  // ── Delete handler ──────────────────────────────────────────────────
  // Remplacements du meme jour qui referencent l'absence de cette personne :
  // on ne peut pas supprimer l'absence tant qu'ils existent (ils la justifient).
  const blockingReplacements = (entry: TimeEntry | undefined): TimeEntry[] => {
    if (!entry) return []
    const isAbs = findPresenceType(presenceTypes, entry.entry_type)?.is_absence ?? false
    if (!isAbs) return []
    return entries.filter(e =>
      e.entry_date === entry.entry_date &&
      e.is_replacement &&
      e.replaced_profile_id === entry.profile_id,
    )
  }

  const handleDelete = async (id: string) => {
    // Garde-fou (le bouton est deja desactive dans ce cas, ceinture + bretelles).
    if (blockingReplacements(entries.find(e => e.id === id)).length > 0) {
      setDeleteConfirm(null)
      return
    }
    const echec = erreurEcriture(
      await supabase.from('staff_time_entries').delete().eq('id', id).select('id'),
      'Cette saisie',
    )
    if (echec) { toast.error(echec); setDeleteConfirm(null); return }

    setDeleteConfirm(null)
    fetchEntries()
    fetchYearEntries()
  }

  // ── Export PDF d'un recapitulatif (mensuel ou annuel) ───────────────
  const [exporting, setExporting] = useState(false)
  const handleExportPdf = async (scope: 'month' | 'year') => {
    setExporting(true)
    // Onglet ouvert AU CLIC, avant tout await (sinon bloque comme popup).
    const onglet = ouvrirOngletPdf()
    try {
      const recap = scope === 'month' ? monthlyRecap : annualRecap
      const periodLabel = scope === 'month'
        ? `${MONTH_NAMES[month]} ${year}`
        : `Année scolaire ${schoolYearLabel ?? ''}`.trim()
      await generateStaffTimePDF({
        etablissementNom,
        etablissementLogo,
        periodLabel,
        typeColumns: presenceTypes.filter(p => !p.is_absence).map(p => ({ code: p.code, label: p.label, rate: rateByTypeId[p.id] ?? 0, color: p.color })),
        rows: recap.rows.map(r => ({ name: r.name, typeMinutes: r.typeMinutes, workedMinutes: r.workedMinutes, absenceMinutes: r.absenceMinutes, cost: r.cost })),
        totals: recap.totals,
        showCosts: canSeeCosts,
      }, onglet)
    } catch (e) {
      fermerOngletPdf(onglet)
      throw e
    } finally {
      setExporting(false)
    }
  }

  // ── Rendu du tableau d'un recapitulatif (mensuel ou annuel) ─────────
  const nonAbsenceTypes = presenceTypes.filter(p => !p.is_absence)
  /**
   * Le recapitulatif EN CARTES, sous le seuil mobile.
   *
   * POURQUOI PAS LE TABLEAU. Il porte 8 colonnes (Personnel + N types + Total +
   * Absences + Cout) avec des libelles longs comme « ADMINISTRATIF » : ~920 px de
   * largeur minimale pour ~316 px utiles. `overflow-x-auto` le laissait defiler,
   * mais rien ne le disait — et en defilant on perdait de vue le NOM de la
   * personne dont on lisait les heures. Un tableau large sur telephone ne se
   * repare pas, il se transpose.
   *
   * TOUS LES TYPES SONT LISTES, zero compris (« · »), comme dans le tableau : on
   * ne masque pas une ligne a zero, sinon on ne sait plus si le type existe.
   *
   * ET LE DETAIL DES ABSENCES DEVIENT VISIBLE. Dans le tableau il vit dans une
   * infobulle — inaccessible au doigt depuis que les bulles ne se declenchent
   * plus au toucher (5 octobre). La carte a la place verticale : on l affiche.
   */
  const renderRecapCartes = (recap: RecapResult, ariaLabel: string) => {
    const ligne = (label: string, valeur: React.ReactNode, couleur?: string) => (
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[11px] font-bold uppercase tracking-wide" style={couleur ? { color: couleur } : undefined}>{label}</dt>
        <dd className="text-xs tabular-nums text-secondary-800">{valeur}</dd>
      </div>
    )

    return (
      <ul className="space-y-2" aria-label={ariaLabel}>
        {recap.rows.map(r => (
          <li key={r.profileId} className="rounded-xl border border-warm-100 p-3 space-y-2">
            <p className="text-sm font-bold text-secondary-800">{r.name}</p>

            <dl className="space-y-1">
              {nonAbsenceTypes.map(pt => {
                const mins = r.typeMinutes[pt.code.toUpperCase()] ?? 0
                return (
                  <div key={pt.id}>{ligne(pt.label, mins > 0 ? fmtDuration(mins) : '·', pt.color)}</div>
                )
              })}
            </dl>

            <dl className="border-t border-warm-100 pt-2 space-y-1">
              {ligne('Total heures', <span className="font-semibold">{r.workedMinutes > 0 ? fmtDuration(r.workedMinutes) : '·'}</span>)}
              {ligne(
                'Absences',
                <span className={r.absenceMinutes > 0 ? 'text-red-700 font-medium' : ''}>
                  {r.absenceMinutes > 0 ? fmtDuration(r.absenceMinutes) : '·'}
                </span>,
              )}
              {r.absenceMinutes > 0 && (
                <ul className="pl-1 space-y-0.5 text-[11px] text-warm-700 tabular-nums">
                  {r.absenceDetail.map(a => (
                    <li key={`${a.date}-${a.start}`}>
                      {new Date(a.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      {'  '}{a.start}-{a.end}{'  '}{fmtDuration(a.minutes)}
                    </li>
                  ))}
                </ul>
              )}
              {canSeeCosts && ligne('Coût', <span className="font-bold">{fmtEur(r.cost)}</span>)}
            </dl>
          </li>
        ))}

        <li className="rounded-xl border-2 border-warm-200 bg-warm-50 p-3 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-warm-700">Total</p>
          <dl className="space-y-1">
            {nonAbsenceTypes.map(pt => {
              const mins = recap.totals.typeMinutes[pt.code.toUpperCase()] ?? 0
              return <div key={pt.id}>{ligne(pt.label, mins > 0 ? fmtDuration(mins) : '·', pt.color)}</div>
            })}
            {ligne('Total heures', <span className="font-bold">{recap.totals.workedMinutes > 0 ? fmtDuration(recap.totals.workedMinutes) : '·'}</span>)}
            {ligne('Absences', <span className={recap.totals.absenceMinutes > 0 ? 'text-red-700 font-medium' : ''}>{recap.totals.absenceMinutes > 0 ? fmtDuration(recap.totals.absenceMinutes) : '·'}</span>)}
            {canSeeCosts && ligne('Coût', <span className="font-bold">{fmtEur(recap.totals.cost)}</span>)}
          </dl>
        </li>
      </ul>
    )
  }

  const renderRecapTable = (recap: RecapResult, ariaLabel: string, emptyMsg: string) => (
    recap.rows.length === 0 ? (
      <p className="text-sm text-warm-700 italic text-center py-10">{emptyMsg}</p>
    ) : petitEcran ? renderRecapCartes(recap, ariaLabel) : (
      <div className="liste overflow-x-auto">
          <table className="w-full text-sm" aria-label={ariaLabel}>
            <thead>
              <tr className="liste-entete border-b border-[var(--card-border)]">
                <th className="px-5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide">Personnel</th>
                {nonAbsenceTypes.map(pt => (
                  <th key={pt.id} className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide" style={{ color: pt.color }}>
                    {pt.label}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide border-l border-warm-200">Total heures</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold !text-red-700 uppercase tracking-wide">Absences</th>
                {canSeeCosts && <th className="px-5 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide">Coût</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {recap.rows.map(r => (
                <tr key={r.profileId}>
                  <td className="px-5 py-3 font-medium text-warm-700 whitespace-nowrap">{r.name}</td>
                  {nonAbsenceTypes.map(pt => {
                    const mins = r.typeMinutes[pt.code.toUpperCase()] ?? 0
                    return (
                      <td key={pt.id} className={`px-4 py-3 text-center tabular-nums ${mins > 0 ? 'text-warm-700' : 'text-warm-700'}`}>
                        {mins > 0 ? fmtDuration(mins) : '·'}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center tabular-nums font-semibold text-secondary-800 border-l border-warm-200">
                    {r.workedMinutes > 0 ? fmtDuration(r.workedMinutes) : '·'}
                  </td>
                  <td className={`px-4 py-3 text-center tabular-nums ${r.absenceMinutes > 0 ? 'text-red-700 font-medium' : 'text-warm-700'}`}>
                    {r.absenceMinutes > 0 ? (
                      // Une somme d'heures ne dit pas QUAND : l'infobulle liste
                      // chaque absence, une par ligne.
                      <Tooltip
                        maxWidth="max-w-none"
                        content={
                          <span className="whitespace-pre">
                            {r.absenceDetail
                              .map(a => `${new Date(a.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}   ${a.start}-${a.end}   ${fmtDuration(a.minutes)}`)
                              .join('\n')}
                          </span>
                        }
                      >
                        <span className="cursor-help underline decoration-dotted underline-offset-2">
                          {fmtDuration(r.absenceMinutes)}
                        </span>
                      </Tooltip>
                    ) : '·'}
                  </td>
                  {canSeeCosts && <td className="px-5 py-3 text-right font-bold text-secondary-800 tabular-nums whitespace-nowrap">{fmtEur(r.cost)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-warm-50 border-t-2 border-warm-200 font-bold">
                <td className="px-5 py-3 text-warm-700 uppercase text-[11px] tracking-wide">Total</td>
                {nonAbsenceTypes.map(pt => {
                  const mins = recap.totals.typeMinutes[pt.code.toUpperCase()] ?? 0
                  return (
                    <td key={pt.id} className="px-4 py-3 text-center tabular-nums" style={{ color: pt.color }}>
                      {mins > 0 ? fmtDuration(mins) : '·'}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center tabular-nums text-secondary-800 border-l border-warm-200">
                  {recap.totals.workedMinutes > 0 ? fmtDuration(recap.totals.workedMinutes) : '·'}
                </td>
                <td className="px-4 py-3 text-center text-red-700 tabular-nums">{recap.totals.absenceMinutes > 0 ? fmtDuration(recap.totals.absenceMinutes) : '·'}</td>
                {canSeeCosts && <td className="px-5 py-3 text-right text-secondary-800 tabular-nums whitespace-nowrap">{fmtEur(recap.totals.cost)}</td>}
              </tr>
            </tfoot>
          </table>
      </div>
    )
  )

  // ── Badges for calendar cell ────────────────────────────────────────
  // ── Absences d'enseignant : barres du calendrier, panneau du jour ─────────
  //
  // Visibles de tout le personnel, pour information (decision du 29/10), motif
  // compris. Une barre par absence couvre ses jours, coupee net au bord d'une
  // semaine (`barresDeLaSemaine`). Le filtre par membre s'y applique aussi.
  const couleurAbsence = presenceTypes.find(p => p.reserved_kind === 'absence')?.color ?? COULEUR_ABSENCE
  const absencesAffichees = useMemo(
    () => absences
      .filter(a => !memberFilter || a.profileId === memberFilter)
      .map(a => ({ ...a, ...joursCouverts(a.debut, a.fin) })),
    [absences, memberFilter],
  )
  const absencesParId = useMemo(() => new Map(absencesAffichees.map(a => [a.id, a])), [absencesAffichees])
  const absencesDuJour = absencesAffichees.filter(a => a.premier <= selectedDay && a.dernier >= selectedDay)
  const peutOuvrir = (a: AbsenceInformation) => peutOuvrirAbsence || a.profileId === currentUserId

  // HAUTEUR : le calendrier occupe la page jusqu'en bas (demande du 29/10) ; le
  // nombre de barres par semaine se deduit de la hauteur MESUREE d'une semaine.
  // Au-dela, « +N » sur les jours concernes (le clic ouvre le jour).
  const semainesRef = useRef<HTMLDivElement>(null)
  const [hauteurSemaines, setHauteurSemaines] = useState(0)
  useEffect(() => {
    const el = semainesRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([e]) => setHauteurSemaines(e.contentRect.height))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const nbSemaines = viewMode === 'month' ? 6 : 1
  // Numero du jour en haut (24 px), ecart (6 px), une ligne de pastilles d'heures en bas (20 px).
  const lignesMax = Math.max(1, Math.floor((hauteurSemaines / nbSemaines - 50) / HAUTEUR_BARRE))

  // Infobulle SOBRE (demande du 29/10, apres essai) : le nom et le motif. Les
  // seances et leurs decisions sont dans le panneau du jour et sur la fiche.
  function infobulleAbsence(a: AbsenceInformation) {
    return (
      <span className="flex flex-col gap-0.5 text-left">
        <span className="font-bold">{a.nom}</span>
        <span>{a.motif}</span>
      </span>
    )
  }

  function renderBarre(b: Barre, cles: string[]) {
    const a = absencesParId.get(b.id)
    if (!a) return null
    // Trait ambre tant qu'une seance reste a decider (meme code que l'EDT).
    const aDecider = a.seances.some(se => se.decision === 'a_decider')
    return (
      <div
        key={b.id}
        style={{ gridColumn: `${b.colDebut + 1} / ${b.colFin + 2}`, gridRow: b.ligne + 1 }}
        className={clsx('pointer-events-auto min-w-0', !b.coupeAvant && 'pl-1', !b.coupeApres && 'pr-1')}
      >
        <Tooltip content={infobulleAbsence(a)} className="w-full" maxWidth="max-w-xs">
          <button
            type="button"
            // Le clic ouvre le jour (debut de la barre dans la semaine) ; le lien
            // vers l'absence est dans le panneau du jour seulement (29/10).
            onClick={() => setSelectedDay(cles[b.colDebut])}
            aria-label={`${a.nom}, ${accordGenre(genreCivilite(a.civilite), 'absent', 'absente', 'absence')} ${periodeAbsence(a)}, ${a.motif}${aDecider ? ', séances à décider' : ''}`}
            className={clsx(
              'h-[18px] w-full min-w-0 flex items-center px-1.5 bg-warm-100 text-secondary-800 text-[10px] font-semibold leading-none border-l-[3px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]',
              b.coupeAvant ? 'rounded-l-none' : 'rounded-l',
              b.coupeApres ? 'rounded-r-none' : 'rounded-r',
              aDecider && 'border-l-amber-500',
            )}
            style={aDecider ? undefined : { borderLeftColor: couleurAbsence }}
          >
            <span className="truncate">{a.nomCourt}</span>
          </button>
        </Tooltip>
      </div>
    )
  }

  function renderAbsenceDuJour(a: AbsenceInformation) {
    const seancesDuJour = a.seances.filter(se => se.date === selectedDay)
    const etat = accordGenre(genreCivilite(a.civilite), 'Absent', 'Absente', 'Absence')
    const initiales = (a.nomCourt.charAt(0) + (a.nomCourt.match(/ (\S)\.$/)?.[1] ?? '')).toUpperCase()
    const contenu = (
      <>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]" style={entryStyle(couleurAbsence)}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={dotStyle(couleurAbsence)} />
          <span className="font-medium shrink-0">{etat}</span>
          <span className="text-warm-700 shrink-0 tabular-nums">{periodeDuJour(a, selectedDay)}</span>
          <span className="text-warm-700 shrink-0">{a.motif}</span>
        </div>
        {seancesDuJour.map(se => (
          <div key={`${se.start}|${se.classe}`} className="pl-2 text-[10px] text-warm-700 tabular-nums">
            {se.classe} · {se.start}-{se.end} ·{' '}
            <span className={clsx(
              se.decision === 'a_decider' && 'text-amber-700 font-medium',
              se.decision === 'annulee' && 'text-red-700 font-medium',
              se.decision === 'remplacee' && 'text-secondary-700',
            )}>{texteDecision(se)}</span>
          </div>
        ))}
      </>
    )
    return (
      <div key={`abs-${a.id}`} className="flex items-start gap-2 py-2">
        <div className="flex items-center gap-1.5 w-36 shrink-0">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--brand-tint)] text-[var(--brand-surface)] dark:text-[var(--brand-accent)] text-[10px] font-bold shrink-0">
            {initiales}
          </span>
          <TruncatedText text={a.nom} className="text-[11px] font-bold text-warm-800" />
        </div>
        {/* Lecture seule : l'absence se regle dans Absences enseignants. */}
        {peutOuvrir(a) ? (
          <Link href={`/dashboard/absences-enseignants/${a.id}`} aria-label={`Ouvrir l’absence de ${a.nom}`}
            className="flex-1 min-w-0 space-y-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]">
            {contenu}
          </Link>
        ) : (
          <div className="flex-1 min-w-0 space-y-1">{contenu}</div>
        )}
      </div>
    )
  }

  function renderCellBadges(dk: string) {
    const cellEntries = entriesByDate[dk] ?? []
    if (cellEntries.length === 0) return null

    // Group by person + type
    const byPersonType: Record<string, { mins: number; count: number; type: EntryType; profileId: string }> = {}
    for (const e of cellEntries) {
      const key = `${e.profile_id}-${e.entry_type}`
      if (!byPersonType[key]) byPersonType[key] = { mins: 0, count: 0, type: e.entry_type, profileId: e.profile_id }
      byPersonType[key].mins += e.duration_minutes
      byPersonType[key].count++
    }

    const badges = Object.values(byPersonType).sort((a, b) => {
      const nameA = staffMap[a.profileId]?.last_name ?? ''
      const nameB = staffMap[b.profileId]?.last_name ?? ''
      return nameA.localeCompare(nameB)
    })
    return (
      <div className="flex flex-wrap gap-0.5">
        {badges.map((data) => {
          const s = staffMap[data.profileId]
          const initials = s ? getInitials(s.first_name, s.last_name) : '??'
          const fullName = s ? `${s.last_name} ${s.first_name}` : ''
          const pt = findPresenceType(presenceTypes, data.type)
          const color = pt?.color ?? FALLBACK_COLOR
          const label = pt?.label ?? data.type
          return (
            <Tooltip key={`${data.profileId}-${data.type}`} content={
              <div className="w-40">
                <span className="block font-bold text-white text-sm">{fullName}</span>
                <span className="block border-t border-white/10 my-1" />
                <span className="block text-secondary-300 text-[11px]">{label}</span>
                {data.mins > 0 && (
                  <span className="block text-secondary-400 text-[11px] mt-0.5">{fmtDuration(data.mins)}</span>
                )}
              </div>
            }>
              <span
                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold leading-none cursor-default"
                style={entryStyle(color)}
              >
                {initials} {data.mins > 0 ? fmtDuration(data.mins) : (pt?.code ?? data.type)}
              </span>
            </Tooltip>
          )
        })}
      </div>
    )
  }

  // ── Title ───────────────────────────────────────────────────────────
  const title = viewMode === 'month'
    ? `${MONTH_NAMES[month]} ${year}`
    : (() => {
        const wk = getWeekDays(currentDate)
        const d1 = wk[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        const d2 = wk[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
        return `${d1} · ${d2}`
      })()

  const selectedDayLabel = new Date(selectedDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const fermetureJour = jourFerme(selectedDay, vacations, feries)

  return (
    <div className="flex flex-col gap-5 lg:h-full">

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3 shrink-0">
        <FiltreSwitch
          ariaLabel="Mode d'affichage"
          actif={viewMode}
          onChange={v => setViewMode(v as 'month' | 'week')}
          options={[
            { valeur: 'month', libelle: 'Mois' },
            { valeur: 'week',  libelle: 'Semaine' },
          ]}
        />

        <div className="flex items-center gap-1">
          <button onClick={prev} aria-label={viewMode === 'month' ? 'Mois précédent' : 'Semaine précédente'} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-700 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"><ChevronLeft size={16} /></button>
          <span className="text-sm font-bold text-secondary-800 min-w-[180px] text-center">{title}</span>
          <button onClick={next} aria-label={viewMode === 'month' ? 'Mois suivant' : 'Semaine suivante'} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-700 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"><ChevronRight size={16} /></button>
        </div>

        {canSeeRecap && (
          <FloatButton variant="secondary" size="mini" type="button" onClick={() => setRecapModal('month')} className="whitespace-nowrap">
            Récap. mensuel
          </FloatButton>
        )}

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:ml-auto">
          {canManage && (
            // Modele de champ de la charte (libelle sur le trait). « Tous » porte
            // la sentinelle `__all__` : une valeur vide laisserait le libelle
            // retomber par-dessus le texte de l'option.
            <FloatSelect
              label="Membre"
              value={memberFilter || '__all__'}
              onChange={e => setMemberFilter(e.target.value === '__all__' ? '' : e.target.value)}
              aria-label="Filtrer par membre"
              wrapperClassName="w-52"
              className="truncate"
            >
              <option value="__all__">Tous</option>
              {assignableStaff.map(s => (
                <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
              ))}
            </FloatSelect>
          )}
          {canSeeRecap && (
            <FloatButton variant="secondary" size="mini" type="button" onClick={() => setRecapModal('year')} className="whitespace-nowrap">
              Récap. annuel
            </FloatButton>
          )}
        </div>

      </div>

      {/* ── Garde : annee / types de presence manquants ──────────────── */}
      {addBlockReason && (
        <div role="status" className="card px-4 py-3 flex items-start gap-2.5 bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs">
            {!schoolYearId ? (
              <>Aucune année scolaire en cours. La saisie des temps de présence est indisponible.</>
            ) : (
              <>
                Aucun type de présence configuré pour cette année. Configurez-les d'abord dans{' '}
                <Link href="/dashboard/types-presence" className="font-semibold underline hover:text-amber-900">
                  Paramètres → Types de présence
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      {/* ── Calendar + Day panel ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:flex-1 lg:min-h-0">

        {/* Calendar */}
        <div className="lg:col-span-2 card overflow-hidden flex flex-col lg:min-h-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-warm-100 bg-warm-50 shrink-0">
            {DAY_NAMES.map(d => (
              <div key={d} className="px-1 h-9 flex items-center justify-center text-[10px] font-bold text-warm-700 uppercase">{d}</div>
            ))}
          </div>
          {/* Semaines : les cases du jour, et par-dessus les barres d'absence. */}
          <div ref={semainesRef} className="flex flex-col lg:flex-1 lg:min-h-0">
            {(() => {
              const jours = calDays.slice(0, viewMode === 'month' ? 42 : 7)
              const semaines: Date[][] = []
              for (let i = 0; i < jours.length; i += 7) semaines.push(jours.slice(i, i + 7))
              return semaines.map((sem, w) => {
                const cles = sem.map(dateKey)
                const barres = barresDeLaSemaine(absencesAffichees, cles)
                const nbLignes = barres.reduce((m, b) => Math.max(m, b.ligne + 1), 0)
                const deborde = nbLignes > lignesMax
                const lignesVisibles = deborde ? lignesMax - 1 : nbLignes
                const cachees = barres.filter(b => b.ligne >= lignesVisibles)
                const lignesOccupees = Math.min(nbLignes, lignesMax)
                return (
                  <div key={w} className={clsx('relative grid grid-cols-7 lg:flex-1 lg:min-h-0', viewMode === 'month' ? 'min-h-[70px]' : 'min-h-[120px]')}>
                    {sem.map((d, i) => {
                      const dk = cles[i]
                      const isCurrentMonth = d.getMonth() === month
                      const isSelected = dk === selectedDay
                      const isToday = dk === todayKey
                      const cellCount = (entriesByDate[dk] ?? []).length
                      const nbAbsents = absencesAffichees.filter(a => a.premier <= dk && a.dernier >= dk).length
                      const dLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                      // Jour ferme : meme ambre que l'emploi du temps, pour qu'un jour
                      // sans ecole se reconnaisse d'un ecran a l'autre. La NATURE part
                      // dans l'aria-label : un fond colore ne se lit pas au clavier.
                      const ferme = jourFerme(dk, vacations, feries)
                      const ariaLabel = `${dLabel}${isToday ? " (aujourd'hui)" : ''}${ferme ? `, ${ferme.titre}${ferme.label ? ` ${ferme.label}` : ''}` : ''}, ${cellCount === 0 ? 'aucune saisie' : cellCount === 1 ? '1 saisie' : `${cellCount} saisies`}${nbAbsents > 0 ? `, ${pluriel(nbAbsents, 'enseignant absent', 'enseignants absents')}` : ''}`
                      return (
                        <button
                          key={dk}
                          onClick={() => setSelectedDay(dk)}
                          aria-label={ariaLabel}
                          aria-pressed={isSelected}
                          aria-current={isToday ? 'date' : undefined}
                          className={clsx(
                            'relative border border-warm-50 p-1 text-left transition-colors h-full min-h-0 overflow-hidden flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)] focus-visible:z-10',
                            ferme ? 'bg-amber-50' : (isCurrentMonth ? 'bg-white' : 'bg-warm-50/50'),
                            isSelected && 'ring-2 ring-[var(--brand-surface)] dark:ring-[var(--brand-accent)] ring-inset',
                            !isSelected && (ferme ? 'hover:bg-amber-100' : 'hover:bg-warm-100'),
                          )}
                        >
                          <div className="flex items-start gap-1">
                            <span className={clsx(
                              'text-xs font-medium shrink-0',
                              // Marqueur du jour : meme ambre que l'emploi du temps.
                              isToday && 'bg-amber-700 text-white rounded-full w-5 h-5 inline-flex items-center justify-center',
                              !isToday && 'text-warm-700',
                            )}>
                              {d.getDate()}
                            </span>
                            {lignesOccupees === 0 && <div className="flex-1 min-w-0">{renderCellBadges(dk)}</div>}
                          </div>
                          {/* Place des barres d'absence de la semaine, puis les heures. */}
                          {lignesOccupees > 0 && (
                            <>
                              {/* Ecart de 6 px sous la derniere barre (demande du 29/10). */}
                              <div aria-hidden className="shrink-0" style={{ height: lignesOccupees * HAUTEUR_BARRE + ECART_PASTILLES }} />
                              <div className="min-w-0">{renderCellBadges(dk)}</div>
                            </>
                          )}
                        </button>
                      )
                    })}
                    {barres.length > 0 && (
                      <div className="absolute inset-x-0 top-6 grid grid-cols-7 gap-y-0.5 pointer-events-none" style={{ gridAutoRows: '18px' }}>
                        {barres.filter(b => b.ligne < lignesVisibles).map(b => renderBarre(b, cles))}
                        {deborde && cles.map((dk, c) => {
                          const n = cachees.filter(b => b.colDebut <= c && b.colFin >= c).length
                          return n > 0 && (
                            <div key={`plus-${dk}`} style={{ gridColumn: c + 1, gridRow: lignesMax }} className="pointer-events-auto px-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedDay(dk)}
                                aria-label={`${pluriel(n, 'autre absence', 'autres absences')} ce jour`}
                                className="h-[18px] w-full text-left px-1.5 rounded text-[10px] font-bold text-warm-700 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                              >
                                +{n}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </div>

        {/* Day panel : hauteur du contenu sur telephone ; sur ordinateur, celle du
            calendrier (pleine page), la liste defile a l'interieur. */}
        <div className="card flex flex-col self-start lg:self-stretch lg:min-h-0">
          <div className="px-4 h-9 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-secondary-800 capitalize whitespace-nowrap">{selectedDayLabel}</h3>
              {fermetureJour && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 uppercase tracking-wide truncate">
                  {fermetureJour.titre}{fermetureJour.label ? ` · ${fermetureJour.label}` : ''}
                </span>
              )}
            </div>
            {/* MASQUE pour qui ne gere pas la presence (l enseignant), et non grise :
                l action ne lui est JAMAIS possible, quel que soit le jour — c est le
                critere qui separe les deux traitements dans ce projet. Le bouton
                n avait AUCUN controle de role : il s affichait actif pour tout le
                monde, et la modale s ouvrait sur une liste de membres VIDE
                (`assignableStaff` rend `[]` hors perimetre d ecriture). Une promesse
                que l ecran ne pouvait pas tenir.
                Le grisage, lui, reste pour les gestionnaires quand l annee ou les
                types manquent : cet etat-la est temporaire. */}
            {canManage && (
            <Tooltip content={raisonAjoutGrise ?? 'Ajouter une saisie'}>
              <FloatButton
                variant="submit"
                size="mini"
                type="button"
                onClick={() => { setEditingEntry(null); setModalOpen(true) }}
                disabled={!canAdd}
              >
                Ajouter
              </FloatButton>
            </Tooltip>
            )}
          </div>

          <div className="overflow-y-auto max-h-[65vh] lg:max-h-none lg:flex-1 lg:min-h-0 px-3 py-1 divide-y divide-warm-100">
            {absencesDuJour.length === 0 && Object.keys(dayByStaff).length === 0 ? (
              <p className="text-xs text-warm-700 italic text-center py-8">Aucune saisie ce jour</p>
            ) : (<>
              {/* Absences d'enseignant du jour, pour information (lecture seule). */}
              {absencesDuJour.map(renderAbsenceDuJour)}
              {Object.entries(dayByStaff).map(([pid, pEntries]) => {
                const s = staffMap[pid]
                const name = s ? `${s.last_name} ${s.first_name}` : '·'
                return (
                  <div key={pid} className="flex items-start gap-2 py-2">
                    {/* Identite (colonne gauche) : avatar + nom sur une seule ligne, aligne en haut */}
                    <div className="flex items-center gap-1.5 w-36 shrink-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--brand-tint)] text-[var(--brand-surface)] dark:text-[var(--brand-accent)] text-[10px] font-bold shrink-0">
                        {s ? getInitials(s.first_name, s.last_name) : '??'}
                      </span>
                      <TruncatedText text={name} className="text-[11px] font-bold text-warm-800" />
                    </div>
                    {/* Saisies (colonne droite) */}
                    <div className="flex-1 min-w-0 space-y-1">
                    {pEntries.map(e => {
                      const pt = findPresenceType(presenceTypes, e.entry_type)
                      const color = pt?.color ?? FALLBACK_COLOR
                      const label = pt?.label ?? e.entry_type
                      const isAbs = pt?.is_absence ?? false
                      const targetIsTeacher = staffMap[e.profile_id]?.role === 'enseignant'
                      // Heure de COURS ou d'ACTIVITE : nee d'une seance de l'EDT et de sa
                      // validation (decision du 28/10). Elle ne se modifie ni ne se
                      // supprime ici : la retirer laisserait la seance « validee » sans heure.
                      const issueDeLEdt = pt?.reserved_kind === 'cours' || pt?.reserved_kind === 'activite'
                      const canEdit = !issueDeLEdt && (canWriteAll
                        || (isRespPedago && (targetIsTeacher || e.profile_id === currentUserId)))
                      return (
                        // `flex-wrap` : TOUS les elements de cette ligne portent
                        // `shrink-0` (libelle, horaire, duree, actions) — elle ne
                        // pouvait donc ni se replier ni retrecir, et debordait du
                        // panneau en poussant une barre de defilement sur la page.
                        // D ou « COURS 09:00-12:0 » coupe net.
                        <div key={e.id} className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]" style={entryStyle(color)}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={dotStyle(color)} />
                          <span className="font-medium shrink-0">{label}</span>
                          {!isAbs && e.start_time && (
                            <span className="text-warm-700 shrink-0">{fmtTime(e.start_time)}-{fmtTime(e.end_time)}</span>
                          )}
                          <span className="text-warm-700 shrink-0">{fmtDuration(e.duration_minutes)}</span>
                          {e.notes && (
                            <TruncatedText text={e.notes} className="italic text-warm-700 text-[10px]" />
                          )}
                          {e.is_replacement && e.replaced_profile_id && (
                            <TruncatedText
                              text={`rempl. ${staffMap[e.replaced_profile_id]?.last_name ?? ''}`}
                              tooltip={`Remplace ${staffMap[e.replaced_profile_id]?.last_name ?? ''} ${staffMap[e.replaced_profile_id]?.first_name ?? ''}`.trim()}
                              className="italic text-warm-700 text-[10px]"
                            />
                          )}
                          {isAbs && e.start_time && e.end_time && (
                            <span className="text-warm-700 text-[10px] font-medium shrink-0 tabular-nums">
                              {fmtTime(e.start_time)}-{fmtTime(e.end_time)}
                            </span>
                          )}
                          {isAbs && e.absence_reason && (
                            <TruncatedText text={e.absence_reason} className="italic text-warm-700 text-[10px]" />
                          )}
                          {canEdit && (
                            <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                              <Tooltip content="Modifier">
                                <button
                                  onClick={() => { setEditingEntry(e); setModalOpen(true) }}
                                  aria-label="Modifier la saisie"
                                  className="p-1 rounded text-warm-700 hover:text-secondary-800 hover:bg-white/50 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                                >
                                  <Pencil size={12} />
                                </button>
                              </Tooltip>
                              <Tooltip content="Supprimer">
                                <button
                                  onClick={() => setDeleteConfirm(e.id)}
                                  aria-label="Supprimer la saisie"
                                  className="p-1 rounded text-warm-700 hover:text-red-700 hover:bg-white/50 outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </Tooltip>
                            </span>
                          )}
                          {issueDeLEdt && (
                            <Tooltip content="Heure validée dans l’emploi du temps" className="ml-auto flex-shrink-0">
                              <span role="img" aria-label="Heure validée dans l’emploi du temps" className="p-1 inline-flex text-warm-700">
                                <CalendarCheck size={12} />
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )
              })}
            </>)}
          </div>

          {/* Day total */}
          {dayEntries.length > 0 && (
            <div className="px-4 py-2 border-t border-warm-100 bg-warm-50 text-xs font-bold text-warm-700 flex items-center gap-1.5">
              {/* Les ABSENCES sont exclues : le total dit les heures TRAVAILLEES.
                  Un membre absent 3 h le matin et present 3 h l'apres-midi
                  affichait 6 h (vu a l'ecran le 24/09). Le recapitulatif ecarte
                  deja les absences (`filter(p => !p.is_absence)`) ; cette ligne
                  etait la seule restee en dehors de la regle. */}
              <Clock size={12} /> Total jour : {fmtDuration(
                dayEntries
                  .filter(e => !(findPresenceType(presenceTypes, e.entry_type)?.is_absence ?? false))
                  .reduce((s, e) => s + e.duration_minutes, 0)
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modale d'un recapitulatif (mensuel OU annuel) ────────────── */}
      {canSeeRecap && recapModal && (() => {
        const isMonth = recapModal === 'month'
        const modalTitle = isMonth
          ? `Récapitulatif mensuel · ${MONTH_NAMES[month]} ${year}`
          : (schoolYearLabel ? `Récapitulatif annuel · ${schoolYearLabel}` : 'Récapitulatif annuel')
        const recap = isMonth ? monthlyRecap : annualRecap
        const emptyMsg = isMonth ? 'Aucune saisie ce mois' : 'Aucune saisie cette année'
        return (
          <FormModal
            title={modalTitle}
            onClose={() => setRecapModal(null)}
            maxWidth="max-w-4xl"
            footer={<>
              {recap.rows.length > 0 && (
                <FloatButton variant="secondary" type="button" onClick={() => handleExportPdf(isMonth ? 'month' : 'year')} loading={exporting}>
                  Exporter PDF
                </FloatButton>
              )}
              <div className="flex-1" />
              <FloatButton variant="secondary" type="button" onClick={() => setRecapModal(null)}>Fermer</FloatButton>
            </>}
          >
            {/* Legende des taux horaires (une fois, si couts visibles) */}
            {canSeeCosts && presenceTypeRates.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                <span className="font-semibold text-warm-700">Taux horaires</span>
                {nonAbsenceTypes.map(pt => {
                  const rate = presenceTypeRates.find(r => r.presence_type_id === pt.id)?.rate ?? 0
                  if (!rate) return null
                  return <span key={pt.id} style={{ color: pt.color }}>{pt.label} {fmtEur(rate)}/h</span>
                })}
              </div>
            )}

            {renderRecapTable(recap, modalTitle, emptyMsg)}
          </FormModal>
        )
      })()}

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {modalOpen && (
        <TimeEntryModal
          vacations={vacations}
          feries={feries}
          date={selectedDay}
          entry={editingEntry}
          currentUserId={currentUserId}
          canManage={canManage}
          staffList={assignableStaff}
          presenceTypes={presenceTypes}
          existingEntries={dayEntries}
          onClose={() => { setModalOpen(false); setEditingEntry(null) }}
          onSaved={() => { setModalOpen(false); setEditingEntry(null); fetchEntries(); fetchYearEntries() }}
        />
      )}

      {/* ── Confirmation / blocage de suppression ────────────────────── */}
      {deleteConfirm && (() => {
        const entry = entries.find(e => e.id === deleteConfirm)
        const deps = blockingReplacements(entry)
        const blocked = deps.length > 0
        const depNames = [...new Set(deps.map(d => {
          const s = staffMap[d.profile_id]
          return s ? `${s.last_name} ${s.first_name}` : '·'
        }))]

        // Recap de la saisie a supprimer (pour confirmer la bonne donnee).
        const s = entry ? staffMap[entry.profile_id] : undefined
        const pt = entry ? findPresenceType(presenceTypes, entry.entry_type) : undefined
        const isAbs = pt?.is_absence ?? false
        const dateLbl = entry ? new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
        const rs = entry?.replaced_profile_id ? staffMap[entry.replaced_profile_id] : undefined
        const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-warm-700">{label}</span>
            <span className="text-warm-700 font-medium">{children}</span>
          </div>
        )
        const detail = entry ? (
          <div className="space-y-2">
            <p className="text-sm text-warm-700">Cette saisie sera définitivement supprimée :</p>
            <div className="rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-xs space-y-1">
              <Row label="Membre">{s ? `${s.last_name} ${s.first_name}` : '·'}</Row>
              <Row label="Type"><span style={{ color: pt?.color }} className="font-semibold">{pt?.label ?? entry.entry_type}</span></Row>
              <Row label="Date"><span className="capitalize">{dateLbl}</span></Row>
              <Row label="Horaire">{fmtTime(entry.start_time)}-{fmtTime(entry.end_time)} ({fmtDuration(entry.duration_minutes)})</Row>
              {isAbs && entry.absence_reason && <Row label="Motif">{entry.absence_reason}</Row>}
              {entry.is_replacement && rs && <Row label="Remplacement">Remplace {rs.last_name} {rs.first_name}</Row>}
            </div>
          </div>
        ) : undefined

        return (
          <ConfirmModal
            variant={blocked ? 'warning' : 'danger'}
            title={blocked ? 'Suppression impossible' : 'Supprimer la saisie'}
            message={blocked
              ? `Cette absence justifie ${pluriel(deps.length, 'remplacement')} ce jour (${depNames.join(', ')}). Supprimez d'abord ces saisies de remplacement.`
              : 'Cette saisie de temps de présence sera définitivement supprimée.'}
            confirmLabel="Supprimer"
            confirmDisabled={blocked}
            cancelLabel={blocked ? 'Fermer' : 'Annuler'}
            onConfirm={() => handleDelete(deleteConfirm)}
            onCancel={() => setDeleteConfirm(null)}
          >
            {!blocked ? detail : undefined}
          </ConfirmModal>
        )
      })()}
    </div>
  )
}
