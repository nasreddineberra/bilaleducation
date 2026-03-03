'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, ToggleLeft, ToggleRight, KeyRound } from 'lucide-react'
import { clsx } from 'clsx'
import { toggleActive, sendPasswordReset } from '@/app/dashboard/utilisateurs/actions'
import type { Profile, UserRole } from '@/types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  admin:                   'Administrateur',
  direction:               'Direction',
  comptable:               'Comptable',
  responsable_pedagogique: 'Resp. Pédagogique',
  enseignant:              'Enseignant',
  secretaire:              'Secrétaire',
  parent:                  'Parent',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin:                   'bg-red-100 text-red-700',
  direction:               'bg-secondary-100 text-secondary-700',
  comptable:               'bg-amber-100 text-amber-700',
  responsable_pedagogique: 'bg-purple-100 text-purple-700',
  enseignant:              'bg-primary-100 text-primary-700',
  secretaire:              'bg-blue-100 text-blue-700',
  parent:                  'bg-warm-100 text-warm-600',
}

interface UtilisateursTableProps {
  profiles: Profile[]
}

export default function UtilisateursTable({ profiles }: UtilisateursTableProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [resetSentId, setResetSentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async (profile: Profile) => {
    setLoadingId(profile.id)
    setError(null)
    const result = await toggleActive(profile.id, !profile.is_active)
    if (result.error) setError(result.error)
    else router.refresh()
    setLoadingId(null)
  }

  const handleResetPassword = async (profile: Profile) => {
    setLoadingId(profile.id)
    setError(null)
    const result = await sendPasswordReset(profile.email)
    if (result.error) setError(result.error)
    else setResetSentId(profile.id)
    setLoadingId(null)
  }

  if (profiles.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-warm-400 text-sm">Aucun utilisateur pour le moment</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-warm-100">
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-4/12">
                Utilisateur
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-3/12">
                Email
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-2/12">
                Rôle
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider w-1/12">
                Statut
              </th>
              <th className="px-4 py-2 w-2/12" />
            </tr>
          </thead>

          <tbody className="divide-y divide-warm-50">
            {profiles.map(profile => {
              const isLoading = loadingId === profile.id
              const resetSent = resetSentId === profile.id

              return (
                <tr
                  key={profile.id}
                  className={clsx(
                    'transition-colors',
                    profile.is_active ? 'hover:bg-warm-50' : 'bg-warm-50/60 hover:bg-warm-100/60'
                  )}
                >
                  {/* Nom */}
                  <td className="px-4 py-1.5">
                    <span className={clsx(
                      'text-sm font-medium',
                      profile.is_active ? 'text-secondary-800' : 'text-warm-400'
                    )}>
                      {profile.last_name} {profile.first_name}
                    </span>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-1.5">
                    <span className="text-sm text-warm-500 font-mono">{profile.email}</span>
                  </td>

                  {/* Rôle */}
                  <td className="px-4 py-1.5">
                    <span className={clsx(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      ROLE_COLORS[profile.role]
                    )}>
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </td>

                  {/* Statut */}
                  <td className="px-4 py-1.5">
                    <span className={clsx(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      profile.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-warm-200 text-warm-500'
                    )}>
                      {profile.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      {/* Modifier */}
                      <button
                        onClick={() => router.push(`/dashboard/utilisateurs/${profile.id}`)}
                        className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
                        title="Modifier"
                        disabled={isLoading}
                      >
                        <Pencil size={14} />
                      </button>

                      {/* Activer / Désactiver (admin non modifiable) */}
                      <button
                        onClick={() => handleToggle(profile)}
                        disabled={isLoading || profile.role === 'admin'}
                        className={clsx(
                          'p-1.5 rounded-lg transition-colors',
                          profile.role === 'admin'
                            ? 'text-warm-200 cursor-not-allowed'
                            : profile.is_active
                              ? 'text-warm-400 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-warm-400 hover:text-green-600 hover:bg-green-50',
                          isLoading && 'opacity-40 cursor-wait'
                        )}
                        title={profile.role === 'admin' ? 'Le compte administrateur ne peut pas être désactivé' : profile.is_active ? 'Désactiver' : 'Activer'}
                      >
                        {profile.is_active
                          ? <ToggleRight size={16} />
                          : <ToggleLeft size={16} />
                        }
                      </button>

                      {/* Réinitialiser mot de passe */}
                      <button
                        onClick={() => handleResetPassword(profile)}
                        disabled={isLoading || resetSent}
                        className={clsx(
                          'p-1.5 rounded-lg transition-colors',
                          resetSent
                            ? 'text-green-500 bg-green-50 cursor-default'
                            : 'text-warm-400 hover:text-primary-600 hover:bg-primary-50',
                          isLoading && 'opacity-40 cursor-wait'
                        )}
                        title={resetSent ? 'Email envoyé' : 'Réinitialiser le mot de passe'}
                      >
                        <KeyRound size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
