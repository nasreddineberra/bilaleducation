'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { AuditLog, AuditAction } from '@/types/database'

const PAGE_SIZE = 20

// ─── Labels ──────────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  students:    'Apprenants',
  parents:     'Parents',
  teachers:    'Enseignants',
  classes:     'Classes',
  enrollments: 'Inscriptions',
  evaluations: 'Evaluations',
  grades:      'Notes',
  absences:    'Absences',
  profiles:    'Utilisateurs',
  auth:        'Authentification',
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
  INSERT: { label: 'Creation',     bg: 'bg-green-100', text: 'text-green-700' },
  UPDATE: { label: 'Modification', bg: 'bg-blue-100',  text: 'text-blue-700' },
  DELETE: { label: 'Suppression',  bg: 'bg-red-100',   text: 'text-red-700' },
  LOGIN:  { label: 'Connexion',    bg: 'bg-emerald-100', text: 'text-emerald-700' },
  LOGOUT: { label: 'Deconnexion',  bg: 'bg-amber-100',   text: 'text-amber-700' },
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface AuditLogsClientProps {
  logs:         AuditLog[]
  totalCount:   number
  page:         number
  users:        { user_id: string; user_name: string; user_email: string }[]
  entityTypes:  string[]
  userRoles:    Record<string, string>
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
        className="p-1.5 rounded-lg text-warm-400 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={15} />
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1 text-warm-400 text-sm select-none">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onNavigate(p)}
            className={`min-w-[30px] h-[30px] rounded-lg text-sm font-medium transition-colors ${
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
        className="p-1.5 rounded-lg text-warm-400 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
  logs, totalCount, page, users, entityTypes, userRoles, filters,
}: AuditLogsClientProps) {
  const router = useRouter()
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const [showPurge, setShowPurge] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)

  const handlePurge = async () => {
    setPurging(true)
    setPurgeResult(null)
    try {
      const res = await fetch('/api/audit-logs/purge', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPurgeResult(`${data.deleted} log${data.deleted > 1 ? 's' : ''} supprime${data.deleted > 1 ? 's' : ''}`)
      setShowPurge(false)
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

      {/* Onglets utilisateurs */}
      <div className="flex items-center gap-1 border-b border-warm-200 mb-3 overflow-x-auto">
        <button
          onClick={() => navigate({ user: '', page: 1 })}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            !filters.user
              ? 'border-primary-500 text-primary-700'
              : 'border-transparent text-warm-500 hover:text-secondary-700'
          )}
        >
          Tous
        </button>
        {users.map(u => (
          <button
            key={u.user_id}
            onClick={() => navigate({ user: u.user_id, page: 1 })}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              filters.user === u.user_id
                ? 'border-primary-500 text-primary-700'
                : 'border-transparent text-warm-500 hover:text-secondary-700'
            )}
          >
            {u.user_name || u.user_email}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-warm-500">Du</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => navigate({ date_from: e.target.value, page: 1 })}
            className="input-field text-sm py-1.5 px-2 w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-warm-500">Au</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={e => navigate({ date_to: e.target.value, page: 1 })}
            className="input-field text-sm py-1.5 px-2 w-36"
          />
        </div>
        <select
          value={filters.entity_type}
          onChange={e => navigate({ entity_type: e.target.value, page: 1 })}
          className="input-field text-sm py-1.5 px-2"
        >
          <option value="">Toutes entites</option>
          {entityTypes.map(t => (
            <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={e => navigate({ action: e.target.value, page: 1 })}
          className="input-field text-sm py-1.5 px-2"
        >
          <option value="">Toutes actions</option>
          <option value="INSERT">Creation</option>
          <option value="UPDATE">Modification</option>
          <option value="DELETE">Suppression</option>
          <option value="LOGIN">Connexion</option>
          <option value="LOGOUT">Deconnexion</option>
        </select>
        {(filters.date_from || filters.date_to || filters.entity_type || filters.action) && (
          <button
            onClick={() => navigate({ date_from: '', date_to: '', entity_type: '', action: '', page: 1 })}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Reinitialiser
          </button>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setShowPurge(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
            Purger (+1 mois)
          </button>
        </div>
      </div>

      {/* Resultat purge */}
      {purgeResult && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-warm-100 text-sm text-secondary-700 flex items-center justify-between">
          <span>{purgeResult}</span>
          <button onClick={() => setPurgeResult(null)} className="text-warm-400 hover:text-secondary-600 text-xs">Fermer</button>
        </div>
      )}

      {/* Modale confirmation purge */}
      {showPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-secondary-800 mb-2">Confirmer la purge</h3>
            <p className="text-sm text-warm-600 mb-4">
              Cette action supprimera tous les logs datant de plus d&apos;un mois.
              Seuls les logs du dernier mois seront conserves. Cette action est irreversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPurge(false)}
                disabled={purging}
                className="px-4 py-2 text-sm font-medium text-secondary-600 hover:bg-warm-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handlePurge}
                disabled={purging}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {purging ? 'Suppression...' : 'Confirmer la purge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="card flex-1 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-warm-200 text-left text-xs text-warm-500 uppercase tracking-wider">
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
                <td colSpan={5} className="py-8 text-center text-warm-400">
                  Aucun log trouve
                </td>
              </tr>
            ) : (
              logs.map(log => {
                const ac = ACTION_CONFIG[log.action]
                const entityLabel = getEntityLabel(log)
                const changedFields = log.action === 'UPDATE'
                  ? getChangedFields(log.old_data, log.new_data)
                  : ''

                return (
                  <tr key={log.id} className="border-b border-warm-100 hover:bg-warm-50 transition-colors">
                    <td className="py-1.5 px-3 text-xs text-secondary-600 whitespace-nowrap">
                      {fmtDate(log.created_at)}
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span className="text-secondary-700 font-medium">{log.user_name || log.user_email || '-'}</span>
                      {log.user_id && userRoles[log.user_id] && (
                        <span className="ml-1.5 text-warm-400 text-[11px]">({ROLE_LABELS[userRoles[log.user_id]] ?? userRoles[log.user_id]})</span>
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
                        <span className="ml-1.5 text-warm-500 text-xs">{entityLabel}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-xs text-warm-500 truncate" title={changedFields}>
                      {log.action === 'UPDATE' && changedFields
                        ? changedFields
                        : log.action === 'INSERT'
                          ? 'Nouvel enregistrement'
                          : log.action === 'DELETE'
                            ? 'Suppression'
                            : ''}
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
        <span className="text-xs text-warm-500">
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
