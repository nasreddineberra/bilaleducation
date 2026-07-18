'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, ToggleLeft, ToggleRight, KeyRound, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { clsx } from 'clsx'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { toggleActive, sendPasswordReset, resetUserTwoFactor } from '@/app/dashboard/utilisateurs/actions'
import type { Profile, UserRole } from '@/types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:             'Super Admin',
  admin:                   'Administrateur',
  direction:               'Direction',
  comptable:               'Comptable',
  responsable_pedagogique: 'Resp. Pédagogique',
  enseignant:              'Enseignant',
  secretaire:              'Secrétaire',
  parent:                  'Parent',
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin:             'bg-violet-100 text-violet-700',
  admin:                   'bg-red-100 text-red-700',
  direction:               'bg-secondary-100 text-secondary-700',
  comptable:               'bg-amber-100 text-amber-700',
  responsable_pedagogique: 'bg-purple-100 text-purple-700',
  enseignant:              'bg-primary-100 text-primary-700',
  secretaire:              'bg-blue-100 text-blue-700',
  parent:                  'bg-warm-100 text-warm-700',
}

interface UtilisateursTableProps {
  profiles: Profile[]
  twoFactorUserIds?: string[]
}

export default function UtilisateursTable({ profiles, twoFactorUserIds = [] }: UtilisateursTableProps) {
  const router = useRouter()
  const twoFactorSet = new Set(twoFactorUserIds)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [resetSentId, setResetSentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reset2faTarget, setReset2faTarget] = useState<Profile | null>(null)
  const [resetting2fa, setResetting2fa] = useState(false)
  // Actions sensibles → confirmation (desactivation = perte d'acces ; reset mdp = envoi d'email)
  const [deactivateTarget, setDeactivateTarget] = useState<Profile | null>(null)
  const [resetPwdTarget, setResetPwdTarget] = useState<Profile | null>(null)

  const handleReset2fa = async () => {
    if (!reset2faTarget) return
    setResetting2fa(true)
    setError(null)
    const result = await resetUserTwoFactor(reset2faTarget.id)
    setResetting2fa(false)
    if (result.error) { setError(result.error); setReset2faTarget(null); return }
    setReset2faTarget(null)
    router.refresh()
  }

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
        <p className="text-warm-700 text-sm">Aucun utilisateur pour le moment</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" aria-live="assertive" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs" aria-label="Utilisateurs">
          <thead>
            <tr className="border-b border-warm-100">
              <th className="list-th w-3/12">Utilisateur</th>
              <th className="list-th w-3/12">Email</th>
              <th className="list-th w-2/12">Rôle</th>
              <th className="list-th w-1/12">Statut</th>
              <th className="list-th w-1/12">2FA</th>
              <th className="list-th w-2/12" />
            </tr>
          </thead>

          <tbody className="divide-y divide-warm-50">
            {profiles.map(profile => {
              const isLoading = loadingId === profile.id
              const resetSent = resetSentId === profile.id
              const fullName = `${profile.last_name} ${profile.first_name}`
              // Comptes structurants : jamais desactivables (garde aussi cote serveur).
              const isCore = profile.role === 'admin' || profile.role === 'super_admin'
              const toggleLabel = isCore
                ? 'Ce compte est structurant : il ne peut pas être désactivé'
                : profile.is_active ? 'Désactiver' : 'Activer'
              const resetLabel = resetSent ? 'Email envoyé' : 'Réinitialiser le mot de passe'

              return (
                <tr
                  key={profile.id}
                  onClick={() => router.push(`/dashboard/utilisateurs/${profile.id}`)}
                  className={clsx(
                    'transition-colors cursor-pointer',
                    profile.is_active ? 'hover:bg-warm-50' : 'bg-warm-50/60 hover:bg-warm-100/60'
                  )}
                >
                  {/* Nom */}
                  <td className="list-td">
                    <Link
                      href={`/dashboard/utilisateurs/${profile.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={clsx(
                        'list-name hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                        profile.is_active ? 'text-secondary-800' : 'text-warm-400'
                      )}
                    >
                      {fullName}
                    </Link>
                  </td>

                  {/* Email */}
                  <td className="list-td">
                    <span className="text-warm-700">{profile.email}</span>
                  </td>

                  {/* Rôle */}
                  <td className="list-td">
                    <span className={clsx(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      ROLE_COLORS[profile.role]
                    )}>
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </td>

                  {/* Statut */}
                  <td className="list-td">
                    <span className={clsx(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      profile.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-warm-200 text-warm-700'
                    )}>
                      {profile.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>

                  {/* 2FA */}
                  <td className="list-td whitespace-nowrap">
                    {profile.role === 'parent' ? (
                      <Tooltip content="La 2FA n'est pas requise pour les parents">
                        <span className="text-warm-700">·</span>
                      </Tooltip>
                    ) : twoFactorSet.has(profile.id) ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <ShieldCheck size={13} className="flex-shrink-0" /> Activée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <ShieldAlert size={13} className="flex-shrink-0" /> Non
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="list-td" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {/* Modifier */}
                      <Tooltip content="Modifier">
                        <button
                          onClick={() => router.push(`/dashboard/utilisateurs/${profile.id}`)}
                          aria-label={`Modifier ${fullName}`}
                          className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                          disabled={isLoading}
                        >
                          <Pencil size={14} />
                        </button>
                      </Tooltip>

                      {/* Activer / Désactiver (comptes structurants non modifiables) */}
                      <Tooltip content={toggleLabel}>
                        <button
                          onClick={() => profile.is_active ? setDeactivateTarget(profile) : handleToggle(profile)}
                          disabled={isLoading || isCore}
                          aria-label={toggleLabel}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
                            isCore
                              ? 'text-warm-200 cursor-not-allowed'
                              : profile.is_active
                                ? 'text-warm-700 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-warm-700 hover:text-green-600 hover:bg-green-50',
                            isLoading && 'opacity-40 cursor-wait'
                          )}
                        >
                          {profile.is_active
                            ? <ToggleRight size={16} />
                            : <ToggleLeft size={16} />
                          }
                        </button>
                      </Tooltip>

                      {/* Réinitialiser mot de passe */}
                      <Tooltip content={resetLabel}>
                        <button
                          onClick={() => setResetPwdTarget(profile)}
                          disabled={isLoading || resetSent}
                          aria-label={resetLabel}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
                            resetSent
                              ? 'text-green-500 bg-green-50 cursor-default'
                              : 'text-warm-700 hover:text-primary-600 hover:bg-primary-50',
                            isLoading && 'opacity-40 cursor-wait'
                          )}
                        >
                          <KeyRound size={14} />
                        </button>
                      </Tooltip>

                      {/* Réinitialiser la 2FA (déblocage admin) — si activée */}
                      {profile.role !== 'parent' && twoFactorSet.has(profile.id) && (
                        <Tooltip content="Réinitialiser la 2FA">
                          <button
                            onClick={() => { setReset2faTarget(profile); setError(null) }}
                            disabled={isLoading}
                            aria-label={`Réinitialiser la 2FA de ${fullName}`}
                            className={clsx(
                              'p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50',
                              'text-warm-700 hover:text-red-600 hover:bg-red-50',
                              isLoading && 'opacity-40 cursor-wait'
                            )}
                          >
                            <ShieldX size={14} />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {deactivateTarget && (
        <ConfirmModal
          variant="warning"
          title="Désactiver ce compte ?"
          message={`${deactivateTarget.last_name} ${deactivateTarget.first_name} ne pourra plus se connecter à l'application. Le compte reste conservé et peut être réactivé à tout moment.`}
          confirmLabel="Désactiver"
          cancelLabel="Annuler"
          onConfirm={() => { const p = deactivateTarget; setDeactivateTarget(null); handleToggle(p) }}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}

      {resetPwdTarget && (
        <ConfirmModal
          variant="warning"
          title="Réinitialiser le mot de passe ?"
          message={`Un email de réinitialisation sera envoyé à ${resetPwdTarget.email}. La personne devra suivre le lien pour définir un nouveau mot de passe.`}
          confirmLabel="Envoyer le lien"
          cancelLabel="Annuler"
          onConfirm={() => { const p = resetPwdTarget; setResetPwdTarget(null); handleResetPassword(p) }}
          onCancel={() => setResetPwdTarget(null)}
        />
      )}

      {reset2faTarget && (
        <ConfirmModal
          title="Réinitialiser la double authentification ?"
          message={`L'authentificateur 2FA de ${reset2faTarget.last_name} ${reset2faTarget.first_name} sera supprimé. La personne devra en configurer un nouveau à sa prochaine connexion.`}
          confirmLabel={resetting2fa ? 'Réinitialisation…' : 'Réinitialiser'}
          confirmColor="red"
          confirmDisabled={resetting2fa}
          onConfirm={handleReset2fa}
          onCancel={() => setReset2faTarget(null)}
        />
      )}
    </div>
  )
}
