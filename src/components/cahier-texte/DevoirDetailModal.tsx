'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import {
  X, CalendarDays, ClipboardList, BookOpen, Lightbulb, FileText,
  Eye, CheckCircle2, Circle,
} from 'lucide-react'
import { sanitize } from '@/lib/security/sanitize'
import { createClient } from '@/lib/supabase/client'
import { FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import DevoirForm from './DevoirForm'

const STAFF = ['admin', 'direction', 'responsable_pedagogique']

const HW_TYPE: Record<string, { label: string; color: string; icon: any }> = {
  exercice: { label: 'Exercice', color: 'bg-blue-100 text-blue-700', icon: ClipboardList },
  lecon:    { label: 'Leçon',    color: 'bg-green-100 text-green-700', icon: BookOpen },
  expose:   { label: 'Exposé',   color: 'bg-purple-100 text-purple-700', icon: Lightbulb },
  autre:    { label: 'Autre',    color: 'bg-warm-100 text-warm-700', icon: FileText },
}

function teacherLabelOf(t: any): string {
  if (!t) return ''
  return `${t.civilite ? t.civilite + ' ' : ''}${t.last_name} ${t.first_name}`
}
const DAY_STR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi',
  friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}
// Info classe : cotisation · Niveau (si) · horaires.
function classInfoOf(c: any): string {
  if (!c) return ''
  const parts: string[] = []
  if (c.cotisation_types?.label) parts.push(c.cotisation_types.label)
  if (c.level) parts.push(`Niveau ${c.level}`)
  if (c.day_of_week && c.start_time) {
    const day = DAY_STR[c.day_of_week] ?? c.day_of_week
    parts.push(`${day} ${c.start_time.slice(0, 5)}${c.end_time ? `-${c.end_time.slice(0, 5)}` : ''}`)
  }
  return parts.join(' · ')
}
function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}
function formatShortDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Suivi unifié : chaque participant a une clé (élève.id OU `${parentId}-${tutorNumber}`).
interface Participant { key: string; name: string }
interface Status { key: string; id: string; is_seen: boolean; seen_at: string | null; is_done: boolean; done_at: string | null }

interface Props {
  homework: any
  role: string
  teacherId: string | null
  isAdult: boolean
  subjects: string[]
  etablissementId: string
  onClose: () => void
}

