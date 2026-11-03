'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Tooltip from '@/components/ui/Tooltip'
import RaisonBloquee from '@/components/ui/RaisonBloquee'
import { Puce, type Ton } from '@/components/dashboard/tdb'
import { useToast } from '@/lib/toast-context'
import { toggleActive } from '@/app/dashboard/utilisateurs/actions'
import { inviterTuteur } from '@/app/dashboard/utilisateurs/famille-actions'
import type { Database } from '@/types/supabase'

/**
 * Utilisateurs > Parents : un compte par tuteur relie (decision 15). Statut,
 * derniere connexion, « Renvoyer l'invitation », « Desactiver » / « Reactiver ».
 * La ligne ouvre la fiche du foyer.
 */
export type CompteParent = Database['public']['Functions']['comptes_parents_ecole']['Returns'][number]

const JOUR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })
const JOUR_HEURE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Statut d'un compte, dans l'ordre ou il se lit. */
export function statutCompte(c: CompteParent, maintenant = Date.now()): { ton: Ton; libelle: string } {
  if (!c.is_active) return { ton: 'neutre', libelle: 'Désactivé' }
  if (c.configure_le) return { ton: 'ok', libelle: 'Accès en ligne' }
  if (c.invitation_expire_le && new Date(c.invitation_expire_le).getTime() > maintenant) {
    return { ton: 'attente', libelle: c.invite_le ? `Invité le ${JOUR.format(new Date(c.invite_le))}` : 'Invité' }
  }
  return { ton: 'orange', libelle: 'Invitation expirée' }
}

// Meme regle que `toggleActive` et la garde des profils en base (decision du 03/11).
const RAISON_DIRECTION = 'Couper ou rouvrir l’accès d’une famille est réservé à la direction.'

export default function ParentsComptesTable({ comptes, peutDesactiver = true }: { comptes: CompteParent[]; peutDesactiver?: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [enCours, setEnCours] = useState<string | null>(null)
  const [aDesactiver, setADesactiver] = useState<CompteParent | null>(null)

  const fiche = (c: CompteParent) => `/dashboard/parents/${c.parent_id}?from=${encodeURIComponent('/dashboard/utilisateurs?tab=parents')}`

  const renvoyer = async (c: CompteParent) => {
    setEnCours(c.profile_id)
    const res = await inviterTuteur(c.parent_id, c.tutor_number === 2 ? 2 : 1)
    setEnCours(null)
    if (res.error) { toast.error(res.error); return }
    toast.success(`Invitation renvoyée à ${res.email}.`)
    router.refresh()
  }

  const basculer = async (c: CompteParent, actif: boolean) => {
    setEnCours(c.profile_id)
    const res = await toggleActive(c.profile_id, actif)
    setEnCours(null)
    setADesactiver(null)
    if (res.error) { toast.error(res.error); return }
    toast.success(actif ? 'Accès réactivé.' : 'Accès désactivé.')
    router.refresh()
  }

  if (comptes.length === 0) {
    return <div className="card text-center text-sm text-warm-700 py-10">Aucun compte parent.</div>
  }

  return (
    <>
      <div className="liste">
        <table className="w-full text-xs">
          <thead>
            <tr className="liste-entete border-b border-[var(--card-border)]">
              <th className="list-th text-left w-3/12">Tuteur</th>
              <th className="list-th text-left w-3/12">Email</th>
              <th className="list-th text-left w-2/12">Statut</th>
              <th className="list-th text-left w-2/12">Dernière connexion</th>
              <th className="list-th w-2/12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-50">
            {comptes.map(c => {
              const statut = statutCompte(c)
              const occupe = enCours === c.profile_id
              return (
                <tr key={c.profile_id} onClick={() => router.push(fiche(c))}
                  className={clsx('cursor-pointer', c.is_active ? 'ligne-active' : 'bg-warm-50')}>
                  <td className="list-td">
                    <Link href={fiche(c)} onClick={e => e.stopPropagation()}
                      className={clsx('list-name hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]',
                        c.is_active ? 'text-secondary-800' : 'text-warm-400')}>
                      {c.last_name} {c.first_name}
                    </Link>
                    <span className="ml-2 text-warm-700">Tuteur {c.tutor_number}</span>
                  </td>
                  <td className="list-td text-warm-700">{c.email}</td>
                  <td className="list-td"><Puce ton={statut.ton}>{statut.libelle}</Puce></td>
                  <td className="list-td text-warm-700 tabular-nums">
                    {c.derniere_connexion ? JOUR_HEURE.format(new Date(c.derniere_connexion)) : '·'}
                  </td>
                  <td className="list-td" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {c.is_active && !c.configure_le && (
                        <FloatButton type="button" variant="secondary" size="mini" disabled={occupe} loading={occupe}
                          onClick={() => renvoyer(c)}>
                          Renvoyer l’invitation
                        </FloatButton>
                      )}
                      {!peutDesactiver ? (
                        <Tooltip content={RAISON_DIRECTION}>
                          <FloatButton type="button" variant={c.is_active ? 'danger' : 'edit'} size="mini" disabled>
                            {c.is_active ? 'Désactiver' : 'Réactiver'}
                          </FloatButton>
                        </Tooltip>
                      ) : c.is_active ? (
                        <FloatButton type="button" variant="danger" size="mini" disabled={occupe}
                          onClick={() => setADesactiver(c)}>
                          Désactiver
                        </FloatButton>
                      ) : (
                        <FloatButton type="button" variant="edit" size="mini" disabled={occupe} loading={occupe}
                          onClick={() => basculer(c, true)}>
                          Réactiver
                        </FloatButton>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <RaisonBloquee raison={peutDesactiver ? null : RAISON_DIRECTION} />

      {aDesactiver && (
        <ConfirmModal
          title={`Désactiver l’accès de ${aDesactiver.last_name} ${aDesactiver.first_name} ?`}
          confirmLabel="Désactiver"
          variant="danger"
          confirmDisabled={enCours === aDesactiver.profile_id}
          onConfirm={() => basculer(aDesactiver, false)}
          onCancel={() => setADesactiver(null)}
        >
          <p className="text-sm text-warm-700">L’espace famille lui est fermé immédiatement. « Réactiver » le lui rouvre.</p>
        </ConfirmModal>
      )}
    </>
  )
}
