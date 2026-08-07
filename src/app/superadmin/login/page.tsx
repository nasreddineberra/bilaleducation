'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Eye, EyeOff, AlertCircle, Shield } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import { APP_VERSION } from '@/lib/app-version'

/**
 * Connexion de l'ESPACE ÉDITEUR.
 *
 * Volontairement distinct de l'écran des écoles : arriver ici ne doit pas
 * ressembler à arriver chez un client. Mais la distinction passe désormais par
 * les JETONS DE MARQUE et l'orange de la charte, non par une palette inventée
 * — l'écran portait trois teintes (`#0f1923`, `#16232f`, `#e85d04`) qui
 * n'appartenaient à rien et qu'aucune évolution de la marque n'aurait suivies.
 *
 * Les corrections d'ergonomie du 3 août apportées à la connexion des écoles sont
 * reprises telles quelles : focus initial, verrouillage majuscules, bouton actif
 * à vide, œil accessible au clavier.
 */
export default function SuperAdminLoginPage() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock,     setCapsLock]     = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)

  // Un compte d'école qui atterrit ici : le middleware l'a écarté sans le
  // déconnecter. Sans ce mot, il verrait un écran de connexion inexpliqué alors
  // qu'il est déjà authentifié — et se croirait déconnecté de son école.
  const [refus, setRefus] = useState(false)
  useEffect(() => {
    setRefus(new URLSearchParams(window.location.search).get('reason') === 'reserve')
  }, [])

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
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('Email ou mot de passe incorrect.')
      } else if (msg.includes('Too many requests')) {
        setError('Trop de tentatives. Veuillez patienter quelques minutes.')
      } else {
        setError('Identifiants incorrects ou accès non autorisé.')
      }
      setLoading(false)
    }
  }

  const champ =
    'w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/25 outline-none ' +
    'bg-white/[0.06] border border-white/10 transition-colors ' +
    'focus:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400/40'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
    >
      <div className="relative z-10 w-full max-w-sm animate-fade-in">

        {/* Marque — le logo de l'application, comme sur l'écran des écoles : la
            console reste le même produit, vue depuis l'autre côté. */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/icon.png" alt="" width={56} height={56} unoptimized className="mb-3 opacity-95" />
          <h1 className="text-xl font-bold text-white tracking-tight">Bilal Education</h1>
          <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
            <Shield size={11} className="text-orange-400" />
            <span className="text-xs font-bold tracking-widest uppercase text-orange-400">
              Éditeur
            </span>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden bg-black/25 border border-white/10 shadow-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500" />

          <div className="p-8">
            <h2 className="text-base font-bold text-white mb-0.5">Connexion</h2>
            <p className="text-xs mb-6 text-white/40">
              Espace réservé à l&apos;éditeur de l&apos;application
            </p>

            {refus && !error && (
              <div
                role="status"
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm mb-4 bg-white/[0.06] border border-white/15 text-white/70"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>Cet espace est réservé à l&apos;éditeur. Votre session reste ouverte sur le site de votre établissement.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm animate-fade-in bg-orange-500/10 border border-orange-500/30 text-orange-300"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-white/50">
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder="vous@bilaleducation.fr"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  className={champ}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-white/50">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {capsLock && (
                  <p role="status" className="flex items-center gap-1.5 mt-1.5 text-xs text-orange-300">
                    <AlertCircle size={13} className="shrink-0" />
                    Verr. Maj est activé
                  </p>
                )}
              </div>

              {/* Actif même à vide : un bouton grisé n'explique pas ce qui manque. */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors mt-2 bg-orange-500 hover:bg-orange-600 outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Vérification…' : 'Accéder à la console'}
              </button>

            </form>
          </div>
        </div>

        {/* N'affirmer que ce qui est vrai : les actions prises dans une école
            sont tracées à son journal, mais la connexion à cette console ne
            l'est nulle part — le journal est propre à un établissement, et
            celle-ci n'en concerne aucun. Un journal côté éditeur reste à
            construire (bloc 3). */}
        <p className="mt-6 text-center text-xs text-white/25">
          Double authentification requise
          <span className="mx-1.5" aria-hidden="true">·</span>
          © Bilal Education
          <span className="mx-1.5" aria-hidden="true">·</span>
          {APP_VERSION}
        </p>

      </div>
    </div>
  )
}