export default function DevoirDetailModal({ homework, role, teacherId, isAdult, subjects, etablissementId, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [myKeys, setMyKeys] = useState<string[]>([])   // clés que l'utilisateur connecté peut pointer

  const isParent = role === 'parent'
  const canViewTracking = STAFF.includes(role) || role === 'enseignant'
  const canEdit = STAFF.includes(role) || homework.teacher_id === teacherId
  const teacherLabel = teacherLabelOf(homework.teachers)
  const trackingLabel = isAdult ? 'Suivi des participants' : 'Suivi des familles'

  const typeInfo = HW_TYPE[homework.homework_type] ?? HW_TYPE.autre
  const isPast = new Date(homework.due_date) < new Date(new Date().toDateString())

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const supabase = createClient()

      if (isAdult) {
        // Participants = tuteurs inscrits (parent_class_enrollments) + statuts adult_homework_status.
        const { data: enr } = await supabase
          .from('parent_class_enrollments')
          .select('parent_id, tutor_number, parents(tutor1_first_name, tutor1_last_name, tutor2_first_name, tutor2_last_name)')
          .eq('class_id', homework.class_id)
          .eq('status', 'active')
        const parts: Participant[] = ((enr ?? []) as any[]).map(e => {
          const p = e.parents
          const name = e.tutor_number === 1
            ? `${p?.tutor1_last_name ?? ''} ${p?.tutor1_first_name ?? ''}`.trim()
            : `${p?.tutor2_last_name ?? ''} ${p?.tutor2_first_name ?? ''}`.trim()
          return { key: `${e.parent_id}-${e.tutor_number}`, name: name || 'Participant' }
        }).sort((a, b) => a.name.localeCompare(b.name))

        const { data: st } = await supabase.from('adult_homework_status').select('*').eq('homework_id', homework.id)
        const sts: Status[] = ((st ?? []) as any[]).map(s => ({
          key: `${s.parent_id}-${s.tutor_number}`, id: s.id,
          is_seen: s.is_seen, seen_at: s.seen_at, is_done: s.is_done, done_at: s.done_at,
        }))

        let mine: string[] = []
        if (isParent) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: me } = await supabase
              .from('parents')
              .select('id, tutor1_user_id, tutor2_user_id')
              .or(`tutor1_user_id.eq.${user.id},tutor2_user_id.eq.${user.id}`)
            const myAll: string[] = []
            for (const p of (me ?? []) as any[]) {
              if (p.tutor1_user_id === user.id) myAll.push(`${p.id}-1`)
              if (p.tutor2_user_id === user.id) myAll.push(`${p.id}-2`)
            }
            mine = myAll.filter(k => parts.some(pt => pt.key === k))
          }
        }
        if (active) { setParticipants(parts); setStatuses(sts); setMyKeys(mine) }

      } else {
        // Classe d'enfants : participants = élèves inscrits, statuts homework_status.
        if (isParent) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          const { data: pl } = await supabase.from('parents').select('id').eq('user_id', user.id).maybeSingle()
          if (!pl) return
          const { data: kids } = await supabase.from('students').select('id, first_name, last_name').eq('parent_id', pl.id).eq('is_active', true)
          const parts: Participant[] = ((kids ?? []) as any[]).map(s => ({ key: s.id, name: `${s.last_name} ${s.first_name}` }))
          const ids = parts.map(p => p.key)
          const { data: st } = ids.length
            ? await supabase.from('homework_status').select('*').eq('homework_id', homework.id).in('student_id', ids)
            : { data: [] as any[] }
          const sts: Status[] = ((st ?? []) as any[]).map(s => ({ key: s.student_id, id: s.id, is_seen: s.is_seen, seen_at: s.seen_at, is_done: s.is_done, done_at: s.done_at }))
          if (active) { setParticipants(parts); setStatuses(sts); setMyKeys(ids) }
        } else if (canViewTracking) {
          const { data: enr } = await supabase
            .from('enrollments')
            .select('student_id, students:student_id(id, first_name, last_name)')
            .eq('class_id', homework.class_id)
            .eq('status', 'active')
          const parts: Participant[] = ((enr ?? []) as any[])
            .filter(e => e.students)
            .map(e => ({ key: e.students.id, name: `${e.students.last_name} ${e.students.first_name}` }))
            .sort((a, b) => a.name.localeCompare(b.name))
          const { data: st } = await supabase.from('homework_status').select('*').eq('homework_id', homework.id)
          const sts: Status[] = ((st ?? []) as any[]).map(s => ({ key: s.student_id, id: s.id, is_seen: s.is_seen, seen_at: s.seen_at, is_done: s.is_done, done_at: s.done_at }))
          if (active) { setParticipants(parts); setStatuses(sts); setMyKeys([]) }
        }
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homework.id])

  const toggle = async (key: string, field: 'is_seen' | 'is_done') => {
    const supabase = createClient()
    const existing = statuses.find(s => s.key === key)
    const newVal = existing ? !existing[field] : true
    const stampField = field === 'is_seen' ? 'seen_at' : 'done_at'
    const stamp = newVal ? new Date().toISOString() : null

    if (existing) {
      const table = isAdult ? 'adult_homework_status' : 'homework_status'
      await supabase.from(table).update({ [field]: newVal, [stampField]: stamp }).eq('id', existing.id)
      setStatuses(prev => prev.map(s => s.key === key ? { ...s, [field]: newVal, [stampField]: stamp } : s))
      return
    }

    let row: any
    if (isAdult) {
      const cut = key.lastIndexOf('-')
      row = { homework_id: homework.id, parent_id: key.slice(0, cut), tutor_number: Number(key.slice(cut + 1)) }
    } else {
      row = { homework_id: homework.id, student_id: key }
    }
    row[field] = newVal
    row[stampField] = stamp
    const table = isAdult ? 'adult_homework_status' : 'homework_status'
    const { data } = await supabase.from(table).insert(row).select('id').single()
    if (data) {
      setStatuses(prev => [...prev, {
        key, id: data.id,
        is_seen: field === 'is_seen' ? newVal : false, seen_at: field === 'is_seen' ? stamp : null,
        is_done: field === 'is_done' ? newVal : false, done_at: field === 'is_done' ? stamp : null,
      }])
    }
  }

  const statusOf = (key: string) => statuses.find(s => s.key === key)
  const seenCount = participants.filter(p => statusOf(p.key)?.is_seen).length
  const doneCount = participants.filter(p => statusOf(p.key)?.is_done).length
  const total = participants.length

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="devoir-detail-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-warm-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h3 id="devoir-detail-title" className="text-sm font-bold text-secondary-800 truncate">{homework.title}</h3>
            <div className="flex items-center gap-2 text-[11px] text-warm-700 mt-0.5 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-secondary-100 text-secondary-700 font-bold">{homework.classes?.name}</span>
              {homework.subject && homework.subject !== 'General' && (
                <span className="px-1.5 py-0.5 rounded bg-warm-100 text-warm-700 font-bold">{homework.subject}</span>
              )}
              <span>{teacherLabel}</span>
              {classInfoOf(homework.classes) && <span>· {classInfoOf(homework.classes)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && <FloatButton variant="edit" type="button" onClick={() => setShowEdit(true)}>Modifier</FloatButton>}
            <button type="button" onClick={onClose} aria-label="Fermer" className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
          {/* Type de devoir + date de rendu (juste au-dessus des consignes) */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={clsx('inline-flex items-center px-3 py-1.5 rounded-md font-bold text-sm uppercase tracking-wide', typeInfo.color)}>
                {typeInfo.label}
              </span>
              <span className={clsx('inline-flex items-center gap-1.5 text-sm font-medium', isPast ? 'text-warm-700' : 'text-red-600')}>
                <CalendarDays size={14} /> A rendre le {formatDate(homework.due_date)}
              </span>
            </div>

            {/* Consignes (sans icone) */}
            {homework.description_html && sanitize(homework.description_html).trim() && (
              <div className="mt-2">
                <h4 className="text-sm font-bold text-secondary-700 uppercase tracking-wide mb-2">Consignes</h4>
                <div className="prose prose-sm max-w-none text-warm-700" dangerouslySetInnerHTML={{ __html: sanitize(homework.description_html) }} />
              </div>
            )}
          </div>

          {/* Mon pointage (parent / participant adulte) */}
          {myKeys.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Suivi</h4>
              {myKeys.map(key => {
                const st = statusOf(key)
                const p = participants.find(pt => pt.key === key)
                return (
                  <div key={key} className="flex items-center gap-4">
                    {p && <span className="text-sm text-warm-700 w-40 truncate">{p.name}</span>}
                    <button onClick={() => toggle(key, 'is_seen')} aria-pressed={!!st?.is_seen}
                      className={clsx('flex items-center gap-1.5 text-sm transition-colors', st?.is_seen ? 'text-blue-600' : 'text-warm-700 hover:text-blue-500')}>
                      {st?.is_seen ? <Eye size={16} /> : <Circle size={16} />} Vu
                    </button>
                    <button onClick={() => toggle(key, 'is_done')} aria-pressed={!!st?.is_done}
                      className={clsx('flex items-center gap-1.5 text-sm transition-colors', st?.is_done ? 'text-green-600' : 'text-warm-700 hover:text-green-500')}>
                      {st?.is_done ? <CheckCircle2 size={16} /> : <Circle size={16} />} Effectue
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Staff : tableau de suivi */}
          {canViewTracking && participants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <h4 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">{trackingLabel}</h4>
                <span className="text-xs text-warm-700">{seenCount}/{total} vus · {doneCount}/{total} effectues</span>
              </div>
              <div className="overflow-x-auto">
                <table aria-label={`${trackingLabel} (vu / effectué)`} className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-warm-700 border-b border-warm-200">
                      <th className="pb-2 pr-4">{isAdult ? 'Participant' : 'Eleve'}</th>
                      <th className="pb-2 px-4 text-center">Vu</th>
                      <th className="pb-2 px-4 text-center">Effectue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map(p => {
                      const st = statusOf(p.key)
                      return (
                        <tr key={p.key} className="border-b border-warm-100">
                          <td className="py-1.5 pr-4 text-warm-700">{p.name}</td>
                          <td className="py-1.5 px-4 text-center">
                            {st?.is_seen ? (
                              <Tooltip content={`Vu le ${formatShortDate(st.seen_at)}`}>
                                <span className="text-blue-600 text-xs" aria-label={`Vu le ${formatShortDate(st.seen_at)}`}><Eye size={14} className="inline" /></span>
                              </Tooltip>
                            ) : <span className="text-warm-700" aria-label="Non vu">·</span>}
                          </td>
                          <td className="py-1.5 px-4 text-center">
                            {st?.is_done ? (
                              <Tooltip content={`Effectué le ${formatShortDate(st.done_at)}`}>
                                <span className="text-green-600 text-xs" aria-label={`Effectué le ${formatShortDate(st.done_at)}`}><CheckCircle2 size={14} className="inline" /></span>
                              </Tooltip>
                            ) : <span className="text-warm-700" aria-label="Non effectué">·</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-warm-100 flex justify-end flex-shrink-0">
          <FloatButton variant="secondary" type="button" onClick={onClose}>Fermer</FloatButton>
        </div>
      </div>

      {showEdit && (
        <DevoirForm
          etablissementId={etablissementId}
          classId={homework.class_id}
          className={homework.classes?.name ?? ''}
          teacherId={homework.teacher_id}
          teacherLabel={teacherLabel}
          subjects={subjects}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onClose() }}
          initialData={{
            id: homework.id,
            subject: homework.subject,
            title: homework.title,
            homework_type: homework.homework_type,
            due_date: (homework.due_date ?? '').slice(0, 10),
            description_html: homework.description_html,
          }}
        />
      )}
    </div>,
    document.body
  )
}
