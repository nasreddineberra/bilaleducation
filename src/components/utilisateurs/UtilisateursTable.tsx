'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react'
import { clsx } from 'clsx'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { deleteUser, getUserDeleteDeps, toggleActive } from '@/app/dashboard/utilisateurs/actions'
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

type DeleteDeps = { finance: number; scolarite: number; presence: number; rattachement: number }

// Roles dont le compte NE se supprime PAS depuis cet ecran :
//  - admin / super_admin : comptes structurants ;
//  - enseignant : passe par la liste des enseignants (fiche metier + Storage) ;
//  - parent : passe par la fiche parents.
const UNDELETABLE_ROLES: UserRole[] = ['admin', 'super_admin', 'enseignant', 'parent']

export default function UtilisateursTable({ profiles, twoFactorUserIds = [] }: UtilisateursTableProps) {
  const router = useRouter()
  const twoFactorSet = new Set(twoFactorUserIds)

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deps,         setDeps]         = useState<DeleteDeps | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)
  // Etape 1 = recapitulatif ; etape 2 = saisie du nom (suppression definitive).
  const [deleteStep,   setDeleteStep]   = useState<1 | 2>(1)
  const [nameInput,    setNameInput]    = useState('')

  // Les dependances sont comptees AVANT d'ouvrir la modale : elle annonce alors
  // ce qui bloque, au lieu d'echouer apres coup sur une erreur de cle etrangere.
  const startDelete = async (profile: Profile) => {
    setDeleteError(null)
    setDeps(await getUserDeleteDeps(profile.id))
    setDeleteStep(1)
    setNameInput('')
    setDeleteTarget(profile)
  }

  const closeModal = () => {
    setDeleteTarget(null); setDeps(null); setDeleteStep(1); setNameInput('')
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsProcessing(true)
    const { error } = await deleteUser(deleteTarget.id)
    setIsProcessing(false)
    if (error) { setDeleteError(error); closeModal(); return }
    closeModal()
    router.refresh()
  }

  const confirmDeactivate = async () => {
    if (!deleteTarget) return
    setIsProcessing(true)
    const { error } = await toggleActive(deleteTarget.id, false)
    setIsProcessing(false)
    if (error) { setDeleteError(error); closeModal(); return }
    closeModal()
    router.refresh()
  }

  const blocking = deps ? deps.finance + deps.scolarite + deps.presence + deps.rattachement : 0
  const hasBlocking = blocking > 0

  if (profiles.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-warm-700 text-sm">Aucun utilisateur pour le moment</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {deleteError && (
        <div role="alert" aria-live="assertive" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {deleteError}
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
              const fullName = `${profile.last_name} ${profile.first_name}`

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
                        ? 'bg-primary-100 text-primary-700'
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
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700">
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
                        >
                          <Pencil size={14} />
                        </button>
                      </Tooltip>

                      {/* Supprimer — masque pour les roles geres ailleurs */}
                      {!UNDELETABLE_ROLES.includes(profile.role) && (
                        <Tooltip content="Supprimer">
                          <button
                            onClick={() => startDelete(profile)}
                            aria-label={`Supprimer ${fullName}`}
                            className="p-1.5 text-warm-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                          >
                            <Trash2 size={14} />
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

      {/* Etape 1 : recapitulatif (ou desactivation si des donnees bloquent) */}
      {deleteTarget && deps && deleteStep === 1 && (
        <ConfirmModal
          title={hasBlocking
            ? 'Suppression impossible'
            : `Supprimer « ${deleteTarget.last_name} ${deleteTarget.first_name} » ?`}
          confirmLabel={hasBlocking
            ? (isProcessing ? '…' : 'Rendre inactif')
            : 'Continuer'}
          confirmColor={hasBlocking ? 'amber' : 'red'}
          confirmDisabled={isProcessing}
          onConfirm={hasBlocking ? confirmDeactivate : () => setDeleteStep(2)}
          onCancel={closeModal}
        >
          {hasBlocking ? (
            <div className="space-y-3">
              <p className="text-sm text-secondary-700">
                <strong>{deleteTarget.last_name} {deleteTarget.first_name}</strong> ne peut pas être
                supprimé : des données lui sont rattachées.
              </p>
              <ul className="text-sm text-secondary-700 space-y-1 ml-4 list-disc">
                {deps.finance > 0 && (
                  <li><strong>{deps.finance}</strong> écriture{deps.finance > 1 ? 's' : ''} financière{deps.finance > 1 ? 's' : ''}</li>
                )}
                {deps.scolarite > 0 && (
                  <li><strong>{deps.scolarite}</strong> élément{deps.scolarite > 1 ? 's' : ''} de scolarité (appel, bulletins)</li>
                )}
                {deps.presence > 0 && (
                  <li><strong>{deps.presence}</strong> saisie{deps.presence > 1 ? 's' : ''} de temps de présence</li>
                )}
                {deps.rattachement > 0 && (
                  <li>compte rattaché à une <strong>fiche parents</strong></li>
                )}
              </ul>
              <p className="text-xs text-warm-700">
                Vous pouvez le <strong>rendre inactif</strong> : l&apos;historique est conservé et la
                personne ne peut plus se connecter.
              </p>
            </div>
          ) : (
            <p className="text-sm text-secondary-700">
              Aucune donnée n&apos;est rattachée à ce compte. Le <strong>compte de connexion et le
              profil</strong> seront supprimés définitivement. Cette action est irréversible.
            </p>
          )}
        </ConfirmModal>
      )}

      {/* Etape 2 : confirmation finale par saisie du nom */}
      {deleteTarget && deleteStep === 2 && (
        <ConfirmModal
          title="Confirmation finale"
          confirmLabel={isProcessing ? 'Suppression…' : 'Supprimer définitivement'}
          confirmColor="red"
          confirmDisabled={
            isProcessing ||
            nameInput.trim().toLowerCase() !== deleteTarget.last_name.trim().toLowerCase()
          }
          onConfirm={confirmDelete}
          onCancel={closeModal}
        >
          <div className="space-y-3">
            <p className="text-sm text-secondary-700">
              Saisissez le nom <strong>{deleteTarget.last_name}</strong> pour confirmer la
              suppression définitive de ce compte :
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder={deleteTarget.last_name}
              aria-label={`Saisir le nom ${deleteTarget.last_name} pour confirmer`}
              className="w-full px-3 py-2 text-sm border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
              autoFocus
            />
          </div>
        </ConfirmModal>
      )}

    </div>
  )
}
