'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Bell, Search, Mail, Users, UserCheck, Globe, Eye, EyeOff, AlertCircle, Clock, CreditCard, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PushSubscribeButton from './PushSubscribeButton'

// ─── Types ────────────────────────────────────────────────────────────────────

type AnnouncementNotif = {
  id: string
  is_read: boolean
  read_at: string | null
  created_at: string
  source: 'announcement'
  recipientType: 'staff' | 'parent'
  announcements: {
    id: string
    title: string
    body_html: string | null
    content: string
    channel: string | null
    announcement_type: string | null
    published_at: string | null
    sent_at: string | null
    profiles: { first_name: string; last_name: string } | null
  } | null
}

type AutoNotif = {
  id: string
  type: 'absence' | 'retard' | 'payment' | 'announcement'
  title: string
  body: string
  metadata: Record<string, any>
  is_read: boolean
  read_at: string | null
  created_at: string
  source: 'auto'
  recipientType: 'parent'
}

type NotifRow = AnnouncementNotif | AutoNotif

interface Props {
  notifications: NotifRow[]
  role: string
  parentId?: string
}

const ANNOUNCEMENT_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  all_active:     { label: 'Tous (actifs)',   icon: Users,     color: 'bg-blue-100 text-blue-700' },
  all_registered: { label: 'Tous (base)',     icon: Globe,     color: 'bg-purple-100 text-purple-700' },
  class:          { label: 'Classe',          icon: UserCheck, color: 'bg-amber-100 text-amber-700' },
  selected:       { label: 'Sélection',       icon: UserCheck, color: 'bg-green-100 text-green-700' },
  staff:          { label: 'Staff interne',   icon: Users,     color: 'bg-warm-100 text-warm-700' },
}

