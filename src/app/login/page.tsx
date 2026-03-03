'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authRepository } from '@/lib/database/auth'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authRepository.signIn(email, password)
      // TODO: réactiver la 2FA en fin de projet (décommenter le bloc ci-dessous)
      // const supabase = createClient()
      // const { data: factors } = await supabase.auth.mfa.listFactors()
      // const hasVerifiedPhone = factors?.all?.some(f => f.factor_type === 'phone' && f.status === 'verified')
      // router.push(hasVerifiedPhone ? '/auth/mfa-challenge' : '/auth/enroll-phone')
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion. Vérifiez vos identifiants.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4"
      style={{ background: 'linear-gradient(135deg, #507583 0%, #18aa99 100%)' }}
    >
      {/* Cercles décoratifs en arrière-plan */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-10 bg-white" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full opacity-5 bg-amber-400" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo & titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg mb-4">
            <span className="text-white font-bold text-3xl leading-none">B</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Bilal <span className="text-amber-400">Education</span></h1>
          <p className="text-white/75 mt-1 text-sm">Gestion Administrative & Pédagogique</p>
        </div>

        {/* Carte formulaire */}
        <div
          className="bg-white rounded-3xl p-8 animate-fade-in"
          style={{ boxShadow: '0 24px 64px rgba(17,28,33,0.22), 0 8px 24px rgba(17,28,33,0.12)' }}
        >
          <h2 className="text-xl font-bold text-secondary-800 mb-1">Connexion</h2>
          <p className="text-sm text-warm-500 mb-6">Connectez-vous à votre espace</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-secondary-700 mb-1.5">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-secondary-700 mb-1.5">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-500 focus:ring-primary-400 border-warm-300 rounded"
                />
                <label htmlFor="remember-me" className="text-sm text-warm-600">
                  Se souvenir de moi
                </label>
              </div>
              <a href="#" className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                Mot de passe oublié ?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Connexion…
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        {/* Comptes démo */}
        <div className="mt-6 text-center text-white/70 text-xs space-y-0.5">
          <p className="font-semibold text-white/90 mb-1">Comptes de démonstration :</p>
          <p>Admin : admin@bilaleducation.fr</p>
          <p>Enseignant : teacher@bilaleducation.fr</p>
          <p>Parent : parent@bilaleducation.fr</p>
          <p className="mt-1 text-white/50">Mot de passe : demo123</p>
        </div>
      </div>
    </div>
  )
}
