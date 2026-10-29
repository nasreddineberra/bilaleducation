'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { clsx } from 'clsx'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { logAudit } from '@/lib/audit'
import { erreurEcriture, erreurEcritureLot } from '@/lib/supabase/ecriture'
import { usePetitEcran } from '@/hooks/usePetitEcran'
import { useToast } from '@/lib/toast-context'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FormModal from '@/components/ui/FormModal'
import Tooltip from '@/components/ui/Tooltip'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import DayColumn from './DayColumn'
import MonthGrid from './MonthGrid'
import SlotFormModal from './SlotFormModal'
import ConfirmationSeance, { type ModeConfirmationSeance } from './ConfirmationSeance'
import SubjectPalette, { type PaletteSubject } from './SubjectPalette'
import { nomEnseignantCivilite } from '@/lib/teachers/nom'
import { intituleCreneau } from '@/lib/edt/intitule'
import { titulaireActuel } from '@/lib/teachers/titulaire'
import { indexTitulaires, affectationsDesClasses, enseignantDeSeance, fusionnerDecisions, salleDeSeance, type DecisionSeance } from '@/lib/edt/seance'
import { absenceDeSeance, type AbsenceEnseignant } from '@/lib/edt/absences'
import { phraseRefusAbsence } from '@/lib/absences-enseignants/libelles'
import { sallesLibres } from '@/lib/edt/salles'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi',
  4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi',
}

const DAY_LABELS_SHORT: Record<number, string> = {
  0: 'DIM', 1: 'LUN', 2: 'MAR', 3: 'MER',
  4: 'JEU', 5: 'VEN', 6: 'SAM',
}

// Amplitude AFFICHEE par defaut. Elle commande la hauteur d'une heure — donc ce
// qui tient dans une capsule : a 12 heures affichees, une heure fait ~55 px et le
// detail d'un creneau (~70 px) ne rentre pas ; a 11 heures elle en fait ~60.
// Passee de 7h a 8h le 03/10 : personne ne commence a 7h, et cette bande vide
// coutait de la hauteur a tous les creneaux de la journee.
//
// A SURVEILLER : ces bornes sont les memes pour TOUTES les ecoles, alors que
// l'etablissement parametre deja ses jours travailles (`working_days`,
// `week_start_day`). Les rendre parametrables = 2 colonnes sur `etablissements`
// + 2 champs dans sa fiche ; le chemin existe deja, `DayColumn` recoit
// `startHour`/`endHour` en props.
const DEFAULT_START = 8
const DEFAULT_END = 19

// Ordre des jours dynamique selon weekStartDay
function buildDayOrder(startDay: number): number[] {
  const days: number[] = []
  for (let i = 0; i < 7; i++) days.push((startDay + i) % 7)
  return days
}

const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SlotData {
  id: string
  class_id: string
  teacher_id: string | null   // NULL = « Prof non affecté »
  cours_id: string | null
  room_id: string | null
  is_recurring: boolean
  day_of_week: number | null
  slot_date: string | null
  start_time: string
  end_time: string
  slot_type: string
  color: string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean
  classes?: { name: string }
  teachers?: { first_name: string; last_name: string; civilite?: string }
  cours?: { nom_fr: string } | null
  unite_enseignement_id: string | null
  libelle: string | null
  unites_enseignement?: { nom_fr: string } | null
  rooms?: { name: string } | null
}

export interface ExceptionData {
  id: string
  schedule_slot_id: string
  exception_date: string
  exception_type: 'cancelled' | 'modified'
  remplacant_teacher_id?: string | null
  override_room_id: string | null
}

/** Exception telle que la lit la resolution : decisions d'absence fondues (`fusionnerDecisions`). */
type ExceptionVue = ExceptionData & { remplacant_profil_id?: string | null; par_absence?: boolean; absence_id?: string }

/** L'exception qui decide de l'enseignant : une seance annulee garde, a l'affichage, son enseignant. */
const exceptionActive = (e: ExceptionVue | undefined): ExceptionVue | null =>
  e && e.exception_type !== 'cancelled' ? e : null

/** Enseignant AFFICHE sur la capsule : le titulaire quand un remplacant d'absence assure
 *  la seance (il est annonce a part, « Remplacé par »), sinon celui qui assure. */
const enseignantAffiche = (q: { teacherId: string | null; titulaireId: string | null; remplacantProfileId: string | null }) =>
  q.remplacantProfileId ? q.titulaireId : q.teacherId

interface ClassData {
  id: string
  name: string
  level: string
  room_id?: string | null
  day_of_week?: string | null
  start_time?: string | null
  end_time?: string | null
  teaching_mode?: 'single' | 'multi'
  cotisation_types?: { label: string } | null
  class_teachers: {
    teacher_id: string
    is_main_teacher: boolean
    subject?: string | null
    // Bornes de l'affectation : c'est ce qui permet a un REMPLACANT de voir les
    // creneaux de la classe qu'il couvre, pendant la periode ou il la couvre.
    effective_from?: string | null
    effective_until?: string | null
    teachers: { id: string; first_name: string; last_name: string; civilite?: string }
  }[]
}

interface UEData {
  id: string
  nom_fr: string
  code: string | null
  color: string | null
}

interface TeacherData {
  id: string
  first_name: string
  last_name: string
  civilite?: string
  user_id?: string | null
}

interface RoomData {
  id: string
  name: string
  room_type: string
  capacity: number | null
}

interface CoursData {
  id: string
  nom_fr: string
  unite_enseignement_id: string
  unites_enseignement?: { nom_fr: string }
}

interface ValidationData {
  id: string
  schedule_slot_id: string
  profile_id: string
  validation_date: string
  time_entry_id: string | null
}

/** A "resolved" slot for display — can be a recurring slot (possibly modified) or a ponctual slot */
export interface ResolvedSlot {
  id: string
  sourceSlotId: string
  isRecurring: boolean
  isModified: boolean
  exceptionId?: string
  date: string // YYYY-MM-DD of the actual day
  dayOfWeek: number
  class_id: string
  teacher_id: string | null   // NULL = « Prof non affecté »
  cours_id: string | null
  room_id: string | null
  start_time: string
  end_time: string
  slot_type: string
  color: string | null
  /** Seance annulee : affichee grisee (« ANNULÉ »), sans validation, reactivable. */
  annulee?: boolean
  /** Annulee POUR UNE ABSENCE d'enseignant : se regle depuis l'absence, pas depuis l'EDT. */
  parAbsence?: boolean
  /** Absence d'enseignant qui touche la seance (menu « Régler l'absence »). */
  absenceId?: string | null
  /** Titulaire absent et rien de decide : ni validation, ni remplacant. */
  aDecider?: boolean
  /** Remplacant designe par l'absence (un compte, fiche enseignant ou non). */
  remplacant?: { profileId: string; personne: { first_name: string; last_name: string; civilite?: string | null } | null } | null
  classes?: { name: string }
  teachers?: { first_name: string; last_name: string; civilite?: string }
  cours?: { nom_fr: string } | null
  unite_enseignement_id: string | null
  libelle: string | null
  unites_enseignement?: { nom_fr: string } | null
  rooms?: { name: string } | null
}

type ViewMode = 'global' | 'class' | 'teacher'