const AUTO_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  absence:      { label: 'Absence',      icon: AlertCircle, color: 'bg-red-100 text-red-700' },
  retard:       { label: 'Retard',       icon: Clock,       color: 'bg-orange-100 text-orange-700' },
  payment:      { label: 'Paiement',     icon: CreditCard,  color: 'bg-green-100 text-green-700' },
  announcement: { label: 'Annonce',      icon: Megaphone,   color: 'bg-blue-100 text-blue-700' },
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationsClient({ notifications, role, parentId }: Props) {
  const [search, setSearch] = useState('')
  const [filterRead, setFilterRead] = useState<'' | 'unread' | 'read'>('')
  const [filterType, setFilterType] = useState<string>('')
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let list = notifications
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n => {
        if (n.source === 'auto') {
          return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
        }
        const ann = n.announcements
        return ann?.title.toLowerCase().includes(q) ||
          stripHtml(ann?.body_html ?? ann?.content ?? '').toLowerCase().includes(q)
      })
    }
    if (filterRead === 'unread') list = list.filter(n => !n.is_read && !readIds.has(n.id))
    if (filterRead === 'read') list = list.filter(n => n.is_read || readIds.has(n.id))
    if (filterType) {
      list = list.filter(n => {
        if (n.source === 'auto') return n.type === filterType
        return filterType === 'announcement'
      })
    }
    return list
  }, [notifications, search, filterRead, filterType, readIds])

  const unreadCount = notifications.filter(n => !n.is_read && !readIds.has(n.id)).length

  const markAsRead = async (notif: NotifRow) => {
    if (notif.is_read || readIds.has(notif.id)) return
    setReadIds(prev => new Set(prev).add(notif.id))

    const supabase = createClient()
    if (notif.source === 'auto') {
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notif.id)
    } else if (notif.recipientType === 'staff') {
      await supabase.from('announcement_staff_recipients').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notif.id)
    } else {
      await supabase.from('announcement_recipients').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notif.id)
    }
  }

  const isParent = role === 'parent'

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-warm-600">
            <Bell size={16} className="text-warm-400" />
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
              {unreadCount} non lu{unreadCount !== 1 ? 'es' : 'e'}
            </span>
          )}
        </div>
        {isParent && <PushSubscribeButton />}
      </div>

      {/* Filtres */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="input text-sm py-1.5 pl-8 w-full"
          />
        </div>
        <select
          value={filterRead}
          onChange={e => setFilterRead(e.target.value as any)}
          className="input text-sm py-1.5"
        >
          <option value="">Toutes</option>
          <option value="unread">Non lues</option>
          <option value="read">Lues</option>
        </select>
        {isParent && (
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">Tous types</option>
            <option value="absence">Absences</option>
            <option value="retard">Retards</option>
            <option value="payment">Paiements</option>
            <option value="announcement">Annonces</option>
          </select>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <Bell size={32} className="mx-auto text-warm-300 mb-2" />
          <p className="text-sm text-warm-400">Aucune notification.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(n => {
            const isRead = n.is_read || readIds.has(n.id)

            if (n.source === 'auto') {
              const typeInfo = AUTO_TYPE_LABELS[n.type] ?? { label: '—', icon: Bell, color: 'bg-warm-100 text-warm-600' }
              const TypeIcon = typeInfo.icon

              return (
                <button
                  key={`auto-${n.id}`}
                  onClick={() => markAsRead(n)}
                  className={clsx(
                    'card px-4 py-3 flex items-start gap-3 hover:shadow-md transition-all w-full text-left',
                    !isRead && 'border-l-3 border-l-primary-500 bg-primary-50/30'
                  )}
                >
                  <div className="mt-1 flex-shrink-0">
                    {isRead ? (
                      <Eye size={16} className="text-warm-300" />
                    ) : (
                      <EyeOff size={16} className="text-primary-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={clsx(
                        'text-sm truncate',
                        isRead ? 'text-warm-600' : 'text-warm-800 font-bold'
                      )}>
                        {n.title}
                      </h3>
                      <span className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0', typeInfo.color)}>
                        <TypeIcon size={9} />
                        {typeInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-warm-400 mt-0.5 truncate">{n.body}</p>
                    <div className="text-[11px] text-warm-400 mt-1">
                      {formatDate(n.created_at)}
                    </div>
                  </div>
                </button>
              )
            }

            // Announcement notification
            const ann = n.announcements
            if (!ann) return null
            const typeInfo = ANNOUNCEMENT_TYPE_LABELS[ann.announcement_type ?? ''] ?? { label: '—', icon: Mail, color: 'bg-warm-100 text-warm-600' }
            const TypeIcon = typeInfo.icon
            const preview = stripHtml(ann.body_html ?? ann.content ?? '').slice(0, 120)

            return (
              <Link
                key={`ann-${n.id}`}
                href={`/dashboard/notifications/${ann.id}?rid=${n.id}&rt=${n.recipientType}`}
                onClick={() => markAsRead(n)}
                className={clsx(
                  'card px-4 py-3 flex items-start gap-3 hover:shadow-md transition-all group',
                  !isRead && 'border-l-3 border-l-primary-500 bg-primary-50/30'
                )}
              >
                <div className="mt-1 flex-shrink-0">
                  {isRead ? (
                    <Eye size={16} className="text-warm-300" />
                  ) : (
                    <EyeOff size={16} className="text-primary-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={clsx(
                      'text-sm truncate',
                      isRead ? 'text-warm-600' : 'text-warm-800 font-bold'
                    )}>
                      {ann.title}
                    </h3>
                    <span className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0', typeInfo.color)}>
                      <TypeIcon size={9} />
                      {typeInfo.label}
                    </span>
                  </div>
                  {preview && (
                    <p className="text-xs text-warm-400 mt-0.5 truncate">{preview}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-warm-400">
                    <span>{formatDate(ann.sent_at ?? ann.published_at)}</span>
                    {ann.profiles && (
                      <span>de {ann.profiles.first_name} {ann.profiles.last_name}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
