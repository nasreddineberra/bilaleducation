'use client'

import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, Lock, Shield } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'

export default function SuperAdminLoginPage() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authRepository.signIn(email, password)
      window.location.href = '/superadmin'
    } catch (err: any) {
      const msg = err.message ?? ''
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('Email ou mot de passe incorrect.')
      } else if (msg.includes('Too many requests')) {
        setError('Trop de tentatives. Veuillez patienter quelques minutes.')
      } else {
        setError('Identifiants incorrects ou accès non autorisé.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: '#0f1923' }}
    >

      {/* ── Grille de points en arrière-plan ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* ── Halo central très subtil ── */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,93,4,0.07) 0%, transparent 70%)',
        }}
      />

      {/* ── Contenu ── */}
      <div className="relative z-10 w-full max-w-sm animate-fade-in">

        {/* Icône cadenas */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1a2a38 0%, #243444 100%)', border: '1px solid rgba(232,93,4,0.3)' }}
          >
            <Lock size={28} style={{ color: '#e85d04' }} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Bilal Education</h1>
          <div
            className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: 'rgba(232,93,4,0.15)', border: '1px solid rgba(232,93,4,0.3)' }}
          >
            <Shield size={11} style={{ color: '#e85d04' }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#e85d04' }}>
              Super Admin
            </span>
          </div>
        </div>

        {/* Carte formulaire */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#16232f',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          {/* Barre de couleur en haut */}
          <div
            className="h-1 w-full"
            style={{ background: 'linear-gradient(90deg, #e85d04 0%, #ff9a3c 50%, #e85d04 100%)' }}
          />

          <div className="p-8">
            <h2 className="text-base font-bold text-white mb-0.5">Connexion administration</h2>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Accès restreint — personnel autorisé uniquement
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Erreur */}
              {error && (
                <div
                  className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm animate-fade-in"
                  style={{ background: 'rgba(232,93,4,0.12)', border: '1px solid rgba(232,93,4,0.3)', color: '#ff9a3c' }}
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@bilaleducation.fr"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(232,93,4,0.6)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              {/* Mot de passe */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-2.5 pr-11 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(232,93,4,0.6)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Bouton */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: loading ? '#b84a03' : 'linear-gradient(135deg, #e85d04 0%, #c74e03 100%)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Vérification…
                  </span>
                ) : 'Accéder au panneau'}
              </button>

            </form>
          </div>
        </div>

        {/* Mention sécurité */}
        <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Accès surveillé et journalisé · Bilal Education Platform
        </p>

      </div>
    </div>
  )
}
