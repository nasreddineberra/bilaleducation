'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { useToast } from '@/lib/toast-context'
import { useFiltresMemorises } from '@/hooks/useFiltresMemorises'
import PushSubscribeButton from './PushSubscribeButton'
import { SearchField, FloatSelect } from '@/components/ui/FloatFields'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { Puce, type Ton } from '@/components/dashboard/tdb'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'

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
  /** Annee en cours : nomme le ciblage « Parents {annee} » (aligne sur l'historique). */
  yearLabel: string | null
}

// Pastilles de la charte (`Puce`, 21/10) : dix couleurs faites main, dont du
// bleu, du vert et du violet hors charte.
const ANNOUNCEMENT_TYPE_LABELS: Record<string, { label: string; ton: Ton }> = {
  all_active:     { label: 'Parents (élèves inscrits)', ton: 'neutre' },
  all_registered: { label: 'Tous les contacts',        ton: 'neutre' },
  class:          { label: "Parents d'une classe",     ton: 'neutre' },
  selected:       { label: 'Parents choisis',          ton: 'neutre' },
  staff:          { label: 'Équipe',                   ton: 'neutre' },
}

const AUTO_TYPE_LABELS: Record<string, { label: string; ton: Ton }> = {
  absence:      { label: 'Absence',  ton: 'danger' },
  retard:       { label: 'Retard',   ton: 'orange' },
  payment:      { label: 'Paiement', ton: 'ok' },
  announcement: { label: 'Annonce',  ton: 'info' },
  homework:     { label: 'Devoir',   ton: 'remplacement' },
}

// Carte d'une notification : survol par la bordure de marque (l'ombre
// `hover:shadow-md` etait en dur), focus visible ; non lue = liseré et fond de marque.
const CARTE = 'card px-4 py-3 flex items-start gap-3 w-full text-left transition-colors hover:border-[var(--brand-line)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]'
const NON_LUE = 'border-l-[3px] border-l-[var(--brand-surface)] dark:border-l-[var(--brand-accent)] bg-[var(--brand-tint)]'
const OEIL_NON_LU = 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]'

