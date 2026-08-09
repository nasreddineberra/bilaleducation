'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import type { AuditLog, AuditAction } from '@/types/database'
import { PURGE_OPTIONS, type PurgeJours } from '@/lib/audit/purge-options'

const PAGE_SIZE = 20

// ─── Labels ──────────────────────────────────────────────────────────────────

/**
 * Nom de chaque entité, tel qu'une direction le comprend.
 *
 * Le journal affichait le nom des TABLES — `cotisation_types`, `fee_adjustments`,
 * `unites_enseignement`. C'est le vocabulaire de la base, pas celui de l'école :
 * on lui demandait de deviner ce qu'elle avait sous les yeux.
 *
 * La liste couvre les **38 tables auditées**, pas seulement celles déjà
 * apparues : une entité surgit le jour où quelqu'un modifie cette donnée pour la
 * première fois, et elle ne doit pas surgir en anglais.
 */
const ENTITY_LABELS: Record<string, string> = {
  // Vie scolaire
  students:                     'Apprenants',
  parents:                      'Parents',
  enrollments:                  'Inscriptions',
  parent_class_enrollments:     'Inscriptions adultes',
  absences:                     'Absences',
  student_warnings:             'Avertissements',
  student_warning_attachments:  'Pièces jointes d\'avertissement',
  student_documents:            'Documents apprenant',

  // Personnel
  teachers:                     'Enseignants',
  teacher_documents:            'Documents enseignant',
  profiles:                     'Comptes utilisateurs',
  staff_time_entries:           'Temps de présence',
  staff_hourly_rates:           'Taux horaires',

  // Pédagogie
  classes:                      'Classes',
  cours:                        'Cours',
  cours_modules:                'Modules de cours',
  unites_enseignement:          'Unités d\'enseignement',
  evaluations:                  'Évaluations',
  evaluation_order_config:      'Ordre des évaluations',
  grades:                       'Notes',
  adult_grades:                 'Notes des adultes',
  bulletin_archives:            'Bulletins archivés',
  adult_bulletin_archives:      'Bulletins archivés (adultes)',
  adult_bulletin_appreciations: 'Appréciations (adultes)',
  schedule_slots:               'Emploi du temps',
  schedule_exceptions:          'Exceptions d\'emploi du temps',
  schedule_validations:         'Validations de présence',

  // Finances
  cotisation_types:             'Types de cotisation',
  family_fees:                  'Cotisations des familles',
  fee_installments:             'Échéances de paiement',
  fee_adjustments:              'Réductions et avoirs',
  expenses:                     'Dépenses',
  other_revenues:               'Autres recettes',

  // Communication
  announcements:                'Messages envoyés',
  announcement_attachments:     'Pièces jointes de message',

  // Paramétrage
  etablissements:               'Établissement',
  school_years:                 'Années scolaires',
  document_type_configs:        'Documents requis',
  rooms:                        'Salles',
  materials:                    'Matériel',

  // Transverse
  auth:                         'Authentification',
  support:                      'Support éditeur',
}

const ROLE_LABELS: Record<string, string> = {
  super_admin:              'Super Admin',
  admin:                    'Admin',
  direction:                'Direction',
  comptable:                'Comptable',
  responsable_pedagogique:  'Resp. Pédago.',
  enseignant:               'Enseignant',
  secretaire:               'Secrétaire',
  parent:                   'Parent',
}

