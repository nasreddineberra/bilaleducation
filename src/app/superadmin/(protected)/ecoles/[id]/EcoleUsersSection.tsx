'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Eye, EyeOff, Plus, UserX, UserCheck } from 'lucide-react'
import { createTenantUser, updateTenantUser } from '@/app/superadmin/actions'
import type { Profile, UserRole } from '@/types/database'
import { isPasswordValid } from '@/lib/validation/password'

const ROLE_LABELS: Record<string, string> = {
  direction: 'Direction', comptable: 'Comptable',
  responsable_pedagogique: 'Resp. Pédagogique', enseignant: 'Enseignant',
  secretaire: 'Secrétaire', parent: 'Parent', admin: 'Administrateur',
}

const ROLE_OPTIONS: UserRole[] = ['direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire', 'parent']
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export default function EcoleUsersSection({ profiles, etablissementId }: { profiles: Profile[]; etablissementId: string }) {
  const [showForm,     setShowForm]     = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [togglingId,   setTogglingId]   = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ last_name: '', first_name: '', email: '', password: '', role: 'direction' as UserRole })

  const setField = (f: keyof typeof newUser, v: string) => setNewUser(p => ({ ...p, [f]: v }))

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
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (profile: Profile) => {
    setTogglingId(profile.id)
    await updateTenantUser(profile.id, etablissementId, { is_active: !profile.is_active })
    setTogglingId(null)
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Utilisateurs</h2>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} noValidate className="border border-warm-200 rounded-xl p-3 space-y-2 bg-warm-50">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="NOM" value={newUser.last_name} onChange={e => setField('last_name', e.target.value.toUpperCase())} className="input text-sm py-1.5" />
            <input type="text" placeholder="Prénom" value={newUser.first_name} onChange={e => setField('first_name', e.target.value)} className="input text-sm py-1.5" />
          </div>
          <input type="email" placeholder="Email" value={newUser.email} onChange={e => setField('email', e.target.value)} className="input text-sm py-1.5 w-full" />
          <div className="grid grid-cols-2 gap-2">
            <select value={newUser.role} onChange={e => setField('role', e.target.value)} className="input text-sm py-1.5">
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} placeholder="Mot de passe (10+ car.)" value={newUser.password} onChange={e => setField('password', e.target.value)} className="input text-sm py-1.5 pr-8 w-full" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-warm-400">
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary text-xs py-1.5 px-3">Annuler</button>
            <button type="submit" disabled={submitting || !canSubmit} className={clsx('btn btn-primary text-xs py-1.5 px-3', (!canSubmit || submitting) && 'opacity-50 cursor-not-allowed')}>
              {submitting ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      {profiles.length === 0 ? (
        <p className="text-sm text-warm-400 text-center py-4">Aucun utilisateur</p>
      ) : (
        <div className="space-y-1">
          {profiles.map(p => (
            <div key={p.id} className={clsx('flex items-center justify-between px-3 py-2 rounded-xl', p.is_active ? 'bg-warm-50' : 'bg-warm-100 opacity-60')}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-secondary-800 leading-tight">{p.last_name} {p.first_name}</p>
                <p className="text-xs text-warm-400 leading-tight mt-0.5">{p.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs text-warm-500 bg-white px-2 py-0.5 rounded-full border border-warm-200">{ROLE_LABELS[p.role] ?? p.role}</span>
                <button onClick={() => handleToggle(p)} disabled={togglingId === p.id} title={p.is_active ? 'Désactiver' : 'Activer'}
                  className={clsx('p-1 rounded-lg transition-colors', p.is_active ? 'text-warm-400 hover:text-danger-500 hover:bg-danger-50' : 'text-green-500 hover:bg-green-50', togglingId === p.id && 'opacity-40 cursor-not-allowed')}>
                  {p.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