interface Props {
  currentUserId: string
  currentUserName: string
  role: string
  canEdit: boolean
  schoolYearId: string
  classes: ClassData[]
  teachers: TeacherData[]
  slots: SlotData[]
  exceptions: ExceptionData[]
  rooms: RoomData[]
  coursList: CoursData[]
  ueList: UEData[]
  todayValidations: ValidationData[]
  weekStartDay?: number  // 0=Dimanche, 1=Lundi, 6=Samedi
  workingDays?: number   // 5=Lun-Ven, 7=Lun-Dim
  schoolYearStartDate?: string | null  // YYYY-MM-DD
  schoolYearEndDate?: string | null    // YYYY-MM-DD
  vacations?: { start_date: string; end_date: string; label: string }[]
  /** Jours feries de l'annee : une journee fermee au meme titre qu'une vacance. */
  feries?: { date: string; label: string }[]
  /** Absences d'enseignant (lot 3) : toutes celles de l'ecole pour l'encadrement, les
   *  siennes pour l'enseignant (RLS). */
  absencesEnseignants?: AbsenceEnseignant[]
  /** Decisions d'absence des seances de l'annee (remplacee / annulee). */
  decisions?: DecisionSeance[]
  /** Noms des remplacants (`profiles.id`), fiche enseignant ou non. */
  nomsProfils?: Record<string, { first_name: string; last_name: string; civilite?: string | null }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Jour de la classe = string DB (monday…) — DAY_LABELS est indexe par nombre.
const DAY_STR_LABELS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi',
  friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

// Info affichee apres le select : cotisation · Niveau (si renseigne) · horaires.
// PAS l'enseignant (deja affiche dans le select classe) — doublon.
function classInfoLine(c: ClassData): string {
  const parts: string[] = []
  if (c.cotisation_types?.label) parts.push(c.cotisation_types.label)
  if (c.level) parts.push(`Niveau ${c.level}`)
  if (c.day_of_week && c.start_time) {
    const day = DAY_STR_LABELS[c.day_of_week] ?? c.day_of_week
    parts.push(`${day} ${c.start_time.slice(0, 5)}${c.end_time ? `-${c.end_time.slice(0, 5)}` : ''}`)
  }
  return parts.join(' · ')
}

function getWeekStartOf(d: Date, startDay: number) {
  const day = d.getDay()
  const diff = (day - startDay + 7) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
}

function getWeekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateFull(d: Date) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

/** `12/10` — forme courte pour le bandeau de semaine sur telephone. */
function fmtDateCourt(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Vérifie si un créneau récurrent est effectif à une date donnée */
function isSlotEffective(slot: SlotData, dateStr: string): boolean {
  if (slot.effective_from && dateStr < slot.effective_from) return false
  if (slot.effective_until && dateStr > slot.effective_until) return false
  return true
}

// Bouton icone de navigation (precedent / suivant / revenir) : focus visible.
const NAV_ICONE = 'p-1 rounded-lg hover:bg-warm-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]'

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Libelles des trois bascules de vue. La forme COURTE ne sert que sous le seuil
 * mobile : « Globale | Par classe | Par enseignant » occupe ~264 px, soit 84 %
 * des ~316 px utiles d'un telephone — a elles seules, les bascules prenaient
 * une ligne entiere. Sans le « Par », elles tombent a ~210 px et le bouton
 * « Ajouter » tient a cote : une ligne de toolbar rendue a la grille.
 */
const LIBELLES_VUE: Record<ViewMode, { court: string; long: string }> = {
  global:  { court: 'Globale',    long: 'Globale' },
  class:   { court: 'Classe',     long: 'Par classe' },
  teacher: { court: 'Enseignant', long: 'Par enseignant' },
}

export default function EmploiDuTempsClient({
  currentUserId, role, canEdit, schoolYearId,
  classes, teachers, slots: initialSlots, exceptions: initialExceptions,
  rooms, coursList, ueList, todayValidations: initialValidations,
  weekStartDay = 1,
  workingDays = 5,
  schoolYearStartDate, schoolYearEndDate, vacations = [], feries = [],
  absencesEnseignants = [], decisions = [], nomsProfils = {},
}: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const classesRef = useRef(classes)
  classesRef.current = classes

  // Les METHODES sont stables (useCallback dans le fournisseur), l'objet ne l'est
  // pas : il change a chaque notification. On depend des methodes.
  const { success: toastSuccess, error: toastError } = useToast()
  const router = useRouter()
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; title?: string; variant?: 'danger' | 'warning'; confirmLabel?: string; onConfirm: () => void } | null>(null)

  // Id (teachers.id) de l'enseignant connecté — resolu depuis son compte (user_id),
  // et non l'id du profil : sinon le filtre `teacher_id === selectedTeacherId` ne matche jamais.
  const ownTeacherId = role === 'enseignant'
    ? (teachers.find(t => t.user_id === currentUserId)?.id ?? '')
    : ''

  /**
   * L'enseignant n'arbitre pas entre les plannings : il consulte LE SIEN.
   *
   * Les trois bascules (Globale / Par classe / Par enseignant) et les deux
   * listes deroulantes sont donc MASQUEES pour lui — masquees et non grisees,
   * car il n'existe aucun cas ou elles lui serviraient : l'ecriture de
   * `schedule_slots` lui est fermee depuis le lot 3 du chantier RLS, et la
   * validation de presence est deja bornee a ses propres creneaux
   * (`showValidation = canEdit || (isTeacher && isOwnSlot)`, fix du 10 juillet).
   *
   * CE N'EST QU'UN MASQUAGE D'INTERFACE, et c'est DELIBERE :
   * `schedule_slots_select` accorde la lecture a tout le personnel, sans bornage
   * par classe. Decision du 29 septembre, inscrite dans la migration du lot 3 —
   * « l'EDT est un document d'organisation collective, chacun doit voir ou sont
   * les autres ». Confirmee le 6 octobre : la borner priverait un remplacant du
   * planning de la classe qu'il couvre, et un emploi du temps ne porte ni note,
   * ni absence, ni montant — rien que le personnel ne sache deja.
   *
   * CE MASQUAGE A CREE UN TROU, referme le 6 octobre : un remplacant ne voyait
   * plus ses creneaux de remplacement. Depuis le lot 3 (28/10), les seances
   * qu'il remplace viennent des decisions d'absence (`remplacant` de la seance) :
   * voir `profilVu`.
   */
  const estEnseignant = role === 'enseignant'


  const [slots, setSlots] = useState<SlotData[]>(initialSlots)
  const [exceptions, setExceptions] = useState<ExceptionData[]>(initialExceptions)
  const [validations, setValidations] = useState<ValidationData[]>(initialValidations)
  const [viewMode, setViewMode] = useState<ViewMode>(
    role === 'enseignant' ? 'teacher' : 'global'
  )
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(ownTeacherId)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  // Map teacher_id (teachers table) → profile_id (profiles/user_id)
  const teacherProfileMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const t of teachers) {
      if (t.user_id) map[t.id] = t.user_id
    }
    return map
  }, [teachers])

  // View type: week or month
  const [viewType, setViewType] = useState<'week' | 'month'>('week')
  // Vue « Jour » (grand ecran) : la semaine filtree sur UNE journee, avec les memes fleches
  // de navigation que le telephone. Ce n'est pas un 3e `viewType` : tout le rendu et la
  // navigation par semaine existent deja, il suffit de fixer `selectedDay`.
  const [vueJour, setVueJour] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)

  const currentMonth = useMemo(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    return { month: d.getMonth(), year: d.getFullYear() }
  }, [monthOffset])

  const isCurrentMonth = monthOffset === 0

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [prefillDay, setPrefillDay] = useState<number | null>(null)
  const [prefillTime, setPrefillTime] = useState<string | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slot: ResolvedSlot; isLastCol: boolean } | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ─── Week navigation ──────────────────────────────────────────────────────

  const [weekOffset, setWeekOffset] = useState(0)
  const allDays = useMemo(() => buildDayOrder(weekStartDay), [weekStartDay])
  // Filter to working days only (5 = first 5 days from weekStartDay, 7 = all)
  const orderedDays = useMemo(() => {
    if (workingDays >= 7) return allDays
    return allDays.slice(0, workingDays)
  }, [allDays, workingDays])

  const currentWeekStart = useMemo(() => {
    const m = getWeekStartOf(new Date(), weekStartDay)
    m.setDate(m.getDate() + weekOffset * 7)
    return m
  }, [weekOffset, weekStartDay])

  const currentWeekEnd = useMemo(() => {
    const s = new Date(currentWeekStart)
    s.setDate(currentWeekStart.getDate() + 6)
    return s
  }, [currentWeekStart])

  const weekNum = getWeekNumber(currentWeekStart)
  const isCurrentWeek = weekOffset === 0

  // Map: dayOfWeek → date string "YYYY-MM-DD"
  const weekDayDates = useMemo(() => {
    const map: Record<number, string> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart)
      d.setDate(currentWeekStart.getDate() + i)
      map[d.getDay()] = formatDate(d)
    }
    return map
  }, [currentWeekStart])

  // Map: dayOfWeek → "DD/MM/YYYY" for display
  const dayDatesDisplay = useMemo(() => {
    const map: Record<number, string> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart)
      d.setDate(currentWeekStart.getDate() + i)
      map[d.getDay()] = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }
    return map
  }, [currentWeekStart])

  const todayRealDow = new Date().getDay()
  const todayDow = isCurrentWeek ? todayRealDow : -1

  // ─── Telephone : une JOURNEE a la fois ────────────────────────────────────
  //
  // Le filtre par jour existait deja (`selectedDay` reduit `activeDays` a une
  // colonne) ; il manquait un defaut et, surtout, UN MOYEN DE CHANGER DE JOUR.
  // Les en-tetes de jour SONT les boutons de filtre : en vue filtree il n en
  // reste qu un, donc sans les fleches ci-dessous on resterait coince sur une
  // seule journee — acceptable comme confort sur grand ecran, bloquant ici.
  const petitEcran = usePetitEcran()

  // CE QUE NOUS AVONS IMPOSE POUR LE PETIT ECRAN, et qu il faut donc DEFAIRE en
  // repassant au-dessus du seuil. Sans ces deux marqueurs, l affichage restait
  // fige sur un seul jour apres un simple redimensionnement de la fenetre
  // (signale a l ecran le 5 octobre) : l aller etait code, pas le retour.
  //
  // Un marqueur plutot qu une remise a zero systematique, car `selectedDay` et
  // `viewType` sont des reglages que l UTILISATEUR pose aussi lui-meme sur grand
  // ecran (filtre par jour, bascule Semaine/Mois). Les effacer au retour lui
  // reprendrait son choix — on ne defait que ce qu on a impose soi-meme.
  const jourImposeRef = useRef(false)
  const vueImposeeRef = useRef(false)

  // Aujourd hui, ou le premier jour travaille si l on est samedi/dimanche dans
  // une ecole qui ne travaille pas ce jour-la.
  useEffect(() => {
    if (petitEcran) {
      if (selectedDay === null && orderedDays.length > 0) {
        jourImposeRef.current = true
        setSelectedDay(orderedDays.includes(todayRealDow) ? todayRealDow : orderedDays[0])
      }
    } else if (jourImposeRef.current) {
      jourImposeRef.current = false
      setSelectedDay(null)
    }
  }, [petitEcran, selectedDay, orderedDays, todayRealDow])

  // La vue MOIS n a pas de sens sur un telephone, et son bascule est masque :
  // sans ce repli, qui l aurait laissee active en tournant son ecran y resterait
  // enferme, le bouton pour en sortir ayant disparu.
  useEffect(() => {
    if (petitEcran) {
      if (viewType !== 'week') {
        vueImposeeRef.current = true
        setViewType('week')
      }
    } else if (vueImposeeRef.current) {
      vueImposeeRef.current = false
      setViewType('month')
    }
  }, [petitEcran, viewType])

  // Avance d un JOUR TRAVAILLE, en changeant de semaine aux bornes : un
  // vendredi suivi d un lundi, jamais un samedi que l ecole n ouvre pas.
  const choisirVue = useCallback((v: 'jour' | 'week' | 'month') => {
    setVueJour(v === 'jour')
    setViewType(v === 'month' ? 'month' : 'week')
    if (v === 'jour') {
      // Jour courant s'il est travaille et visible, sinon le premier jour de la semaine.
      setSelectedDay(orderedDays.includes(todayRealDow) && weekOffset === 0 ? todayRealDow : orderedDays[0] ?? null)
    } else {
      setSelectedDay(null)
    }
  }, [orderedDays, todayRealDow, weekOffset])

  const allerAuJour = useCallback((delta: number) => {
    setSelectedDay(jour => {
      if (jour === null || orderedDays.length === 0) return jour
      const i = orderedDays.indexOf(jour)
      if (i === -1) return jour
      const j = i + delta
      if (j < 0) {
        setWeekOffset(o => o - 1)
        return orderedDays[orderedDays.length - 1]
      }
      if (j >= orderedDays.length) {
        setWeekOffset(o => o + 1)
        return orderedDays[0]
      }
      return orderedDays[j]
    })
  }, [orderedDays])

  // ─── Resolve slots for this week ──────────────────────────────────────────

  // Helper : la date est-elle en vacances ?
  // Vacances ET feries, par la source unique : les trois ecrans qui posent la
  // question « peut-on faire cours ce jour-la » doivent y repondre pareil.
  const getVacationLabel = useCallback(
    (dateStr: string): string | null => jourFerme(dateStr, vacations, feries)?.label ?? null,
    [vacations, feries],
  )

  // Helper : la date est-elle dans la période scolaire et hors vacances ?
  const isSchoolDay = useCallback((dateStr: string) => {
    if (schoolYearStartDate && dateStr < schoolYearStartDate) return false
    if (schoolYearEndDate && dateStr > schoolYearEndDate) return false
    if (getVacationLabel(dateStr)) return false
    return true
  }, [schoolYearStartDate, schoolYearEndDate, getVacationLabel])

  // Decisions d'absence FONDUES dans les exceptions (lib/edt/seance.ts) : la
  // resolution les lit comme le reste. `exceptions` reste ce que l'EDT ECRIT
  // (annulation, salle) ; les decisions s'ecrivent depuis la page Absences.
  const enseignantDuProfil = useMemo(() => {
    const m = new Map(teachers.filter(t => t.user_id).map(t => [t.user_id as string, t.id]))
    return (profileId: string) => m.get(profileId) ?? null
  }, [teachers])
  const exceptionsVues = useMemo(
    () => fusionnerDecisions(exceptions as ExceptionVue[], decisions, enseignantDuProfil),
    [exceptions, decisions, enseignantDuProfil],
  )

  // ── Qui assure une seance : DEDUIT (lib/edt/seance.ts), jamais lu sur le creneau ──
  const titulaireDe = useMemo(() => indexTitulaires(affectationsDesClasses(classes)), [classes])
  const quiAssure = useCallback(
    (slot: SlotData, date: string, exception: ExceptionVue | null) =>
      enseignantDeSeance(slot.class_id, date, exception, titulaireDe),
    [titulaireDe],
  )
  // ── Salle d'une seance : DEDUITE (lib/edt/seance.ts, `salleDeSeance`) ──
  const salleDeClasse = useMemo(() => {
    const parClasse = new Map(classes.map(c => [c.id, c.room_id ?? null]))
    return (classId: string) => parClasse.get(classId) ?? null
  }, [classes])
  const salleDe = useCallback(
    (slot: SlotData, exception: ExceptionData | null | undefined) =>
      salleDeSeance(slot, exception, salleDeClasse(slot.class_id)),
    [salleDeClasse],
  )
  const salleAffichee = useCallback((slot: SlotData, exception: ExceptionData | null | undefined) => {
    const id = salleDe(slot, exception)
    if (!id) return null
    return rooms.find(r => r.id === id) ?? (id === slot.room_id ? slot.rooms ?? null : null)
  }, [salleDe, rooms])

  // Noms : la liste des enseignants, completee par ceux lus dans les affectations
  // (un remplacant ne lit pas toujours la fiche du titulaire).
  const enseignantParId = useMemo(() => {
    const parId = new Map<string, { first_name: string; last_name: string; civilite?: string }>()
    for (const c of classes) for (const ct of c.class_teachers ?? []) if (ct.teachers) parId.set(ct.teacher_id, ct.teachers)
    for (const t of teachers) parId.set(t.id, t)
    return (id: string | null) => (id ? parId.get(id) : undefined)
  }, [classes, teachers])

  // Etat d'absence d'une seance (lot 3) : decision (remplacee / annulee), ou
  // « a decider » quand le titulaire est absent et que rien n'est decide.
  const infosAbsence = useCallback((slot: SlotData, date: string, debut: string, fin: string, exception: ExceptionVue | null | undefined) => {
    if (exception?.par_absence) {
      const p = exception.remplacant_profil_id ?? null
      return {
        parAbsence: true,
        absenceId: exception.absence_id ?? null,
        aDecider: false,
        remplacant: p ? { profileId: p, personne: nomsProfils[p] ?? null } : null,
      }
    }
    const absence = exception?.exception_type === 'cancelled'
      ? undefined
      : absenceDeSeance(absencesEnseignants, titulaireDe(slot.class_id, date), date, debut, fin)
    return { parAbsence: false, absenceId: absence?.id ?? null, aDecider: !!absence, remplacant: null }
  }, [absencesEnseignants, nomsProfils, titulaireDe])

  const resolvedSlots = useMemo(() => {
    const result: ResolvedSlot[] = []
    const weekDates = Object.values(weekDayDates)

    // 1. Recurring slots
    for (const slot of slots) {
      if (!slot.is_recurring || slot.day_of_week === null) continue
      const date = weekDayDates[slot.day_of_week]
      if (!date) continue

      // Ne pas afficher si hors période effective du créneau
      if (!isSlotEffective(slot, date)) continue

      // Ne pas afficher hors période scolaire ou en vacances
      if (!isSchoolDay(date)) continue

      // Check for exception on this date
      const exception = exceptionsVues.find(
        ex => ex.schedule_slot_id === slot.id && ex.exception_date === date
      )

      if (exception?.exception_type === 'modified') {
        // Show with overrides
        result.push({
          id: `${slot.id}-${date}`,
          sourceSlotId: slot.id,
          isRecurring: true,
          isModified: true,
          exceptionId: exception.id,
          date,
          dayOfWeek: slot.day_of_week,
          class_id: slot.class_id,
          teacher_id: enseignantAffiche(quiAssure(slot, date, exception)),
          cours_id: slot.cours_id,
          room_id: salleDe(slot, exception),
          start_time: slot.start_time,
          end_time: slot.end_time,
          slot_type: slot.slot_type,
          ...infosAbsence(slot, date, slot.start_time, slot.end_time, exception),
          color: slot.color,
          classes: slot.classes,
          teachers: enseignantParId(enseignantAffiche(quiAssure(slot, date, exception))),
          cours: slot.cours,
          unites_enseignement: slot.unites_enseignement,
          unite_enseignement_id: slot.unite_enseignement_id,
          libelle: slot.libelle,
          rooms: salleAffichee(slot, exception),
        })
      } else {
        // Normal recurring
        result.push({
          id: `${slot.id}-${date}`,
          sourceSlotId: slot.id,
          isRecurring: true,
          isModified: false,
          // Annulee : AFFICHEE (grisee, « ANNULÉ »), reactivable depuis le menu.
          annulee: exception?.exception_type === 'cancelled',
          exceptionId: exception?.id,
          date,
          dayOfWeek: slot.day_of_week,
          class_id: slot.class_id,
          teacher_id: enseignantAffiche(quiAssure(slot, date, exceptionActive(exception))),
          cours_id: slot.cours_id,
          room_id: salleDe(slot, exception),
          start_time: slot.start_time,
          end_time: slot.end_time,
          slot_type: slot.slot_type,
          ...infosAbsence(slot, date, slot.start_time, slot.end_time, exception),
          color: slot.color,
          classes: slot.classes,
          teachers: enseignantParId(enseignantAffiche(quiAssure(slot, date, exceptionActive(exception)))),
          cours: slot.cours,
          unites_enseignement: slot.unites_enseignement,
          unite_enseignement_id: slot.unite_enseignement_id,
          libelle: slot.libelle,
          rooms: salleAffichee(slot, exception),
        })
      }
    }

    // 2. Ponctual slots
    for (const slot of slots) {
      if (slot.is_recurring || !slot.slot_date) continue
      if (!weekDates.includes(slot.slot_date)) continue

      const d = new Date(slot.slot_date + 'T00:00:00')

      const exPonctuelle = exceptionsVues.find(ex => ex.schedule_slot_id === slot.id && ex.exception_date === slot.slot_date)
      result.push({
        id: slot.id,
        sourceSlotId: slot.id,
        isRecurring: false,
        isModified: false,
        annulee: exPonctuelle?.exception_type === 'cancelled',
        exceptionId: exPonctuelle?.id,
        date: slot.slot_date,
        dayOfWeek: d.getDay(),
        class_id: slot.class_id,
        teacher_id: enseignantAffiche(quiAssure(slot, slot.slot_date, exceptionActive(exPonctuelle))),
        cours_id: slot.cours_id,
        room_id: salleDe(slot, exPonctuelle),
        start_time: slot.start_time,
        end_time: slot.end_time,
        slot_type: slot.slot_type,
        ...infosAbsence(slot, slot.slot_date, slot.start_time, slot.end_time, exPonctuelle),
        color: slot.color,
        classes: slot.classes,
        teachers: enseignantParId(enseignantAffiche(quiAssure(slot, slot.slot_date, exceptionActive(exPonctuelle)))),
        cours: slot.cours,
        unites_enseignement: slot.unites_enseignement,
        unite_enseignement_id: slot.unite_enseignement_id,
        libelle: slot.libelle,
        rooms: salleAffichee(slot, exPonctuelle),
      })
    }

    return result
  }, [slots, exceptionsVues, weekDayDates, isSchoolDay, infosAbsence, quiAssure, enseignantParId, salleDe, salleAffichee])

  // ─── Month-scoped resolved slots ─────────────────────────────────────────

  const resolvedMonthSlots = useMemo(() => {
    if (viewType !== 'month') return []

    const result: ResolvedSlot[] = []
    const firstOfMonth = new Date(currentMonth.year, currentMonth.month, 1)
    const lastOfMonth = new Date(currentMonth.year, currentMonth.month + 1, 0)

    // Extend to full calendar weeks
    const firstDow = firstOfMonth.getDay()
    const offset = (firstDow - weekStartDay + 7) % 7
    const calStart = new Date(currentMonth.year, currentMonth.month, 1 - offset)
    const cursor = new Date(calStart)
    const allDates: string[] = []
    while (cursor <= lastOfMonth || allDates.length % 7 !== 0) {
      allDates.push(formatDate(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    // Build a datesByDow map for recurring lookup
    const datesByDow: Record<number, string[]> = {}
    for (const dateStr of allDates) {
      const d = new Date(dateStr + 'T00:00:00')
      const dow = d.getDay()
      if (!datesByDow[dow]) datesByDow[dow] = []
      datesByDow[dow].push(dateStr)
    }

    // 1. Recurring slots
    for (const slot of slots) {
      if (!slot.is_recurring || slot.day_of_week === null) continue
      const dates = datesByDow[slot.day_of_week] ?? []

      for (const date of dates) {
        if (!isSlotEffective(slot, date)) continue
        if (!isSchoolDay(date)) continue

        const exception = exceptionsVues.find(
          ex => ex.schedule_slot_id === slot.id && ex.exception_date === date
        )

        if (exception?.exception_type === 'modified') {
          result.push({
            id: `${slot.id}-${date}`,
            sourceSlotId: slot.id,
            isRecurring: true,
            isModified: true,
            exceptionId: exception.id,
            date,
            dayOfWeek: slot.day_of_week,
            class_id: slot.class_id,
            teacher_id: enseignantAffiche(quiAssure(slot, date, exception)),
            cours_id: slot.cours_id,
            room_id: salleDe(slot, exception),
            start_time: slot.start_time,
            end_time: slot.end_time,
            slot_type: slot.slot_type,
            ...infosAbsence(slot, date, slot.start_time, slot.end_time, exception),
            color: slot.color,
            classes: slot.classes,
            teachers: enseignantParId(enseignantAffiche(quiAssure(slot, date, exception))),
            cours: slot.cours,
            unites_enseignement: slot.unites_enseignement,
            unite_enseignement_id: slot.unite_enseignement_id,
            libelle: slot.libelle,
            rooms: salleAffichee(slot, exception),
          })
        } else {
          result.push({
            id: `${slot.id}-${date}`,
            sourceSlotId: slot.id,
            isRecurring: true,
            isModified: false,
            // Annulee : AFFICHEE (grisee, « ANNULÉ »), reactivable depuis le menu.
            annulee: exception?.exception_type === 'cancelled',
            exceptionId: exception?.id,
            date,
            dayOfWeek: slot.day_of_week,
            class_id: slot.class_id,
            teacher_id: enseignantAffiche(quiAssure(slot, date, exceptionActive(exception))),
            cours_id: slot.cours_id,
            room_id: salleDe(slot, exception),
            start_time: slot.start_time,
            end_time: slot.end_time,
            slot_type: slot.slot_type,
            ...infosAbsence(slot, date, slot.start_time, slot.end_time, exception),
            color: slot.color,
            classes: slot.classes,
            teachers: enseignantParId(enseignantAffiche(quiAssure(slot, date, exceptionActive(exception)))),
            cours: slot.cours,
            unites_enseignement: slot.unites_enseignement,
            unite_enseignement_id: slot.unite_enseignement_id,
            libelle: slot.libelle,
            rooms: salleAffichee(slot, exception),
          })
        }
      }
    }

    // 2. Ponctual slots
    for (const slot of slots) {
      if (slot.is_recurring || !slot.slot_date) continue
      if (!allDates.includes(slot.slot_date)) continue

      const d = new Date(slot.slot_date + 'T00:00:00')

      const exPonctuelle = exceptionsVues.find(ex => ex.schedule_slot_id === slot.id && ex.exception_date === slot.slot_date)
      result.push({
        id: slot.id,
        sourceSlotId: slot.id,
        isRecurring: false,
        isModified: false,
        annulee: exPonctuelle?.exception_type === 'cancelled',
        exceptionId: exPonctuelle?.id,
        date: slot.slot_date,
        dayOfWeek: d.getDay(),
        class_id: slot.class_id,
        teacher_id: enseignantAffiche(quiAssure(slot, slot.slot_date, exceptionActive(exPonctuelle))),
        cours_id: slot.cours_id,
        room_id: salleDe(slot, exPonctuelle),
        start_time: slot.start_time,
        end_time: slot.end_time,
        slot_type: slot.slot_type,
        ...infosAbsence(slot, slot.slot_date, slot.start_time, slot.end_time, exPonctuelle),
        color: slot.color,
        classes: slot.classes,
        teachers: enseignantParId(enseignantAffiche(quiAssure(slot, slot.slot_date, exceptionActive(exPonctuelle)))),
        cours: slot.cours,
        unites_enseignement: slot.unites_enseignement,
        unite_enseignement_id: slot.unite_enseignement_id,
        libelle: slot.libelle,
        rooms: salleAffichee(slot, exPonctuelle),
      })
    }

    return result
  }, [viewType, currentMonth, slots, exceptionsVues, isSchoolDay, weekStartDay, infosAbsence, quiAssure, enseignantParId, salleDe, salleAffichee])

  // Compte dont on regarde le planning (vue par enseignant) : les seances qu'il
  // REMPLACE (decision d'absence) y entrent, quelle que soit la classe.
  const profilVu = estEnseignant ? currentUserId : (teacherProfileMap[selectedTeacherId] ?? '')

  // Filter month slots by view mode
  const filteredMonthSlots = useMemo(() => {
    if (viewMode === 'class' && selectedClassId) {
      return resolvedMonthSlots.filter(s => s.class_id === selectedClassId)
    }
    // `|| estEnseignant` : sans lui, un `selectedTeacherId` vide SAUTE le filtre et
    // rend TOUS les creneaux de l'ecole. L'encadrement le voit (sa liste est la, il
    // n'a rien choisi) ; l'enseignant, dont la liste est masquee, croirait lire le sien.
    if (viewMode === 'teacher' && (selectedTeacherId || estEnseignant)) {
      return resolvedMonthSlots.filter(s =>
        s.teacher_id === selectedTeacherId
        || (!!profilVu && s.remplacant?.profileId === profilVu))
    }
    return resolvedMonthSlots
  }, [resolvedMonthSlots, viewMode, selectedClassId, selectedTeacherId, estEnseignant, profilVu])

  // ─── Computed ─────────────────────────────────────────────────────────────

  const activeDays = useMemo(() => (selectedDay !== null ? [selectedDay] : orderedDays), [selectedDay, orderedDays])

  // Semaine entière en vacances ?
  const isFullWeekVacation = useMemo(() => {
    return orderedDays.every(d => {
      const dateStr = weekDayDates[d]
      return dateStr ? !isSchoolDay(dateStr) : false
    })
  }, [orderedDays, weekDayDates, isSchoolDay])
  // ── LA BORNE S'ELARGIT PLUTOT QUE DE MASQUER ──────────────────────────
  // Un creneau hors de l'intervalle disparaitrait de la grille EN SILENCE :
  // toujours en base, toujours actif, toujours compte dans les presences, mais
  // invisible — et c'est en le cherchant qu'on decouvrirait le reglage. La
  // grille s'ouvre donc jusqu'a lui.
  //
  // Le calcul porte sur `resolvedSlots` (TOUS les creneaux, exceptions
  // appliquees) et non sur la liste filtree : sinon la grille changerait de
  // hauteur en passant d'une classe a l'autre, ce qui se lirait comme un defaut.
  const [startHour, endHour] = useMemo(() => {
    let debut = DEFAULT_START
    let fin   = DEFAULT_END
    for (const s of resolvedSlots) {
      const h  = Number(s.start_time.slice(0, 2))
      // Une fin a 18:30 exige d'afficher l'heure 18, donc d'aller jusqu'a 19.
      const hf = Number(s.end_time.slice(0, 2)) + (s.end_time.slice(3, 5) === '00' ? 0 : 1)
      if (h  < debut) debut = h
      if (hf > fin)   fin   = hf
    }
    return [debut, Math.min(fin, 24)]
  }, [resolvedSlots])

  const hours = useMemo(() => {
    const arr: number[] = []
    for (let h = startHour; h < endHour; h++) arr.push(h)
    return arr
  }, [startHour, endHour])

  // Filter by view
  const filteredSlots = useMemo(() => {
    if (viewMode === 'class' && selectedClassId) {
      return resolvedSlots.filter(s => s.class_id === selectedClassId)
    }
    // Meme garde que la vue mois : un id vide ne doit pas ouvrir tout l'etablissement.
    if (viewMode === 'teacher' && (selectedTeacherId || estEnseignant)) {
      // Voir la vue mois : ses creneaux, PLUS les seances qu'il remplace.
      return resolvedSlots.filter(s =>
        s.teacher_id === selectedTeacherId
        || (!!profilVu && s.remplacant?.profileId === profilVu))
    }
    return resolvedSlots
  }, [resolvedSlots, viewMode, selectedClassId, selectedTeacherId, estEnseignant, profilVu])

  // Group by day
  const slotsByDay = useMemo(() => {
    const map: Record<number, ResolvedSlot[]> = {}
    for (const d of activeDays) map[d] = []
    for (const s of filteredSlots) {
      if (map[s.dayOfWeek]) map[s.dayOfWeek].push(s)
    }
    return map
  }, [filteredSlots, activeDays])

  // ─── Refresh data ─────────────────────────────────────────────────────────

  const refreshData = useCallback(async () => {
    const [{ data: freshSlots }, { data: freshExceptions }] = await Promise.all([
      supabase
        .from('schedule_slots')
        .select('*, classes(name), teachers(first_name, last_name, civilite), cours(nom_fr), unites_enseignement(nom_fr), rooms(name)')
        .eq('school_year_id', schoolYearId)
        .eq('is_active', true)
        .order('start_time'),
      supabase
        .from('schedule_exceptions')
        .select('*'),
    ])
    if (freshSlots) setSlots(freshSlots as any[])
    if (freshExceptions) setExceptions(freshExceptions as any[])
  }, [supabase, schoolYearId])

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const selectedClass = classes.find(c => c.id === selectedClassId)
  // V1 : le mode Secondaire (multi) n'est pas géré → palette de matières et création
  // par glisser-déposer désactivées. À réactiver si le Secondaire revient.
  const isDndActive = false

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [draggedSubject, setDraggedSubject] = useState<PaletteSubject | null>(null)
  const [draggedSlot, setDraggedSlot] = useState<ResolvedSlot | null>(null)

  // Build palette subjects from class_teachers of the selected class
  const paletteSubjects = useMemo<PaletteSubject[]>(() => {
    if (!isDndActive || !selectedClass) return []
    return selectedClass.class_teachers
      .filter(ct => ct.subject)
      .map(ct => {
        // Parse UE info from subject string and ueList
        const subjectStr = ct.subject ?? ''
        const codeMatch = subjectStr.match(/^([^ ]+) · /)
        const ueCode = codeMatch?.[1] ?? null
        const ue = ueList.find(u => u.code === ueCode) ?? ueList.find(u => subjectStr.includes(u.nom_fr))
        return {
          subject: subjectStr,
          ueName: ue?.nom_fr ?? subjectStr,
          ueCode: ue?.code ?? ueCode,
          color: ue?.color ?? null,
          teacherId: ct.teacher_id ?? '',
          teacherName: ct.teachers ? `${ct.teachers.last_name} ${ct.teachers.first_name}` : '',
        }
      })
  }, [isDndActive, selectedClass, ueList])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'new-subject') {
      setDraggedSubject(data.subject as PaletteSubject)
      setDraggedSlot(null)
    } else if (data?.type === 'existing-slot') {
      setDraggedSlot(data.slot as ResolvedSlot)
      setDraggedSubject(null)
    }
  }, [])

  // Helper: parse drop zone ID → { dayOfWeek, startTime }
  const parseDropId = useCallback((dropId: string) => {
    const parts = dropId.split('-')
    return { dayOfWeek: parseInt(parts[1], 10), startTime: parts[2] }
  }, [])

  // Helper: format minutes → "HH:MM"
  const minsToTime = useCallback((mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, [])

  // Helper: "HH:MM" → minutes
  const timeToMins = useCallback((t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }, [])

  // Check collision: same class, same day, overlapping time (excluding the moved slot itself)
  const hasCollision = useCallback((dayOfWeek: number, startTime: string, endTime: string, excludeSlotId?: string) => {
    const newStart = timeToMins(startTime)
    const newEnd = timeToMins(endTime)
    return filteredSlots.some(s => {
      if (excludeSlotId && s.sourceSlotId === excludeSlotId) return false
      if (s.dayOfWeek !== dayOfWeek) return false
      const sStart = timeToMins(s.start_time)
      const sEnd = timeToMins(s.end_time)
      return newStart < sEnd && newEnd > sStart
    })
  }, [filteredSlots, timeToMins])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setDraggedSubject(null)
    setDraggedSlot(null)
    const { active, over } = event
    if (!over || !selectedClassId) return

    const dropId = over.id as string
    if (!dropId.startsWith('drop-')) return

    const { dayOfWeek, startTime } = parseDropId(dropId)
    const data = active.data.current

    // ── Check: is this day in vacation? ──
    const dateStr = weekDayDates[dayOfWeek]
    if (dateStr && getVacationLabel(dateStr)) {
      toastError('Impossible de placer un créneau pendant les vacances.')
      return
    }

    // ── Check: is this day a working day? ──
    if (!orderedDays.includes(dayOfWeek)) {
      toastError('Ce jour n\'est pas un jour travaillé.')
      return
    }

    if (data?.type === 'new-subject') {
      // ── CREATE new slot from palette ──
      const subject = data.subject as PaletteSubject
      const [sh, sm] = startTime.split(':').map(Number)
      const endTime = minsToTime(sh * 60 + sm + 60)

      if (hasCollision(dayOfWeek, startTime, endTime)) {
        toastError('Un créneau existe déjà sur ce créneau horaire.')
        return
      }

      const matchedCours = coursList.find(c => {
        const ue = (c as any).unites_enseignement
        return ue?.nom_fr === subject.ueName
      })

      try {
        const { error } = await supabase.from('schedule_slots').insert({
          class_id: selectedClassId,
          // Enseignant deduit du titulaire (lot 5) : jamais recopie sur le creneau.
          school_year_id: schoolYearId,
          is_recurring: true,
          day_of_week: dayOfWeek,
          slot_date: null,
          start_time: startTime,
          end_time: endTime,
          slot_type: 'cours',
          cours_id: matchedCours?.id ?? null,
          room_id: selectedClass?.room_id ?? null,
          is_active: true,
          effective_from: schoolYearStartDate ?? null,
          effective_until: null,
          color: subject.color ?? null,
        })
        if (error) throw error
        logAudit(supabase, {
          action: 'INSERT',
          entityType: 'schedule_slots',
          description: `Nouveau créneau ${subject.ueName} le ${DAY_LABELS[dayOfWeek]} à ${startTime} pour ${selectedClass?.name}`,
        })
        toastSuccess(`Créneau ${subject.ueName} créé (${DAY_LABELS[dayOfWeek]} ${startTime}-${endTime})`)
        await refreshData()
      } catch (err) {
        console.error('[EmploiDuTemps] Erreur lors de la création du créneau:', err)
        toastError('Erreur lors de la création du créneau.')
      }

    } else if (data?.type === 'existing-slot') {
      // ── MOVE existing slot ──
      const slot = data.slot as ResolvedSlot
      const duration = timeToMins(slot.end_time) - timeToMins(slot.start_time)
      const endTime = minsToTime(timeToMins(startTime) + duration)

      // Skip if dropped on same position
      if (dayOfWeek === slot.dayOfWeek && startTime === slot.start_time.slice(0, 5)) return

      if (hasCollision(dayOfWeek, startTime, endTime, slot.sourceSlotId)) {
        toastError('Un créneau existe déjà sur ce créneau horaire.')
        return
      }

      try {
        const echec = erreurEcriture(
          await supabase
            .from('schedule_slots')
            .update({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })
            .eq('id', slot.sourceSlotId)
            .select('id'),
          'Ce creneau',
        )
        if (echec) throw new Error(echec)
        logAudit(supabase, {
          action: 'UPDATE',
          entityType: 'schedule_slots',
          entityId: slot.sourceSlotId,
          description: `Créneau déplacé vers ${DAY_LABELS[dayOfWeek]} ${startTime}-${endTime}`,
        })
        toastSuccess(`Créneau déplacé (${DAY_LABELS[dayOfWeek]} ${startTime}-${endTime})`)
        await refreshData()
      } catch (err) {
        console.error('[EmploiDuTemps] Erreur lors du déplacement du créneau:', err)
        toastError('Erreur lors du déplacement du créneau.')
      }
    }
  }, [selectedClassId, selectedClass, schoolYearId, schoolYearStartDate, coursList, supabase, toastSuccess, toastError, refreshData, parseDropId, minsToTime, timeToMins, hasCollision, weekDayDates, getVacationLabel, orderedDays])

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  // Nouvelle SEANCE PONCTUELLE, seul enregistrement de la modale (lot 5, 29/10 :
  // l'edition d'une serie, d'un horaire ou d'un enseignant est retiree de l'EDT).
  // L'enseignant n'est pas ecrit : il se deduit du titulaire a la date.
  const handleSaveSlot = useCallback(async (data: {
    class_id: string
    unite_enseignement_id: string | null
    libelle: string | null
    room_id: string | null
    slot_date: string
    start_time: string
    end_time: string
    slot_type: string
  }) => {
    const { error } = await supabase.from('schedule_slots').insert({
      school_year_id: schoolYearId,
      class_id: data.class_id,
      // Chacun sa place (CHECK en base) : matiere d'un cours, nom d'une activite.
      unite_enseignement_id: data.slot_type === 'cours' ? (data.unite_enseignement_id || null) : null,
      libelle: data.slot_type === 'activite' ? (data.libelle?.trim() || null) : null,
      room_id: data.room_id || null,
      is_recurring: false,
      day_of_week: null,
      slot_date: data.slot_date,
      start_time: data.start_time,
      end_time: data.end_time,
      slot_type: data.slot_type,
      effective_from: null,
      effective_until: null,
    })
    if (error) { toastError('Erreur : ' + error.message); return }

    const cls = classesRef.current.find(c => c.id === data.class_id)
    logAudit(supabase, {
      action: 'INSERT',
      entityType: 'schedule_slots',
      description: `Nouveau créneau ponctuel pour ${cls?.name ?? 'classe'} : ${data.start_time}-${data.end_time} le ${new Date(data.slot_date + 'T00:00:00').toLocaleDateString('fr-FR')}`,
    })

    await refreshData()
    setModalOpen(false)
  }, [supabase, schoolYearId, refreshData, toastError])

  const libelleSeance = useCallback((slotId: string, date: string) => {
    const slot = slots.find(s => s.id === slotId)
    const cls = classesRef.current.find(c => c.id === slot?.class_id)
    return `${cls?.name ?? 'classe'} du ${new Date(date + 'T00:00:00').toLocaleDateString('fr-FR')}`
  }, [slots])

  // Suppression : seance PONCTUELLE seulement (creee dans l'EDT). Une serie se
  // gere dans la fiche classe ; une seance de serie s'annule, elle ne se supprime pas.
  const handleDeleteSlot = useCallback((slotId: string) => {
    setContextMenu(null)
    const slot = slots.find(s => s.id === slotId)
    if (!slot || slot.is_recurring || !slot.slot_date) return
    const libelle = libelleSeance(slotId, slot.slot_date)
    void (async () => {
      const echecLot = erreurEcritureLot(
        await supabase.from('schedule_exceptions').delete().eq('schedule_slot_id', slotId),
        'Les modifications de la seance',
      )
      if (echecLot) { toastError(echecLot); return }
      const echec = erreurEcriture(
        await supabase.from('schedule_slots').delete().eq('id', slotId).select('id'),
        'Cette seance',
      )
      if (echec) { toastError(echec); return }
      logAudit(supabase, {
        action: 'DELETE',
        entityType: 'schedule_slots',
        entityId: slotId,
        description: `Suppression de la séance ponctuelle ${libelle} (${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)})`,
      })
      await refreshData()
    })()
  }, [supabase, slots, refreshData, toastError, libelleSeance])

  // ─── Actions ponctuelles sur UNE seance (conception 27/10, lot 2) ─────────
  //
  // L'EDT n'edite plus la structure (fiche classe) : il annule, reactive, change
  // la salle d'une seance, et supprime une seance PONCTUELLE (creee ici).
  // Annuler garde les autres modifications de la seance (salle) : reactiver la
  // rend telle qu'elle etait.


  const handleCancelForDate = useCallback((slotId: string, date: string) => {
    setContextMenu(null)
    // Une seance validee a eu lieu : ses heures sont comptees. L'annuler sans
    // retirer la validation compterait des heures pour une seance « annulée ».
    if (validations.some(v => v.schedule_slot_id === slotId && v.validation_date === date)) {
      toastError('Cette séance est validée : annulez d’abord la validation de présence.')
      return
    }
    void (async () => {
      const existing = exceptions.find(ex => ex.schedule_slot_id === slotId && ex.exception_date === date)
      if (existing) {
        const echec = erreurEcriture(
          await supabase.from('schedule_exceptions').update({ exception_type: 'cancelled' }).eq('id', existing.id).select('id'),
          'Cette annulation',
        )
        if (echec) { toastError(echec); return }
      } else {
        const { error } = await supabase.from('schedule_exceptions')
          .insert({ schedule_slot_id: slotId, exception_date: date, exception_type: 'cancelled' })
        if (error) { toastError('Erreur : ' + error.message); return }
      }
      logAudit(supabase, {
        action: 'UPDATE',
        entityType: 'schedule_exceptions',
        description: `Annulation de la séance ${libelleSeance(slotId, date)}`,
      })
      await refreshData()
    })()
  }, [supabase, exceptions, validations, refreshData, toastError, libelleSeance])

  // Double confirmation (decision du 27/10) : recapitulatif complet de la seance
  // et saisie d'un mot-cle (`ConfirmationSeance`) avant d'annuler ou de supprimer.
  const [confirmSeance, setConfirmSeance] = useState<{ seance: ResolvedSlot; mode: ModeConfirmationSeance } | null>(null)
  const demanderConfirmation = (seance: ResolvedSlot, mode: ModeConfirmationSeance) => {
    setContextMenu(null)
    // Annuler une seance VALIDEE compterait des heures pour une seance annulee :
    // on le dit avant la saisie du mot-cle, pas apres.
    if (mode === 'annuler' && validations.some(v => v.schedule_slot_id === seance.sourceSlotId && v.validation_date === seance.date)) {
      toastError('Cette séance est validée : annulez d’abord la validation de présence.')
      return
    }
    setConfirmSeance({ seance, mode })
  }

  const handleReactivate = useCallback(async (slotId: string, date: string) => {
    setContextMenu(null)
    const existing = exceptions.find(ex => ex.schedule_slot_id === slotId && ex.exception_date === date)
    if (!existing || existing.exception_type !== 'cancelled') return
    // Une salle changee avant l'annulation est rendue a la seance ; sinon la
    // ligne d'exception n'a plus de raison d'etre.
    // Une seance « modifiee » ne porte plus qu'une salle changee (lot 5).
    const resteModifiee = !!existing.override_room_id
    const echec = erreurEcriture(
      resteModifiee
        ? await supabase.from('schedule_exceptions').update({ exception_type: 'modified' }).eq('id', existing.id).select('id')
        : await supabase.from('schedule_exceptions').delete().eq('id', existing.id).select('id'),
      'Cette réactivation',
    )
    if (echec) { toastError(echec); return }
    logAudit(supabase, {
      action: 'UPDATE',
      entityType: 'schedule_exceptions',
      description: `Réactivation de la séance ${libelleSeance(slotId, date)}`,
    })
    toastSuccess('Séance réactivée.')
    await refreshData()
  }, [supabase, exceptions, refreshData, toastError, toastSuccess, libelleSeance])

  // Salle d'UNE seance : seance ponctuelle = sa propre ligne ; seance d'une serie =
  // une exception (`override_room_id`), retiree si elle ne change plus rien.
  const [salleSeance, setSalleSeance] = useState<{ resolved: ResolvedSlot; roomId: string } | null>(null)
  // Salles proposees pour une seance : salles de COURS libres sur ce creneau (lib/edt/salles.ts).
  const sallesPour = useCallback(
    (date: string, debut: string, fin: string, exclureSlotId?: string | null, salleActuelle?: string | null) =>
      sallesLibres(rooms, slots, exceptions, date, debut, fin, { exclureSlotId, salleActuelle, salleDeClasse }),
    [rooms, slots, exceptions, salleDeClasse],
  )
  const sallesSeance = salleSeance
    ? sallesPour(salleSeance.resolved.date, salleSeance.resolved.start_time, salleSeance.resolved.end_time,
        salleSeance.resolved.sourceSlotId, salleSeance.resolved.room_id)
    : null
  const handleChangeRoom = useCallback(async (resolved: ResolvedSlot, roomId: string) => {
    const slot = slots.find(s => s.id === resolved.sourceSlotId)
    if (!slot) return
    const nouvelle = roomId || null
    let echec: string | null = null
    if (!slot.is_recurring) {
      echec = erreurEcriture(
        await supabase.from('schedule_slots').update({ room_id: nouvelle }).eq('id', slot.id).select('id'),
        'Cette séance',
      )
    } else {
      const existing = exceptions.find(ex => ex.schedule_slot_id === slot.id && ex.exception_date === resolved.date)
      // Salle de la seance sans changement ponctuel : celle de la classe ou du creneau.
      const override = nouvelle === salleDe(slot, null) ? null : nouvelle
      if (existing) {
        const vide = !override
        echec = erreurEcriture(
          vide && existing.exception_type === 'modified'
            ? await supabase.from('schedule_exceptions').delete().eq('id', existing.id).select('id')
            : await supabase.from('schedule_exceptions').update({ override_room_id: override }).eq('id', existing.id).select('id'),
          'Cette séance',
        )
      } else if (override) {
        const { error } = await supabase.from('schedule_exceptions').insert({
          schedule_slot_id: slot.id, exception_date: resolved.date, exception_type: 'modified', override_room_id: override,
        })
        if (error) echec = 'Erreur : ' + error.message
      }
    }
    if (echec) { toastError(echec); return }
    const salle = rooms.find(r => r.id === nouvelle)?.name ?? 'aucune salle'
    logAudit(supabase, {
      action: 'UPDATE',
      entityType: 'schedule_exceptions',
      description: `Salle de la séance ${libelleSeance(slot.id, resolved.date)} : ${salle}`,
    })
    setSalleSeance(null)
    toastSuccess('Salle modifiée pour cette séance.')
    await refreshData()
  }, [supabase, slots, exceptions, rooms, refreshData, toastError, toastSuccess, libelleSeance, salleDe])

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  // ─── Validation présence ──────────────────────────────────────────────────

  // ── QUI RECOIT L'HEURE : LA BASE LE DECIDE (lot 3b-2a, 28/10) ──────────
  //
  // `valider_seance` credite le remplacant designe par l'absence (fiche
  // enseignant ou non), sinon le titulaire en poste ; elle refuse une seance
  // annulee, « a decider », future ou deja validee, et ecrit l'heure et la
  // validation d'un coup. L'encadrement valide pour n'importe qui ; un
  // enseignant, seulement ce qu'il assure. Le message ne fait que l'annoncer.
  const handleValidate = useCallback(async (resolved: ResolvedSlot) => {
    const slotDate = resolved.date
    const [y, m, d] = slotDate.split('-')
    const dateLabel = `${d}/${m}/${y}`
    const horaire = `${resolved.start_time.slice(0, 5)}-${resolved.end_time.slice(0, 5)}`
    if (resolved.aDecider) {
      toastError('L’enseignant est absent et rien n’est décidé pour cette séance : réglez d’abord l’absence.')
      return
    }
    const titulaire = nomEnseignantCivilite(resolved.teachers) || 'l’enseignant'
    const r = resolved.remplacant
    const message = !r
      ? `Valider la presence de ${titulaire} le ${dateLabel} (${horaire}) ?`
      : r.profileId === currentUserId
        ? `Valider VOTRE presence en remplacement de ${titulaire} le ${dateLabel} (${horaire}) ?`
        : `Valider la presence de ${r.personne ? nomEnseignantCivilite(r.personne) : 'son remplaçant'} en remplacement de ${titulaire} le ${dateLabel} (${horaire}) ?`
    setPendingConfirm({
      message,
      confirmLabel: 'Valider',
      onConfirm: async () => {
        const { data, error } = await supabase.rpc('valider_seance', { p_slot_id: resolved.sourceSlotId, p_date: slotDate })
        if (error) { toastError(phraseRefusAbsence(error, 'La présence n’a pas pu être validée.')); return }
        setValidations(prev => [...prev, data as ValidationData])
      },
    })
  }, [supabase, currentUserId, toastError])

  const handleCancelValidation = useCallback(async (sourceSlotId: string, slotDate: string) => {
    const v = validations.find(v => v.schedule_slot_id === sourceSlotId && v.validation_date === slotDate)
    if (!v) return
    setPendingConfirm({
      message: 'Annuler cette validation de presence ?',
      variant: 'danger',
      confirmLabel: 'Annuler la validation',
      onConfirm: async () => {
        // L'heure et la validation partent ensemble (`retirer_validation_seance`).
        const { error } = await supabase.rpc('retirer_validation_seance', { p_slot_id: sourceSlotId, p_date: slotDate })
        if (error) { toastError(phraseRefusAbsence(error, 'La validation n’a pas pu être retirée.')); return }
        setValidations(prev => prev.filter(x => x.id !== v.id))
      },
    })
  }, [validations, supabase, toastError])

  const isValidated = useCallback((sourceSlotId: string, slotDate: string) => {
    return validations.some(v => v.schedule_slot_id === sourceSlotId && v.validation_date === slotDate)
  }, [validations])

  // ─── Open modal helpers ───────────────────────────────────────────────────

  const openNewSlot = (day?: number, time?: string, date?: string) => {
    setPrefillDay(day ?? null)
    setPrefillTime(time ?? null)
    setPrefillDate(date ?? null)
    setModalOpen(true)
  }

  // Context menu for right-click on recurring slot
  const handleSlotContextMenu = (e: React.MouseEvent, resolved: ResolvedSlot) => {
    if (!canEdit) return
    e.preventDefault()
    e.stopPropagation()
    const dayIndex = activeDays.indexOf(resolved.dayOfWeek)
    const isLastCol = dayIndex === activeDays.length - 1
    // Use nativeEvent for accurate mouse position (dnd-kit can alter React event)
    const x = e.nativeEvent.clientX
    const y = e.nativeEvent.clientY
    setContextMenu({ x, y, slot: resolved, isLastCol })
  }

  // Ouverture clavier du menu d'actions (Entrée sur une capsule récurrente), positionné sur la capsule
  const handleSlotKeyMenu = (resolved: ResolvedSlot, rect: DOMRect) => {
    if (!canEdit) return
    const dayIndex = activeDays.indexOf(resolved.dayOfWeek)
    const isLastCol = dayIndex === activeDays.length - 1
    setContextMenu({
      x: isLastCol ? rect.right : rect.left,
      y: rect.bottom,
      slot: resolved,
      isLastCol,
    })
  }

  // Clic sur une seance : plus d'edition dans l'EDT (structure = fiche classe).
  // Les actions passent par le menu « ⋯ » (`handleSlotContextMenu` / `handleSlotKeyMenu`).
  const handleSlotClick = () => {}

  // ─── Render ───────────────────────────────────────────────────────────────

  // Créneau dont le menu d'actions est ouvert (mis en surbrillance)
  const activeMenuSlotId = contextMenu?.slot.id ?? null

  return (
    <div className="flex flex-col h-full gap-2 p-2">
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="card flex flex-wrap items-center gap-3 px-4 py-2 flex-shrink-0">
        {/* View tabs — voir `estEnseignant` : il consulte son planning, il n'arbitre pas */}
        {!estEnseignant && (
        <FiltreSwitch
          ariaLabel="Type de vue"
          actif={viewMode}
          onChange={val => {
            const v = val as ViewMode
            setViewMode(v)
            setSelectedClassId('')
            setSelectedTeacherId(v === 'teacher' ? ownTeacherId : '')
            if (!vueJour) setSelectedDay(null)
          }}
          options={(['global', 'class', 'teacher'] as ViewMode[]).map(v => ({
            valeur: v, libelle: petitEcran ? LIBELLES_VUE[v].court : LIBELLES_VUE[v].long,
          }))}
        />
        )}

        {/* Class select */}
        {viewMode === 'class' && !estEnseignant && (
          <FloatSelect
            label="Classe"
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            wrapperClassName="w-fit"
          >
            <option value="" disabled hidden></option>
            {classes.map(c => {
              const mainT = titulaireActuel(c.class_teachers)
              const teacher = mainT?.teachers ? nomEnseignantCivilite(mainT.teachers) : ''
              const infoParts = [teacher, c.cotisation_types?.label].filter(Boolean)
              return (
                <option key={c.id} value={c.id}>{[c.name, ...infoParts].join(' · ')}</option>
              )
            })}
          </FloatSelect>
        )}

        {/* Teacher select */}
        {viewMode === 'teacher' && !estEnseignant && (
          <FloatSelect
            label="Enseignant"
            value={selectedTeacherId}
            onChange={e => setSelectedTeacherId(e.target.value)}
            wrapperClassName="w-fit"
          >
            <option value="" disabled hidden></option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
            ))}
          </FloatSelect>
        )}

        {/* Cas defensif : la fiche de l'enseignant connecte n'est pas resolue (ligne
            `teachers` absente, ou `user_id` non rattache). Son planning est alors VIDE
            — et il doit le savoir, sinon il conclut que l'ecole ne lui a rien affecte.
            Aucun ecran ne permet de rattacher un compte : l'action est ailleurs. */}
        {estEnseignant && !ownTeacherId && (
          <span role="alert" className="text-sm font-medium text-red-700">
            Votre fiche enseignant n&apos;est pas rattachée à ce compte : votre planning ne peut pas être affiché. Contactez l&apos;administrateur.
          </span>
        )}

        {/* Class info line */}
        {selectedClassId && viewMode === 'class' && (() => {
          const cls = classes.find(c => c.id === selectedClassId)
          if (!cls) return null
          const info = classInfoLine(cls)
          return info ? <span className="text-sm font-medium text-warm-700 whitespace-nowrap">{info}</span> : null
        })()}

        {/* Separateur elastique : neutralise sous le seuil, ou il absorberait
            l espace libere par les libelles courts et annulerait le gain. */}
        <div className="hidden md:block md:flex-1" />

        {/* View type toggle: Semaine / Mois — masque sur telephone (la vue mois
            y est illisible, et « Semaine » contredirait l affichage a la journee) */}
        {!petitEcran && (
          <FiltreSwitch
            ariaLabel="Affichage jour, semaine ou mois"
            actif={vueJour ? 'jour' : viewType}
            onChange={v => choisirVue(v as 'jour' | 'week' | 'month')}
            options={[
              { valeur: 'jour',  libelle: 'Jour' },
              { valeur: 'week',  libelle: 'Semaine' },
              { valeur: 'month', libelle: 'Mois' },
            ]}
          />
        )}

        {/* Revenir à la période courante */}
        {((viewType === 'week' && !isCurrentWeek) || (viewType === 'month' && !isCurrentMonth)) && (
          <Tooltip content={viewType === 'week' ? 'Revenir à la semaine courante' : 'Revenir au mois courant'}>
            <button
              onClick={() => {
                if (viewType !== 'week') { setMonthOffset(0); return }
                setWeekOffset(0)
                if (vueJour && orderedDays.includes(todayRealDow)) setSelectedDay(todayRealDow)
              }}
              aria-label={viewType === 'week' ? 'Revenir à la semaine courante' : 'Revenir au mois courant'}
              className={clsx(NAV_ICONE, 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]')}
            >
              <RotateCcw size={14} />
            </button>
          </Tooltip>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => vueJour ? allerAuJour(-1) : viewType === 'week' ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1)}
            aria-label={vueJour ? 'Jour précédent' : viewType === 'week' ? 'Semaine précédente' : 'Mois précédent'}
            className={clsx(NAV_ICONE, 'text-warm-700')}
          >
            <ChevronLeft size={16} />
          </button>
          {/* `capitalize` sert au nom de MOIS (« octobre » -> « Octobre ») ; sur
              la forme courte il transformerait « du … au … » en « Du … Au … ». */}
          <span className={clsx(
            'text-xs font-medium whitespace-nowrap px-2 py-1 text-warm-700 select-none',
            !petitEcran && 'capitalize'
          )}>
            {vueJour && selectedDay !== null
              ? `S${weekNum} · ${DAY_LABELS[selectedDay]} ${dayDatesDisplay[selectedDay]}`
              : viewType === 'week'
              ? (petitEcran
                  ? `S${weekNum} · du ${fmtDateCourt(currentWeekStart)} au ${fmtDateCourt(currentWeekEnd)}`
                  : `S${weekNum} · ${fmtDateFull(currentWeekStart)} au ${fmtDateFull(currentWeekEnd)} ${currentWeekEnd.getFullYear()}`)
              : `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`
            }
          </span>
          <button
            onClick={() => vueJour ? allerAuJour(1) : viewType === 'week' ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1)}
            aria-label={vueJour ? 'Jour suivant' : viewType === 'week' ? 'Semaine suivante' : 'Mois suivant'}
            className={clsx(NAV_ICONE, 'text-warm-700')}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Add slot button */}
        {canEdit && (
          <FloatButton
            variant="submit"
            size="mini"
            type="button"
            onClick={() => openNewSlot()}
            disabled={viewType === 'week' && isFullWeekVacation}
          >
            Ajouter
          </FloatButton>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      {viewType === 'week' ? (
        <DndContext
          sensors={dndSensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        <div className="flex-1 overflow-hidden flex min-h-0 gap-0">
          {/* Palette matières (mode multi + vue classe uniquement) */}
          {isDndActive && <SubjectPalette subjects={paletteSubjects} />}

          <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Day headers */}
          <div
            className="grid border-b border-warm-100 flex-shrink-0"
            style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, 1fr)` }}
          >
            <div className="p-2 text-xs text-warm-700" />
            {activeDays.map(d => (
              // Sur telephone l en-tete CESSE d etre le bouton de filtre et
              // devient la navigation : un clic y annulerait l affichage a la
              // journee et ramenerait des colonnes de 70 px.
              (petitEcran || vueJour) ? (
                <div
                  key={d}
                  className={clsx(
                    'flex items-center justify-between gap-1 border-l border-warm-100 px-1 py-1.5',
                    // Jour actuel : vert de marque (l'ambre de la charte signale un avertissement).
                    d === todayDow ? 'bg-[var(--edt-jour)]' : ''
                  )}
                >
                  <button
                    onClick={() => allerAuJour(-1)}
                    aria-label="Jour précédent"
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-warm-700 hover:bg-warm-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className={clsx(
                    'min-w-0 truncate text-center text-sm font-semibold uppercase tracking-wide',
                    d === todayDow ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)] font-bold' : 'text-warm-700'
                  )}>
                    {DAY_LABELS[d]}
                    <span className="text-xs font-medium opacity-80 ml-1">{dayDatesDisplay[d]}</span>
                  </span>
                  <button
                    onClick={() => allerAuJour(1)}
                    aria-label="Jour suivant"
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-warm-700 hover:bg-warm-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              ) : (
              <button
                key={d}
                onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                aria-pressed={selectedDay === d}
                aria-label={`Filtrer sur ${DAY_LABELS[d]}`}
                className={clsx(
                  'p-2 text-center text-sm font-semibold uppercase tracking-wide border-l border-warm-100 transition-colors cursor-pointer',
                  selectedDay === d
                    ? 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)]'
                    : d === todayDow ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)] font-bold bg-[var(--edt-jour)]' : 'text-warm-700 hover:bg-warm-50'
                )}
              >
                {selectedDay !== null ? DAY_LABELS[d] : DAY_LABELS_SHORT[d]}
                <span className="text-xs font-medium opacity-80 ml-1">{dayDatesDisplay[d]}</span>
              </button>
              )
            ))}
          </div>

          {/* Time grid */}
          <div
            className="grid flex-1 min-h-0"
            style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, 1fr)` }}
          >
            {/* Time axis */}
            <div className="relative border-r border-warm-100">
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute w-full text-right pr-2 text-[10px] text-warm-700 -translate-y-1/2"
                  style={{ top: `${(i / hours.length) * 100}%` }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {activeDays.map(d => {
              const dateStr = weekDayDates[d]
              const fermeture = dateStr ? jourFerme(dateStr, vacations, feries) : null
              const canValidate = !!dateStr && dateStr <= todayStr
              return (
                <DayColumn
                  key={d}
                  day={d}
                  dateStr={dateStr ?? ''}
                  slots={slotsByDay[d] ?? []}
                  startHour={startHour}
                  endHour={endHour}
                  isToday={d === todayDow}
                  canValidate={canValidate}
                  canEdit={canEdit}
                  viewMode={viewMode}
                  isTeacher={role === 'enseignant'}
                  currentTeacherId={ownTeacherId}
                  currentUserId={currentUserId}
                  fermeture={fermeture}
                  droppable={isDndActive}
                  isValidated={(sourceSlotId, slotDate) => isValidated(sourceSlotId, slotDate)}
                  onValidate={(resolved) => handleValidate(resolved)}
                  onCancelValidation={(sourceSlotId, slotDate) => handleCancelValidation(sourceSlotId, slotDate)}
                  onClickSlot={handleSlotClick}
                  onContextMenuSlot={handleSlotContextMenu}
                  onKeyMenuSlot={handleSlotKeyMenu}
                  activeMenuSlotId={activeMenuSlotId}
                  onClickEmpty={(day, time) => canEdit && openNewSlot(day, time)}
                  onDeleteSlot={(sourceSlotId) => handleDeleteSlot(sourceSlotId)}
                />
              )
            })}
          </div>
          </div>
        </div>

        {/* Drag overlay — capsule fantôme pendant le drag */}
        <DragOverlay>
          {draggedSubject && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg text-xs font-semibold"
              style={{
                backgroundColor: draggedSubject.color ? `${draggedSubject.color}20` : '#f1f5f9',
                borderColor: draggedSubject.color ?? '#94a3b8',
                color: draggedSubject.color ?? '#334155',
              }}
            >
              <span
                className="w-3 h-3 rounded-full border border-black/10"
                style={{ backgroundColor: draggedSubject.color ?? '#94a3b8' }}
              />
              {draggedSubject.ueCode ? `${draggedSubject.ueCode} · ` : ''}{draggedSubject.ueName}
            </div>
          )}
          {draggedSlot && (
            <div
              className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg border shadow-lg text-xs"
              style={{
                backgroundColor: draggedSlot.color ? `${draggedSlot.color}20` : '#dbeafe',
                borderColor: draggedSlot.color ?? '#93c5fd',
                color: draggedSlot.color ?? '#1e3a5f',
                minWidth: '100px',
              }}
            >
              <span className="font-bold text-[10px] truncate">{intituleCreneau(draggedSlot)}</span>
              <span className="text-[9px] opacity-70">{draggedSlot.start_time.slice(0, 5)}-{draggedSlot.end_time.slice(0, 5)}</span>
            </div>
          )}
        </DragOverlay>
        </DndContext>
      ) : (
        <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
          <MonthGrid
            month={currentMonth.month}
            year={currentMonth.year}
            orderedDays={orderedDays}
            slots={filteredMonthSlots}
            viewMode={viewMode}
            canEdit={canEdit}
            isSchoolDay={isSchoolDay}
            getVacationLabel={getVacationLabel}
            onClickSlot={handleSlotClick}
            onContextMenuSlot={handleSlotContextMenu}
            onKeyMenuSlot={handleSlotKeyMenu}
            activeMenuSlotId={activeMenuSlotId}
            onClickEmpty={(day, time, date) => canEdit && openNewSlot(day, time, date)}
          />
        </div>
      )}


      {/* ── Context menu (portal pour éviter le containing block de animate-fade-in) ── */}
      {contextMenu && createPortal(
        <>
        {/* Calque de fermeture : capte le clic au dehors (ferme le menu) sans atteindre le créneau en dessous */}
        <div
          className="fixed inset-0 z-[99]"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null) }}
        />
        <div
          ref={contextRef}
          role="menu"
          aria-label="Actions du créneau"
          className="fixed bg-white rounded-xl shadow-xl border border-warm-200 z-[100] p-1.5 w-60"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            ...(contextMenu.isLastCol
              ? { right: window.innerWidth - contextMenu.x }
              : { left: contextMenu.x }),
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setContextMenu(null); return }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              const items = Array.from(contextRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
              if (items.length === 0) return
              const idx = items.indexOf(document.activeElement as HTMLButtonElement)
              const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length
              items[next]?.focus()
            }
          }}
        >
          {/* En-tête : la séance visée — classe · date · horaire (réel ce jour-là). */}
          <div className="px-2.5 py-1.5 mb-1 border-b border-warm-100 text-xs text-warm-700">
            {contextMenu.slot.classes?.name && (
              <><span className="font-bold text-secondary-800">{contextMenu.slot.classes.name}</span> · </>
            )}
            {(() => {
              const jour = new Date(contextMenu.slot.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
              return jour.charAt(0).toUpperCase() + jour.slice(1)
            })()}
            {' · '}
            <span className="tabular-nums">{contextMenu.slot.start_time.slice(0, 5)}-{contextMenu.slot.end_time.slice(0, 5)}</span>
          </div>

          {/* Menu selon la seance (conception 27/10, lot 2) : la STRUCTURE se gere
              dans la fiche classe ; ici, des actions sur CETTE seance seulement.
              Une action qui ne s'applique pas a la seance n'est pas proposee. */}
          {(() => {
            const s = contextMenu.slot
            const item = 'w-full text-left px-2.5 py-1.5 text-sm rounded-lg text-warm-700 hover:bg-warm-100 focus:bg-warm-100 focus:outline-none'
            const danger = 'w-full text-left px-2.5 py-1.5 text-sm rounded-lg text-red-700 hover:bg-red-50 focus:bg-red-50 focus:outline-none'
            return (
              <>
                {/* Seance touchee par une absence d'enseignant : elle se regle depuis
                    l'absence (meme decision que la page), jamais par l'annulation
                    de l'EDT. Une seule voie pour une seance. */}
                {s.absenceId ? (
                  <>
                    <button
                      role="menuitem" autoFocus className={item}
                      onClick={() => { setContextMenu(null); router.push(`/dashboard/absences-enseignants/${s.absenceId}`) }}
                    >
                      Régler l’absence
                    </button>
                    {!s.annulee && (
                      <button
                        role="menuitem" className={item}
                        onClick={() => { setSalleSeance({ resolved: s, roomId: s.room_id ?? '' }); setContextMenu(null) }}
                      >
                        Changer la salle
                      </button>
                    )}
                  </>
                ) : s.annulee ? (
                  <button role="menuitem" autoFocus className={item} onClick={() => handleReactivate(s.sourceSlotId, s.date)}>
                    Réactiver la séance
                  </button>
                ) : (
                  <>
                    <button role="menuitem" autoFocus className={item} onClick={() => demanderConfirmation(s, 'annuler')}>
                      Annuler cette séance
                    </button>
                    <button
                      role="menuitem" className={item}
                      onClick={() => { setSalleSeance({ resolved: s, roomId: s.room_id ?? '' }); setContextMenu(null) }}
                    >
                      Changer la salle
                    </button>
                  </>
                )}
                {!s.isRecurring && (
                  <button role="menuitem" className={danger} onClick={() => demanderConfirmation(s, 'supprimer')}>
                    Supprimer la séance
                  </button>
                )}
                <div className="border-t border-warm-100 my-1" />
                <button
                  role="menuitem" className={item}
                  onClick={() => { setContextMenu(null); router.push(`/dashboard/classes/${s.class_id}`) }}
                >
                  Ouvrir la fiche classe
                </button>
              </>
            )
          })()}
        </div>
        </>,
        document.body
      )}

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {confirmSeance && (
        <ConfirmationSeance
          seance={confirmSeance.seance}
          mode={confirmSeance.mode}
          onCancel={() => setConfirmSeance(null)}
          onConfirm={() => {
            const { seance, mode } = confirmSeance
            setConfirmSeance(null)
            if (mode === 'annuler') handleCancelForDate(seance.sourceSlotId, seance.date)
            else handleDeleteSlot(seance.sourceSlotId)
          }}
        />
      )}

      {/* Salle d'UNE seance */}
      {salleSeance && sallesSeance && (
        <FormModal
          title={`Salle · ${libelleSeance(salleSeance.resolved.sourceSlotId, salleSeance.resolved.date)}`}
          onClose={() => setSalleSeance(null)}
          footer={<>
            <div className="flex-1" />
            <FloatButton type="button" variant="secondary" onClick={() => setSalleSeance(null)}>Annuler</FloatButton>
            <FloatButton
              type="button" variant="edit"
              disabled={salleSeance.roomId === (salleSeance.resolved.room_id ?? '')}
              onClick={() => handleChangeRoom(salleSeance.resolved, salleSeance.roomId)}
            >
              Modifier
            </FloatButton>
          </>}
        >
          <FloatSelect
            label="Salle"
            value={salleSeance.roomId}
            onChange={e => setSalleSeance({ ...salleSeance, roomId: e.target.value })}
          >
            <option value=""></option>
            {sallesSeance.map(r => (
              <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` (${r.capacity} places)` : ''}</option>
            ))}
          </FloatSelect>
          {!sallesSeance.some(r => r.id !== salleSeance.resolved.room_id) && (
            <p className="text-xs text-warm-700">Aucune salle de cours libre sur ce créneau.</p>
          )}
        </FormModal>
      )}

      {modalOpen && (
        <SlotFormModal
          key={`new-${prefillDate}-${prefillDay}-${prefillTime}`}
          prefillDay={prefillDay ?? selectedDay}
          prefillTime={prefillTime}
          prefillDate={prefillDate}
          prefillClassId={selectedClassId}
          weekDayDates={weekDayDates}
          classes={classes}
          sallesPour={sallesPour}
          matieres={ueList}
          existingSlots={slots}
          vacations={vacations}
          onSave={handleSaveSlot}
          onClose={() => setModalOpen(false)}
        />
      )}

      <ConfirmModal
        open={!!pendingConfirm}
        message={pendingConfirm?.message ?? ''}
        title={pendingConfirm?.title}
        variant={pendingConfirm?.variant ?? 'warning'}
        confirmLabel={pendingConfirm?.confirmLabel}
        onConfirm={() => { pendingConfirm?.onConfirm(); setPendingConfirm(null) }}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  )
}