function formatDate(d: string | null): string {
  if (!d) return '·'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Une balise devient un ESPACE, pas rien : sinon « </p><p> » soude deux
// paragraphes (« staffCordialement »). Les espaces multiples se replient.
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationsClient({ notifications: toutes, role, yearLabel }: Props) {
  const router = useRouter()
  // Recherche et DEUX filtres MEMORISES : on ouvre une notification, on revient,
  // et la liste est retrouvee telle quelle. Filtrage cote CLIENT, donc rien dans
  // l'URL — voir `useFiltresMemorises`.
  //
  // Valeur « all » non vide : sinon le label flottant du FloatSelect chevauche
  // le texte de l'option.
  const [etatListe, setEtatListe] = useFiltresMemorises('notifications-filtres', {
    search: '', read: 'all', type: 'all',
  })
  const search = etatListe.search
  // Le hook garantit une chaine, pas une valeur valide : on valide ici.
  const filterRead: 'all' | 'unread' | 'read' =
    etatListe.read === 'unread' ? 'unread' : etatListe.read === 'read' ? 'read' : 'all'
  const filterType = etatListe.type
  const setSearch     = (v: string) => setEtatListe({ search: v })
  const setFilterRead = (v: string) => setEtatListe({ read: v })
  const setFilterType = (v: string) => setEtatListe({ type: v })

  // PAS memorise, a dessein : ce ne sont pas des filtres mais les lignes que
  // l'utilisateur vient de marquer comme lues dans CETTE visite. Les retenir
  // ferait croire a des lectures qui n'ont pas eu lieu.
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  // Notifications supprimees dans CETTE visite (masquees tout de suite, la page ne
  // se recharge qu'apres l'ecriture).
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  // Notification dont la suppression attend confirmation.
  const [aSupprimer, setASupprimer] = useState<AnnouncementNotif | null>(null)
  const notifications = useMemo(() => toutes.filter(n => !deletedIds.has(n.id)), [toutes, deletedIds])

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
    if (filterType && filterType !== 'all') {
      list = list.filter(n => {
        if (n.source === 'auto') return n.type === filterType
        return filterType === 'announcement'
      })
    }
    return list
  }, [notifications, search, filterRead, filterType, readIds])

  const toast = useToast()
  const unreadCount = notifications.filter(n => !n.is_read && !readIds.has(n.id)).length

  const markAsRead = async (notif: NotifRow) => {
    if (notif.is_read || readIds.has(notif.id)) return
    setReadIds(prev => new Set(prev).add(notif.id))

    const supabase = createClient()
    const table = notif.source === 'auto' ? 'notifications'
      : notif.recipientType === 'staff' ? 'announcement_staff_recipients'
      : 'announcement_recipients'
    const echec = erreurEcriture(
      await supabase.from(table)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notif.id)
        .select('id'),
      'Cette notification',
    )
    // L'optimisme se DEFAIT : sans cela la cloche se vidait a l'ecran et se
    // remplissait de nouveau au rechargement, sans que rien ne l'explique.
    if (echec) {
      setReadIds(prev => { const copie = new Set(prev); copie.delete(notif.id); return copie })
      toast.error(echec)
      return
    }
    // Le badge de la cloche est rendu par le layout, que cette page ne
    // re-rend pas : on le lui demande.
    router.refresh()
  }

  // Suppression d'une notification LUE de l'equipe : on la masque (`deleted_at`),
  // on ne l'efface pas — la ligne porte aussi la trace d'envoi de l'expediteur.
  const deleteNotif = async (notif: AnnouncementNotif) => {
    setDeletedIds(prev => new Set(prev).add(notif.id))
    const supabase = createClient()
    const echec = erreurEcriture(
      await supabase.from('announcement_staff_recipients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', notif.id)
        .select('id'),
      'Cette notification',
    )
    if (echec) {
      setDeletedIds(prev => { const copie = new Set(prev); copie.delete(notif.id); return copie })
      toast.error(echec)
      return
    }
    router.refresh()
  }

  const isParent = role === 'parent'

  return (
    <div className="space-y-4">

      {/* Filtres */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <FiltreSwitch
          ariaLabel="Filtrer par statut de lecture"
          actif={filterRead}
          onChange={setFilterRead}
          options={[
            { valeur: 'all',    libelle: 'Toutes',   nombre: notifications.length },
            { valeur: 'unread', libelle: 'Non lues', nombre: unreadCount },
            { valeur: 'read',   libelle: 'Lues',     nombre: notifications.length - unreadCount },
          ]}
        />
        {isParent && (
          <FloatSelect
            label="Type"
            compact
            aria-label="Filtrer par type de notification"
            wrapperClassName="w-44"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">Tous types</option>
            <option value="absence">Absences</option>
            <option value="retard">Retards</option>
            <option value="payment">Paiements</option>
            <option value="announcement">Annonces</option>
            <option value="homework">Devoirs</option>
          </FloatSelect>
        )}
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher…"
          ariaLabel="Rechercher une notification"
          className="max-w-xs"
        />
        {isParent && <div className="ml-auto"><PushSubscribeButton /></div>}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="card text-center text-sm text-warm-700 py-10">Aucune notification.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(n => {
            const isRead = n.is_read || readIds.has(n.id)

            if (n.source === 'auto') {
              const typeInfo = AUTO_TYPE_LABELS[n.type] ?? { label: '·', ton: 'neutre' as Ton }

              return (
                <button
                  key={`auto-${n.id}`}
                  onClick={() => markAsRead(n)}
                  className={clsx(CARTE, !isRead && NON_LUE)}
                >
                  <div className="mt-1 flex-shrink-0">
                    {isRead ? (
                      <Eye size={16} className="text-warm-700" aria-label="Lu" />
                    ) : (
                      <EyeOff size={16} className={OEIL_NON_LU} aria-label="Non lu" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={clsx(
                        'text-sm truncate',
                        isRead ? 'text-warm-700' : 'text-warm-800 font-bold'
                      )}>
                        {n.title}
                      </h3>
                      <Puce ton={typeInfo.ton}>{typeInfo.label}</Puce>
                    </div>
                    <p className="text-xs text-warm-700 mt-0.5 truncate">{n.body}</p>
                    <div className="text-[11px] text-warm-700 mt-1">
                      {formatDate(n.created_at)}
                    </div>
                  </div>
                </button>
              )
            }

            // Announcement notification
            const ann = n.announcements
            if (!ann) return null
            const typeInfo = ANNOUNCEMENT_TYPE_LABELS[ann.announcement_type ?? ''] ?? { label: '·', ton: 'neutre' as Ton }
            // « Parents {annee} » si une annee est en cours (aligne sur l'historique).
            const typeText = ann.announcement_type === 'all_active' && yearLabel
              ? `Parents ${yearLabel}`
              : typeInfo.label
            const preview = stripHtml(ann.body_html ?? ann.content ?? '').slice(0, 120)

            return (
              <Link
                key={`ann-${n.id}`}
                href={`/dashboard/notifications/${ann.id}?rid=${n.id}&rt=${n.recipientType}`}
                onClick={() => markAsRead(n)}
                className={clsx(CARTE, !isRead && NON_LUE)}
              >
                <div className="mt-1 flex-shrink-0">
                  {isRead ? (
                    <Eye size={16} className="text-warm-700" aria-label="Lu" />
                  ) : (
                    <EyeOff size={16} className={OEIL_NON_LU} aria-label="Non lu" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={clsx(
                      'text-sm truncate',
                      isRead ? 'text-warm-700' : 'text-warm-800 font-bold'
                    )}>
                      {ann.title}
                    </h3>
                    <Puce ton={typeInfo.ton}>{typeText}</Puce>
                  </div>
                  {preview && (
                    <p className="text-xs text-warm-700 mt-0.5 truncate">{preview}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-warm-700">
                    <span>{formatDate(ann.sent_at ?? ann.published_at)}</span>
                    {ann.profiles && (
                      <span>de {ann.profiles.last_name} {ann.profiles.first_name}</span>
                    )}
                  </div>
                </div>
                {/* Suppression : uniquement une notification de l'equipe deja LUE. */}
                {isRead && n.recipientType === 'staff' && (
                  <Tooltip content="Supprimer la notification">
                    <button
                      type="button"
                      aria-label={`Supprimer la notification ${ann.title}`}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setASupprimer(n) }}
                      className="p-1.5 text-warm-700 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!aSupprimer}
        variant="danger"
        confirmColor="red"
        title="Supprimer la notification"
        message={`Supprimer « ${aSupprimer?.announcements?.title ?? ''} » de vos notifications ? Le message reste dans l'historique de son expéditeur.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => { const n = aSupprimer; setASupprimer(null); if (n) void deleteNotif(n) }}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  )
}
