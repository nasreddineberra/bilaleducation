'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Clock, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import TimeEntryModal from './TimeEntryModal'
import Tooltip from '@/components/ui/Tooltip'

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
  initialMonth?: string // format "YYYY-MM"
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
const MONTH_NAMES = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']

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

function getInitials(first: string, last: string): string {
  return `${(last?.[0] ?? '').toUpperCase()}${(first?.[0] ?? '').toUpperCase()}`
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function TempsPresenceClient({
  currentUserId, currentUserName, role, canManageAll, canSeeRecap,
  staffList, presenceTypes, presenceTypeRates, schoolYearId, initialMonth,
}: Props) {
  const supabase = createClient()
  const canSeeCosts = ['admin', 'direction', 'comptable'].includes(role)

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
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

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

    if (role === 'resp_pedagogique') {
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
  }, [year, month, canManageAll, currentUserId, role, staffList, supabase])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // ── Navigation ──────────────────────────────────────────────────────
  const prev = () => {
    if (viewMode === 'month') setCurrentDate(new Date(year, month - 1, 1))
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7))
  }
  const next = () => {
    if (viewMode === 'month') setCurrentDate(new Date(year, month + 1, 1))
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7))
  }

  // ── Entries indexed by date ─────────────────────────────────────────
  const entriesByDate = useMemo(() => {
    const map: Record<string, TimeEntry[]> = {}
    for (const e of entries) {
      if (!map[e.entry_date]) map[e.entry_date] = []
      map[e.entry_date].push(e)
    }
    return map
  }, [entries])

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

  // ── Monthly recap ───────────────────────────────────────────────────
  const monthlyRecap = useMemo(() => {
    // recapMap[profileId][typeCode] = minutes (0 si absence = compte en jours)
    const recapMap: Record<string, Record<string, number>> = {}
    const absenceDaysMap: Record<string, number> = {}

    for (const e of entries) {
      if (!recapMap[e.profile_id]) recapMap[e.profile_id] = {}
      if (!absenceDaysMap[e.profile_id]) absenceDaysMap[e.profile_id] = 0

      const pt = findPresenceType(presenceTypes, e.entry_type)
      if (pt?.is_absence) {
        // Traitement absence : comptage en jours
        absenceDaysMap[e.profile_id]++
      } else {
        const code = e.entry_type.toUpperCase()
        recapMap[e.profile_id][code] = (recapMap[e.profile_id][code] ?? 0) + e.duration_minutes
      }
    }

    const allProfileIds = new Set([...Object.keys(recapMap), ...Object.keys(absenceDaysMap)])

    const rows = Array.from(allProfileIds).map(profileId => {
      const s = staffMap[profileId]
      const typeMinutes = recapMap[profileId] ?? {}
      const absenceDays = absenceDaysMap[profileId] ?? 0

      // Calcul cout : pour chaque presence type non-absence
      let cost = 0
      for (const pt of presenceTypes.filter(p => !p.is_absence)) {
        const mins = typeMinutes[pt.code.toUpperCase()] ?? 0
        const rate = rateByTypeId[pt.id] ?? 0
        cost += (mins / 60) * rate
      }

      return {
        profileId,
        name: s ? `${s.last_name} ${s.first_name}` : '—',
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
  }, [entries, staffMap, presenceTypes, rateByTypeId])

  // ── Calendar cells ──────────────────────────────────────────────────
  const calDays = viewMode === 'month' ? getMonthDays(year, month) : getWeekDays(currentDate)
  const todayKey = dateKey(new Date())

  // ── Delete handler ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await supabase.from('staff_time_entries').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchEntries()
  }

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
    const shown = badges.slice(0, 4)
    const extra = badges.length - 4

    return (
      <div className="flex flex-wrap gap-0.5 mt-0.5">
        {shown.map((data, i) => {
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
                {initials} {data.mins > 0 ? fmtDuration(data.mins) : 'ABS'}
              </span>
            </Tooltip>
          )
        })}
        {extra > 0 && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-warm-200 text-warm-600">
            +{extra}
          </span>
        )}
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
        return `${d1} — ${d2}`
      })()

  const selectedDayLabel = new Date(selectedDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-warm-100 rounded-lg p-0.5">
          <button onClick={() => setViewMode('month')} className={clsx('px-3 py-1 rounded-md text-xs font-medium transition-colors', viewMode === 'month' ? 'bg-white shadow text-secondary-800' : 'text-warm-500')}>
            Mois
          </button>
          <button onClick={() => setViewMode('week')} className={clsx('px-3 py-1 rounded-md text-xs font-medium transition-colors', viewMode === 'week' ? 'bg-white shadow text-secondary-800' : 'text-warm-500')}>
            Semaine
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-500"><ChevronLeft size={16} /></button>
          <span className="text-sm font-bold text-secondary-800 min-w-[180px] text-center">{title}</span>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-500"><ChevronRight size={16} /></button>
        </div>

      </div>

      {/* ── Calendar + Day panel ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Calendar */}
        <div className="lg:col-span-2 card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-warm-100 bg-warm-50">
            {DAY_NAMES.map(d => (
              <div key={d} className="px-1 py-1.5 text-center text-[10px] font-bold text-warm-500 uppercase">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className={clsx('grid grid-cols-7', viewMode === 'month' ? 'grid-rows-6' : 'grid-rows-1')}>
            {calDays.slice(0, viewMode === 'month' ? 42 : 7).map((d, i) => {
              const dk = dateKey(d)
              const isCurrentMonth = d.getMonth() === month
              const isSelected = dk === selectedDay
              const isToday = dk === todayKey
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(dk)}
                  className={clsx(
                    'relative border border-warm-50 p-1 text-left transition-colors min-h-[70px]',
                    viewMode === 'week' && 'min-h-[120px]',
                    isCurrentMonth ? 'bg-white' : 'bg-warm-50/50',
                    isSelected && 'ring-2 ring-primary-400 ring-inset',
                    !isSelected && 'hover:bg-warm-50',
                  )}
                >
                  <span className={clsx(
                    'text-xs font-medium',
                    isToday && 'bg-primary-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center',
                    !isToday && (isCurrentMonth ? 'text-warm-700' : 'text-warm-300'),
                  )}>
                    {d.getDate()}
                  </span>
                  {renderCellBadges(dk)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day panel */}
        <div className="card flex flex-col">
          <div className="px-4 py-3 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-secondary-800 capitalize">{selectedDayLabel}</h3>
            <button
              onClick={() => { setEditingEntry(null); setModalOpen(true) }}
              disabled={!schoolYearId}
              title={!schoolYearId ? 'Aucune année scolaire en cours' : undefined}
              className={clsx(
                'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                schoolYearId
                  ? 'bg-secondary-700 text-white hover:bg-secondary-800 shadow-[0_2px_6px_rgba(47,69,80,0.30)] hover:shadow-[0_4px_12px_rgba(47,69,80,0.40)]'
                  : 'bg-warm-200 text-warm-400 cursor-not-allowed'
              )}
            >
              <Plus size={12} /> Ajouter
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {Object.keys(dayByStaff).length === 0 ? (
              <p className="text-xs text-warm-400 italic text-center py-8">Aucune saisie ce jour</p>
            ) : (
              Object.entries(dayByStaff).map(([pid, pEntries]) => {
                const s = staffMap[pid]
                const name = s ? `${s.last_name} ${s.first_name}` : '—'
                const totalMins = pEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
                return (
                  <div key={pid} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold">
                        {s ? getInitials(s.first_name, s.last_name) : '??'}
                      </span>
                      <span className="text-xs font-bold text-warm-800 flex-1">{name}</span>
                      <span className="text-[10px] text-warm-400">{fmtDuration(totalMins)}</span>
                    </div>
                    {pEntries.map(e => {
                      const pt = findPresenceType(presenceTypes, e.entry_type)
                      const color = pt?.color ?? FALLBACK_COLOR
                      const label = pt?.label ?? e.entry_type
                      const canEdit = canManageAll || e.profile_id === currentUserId
                      return (
                        <div key={e.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs" style={entryStyle(color)}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={dotStyle(color)} />
                          <span className="font-medium">{label}</span>
                          {e.entry_type !== 'absence' && e.start_time && (
                            <span className="text-warm-500">{fmtTime(e.start_time)}-{fmtTime(e.end_time)}</span>
                          )}
                          <span className="text-warm-400">{fmtDuration(e.duration_minutes)}</span>
                          {e.notes && (
                            <span className="italic text-warm-400 text-[10px] truncate">{e.notes}</span>
                          )}
                          {e.is_replacement && e.replaced_profile_id && (
                            <span className="italic text-warm-400 text-[10px]">
                              rempl. {staffMap[e.replaced_profile_id]?.last_name ?? ''}
                            </span>
                          )}
                          {e.entry_type === 'absence' && e.absence_reason && (
                            <span className="italic text-warm-400 text-[10px] truncate">{e.absence_reason}</span>
                          )}
                          {canEdit && (
                            <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                              <button onClick={() => { setEditingEntry(e); setModalOpen(true) }} className="p-0.5 rounded hover:bg-white/50">
                                <Pencil size={10} className="text-warm-400" />
                              </button>
                              {deleteConfirm === e.id ? (
                                <button onClick={() => handleDelete(e.id)} className="p-0.5 rounded bg-danger-500 text-white">
                                  <Trash2 size={10} />
                                </button>
                              ) : (
                                <button onClick={() => setDeleteConfirm(e.id)} className="p-0.5 rounded hover:bg-white/50">
                                  <Trash2 size={10} className="text-warm-400" />
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                      )
                    })}
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

      {/* ── Recapitulatif mensuel ────────────────────────────────────── */}
      {canSeeRecap && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-secondary-800">
              Recapitulatif — {MONTH_NAMES[month]} {year}
            </h3>
            {canSeeCosts && presenceTypeRates.length > 0 && (
              <div className="flex flex-wrap gap-3 text-[10px] text-warm-400">
                {presenceTypes.filter(p => !p.is_absence).map(pt => {
                  const rate = presenceTypeRates.find(r => r.presence_type_id === pt.id)?.rate ?? 0
                  if (!rate) return null
                  return <span key={pt.id} style={{ color: pt.color }}>{pt.label} {fmtEur(rate)}/h</span>
                })}
              </div>
            )}
          </div>
          {monthlyRecap.rows.length === 0 ? (
            <p className="text-xs text-warm-400 italic text-center py-6">Aucune saisie ce mois</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50 border-b border-warm-100">
                  <th className="px-3 py-2 text-left text-xs font-bold text-warm-500 uppercase">Staff</th>
                  {presenceTypes.filter(p => !p.is_absence).map(pt => (
                    <th key={pt.id} className="px-3 py-2 text-center text-xs font-bold uppercase" style={{ color: pt.color }}>
                      {pt.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center text-xs font-bold text-red-400 uppercase">Absences</th>
                  {canSeeCosts && <th className="px-3 py-2 text-right text-xs font-bold text-warm-500 uppercase">Cout</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {monthlyRecap.rows.map(r => (
                  <tr key={r.profileId} className="hover:bg-warm-50">
                    <td className="px-3 py-2 font-medium text-warm-700">{r.name}</td>
                    {presenceTypes.filter(p => !p.is_absence).map(pt => {
                      const mins = r.typeMinutes[pt.code.toUpperCase()] ?? 0
                      return (
                        <td key={pt.id} className="px-3 py-2 text-center text-warm-600">
                          {mins > 0 ? fmtDuration(mins) : '—'}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-center text-warm-600">{r.absenceDays > 0 ? `${r.absenceDays}j` : '—'}</td>
                    {canSeeCosts && <td className="px-3 py-2 text-right font-bold text-secondary-800">{fmtEur(r.cost)}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-warm-50 border-t border-warm-200 font-bold">
                  <td className="px-3 py-2 text-warm-700">TOTAL</td>
                  {presenceTypes.filter(p => !p.is_absence).map(pt => {
                    const mins = monthlyRecap.totals.typeMinutes[pt.code.toUpperCase()] ?? 0
                    return (
                      <td key={pt.id} className="px-3 py-2 text-center" style={{ color: pt.color }}>
                        {mins > 0 ? fmtDuration(mins) : '—'}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center text-red-600">{monthlyRecap.totals.absenceDays > 0 ? `${monthlyRecap.totals.absenceDays}j` : '—'}</td>
                  {canSeeCosts && <td className="px-3 py-2 text-right text-secondary-800">{fmtEur(monthlyRecap.totals.cost)}</td>}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {modalOpen && (
        <TimeEntryModal
          date={selectedDay}
          entry={editingEntry}
          currentUserId={currentUserId}
          canManageAll={canManageAll}
          staffList={staffList}
          presenceTypes={presenceTypes}
          existingEntries={dayEntries}
          onClose={() => { setModalOpen(false); setEditingEntry(null) }}
          onSaved={() => { setModalOpen(false); setEditingEntry(null); fetchEntries() }}
        />
      )}
    </div>
  )
}
