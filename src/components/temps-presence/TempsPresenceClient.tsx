'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Clock, AlertTriangle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import TimeEntryModal from './TimeEntryModal'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { generateStaffTimePDF } from './staffTimePdf'

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
  absence_period: string // 'full' | 'am' | 'pm'
  notes: string | null
  recorded_by: string | null
}

interface PresenceType {
  id: string
  label: string
  code: string
  color: string
  is_absence: boolean
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
  canManageAll: boolean
  canSeeRecap: boolean
  staffList: StaffMember[]
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

function findPresenceType(presenceTypes: PresenceType[], code: string): PresenceType | undefined {
  return presenceTypes.find(pt => pt.code.toUpperCase() === code.toUpperCase())
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

// Fallback si le type n'est pas trouve dans presence_types
const FALLBACK_COLOR = '#6b7280'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

function fmtTime(t: string | null): string {
  return t?.slice(0, 5) ?? ''
}

function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

// Valeur en jours d'une absence sur une journee selon les periodes saisies :
// journee entiere = 1 ; matin ou apres-midi = 0,5 ; les deux demi-journees = 1.
function absenceDayValue(periods: Set<string>): number {
  if (periods.has('full')) return 1
  return (periods.has('am') ? 0.5 : 0) + (periods.has('pm') ? 0.5 : 0)
}

// Formatage « 1j », « 0,5j », « 1,5j » (decimale francaise).
function fmtDays(n: number): string {
  return `${n.toLocaleString('fr-FR')}j`
}

// Libelle court d'une periode d'absence.
const PERIOD_LABEL: Record<string, string> = { full: 'Journée', am: 'Matin', pm: 'Après-midi' }

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
interface RecapRow { profileId: string; name: string; typeMinutes: Record<string, number>; absenceDays: number; cost: number }
interface RecapResult { rows: RecapRow[]; totals: { typeMinutes: Record<string, number>; absenceDays: number; cost: number } }

function buildRecap(
  list: TimeEntry[],
  staffMap: Record<string, StaffMember>,
  presenceTypes: PresenceType[],
  rateByTypeId: Record<string, number>,
): RecapResult {
  const recapMap: Record<string, Record<string, number>> = {}
  // Absences : periodes saisies par (personne, jour) → converties en fractions de jour.
  // Plusieurs saisies le meme jour se combinent (matin + apres-midi = 1 jour).
  const absencePeriodsMap: Record<string, Record<string, Set<string>>> = {}

  for (const e of list) {
    if (!recapMap[e.profile_id]) recapMap[e.profile_id] = {}

    const pt = findPresenceType(presenceTypes, e.entry_type)
    if (pt?.is_absence) {
      const byDate = (absencePeriodsMap[e.profile_id] ??= {})
      ;(byDate[e.entry_date] ??= new Set()).add(e.absence_period || 'full')
    } else {
      const code = e.entry_type.toUpperCase()
      recapMap[e.profile_id][code] = (recapMap[e.profile_id][code] ?? 0) + e.duration_minutes
    }
  }

  const allProfileIds = new Set([...Object.keys(recapMap), ...Object.keys(absencePeriodsMap)])

  const rows = Array.from(allProfileIds).map(profileId => {
    const s = staffMap[profileId]
    const typeMinutes = recapMap[profileId] ?? {}
    const byDate = absencePeriodsMap[profileId] ?? {}
    const absenceDays = Object.values(byDate).reduce((sum, periods) => sum + absenceDayValue(periods), 0)

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
      absenceDays,
      cost,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const totals = rows.reduce((t, r) => {
    const tm = { ...t.typeMinutes }
    for (const [code, mins] of Object.entries(r.typeMinutes)) {
      tm[code] = (tm[code] ?? 0) + mins
    }
    return { typeMinutes: tm, absenceDays: t.absenceDays + r.absenceDays, cost: t.cost + r.cost }
  }, { typeMinutes: {} as Record<string, number>, absenceDays: 0, cost: 0 })

  return { rows, totals }
}

// ─── Texte tronque avec tooltip UNIQUEMENT si le texte deborde ────────────────
function TruncatedText({ text, tooltip, className = '' }: { text: string; tooltip?: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)
  useEffect(() => {
    const measure = () => {
      const el = ref.current
      if (el) setTruncated(el.scrollWidth > el.clientWidth + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [text])

  const inner = <span ref={ref} className={`block w-full truncate ${className}`}>{text}</span>
  return truncated
    ? <Tooltip content={tooltip ?? text} className="flex-1 min-w-0">{inner}</Tooltip>
    : <span className="inline-flex flex-1 min-w-0">{inner}</span>
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TempsPresenceClient({
  currentUserId, currentUserName, role, canManageAll, canSeeRecap,
  staffList, presenceTypes, presenceTypeRates, schoolYearId, initialMonth,
  schoolYearLabel, schoolYearStart, schoolYearEnd,
  etablissementNom, etablissementLogo,
}: Props) {
  const supabase = createClient()
  // enseignant voit ses propres couts (il ne voit que ses saisies).
  const canSeeCosts = ['admin', 'direction', 'comptable', 'enseignant'].includes(role)
  const isRespPedago = role === 'responsable_pedagogique'
  // Peut saisir pour quelqu'un d'autre que soi : gestionnaires (tout le staff) OU
  // responsable pedagogique (enseignants uniquement).
  const canManage = canManageAll || isRespPedago
  // Staff selectionnable dans la modale selon le perimetre du role.
  const assignableStaff = useMemo(() => {
    if (canManageAll) return staffList
    if (isRespPedago) return staffList.filter(s => s.role === 'enseignant' || s.id === currentUserId)
    return staffList.filter(s => s.id === currentUserId)
  }, [canManageAll, isRespPedago, staffList, currentUserId])

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
  const [loading, setLoading] = useState(false)
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
  const canAdd = !!schoolYearId && !noTypes
  const addBlockReason = !schoolYearId
    ? 'Aucune année scolaire en cours'
    : noTypes
      ? 'Aucun type de présence configuré pour cette année'
      : null

  // Staff map for quick lookup
  const staffMap = useMemo(() => {
    const map: Record<string, StaffMember> = {}
    staffList.forEach(s => { map[s.id] = s })
    return map
  }, [staffList])

  // ── Fetch entries for current month ──────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-01`

    let query = supabase
      .from('staff_time_entries')
      .select('*')
      .gte('entry_date', startDate)
      .lt('entry_date', endDate)
      .order('entry_date')
      .order('start_time')

    if (isRespPedago) {
      // Resp. pedagogique voit tous les enseignants + lui-meme
      const teacherIds = staffList.filter(s => s.role === 'enseignant').map(s => s.id)
      if (!teacherIds.includes(currentUserId)) teacherIds.push(currentUserId)
      query = query.in('profile_id', teacherIds)
    } else if (!canManageAll) {
      // Enseignant ne voit que ses propres saisies
      query = query.eq('profile_id', currentUserId)
    }

    const { data } = await query
    setEntries((data ?? []) as TimeEntry[])
    setLoading(false)
  }, [year, month, canManageAll, isRespPedago, currentUserId, staffList, supabase])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // ── Fetch entries for the whole school year (recap annuel) ───────────
  const fetchYearEntries = useCallback(async () => {
    if (!schoolYearStart || !schoolYearEnd) { setYearEntries([]); return }

    let query = supabase
      .from('staff_time_entries')
      .select('*')
      .gte('entry_date', schoolYearStart)
      .lte('entry_date', schoolYearEnd)

    if (isRespPedago) {
      const teacherIds = staffList.filter(s => s.role === 'enseignant').map(s => s.id)
      if (!teacherIds.includes(currentUserId)) teacherIds.push(currentUserId)
      query = query.in('profile_id', teacherIds)
    } else if (!canManageAll) {
      query = query.eq('profile_id', currentUserId)
    }

    const { data } = await query
    setYearEntries((data ?? []) as TimeEntry[])
  }, [schoolYearStart, schoolYearEnd, canManageAll, isRespPedago, currentUserId, staffList, supabase])

  useEffect(() => { fetchYearEntries() }, [fetchYearEntries])

  // Fermeture de la modale recapitulatif sur Echap (lecture seule → fermable).
  useEffect(() => {
    if (!recapModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setRecapModal(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [recapModal])

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
  const dayEntries = entriesByDate[selectedDay] ?? []
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
  const monthlyRecap = useMemo(
    () => buildRecap(filteredEntries, staffMap, presenceTypes, rateByTypeId),
    [filteredEntries, staffMap, presenceTypes, rateByTypeId],
  )
  const annualRecap = useMemo(
    () => buildRecap(filteredYearEntries, staffMap, presenceTypes, rateByTypeId),
    [filteredYearEntries, staffMap, presenceTypes, rateByTypeId],
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
    await supabase.from('staff_time_entries').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchEntries()
    fetchYearEntries()
  }

  // ── Export PDF d'un recapitulatif (mensuel ou annuel) ───────────────
  const [exporting, setExporting] = useState(false)
  const handleExportPdf = async (scope: 'month' | 'year') => {
    setExporting(true)
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
        rows: recap.rows.map(r => ({ name: r.name, typeMinutes: r.typeMinutes, absenceDays: r.absenceDays, cost: r.cost })),
        totals: recap.totals,
        showCosts: canSeeCosts,
      })
    } finally {
      setExporting(false)
    }
  }

  // ── Rendu du tableau d'un recapitulatif (mensuel ou annuel) ─────────
  const nonAbsenceTypes = presenceTypes.filter(p => !p.is_absence)
  const renderRecapTable = (recap: RecapResult, ariaLabel: string, emptyMsg: string) => (
    recap.rows.length === 0 ? (
      <p className="text-sm text-warm-400 italic text-center py-10">{emptyMsg}</p>
    ) : (
      <div className="overflow-x-auto rounded-xl border border-warm-100">
          <table className="w-full text-sm" aria-label={ariaLabel}>
            <thead>
              <tr className="bg-warm-50/60 border-b border-warm-100">
                <th className="px-5 py-2.5 text-left text-[11px] font-bold text-warm-500 uppercase tracking-wide">Personnel</th>
                {nonAbsenceTypes.map(pt => (
                  <th key={pt.id} className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide" style={{ color: pt.color }}>
                    {pt.label}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-center text-[11px] font-bold text-red-400 uppercase tracking-wide">Absences</th>
                {canSeeCosts && <th className="px-5 py-2.5 text-right text-[11px] font-bold text-warm-500 uppercase tracking-wide">Coût</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {recap.rows.map(r => (
                <tr key={r.profileId} className="hover:bg-warm-50/60">
                  <td className="px-5 py-3 font-medium text-warm-700 whitespace-nowrap">{r.name}</td>
                  {nonAbsenceTypes.map(pt => {
                    const mins = r.typeMinutes[pt.code.toUpperCase()] ?? 0
                    return (
                      <td key={pt.id} className={`px-4 py-3 text-center tabular-nums ${mins > 0 ? 'text-warm-700' : 'text-warm-300'}`}>
                        {mins > 0 ? fmtDuration(mins) : '·'}
                      </td>
                    )
                  })}
                  <td className={`px-4 py-3 text-center tabular-nums ${r.absenceDays > 0 ? 'text-red-600 font-medium' : 'text-warm-300'}`}>{r.absenceDays > 0 ? fmtDays(r.absenceDays) : '·'}</td>
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
                <td className="px-4 py-3 text-center text-red-600 tabular-nums">{recap.totals.absenceDays > 0 ? fmtDays(recap.totals.absenceDays) : '·'}</td>
                {canSeeCosts && <td className="px-5 py-3 text-right text-secondary-800 tabular-nums whitespace-nowrap">{fmtEur(recap.totals.cost)}</td>}
              </tr>
            </tfoot>
          </table>
      </div>
    )
  )

  // ── Badges for calendar cell ────────────────────────────────────────
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
        {badges.map((data, i) => {
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
        return `${d1} – ${d2}`
      })()

  const selectedDayLabel = new Date(selectedDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-warm-100 rounded-lg p-0.5" role="group" aria-label="Mode d'affichage">
          <button onClick={() => setViewMode('month')} aria-pressed={viewMode === 'month'} className={clsx('px-3 py-1 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50', viewMode === 'month' ? 'bg-white shadow text-secondary-800' : 'text-warm-500')}>
            Mois
          </button>
          <button onClick={() => setViewMode('week')} aria-pressed={viewMode === 'week'} className={clsx('px-3 py-1 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50', viewMode === 'week' ? 'bg-white shadow text-secondary-800' : 'text-warm-500')}>
            Semaine
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={prev} aria-label={viewMode === 'month' ? 'Mois précédent' : 'Semaine précédente'} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-500 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"><ChevronLeft size={16} /></button>
          <span className="text-sm font-bold text-secondary-800 min-w-[180px] text-center">{title}</span>
          <button onClick={next} aria-label={viewMode === 'month' ? 'Mois suivant' : 'Semaine suivante'} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-500 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"><ChevronRight size={16} /></button>
        </div>

        {canSeeRecap && (
          <button
            onClick={() => setRecapModal('month')}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide bg-white text-secondary-600 border border-warm-300 shadow-sm hover:bg-warm-50 hover:border-warm-400 active:scale-[0.97] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-secondary-300 whitespace-nowrap"
          >
            Récap. mensuel
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {canManage && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="member-filter" className="text-xs font-medium text-warm-500">Membre</label>
              <select
                id="member-filter"
                value={memberFilter}
                onChange={e => setMemberFilter(e.target.value)}
                aria-label="Filtrer par membre"
                className="text-xs border border-warm-200 rounded-lg px-2 py-1 bg-white text-secondary-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 max-w-[180px]"
              >
                <option value="">Tous</option>
                {assignableStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                ))}
              </select>
            </div>
          )}
          {canSeeRecap && (
            <button
              onClick={() => setRecapModal('year')}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide bg-white text-secondary-600 border border-warm-300 shadow-sm hover:bg-warm-50 hover:border-warm-400 active:scale-[0.97] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-secondary-300 whitespace-nowrap"
            >
              Récap. annuel
            </button>
          )}
        </div>

      </div>

      {/* ── Garde : annee / types de presence manquants ──────────────── */}
      {addBlockReason && (
        <div role="status" className="card px-4 py-3 flex items-start gap-2.5 bg-amber-50 border-amber-200 text-amber-800">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Calendar */}
        <div className="lg:col-span-2 card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-warm-100 bg-warm-50">
            {DAY_NAMES.map(d => (
              <div key={d} className="px-1 h-9 flex items-center justify-center text-[10px] font-bold text-warm-500 uppercase">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className={clsx('grid grid-cols-7', viewMode === 'month' ? 'grid-rows-6' : 'grid-rows-1')}>
            {calDays.slice(0, viewMode === 'month' ? 42 : 7).map((d, i) => {
              const dk = dateKey(d)
              const isCurrentMonth = d.getMonth() === month
              const isSelected = dk === selectedDay
              const isToday = dk === todayKey
              const cellCount = (entriesByDate[dk] ?? []).length
              const dLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              const ariaLabel = `${dLabel}${isToday ? " (aujourd'hui)" : ''}, ${cellCount === 0 ? 'aucune saisie' : cellCount === 1 ? '1 saisie' : `${cellCount} saisies`}`
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(dk)}
                  aria-label={ariaLabel}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  className={clsx(
                    'relative border border-warm-50 p-1 text-left transition-colors min-h-[70px] outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:z-10',
                    viewMode === 'week' && 'min-h-[120px]',
                    isCurrentMonth ? 'bg-white' : 'bg-warm-50/50',
                    isSelected && 'ring-2 ring-primary-400 ring-inset',
                    !isSelected && 'hover:bg-warm-50',
                  )}
                >
                  <div className="flex items-start gap-1">
                    <span className={clsx(
                      'text-xs font-medium shrink-0',
                      isToday && 'bg-primary-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center',
                      !isToday && (isCurrentMonth ? 'text-warm-700' : 'text-warm-300'),
                    )}>
                      {d.getDate()}
                    </span>
                    <div className="flex-1 min-w-0">{renderCellBadges(dk)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Day panel : hauteur = contenu (self-start) au lieu de s'etirer sur le calendrier */}
        <div className="card flex flex-col self-start">
          <div className="px-4 h-9 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-secondary-800 capitalize">{selectedDayLabel}</h3>
            <Tooltip content={addBlockReason ?? 'Ajouter une saisie'}>
              <button
                onClick={() => { setEditingEntry(null); setModalOpen(true) }}
                disabled={!canAdd}
                className={clsx(
                  'inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                  canAdd
                    ? 'bg-secondary-700 text-white hover:bg-secondary-800 shadow-[0_2px_6px_rgba(47,69,80,0.30)] hover:shadow-[0_4px_12px_rgba(47,69,80,0.40)]'
                    : 'bg-warm-200 text-warm-400 cursor-not-allowed'
                )}
              >
                Ajouter
              </button>
            </Tooltip>
          </div>

          <div className="overflow-y-auto max-h-[65vh] px-3 py-1 divide-y divide-warm-100">
            {Object.keys(dayByStaff).length === 0 ? (
              <p className="text-xs text-warm-400 italic text-center py-8">Aucune saisie ce jour</p>
            ) : (
              Object.entries(dayByStaff).map(([pid, pEntries]) => {
                const s = staffMap[pid]
                const name = s ? `${s.last_name} ${s.first_name}` : '·'
                const totalMins = pEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
                return (
                  <div key={pid} className="flex items-start gap-2 py-2">
                    {/* Identite (colonne gauche) : avatar + nom sur une seule ligne, aligne en haut */}
                    <div className="flex items-center gap-1.5 w-36 shrink-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold shrink-0">
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
                      const canEdit = canManageAll
                        || e.profile_id === currentUserId
                        || (isRespPedago && targetIsTeacher)
                      return (
                        <div key={e.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]" style={entryStyle(color)}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={dotStyle(color)} />
                          <span className="font-medium shrink-0">{label}</span>
                          {!isAbs && e.start_time && (
                            <span className="text-warm-500 shrink-0">{fmtTime(e.start_time)}-{fmtTime(e.end_time)}</span>
                          )}
                          <span className="text-warm-400 shrink-0">{fmtDuration(e.duration_minutes)}</span>
                          {e.notes && (
                            <TruncatedText text={e.notes} className="italic text-warm-400 text-[10px]" />
                          )}
                          {e.is_replacement && e.replaced_profile_id && (
                            <TruncatedText
                              text={`rempl. ${staffMap[e.replaced_profile_id]?.last_name ?? ''}`}
                              tooltip={`Remplace ${staffMap[e.replaced_profile_id]?.last_name ?? ''} ${staffMap[e.replaced_profile_id]?.first_name ?? ''}`.trim()}
                              className="italic text-warm-400 text-[10px]"
                            />
                          )}
                          {isAbs && e.absence_period && e.absence_period !== 'full' && (
                            <span className="text-warm-500 text-[10px] font-medium shrink-0">{PERIOD_LABEL[e.absence_period]}</span>
                          )}
                          {isAbs && e.absence_reason && (
                            <TruncatedText text={e.absence_reason} className="italic text-warm-400 text-[10px]" />
                          )}
                          {canEdit && (
                            <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                              <Tooltip content="Modifier">
                                <button
                                  onClick={() => { setEditingEntry(e); setModalOpen(true) }}
                                  aria-label="Modifier la saisie"
                                  className="p-0.5 rounded hover:bg-white/50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                                >
                                  <Pencil size={10} className="text-warm-400" />
                                </button>
                              </Tooltip>
                              <Tooltip content="Supprimer">
                                <button
                                  onClick={() => setDeleteConfirm(e.id)}
                                  aria-label="Supprimer la saisie"
                                  className="p-0.5 rounded hover:bg-white/50 outline-none focus-visible:ring-2 focus-visible:ring-danger-500/50"
                                >
                                  <Trash2 size={10} className="text-warm-400" />
                                </button>
                              </Tooltip>
                            </span>
                          )}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Day total */}
          {dayEntries.length > 0 && (
            <div className="px-4 py-2 border-t border-warm-100 bg-warm-50 text-xs font-bold text-warm-600 flex items-center gap-1.5">
              <Clock size={12} /> Total jour : {fmtDuration(dayEntries.reduce((s, e) => s + e.duration_minutes, 0))}
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            onClick={() => setRecapModal(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="recap-modal-title"
              className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* En-tete : titre + export + fermer */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-warm-100 shrink-0">
                <h3 id="recap-modal-title" className="text-sm font-bold text-secondary-800">{modalTitle}</h3>
                <div className="flex items-center gap-2">
                  {recap.rows.length > 0 && (
                    <Tooltip content="Exporter le récapitulatif en PDF">
                      <button
                        onClick={() => handleExportPdf(isMonth ? 'month' : 'year')}
                        disabled={exporting}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary-700 text-white hover:bg-secondary-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {exporting ? 'Export…' : 'Exporter PDF'}
                      </button>
                    </Tooltip>
                  )}
                  <button onClick={() => setRecapModal(null)} aria-label="Fermer" className="p-1 rounded-lg hover:bg-warm-100 text-warm-400 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"><X size={16} /></button>
                </div>
              </div>

              {/* Legende des taux horaires (une fois, si couts visibles) */}
              {canSeeCosts && presenceTypeRates.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 border-b border-warm-100 bg-warm-50/60 text-[11px] shrink-0">
                  <span className="font-semibold text-warm-500">Taux horaires</span>
                  {nonAbsenceTypes.map(pt => {
                    const rate = presenceTypeRates.find(r => r.presence_type_id === pt.id)?.rate ?? 0
                    if (!rate) return null
                    return <span key={pt.id} style={{ color: pt.color }}>{pt.label} {fmtEur(rate)}/h</span>
                  })}
                </div>
              )}

              {/* Tableau */}
              <div className="p-4 overflow-y-auto min-h-0">
                {renderRecapTable(recap, modalTitle, emptyMsg)}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {modalOpen && (
        <TimeEntryModal
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
            <span className="w-24 shrink-0 text-warm-400">{label}</span>
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
              {isAbs ? (
                <Row label="Période">{PERIOD_LABEL[entry.absence_period] ?? 'Journée'}{entry.absence_reason ? ` · ${entry.absence_reason}` : ''}</Row>
              ) : (
                <Row label="Horaire">{fmtTime(entry.start_time)}–{fmtTime(entry.end_time)} ({fmtDuration(entry.duration_minutes)})</Row>
              )}
              {entry.is_replacement && rs && <Row label="Remplacement">Remplace {rs.last_name} {rs.first_name}</Row>}
            </div>
          </div>
        ) : undefined

        return (
          <ConfirmModal
            variant={blocked ? 'warning' : 'danger'}
            title={blocked ? 'Suppression impossible' : 'Supprimer la saisie'}
            message={blocked
              ? `Cette absence justifie ${deps.length} remplacement(s) ce jour (${depNames.join(', ')}). Supprimez d'abord ces saisies de remplacement.`
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
