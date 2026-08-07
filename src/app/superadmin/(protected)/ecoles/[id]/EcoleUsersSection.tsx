'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Tooltip from '@/components/ui/Tooltip'
import { clsx } from 'clsx'
import { UserX, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import FormModal from '@/components/ui/FormModal'
import TempPasswordField from '@/components/superadmin/TempPasswordField'
import { createTenantUser, updateTenantUser } from '@/app/superadmin/actions'
import type { Profile, UserRole } from '@/types/database'
import { isPasswordValid } from '@/lib/validation/password'

const ROLE_LABELS: Record<string, string> = {
  direction: 'Direction', comptable: 'Comptable',
  responsable_pedagogique: 'Resp. Pédagogique', enseignant: 'Enseignant',
  secretaire: 'Secrétaire', parent: 'Parent', admin: 'Administrateur',
}

const ROLE_OPTIONS: UserRole[] = ['direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire']

/**
 * Ordre HIÉRARCHIQUE des rôles, repris de la liste des utilisateurs d'une école
 * (`UtilisateursClient`) : les deux listes montrent les mêmes personnes, elles ne
 * peuvent pas les ranger autrement.
 */
const ROLE_ORDER: Record<string, number> = {
  super_admin: 0, admin: 1, direction: 2, comptable: 3,
  responsable_pedagogique: 4, enseignant: 5, secretaire: 6, parent: 7,
}

/** Rôle, puis NOM, puis prénom — insensible à la casse et aux accents. */
function parRolePuisNom(a: Profile, b: Profile): number {
  const r = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
  if (r !== 0) return r
  const n = (a.last_name ?? '').localeCompare(b.last_name ?? '', 'fr', { sensitivity: 'base' })
  if (n !== 0) return n
  return (a.first_name ?? '').localeCompare(b.first_name ?? '', 'fr', { sensitivity: 'base' })
}

const PAR_PAGE = 10
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export default function EcoleUsersSection({ profiles, etablissementId }: { profiles: Profile[]; etablissementId: string }) {
  const [showForm,     setShowForm]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [togglingId,   setTogglingId]   = useState<string | null>(null)
  // Couper l'accès de quelqu'un ne demandait aucune confirmation, alors qu'on en
  // pose une pour l'école entière — la même action, à une personne près.
  const [aDesactiver,  setADesactiver]  = useState<Profile | null>(null)
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [newUser, setNewUser] = useState({ last_name: '', first_name: '', email: '', password: '', role: 'direction' as UserRole })

  const setField = (f: keyof typeof newUser, v: string) => setNewUser(p => ({ ...p, [f]: v }))

  const triees = useMemo(() => [...profiles].sort(parRolePuisNom), [profiles])
  const nbPages = Math.max(1, Math.ceil(triees.length / PAR_PAGE))
  const pageSure = Math.min(page, nbPages)
  const visibles = triees.slice((pageSure - 1) * PAR_PAGE, pageSure * PAR_PAGE)

  const canSubmit = isValidEmail(newUser.email.trim()) &&
    isPasswordValid(newUser.password, newUser.first_name, newUser.last_name) &&
    newUser.last_name.trim().length >= 2 && newUser.first_name.trim().length >= 2

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true); setError(null)
    try {
      const result = await createTenantUser(etablissementId, {
        email: newUser.email.trim(), password: newUser.password,
        role: newUser.role, first_name: newUser.first_name.trim(), last_name: newUser.last_name.trim(),
      })
      if (result.error) { setError(result.error); return }
      setNewUser({ last_name: '', first_name: '', email: '', password: '', role: 'direction' })
      setShowForm(false)
      // La liste vient du serveur : sans rafraîchissement, le compte créé
      // n'apparaît pas et la création semble n'avoir rien fait.
      router.refresh()
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (profile: Profile) => {
    setTogglingId(profile.id)
    setError(null)
    try {
      // La valeur de retour était jetée : depuis le cloisonnement du 7 août,
      // cette action peut refuser (« ce compte n'appartient pas à cet
      // établissement »), et le refus ressemblait exactement à un succès.
      const res = await updateTenantUser(profile.id, etablissementId, { is_active: !profile.is_active })
      if (res?.error) { setError(res.error); return }
      router.refresh()
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="card p-4 space-y-3 self-start">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Utilisateurs</h2>
        <button
          type="button"
          onClick={() => { setError(null); setShowForm(true) }}
          className="btn btn-secondary text-xs py-1 px-2.5"
        >
          Ajouter
        </button>
      </div>

      {showForm && (
        <FormModal
          title="Nouveau compte"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary text-sm ml-auto">
                Annuler
              </button>
              <button
                type="submit"
                form="form-nouveau-compte"
                disabled={submitting || !canSubmit}
                className={clsx('btn btn-primary text-sm', (!canSubmit || submitting) && 'opacity-50 cursor-not-allowed')}
              >
                {submitting ? 'Création…' : 'Créer'}
              </button>
            </>
          }
        >
          {/* Le formulaire est DANS la modale, mais ses boutons vivent dans le
              pied : l'attribut `form` les relie, sans quoi « Créer » ne
              soumettrait rien. */}
          <form id="form-nouveau-compte" onSubmit={handleCreate} noValidate className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="NOM" aria-label="Nom" value={newUser.last_name} onChange={e => setField('last_name', e.target.value.toUpperCase())} className="input text-sm py-1.5" />
              <input type="text" placeholder="Prénom" aria-label="Prénom" value={newUser.first_name} onChange={e => setField('first_name', e.target.value)} className="input text-sm py-1.5" />
            </div>

            <input type="email" placeholder="Email" aria-label="Adresse email" value={newUser.email} onChange={e => setField('email', e.target.value)} className="input text-sm py-1.5 w-full" />

            <select value={newUser.role} onChange={e => setField('role', e.target.value)} aria-label="Rôle" className="input text-sm py-1.5 w-full">
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>

            <div>
              <label className="text-xs font-semibold text-warm-700 uppercase tracking-wide">Mot de passe temporaire</label>
              <div className="mt-1">
                <TempPasswordField value={newUser.password} onChange={v => setField('password', v)} compact />
              </div>
            </div>

            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          </form>
        </FormModal>
      )}

      {error && !showForm && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{error}</p>
      )}

      {profiles.length === 0 ? (
        <p className="text-sm text-warm-700 text-center py-4">Aucun utilisateur</p>
      ) : (
        <div className="space-y-1">
          {visibles.map(p => (
            <div key={p.id} className={clsx('flex items-center justify-between px-3 py-2 rounded-xl', p.is_active ? 'bg-warm-50' : 'bg-warm-100 opacity-60')}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-secondary-800 leading-tight">{p.last_name} {p.first_name}</p>
                <p className="text-xs text-warm-700 leading-tight mt-0.5">{p.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs text-warm-700 bg-white px-2 py-0.5 rounded-full border border-warm-200">{ROLE_LABELS[p.role] ?? p.role}</span>
                <Tooltip content={p.is_active ? 'Désactiver ce compte' : 'Réactiver ce compte'}>
                  <button
                    type="button"
                    onClick={() => (p.is_active ? setADesactiver(p) : handleToggle(p))}
                    disabled={togglingId === p.id}
                    aria-label={`${p.is_active ? 'Désactiver' : 'Réactiver'} le compte de ${p.last_name} ${p.first_name}`}
                    className={clsx('p-1 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50', p.is_active ? 'text-warm-700 hover:text-red-500 hover:bg-red-50' : 'text-primary-600 hover:bg-primary-50', togglingId === p.id && 'opacity-40 cursor-not-allowed')}
                  >
                    {p.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {nbPages > 1 && (
        <nav className="flex items-center justify-between pt-1" aria-label="Pagination des utilisateurs">
          <p className="text-xs text-warm-700">
            {(pageSure - 1) * PAR_PAGE + 1}<span aria-hidden="true">-</span>{Math.min(pageSure * PAR_PAGE, triees.length)} sur {triees.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={pageSure === 1}
              aria-label="Page précédente"
              className="p-1 rounded-lg text-warm-700 hover:bg-warm-100 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs text-warm-700 tabular-nums px-1">{pageSure} / {nbPages}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(nbPages, p + 1))}
              disabled={pageSure === nbPages}
              aria-label="Page suivante"
              className="p-1 rounded-lg text-warm-700 hover:bg-warm-100 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </nav>
      )}

      {aDesactiver && (
        <ConfirmModal
          title="Désactiver ce compte ?"
          message={`${aDesactiver.last_name} ${aDesactiver.first_name} ne pourra plus se connecter. Le compte et ses données sont conservés, l'accès se rétablit d'un clic.`}
          confirmLabel="Désactiver"
          variant="danger"
          onConfirm={() => { const p = aDesactiver; setADesactiver(null); handleToggle(p) }}
          onCancel={() => setADesactiver(null)}
        />
      )}
    </div>
  )
}