const ACTION_CONFIG: Record<AuditAction, { label: string; bg: string; text: string }> = {
  INSERT: { label: 'Création',     bg: 'bg-green-100', text: 'text-green-700' },
  UPDATE: { label: 'Modification', bg: 'bg-blue-100',  text: 'text-blue-700' },
  DELETE: { label: 'Suppression',  bg: 'bg-red-100',   text: 'text-red-700' },
  LOGIN:  { label: 'Connexion',    bg: 'bg-secondary-100', text: 'text-secondary-700' },
  LOGOUT: { label: 'Déconnexion',  bg: 'bg-amber-100',   text: 'text-amber-700' },
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface AuditLogsClientProps {
  logs:         AuditLog[]
  totalCount:   number
  page:         number
  users:        { user_id: string; user_name: string; user_email: string }[]
  entityTypes:  string[]
  userRoles:    Record<string, string>
  docOwners:    Record<string, string>
  /** Intervention de support en cours : la purge appartient a l'ecole. */
  purgeInterdite: boolean
  filters: {
    user:        string
    entity_type: string
    action:      string
    date_from:   string
    date_to:     string
  }
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function PaginationBar({ page, totalPages, onNavigate }: {
  page:       number
  totalPages: number
  onNavigate: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onNavigate(page - 1)}
        disabled={page === 1}
        aria-label="Page précédente"
        className="p-1.5 rounded-lg text-warm-700 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      >
        <ChevronLeft size={15} />
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1 text-warm-700 text-sm select-none">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onNavigate(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[30px] h-[30px] rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
              p === page
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-600 hover:bg-warm-100'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onNavigate(page + 1)}
        disabled={page === totalPages}
        aria-label="Page suivante"
        className="p-1.5 rounded-lg text-warm-700 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ─── Detail changes ──────────────────────────────────────────────────────────

function getChangedFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string {
  if (!oldData || !newData) return ''
  const changes: string[] = []
  for (const key of Object.keys(newData)) {
    if (['created_at', 'updated_at', 'id', 'etablissement_id'].includes(key)) continue
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changes.push(key)
    }
  }
  return changes.join(', ')
}

function getEntityLabel(log: AuditLog): string {
  const data = log.new_data ?? log.old_data
  if (!data) return ''
  const last = (data.last_name as string) ?? (data.tutor1_last_name as string) ?? ''
  const first = (data.first_name as string) ?? (data.tutor1_first_name as string) ?? ''
  const name = (data.name as string) ?? (data.title as string) ?? (data.label as string) ?? ''
  if (last || first) return `${last} ${first}`.trim()
  if (name) return name
  return ''
}

// ─── Formatage date ──────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function AuditLogsClient({
  logs, totalCount, page, users, entityTypes, userRoles, docOwners, purgeInterdite, filters,
}: AuditLogsClientProps) {
  const router = useRouter()
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const [showPurge, setShowPurge] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)
  // Le mois par defaut : c'est l'ancien comportement, et le choix le plus sur.
  const [purgeJours, setPurgeJours] = useState<PurgeJours>(30)
  /**
   * DEUX TEMPS. Le bouton « Purger » declenchait la suppression au premier clic,
   * depuis un ecran ou l'on venait de cocher une option : le geste de choisir et
   * le geste de detruire se confondaient. On separe donc le choix (1) de la
   * confirmation (2), et cette derniere annonce le NOMBRE REEL d'entrees
   * concernees — sans quoi elle ne serait qu'une formalite qu'on clique.
   */
  const [purgeEtape, setPurgeEtape] = useState<1 | 2>(1)
  const [purgeCount, setPurgeCount] = useState<number | null>(null)
  const [comptage, setComptage] = useState(false)
  /** L'option retenue, rappelee a la confirmation : on ne confirme pas a l'aveugle. */
  const optionChoisie = PURGE_OPTIONS.find(o => o.jours === purgeJours)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Modale : focus a l'ouverture + fermeture par Echap
  useEffect(() => {
    if (!showPurge) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !purging) fermerPurge() }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPurge, purging])

  const fermerPurge = () => {
    setShowPurge(false)
    setPurgeEtape(1)
    setPurgeCount(null)
  }

  /** Passage a la confirmation : on demande d'abord le volume au serveur. */
  const versConfirmation = async () => {
    setComptage(true)
    setPurgeResult(null)
    try {
      const res = await fetch(`/api/audit-logs/purge?jours=${purgeJours}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPurgeCount(data.count)
      setPurgeEtape(2)
    } catch {
      // Sans le volume, on ne confirme pas a l'aveugle : on le dit et on reste
      // sur le choix.
      setPurgeResult('Impossible de compter les entrées concernées. Purge non lancée.')
      fermerPurge()
    } finally {
      setComptage(false)
    }
  }

  const handlePurge = async () => {
    setPurging(true)
    setPurgeResult(null)
    try {
      const res = await fetch(`/api/audit-logs/purge?jours=${purgeJours}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPurgeResult(`${data.deleted} entrée${data.deleted > 1 ? 's' : ''} supprimée${data.deleted > 1 ? 's' : ''}`)
      fermerPurge()
      router.refresh()
    } catch {
      setPurgeResult('Erreur lors de la purge')
    } finally {
      setPurging(false)
    }
  }

  const navigate = (params: Partial<typeof filters> & { page?: number }) => {
    const sp = new URLSearchParams()
    const merged = { ...filters, ...params }
    if (merged.user)        sp.set('user', merged.user)
    if (merged.entity_type) sp.set('entity_type', merged.entity_type)
    if (merged.action)      sp.set('action', merged.action)
    if (merged.date_from)   sp.set('date_from', merged.date_from)
    if (merged.date_to)     sp.set('date_to', merged.date_to)
    if (params.page && params.page > 1) sp.set('page', String(params.page))
    const qs = sp.toString()
    router.push(`/dashboard/logs${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <label htmlFor="log-date-from" className="text-xs text-warm-700">Du</label>
          <input
            id="log-date-from"
            type="date"
            value={filters.date_from}
            onChange={e => navigate({ date_from: e.target.value, page: 1 })}
            className="input text-sm py-1.5 px-2 w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="log-date-to" className="text-xs text-warm-700">Au</label>
          <input
            id="log-date-to"
            type="date"
            value={filters.date_to}
            onChange={e => navigate({ date_to: e.target.value, page: 1 })}
            className="input text-sm py-1.5 px-2 w-36"
          />
        </div>
        {/* Filtre par utilisateur. C'était une barre d'ONGLETS, un par personne :
            lisible à trois comptes, illisible à trente — elle débordait en
            défilement horizontal et poussait le tableau vers le bas. */}
        <select
          aria-label="Filtrer par utilisateur"
          value={filters.user}
          onChange={e => navigate({ user: e.target.value, page: 1 })}
          className="input text-sm py-1.5 px-2 w-auto"
        >
          <option value="">Tous les utilisateurs</option>
          {users.map(u => (
            <option key={u.user_id} value={u.user_id}>
              {u.user_name || u.user_email}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrer par entité"
          value={filters.entity_type}
          onChange={e => navigate({ entity_type: e.target.value, page: 1 })}
          className="input text-sm py-1.5 px-2 w-auto"
        >
          <option value="">Toutes les entités</option>
          {/* Tri sur le LIBELLÉ et non sur le nom de table : classer « Notes »
              sous G parce que la table s'appelle `grades` n'aide personne. */}
          {[...entityTypes]
            .sort((a, b) => (ENTITY_LABELS[a] ?? a).localeCompare(ENTITY_LABELS[b] ?? b, 'fr'))
            .map(t => (
              <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>
            ))}
        </select>
        <select
          aria-label="Filtrer par action"
          value={filters.action}
          onChange={e => navigate({ action: e.target.value, page: 1 })}
          className="input text-sm py-1.5 px-2 w-auto"
        >
          <option value="">Toutes les actions</option>
          <option value="INSERT">Création</option>
          <option value="UPDATE">Modification</option>
          <option value="DELETE">Suppression</option>
          <option value="LOGIN">Connexion</option>
          <option value="LOGOUT">Déconnexion</option>
        </select>
        {(filters.user || filters.date_from || filters.date_to || filters.entity_type || filters.action) && (
          <button
            onClick={() => navigate({ user: '', date_from: '', date_to: '', entity_type: '', action: '', page: 1 })}
            className="text-xs text-red-500 hover:text-red-700 underline rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            Réinitialiser
          </button>
        )}
        <div className="ml-auto">
          {/* Désactivé, jamais masqué : un bouton qui disparaît se lit comme un
              défaut d'affichage, alors qu'ici c'est une règle qu'il faut dire. */}
          <Tooltip
            content={purgeInterdite
              ? "Le journal appartient à l'établissement : il ne se purge pas pendant une intervention de support."
              : 'Supprimer des traces du journal'}
          >
            <FloatButton
              type="button"
              variant="danger"
              onClick={() => setShowPurge(true)}
              disabled={purgeInterdite}
            >
              Purger le journal
            </FloatButton>
          </Tooltip>
        </div>
      </div>

      {/* Resultat purge */}
      {purgeResult && (
        <div role="status" aria-live="polite" className="mb-2 px-3 py-2 rounded-lg bg-warm-100 text-sm text-secondary-700 flex items-center justify-between">
          <span>{purgeResult}</span>
          <button onClick={() => setPurgeResult(null)} className="text-warm-700 hover:text-secondary-700 text-xs rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-warm-400/50">Fermer</button>
        </div>
      )}

      {/* Modale confirmation purge */}
      {showPurge && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-title"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md outline-none"
          >
            <h3 id="purge-title" className="text-lg font-bold text-secondary-800 mb-2">
              {purgeEtape === 1 ? 'Purger le journal' : 'Confirmer la suppression'}
            </h3>

            {purgeEtape === 1 ? (
              <>
                <p className="text-sm text-warm-700 mb-3">
                  Choisissez ce que vous souhaitez conserver. La suppression est
                  <span className="font-semibold"> définitive</span> : le journal ne se reconstitue pas.
                </p>

                {/* Un choix EXPLICITE plutôt qu'un délai imposé : selon qu'on fasse
                    du ménage ou qu'on reparte à zéro, ce n'est pas la même opération.
                    Le mois reste coché par défaut — l'ancien comportement, et le
                    choix le moins destructeur. */}
                <fieldset className="space-y-1.5 mb-4">
                  <legend className="sr-only">Durée de conservation</legend>
                  {PURGE_OPTIONS.map(o => (
                    <label
                      key={o.jours}
                      className={clsx(
                        'flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                        purgeJours === o.jours
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-warm-200 hover:bg-warm-50',
                      )}
                    >
                      <input
                        type="radio"
                        name="purge-duree"
                        value={o.jours}
                        checked={purgeJours === o.jours}
                        onChange={() => setPurgeJours(o.jours)}
                        disabled={comptage}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-secondary-800">{o.label}</span>
                        <span className={clsx('block text-xs', o.jours === 0 ? 'text-red-700' : 'text-warm-700')}>
                          {o.detail}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="flex justify-end gap-3">
                  <FloatButton type="button" variant="secondary" onClick={fermerPurge} disabled={comptage}>
                    Annuler
                  </FloatButton>
                  {/* « Continuer » et non « Purger » : ce bouton ne detruit rien. */}
                  <FloatButton type="button" variant="submit" onClick={versConfirmation} disabled={comptage}>
                    {comptage ? 'Vérification…' : 'Continuer'}
                  </FloatButton>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-warm-700 mb-3">
                  {optionChoisie?.label} · {optionChoisie?.detail}
                </p>

                <div className={clsx(
                  'rounded-lg border px-3 py-3 mb-4',
                  purgeCount === 0 ? 'border-warm-200 bg-warm-50' : 'border-red-200 bg-red-50',
                )}>
                  {purgeCount === 0 ? (
                    <p className="text-sm text-warm-700">
                      Aucune entrée ne correspond : il n’y a rien à supprimer.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-secondary-800">
                        <span className="font-bold tabular-nums">{purgeCount?.toLocaleString('fr-FR')}</span>
                        {' '}entrée{(purgeCount ?? 0) > 1 ? 's' : ''} du journal
                        {(purgeCount ?? 0) > 1 ? ' seront supprimées' : ' sera supprimée'}
                        {' '}<span className="font-semibold">définitivement</span>.
                      </p>
                      <p className="mt-1 text-xs text-red-700">
                        Le journal ne se reconstitue pas : ces traces ne pourront plus être produites.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  {/* Retour, et non Annuler : on revient au choix sans tout refermer. */}
                  <FloatButton type="button" variant="secondary" onClick={() => setPurgeEtape(1)} disabled={purging}>
                    Retour
                  </FloatButton>
                  <FloatButton
                    type="button"
                    variant="danger"
                    onClick={handlePurge}
                    disabled={purging || purgeCount === 0}
                  >
                    {purging
                      ? 'Suppression…'
                      : purgeJours === 0 ? 'Tout supprimer' : 'Supprimer définitivement'}
                  </FloatButton>
                </div>
              </>
            )}
          </div>
        </div>
        ,
        document.body
      )}

      {/* Tableau */}
      <div className="card flex-1 overflow-hidden">
        <table className="w-full text-sm" aria-label="Journal d'activité">
          <thead>
            <tr className="border-b border-warm-200 text-left text-xs text-warm-700 uppercase tracking-wider">
              <th className="py-2 px-3 whitespace-nowrap">Date</th>
              <th className="py-2 px-3 whitespace-nowrap">Utilisateur</th>
              <th className="py-2 px-3 whitespace-nowrap">Action</th>
              <th className="py-2 px-3 whitespace-nowrap">Entite</th>
              <th className="py-2 px-3 whitespace-nowrap">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-warm-700">
                  Aucun log trouve
                </td>
              </tr>
            ) : (
              logs.map(log => {
                const ac = ACTION_CONFIG[log.action]
                const isDoc = log.entity_type === 'teacher_documents' || log.entity_type === 'student_documents'
                const docData = (log.new_data ?? log.old_data) as Record<string, unknown> | null
                const ownerId = isDoc ? ((docData?.teacher_id ?? docData?.student_id) as string | undefined) : undefined
                // Pour un document : l'entité affiche l'enseignant/apprenant concerné
                const entityLabel = isDoc
                  ? (ownerId ? (docOwners[ownerId] ?? '') : '')
                  : getEntityLabel(log)
                const changedFields = log.action === 'UPDATE'
                  ? getChangedFields(log.old_data, log.new_data)
                  : ''
                // Pour un document : le détail affiche le libellé/nom du document
                const detailText = isDoc
                  ? ((docData?.label as string) || (docData?.file_name as string) || '')
                  : log.description
                    ? log.description
                    : log.action === 'UPDATE' && changedFields
                      ? changedFields
                      : log.action === 'INSERT'
                        ? 'Nouvel enregistrement'
                        : log.action === 'DELETE'
                          ? 'Suppression'
                          : ''

                return (
                  <tr key={log.id} className="border-b border-warm-100 hover:bg-warm-50 transition-colors">
                    <td className="py-1.5 px-3 text-xs text-secondary-600 whitespace-nowrap">
                      {fmtDate(log.created_at)}
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span className="text-secondary-700 font-medium">{log.user_name || log.user_email || '-'}</span>
                      {log.user_id && userRoles[log.user_id] && (
                        <span className="ml-1.5 text-warm-700 text-[11px]">({ROLE_LABELS[userRoles[log.user_id]] ?? userRoles[log.user_id]})</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-medium', ac.bg, ac.text)}>
                        {ac.label}
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      <span className="text-secondary-600">{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</span>
                      {entityLabel && (
                        <span className="ml-1.5 text-warm-700 text-xs">{entityLabel}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-xs text-warm-700">
                      {detailText && (
                        <Tooltip content={detailText}>
                          <span className="block truncate max-w-[16rem]">{detailText}</span>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pied de page : compteur + pagination */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-warm-700">
          {totalCount} resultat{totalCount > 1 ? 's' : ''}
        </span>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          onNavigate={p => navigate({ page: p })}
        />
      </div>
    </div>
  )
}
