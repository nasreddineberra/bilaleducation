'use client'

import { useState } from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import MarqueConsole from '@/components/superadmin/MarqueConsole'
import { BOUTON_CONSOLE } from '@/components/superadmin/CoqueConsoleAuth'

/**
 * Connexion de la CONSOLE DE L'EDITEUR (refonte du 22/10, maquette H).
 *
 * Un seul ecran graphite, centre : la marque et les champs, RIEN d'autre. Une
 * personne malveillante qui tombe sur cette adresse ne doit rien apprendre :
 * ni version, ni mention de la 2FA, ni exemple d'adresse, ni message disant
 * qu'il s'agit d'un espace reserve (un compte d'ecole ecarte par le middleware,
 * `?reason=reserve`, voit le meme ecran que tout le monde). Un seul message pour
 * tout echec d'identification, quel qu'en soit le motif.
 *
 * Les corrections d'ergonomie du 3 août sont conservees : focus initial,
 * verrouillage majuscules, bouton actif a vide, œil accessible au clavier.
 */
export default function SuperAdminLoginPage() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock,     setCapsLock]     = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Le bouton reste actif même à vide : c'est ici qu'on dit ce qui manque,
    // plutôt que de laisser l'utilisateur devant un bouton grisé sans raison.
    if (!email.trim() || !password) {
      setError(!email.trim()
        ? 'Veuillez saisir votre adresse email.'
        : 'Veuillez saisir votre mot de passe.')
      return
    }
    setLoading(true)
    try {
      await authRepository.signIn(email, password)
      window.location.href = '/superadmin'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('Too many requests')
        ? 'Trop de tentatives. Veuillez patienter quelques minutes.'
        : 'Identifiants incorrects.')
      setLoading(false)
    }
  }

  const champ =
    'w-full h-11 px-3.5 rounded-xl text-sm text-white outline-none transition-colors ' +
    'bg-[var(--console-champ)] border border-[var(--console-champ-trait)] ' +
    'focus:border-[var(--console-accent)] focus:shadow-[0_0_0_4px_var(--console-halo)]'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--brand-surface)]">
      <div className="w-full max-w-[360px] flex flex-col items-center gap-9 animate-fade-in">

        <MarqueConsole />

        <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>

          {error && (
            <div role="alert" className="flex items-start gap-2 text-sm text-[var(--console-erreur)]">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-semibold text-[var(--console-texte-doux)]">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className={champ}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-[var(--console-texte-doux)]">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                // Cause n°1 des échecs de connexion, et la seule que
                // l'utilisateur ne peut pas voir puisque le champ est masqué.
                onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))}
                onBlur={() => setCapsLock(false)}
                disabled={loading}
                className={`${champ} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--brand-muted)] hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--console-accent)]"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {capsLock && (
              <p role="status" className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--console-alerte)]">
                <AlertCircle size={13} className="shrink-0" />
                Verr. Maj est activé
              </p>
            )}
          </div>

          {/* Actif même à vide : un bouton grisé n'explique pas ce qui manque. */}
          <button
            type="submit"
            disabled={loading}
            className={`${BOUTON_CONSOLE} !mt-6`}
          >
            {loading ? 'Vérification…' : 'Se connecter'}
          </button>

        </form>
      </div>
    </div>
  )
}
