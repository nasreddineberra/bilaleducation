'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { authRepository } from '@/lib/database/auth'

// ─── Illustration B : Livre ouvert + étoiles ─────────────────────────────────

function IllustrationB() {
  return (
    <svg viewBox="0 0 280 220" className="w-full max-w-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="140" cy="130" rx="90" ry="55" fill="white" fillOpacity="0.06" />

      {/* Livre ouvert */}
      <path d="M60 90 Q60 80 70 78 L128 72 L128 158 L70 164 Q60 166 60 156 Z"
        fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
      <path d="M220 90 Q220 80 210 78 L152 72 L152 158 L210 164 Q220 166 220 156 Z"
        fill="white" fillOpacity="0.22" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
      <path d="M128 72 Q140 68 152 72 L152 158 Q140 162 128 158 Z"
        fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.5" strokeWidth="1" />

      {/* Lignes page gauche */}
      {[96,104,112,120,128,136,144].map((y, i) => (
        <line key={i} x1="78" y1={y} x2={i % 2 === 0 ? 120 : 115} y2={y - 2}
          stroke="white" strokeOpacity={i % 2 === 0 ? 0.35 : 0.25} strokeWidth="1.5" strokeLinecap="round" />
      ))}
      {/* Lignes page droite */}
      {[96,104,112,120,128,136,144].map((y, i) => (
        <line key={i} x1="160" y1={y} x2={i % 2 === 0 ? 202 : 196} y2={y - 2}
          stroke="white" strokeOpacity={i % 2 === 0 ? 0.35 : 0.25} strokeWidth="1.5" strokeLinecap="round" />
      ))}

      {/* Marque-page ambre */}
      <path d="M148 68 L148 48 L154 52 L154 68 Z" fill="#ffa200" fillOpacity="0.9" />

      {/* Ombre */}
      <ellipse cx="140" cy="168" rx="62" ry="7" fill="black" fillOpacity="0.12" />

      {/* Étoiles */}
      <g transform="translate(42,42)">
        <path d="M0 -10 L2.4 -3.1 L9.5 -3.1 L3.8 1.2 L6.2 8.1 L0 4 L-6.2 8.1 L-3.8 1.2 L-9.5 -3.1 L-2.4 -3.1 Z" fill="#ffa200" fillOpacity="0.9" />
      </g>
      <g transform="translate(235,38)">
        <path d="M0 -7 L1.7 -2.2 L6.7 -2.2 L2.7 0.8 L4.3 5.7 L0 2.8 L-4.3 5.7 L-2.7 0.8 L-6.7 -2.2 L-1.7 -2.2 Z" fill="white" fillOpacity="0.8" />
      </g>
      <g transform="translate(248,105)">
        <path d="M0 -6 L1.4 -1.9 L5.7 -1.9 L2.3 0.7 L3.7 4.9 L0 2.4 L-3.7 4.9 L-2.3 0.7 L-5.7 -1.9 L-1.4 -1.9 Z" fill="#ffa200" fillOpacity="0.7" />
      </g>
      <g transform="translate(34,160)">
        <path d="M0 -5 L1.2 -1.5 L4.7 -1.5 L1.9 0.6 L3 4 L0 2 L-3 4 L-1.9 0.6 L-4.7 -1.5 L-1.2 -1.5 Z" fill="white" fillOpacity="0.6" />
      </g>
      <g transform="translate(140,28)">
        <path d="M0 -5 L1.2 -1.5 L4.7 -1.5 L1.9 0.6 L3 4 L0 2 L-3 4 L-1.9 0.6 L-4.7 -1.5 L-1.2 -1.5 Z" fill="#ffa200" fillOpacity="0.6" />
      </g>
      <g transform="translate(28,100)">
        <path d="M0 -4 L1 -1.2 L3.8 -1.2 L1.5 0.5 L2.4 3.2 L0 1.6 L-2.4 3.2 L-1.5 0.5 L-3.8 -1.2 L-1 -1.2 Z" fill="white" fillOpacity="0.5" />
      </g>

      {/* Particules */}
      <circle cx="58" cy="65" r="4" fill="white" fillOpacity="0.15" />
      <circle cx="222" cy="70" r="3" fill="white" fillOpacity="0.15" />
      <circle cx="48" cy="140" r="5" fill="white" fillOpacity="0.1" />
      <circle cx="240" cy="148" r="4" fill="white" fillOpacity="0.12" />
      <circle cx="200" cy="32" r="3" fill="#ffa200" fillOpacity="0.3" />
      <circle cx="80" cy="30" r="2.5" fill="white" fillOpacity="0.3" />

      {/* Chapeau diplôme */}
      <g transform="translate(205,170)">
        <path d="M0 -8 L18 -2 L0 4 L-18 -2 Z" fill="white" fillOpacity="0.25" />
        <path d="M-10 -1 L-10 8 Q-5 12 0 12 Q5 12 10 8 L10 -1" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" fill="none" />
        <line x1="18" y1="-2" x2="18" y2="6" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
        <circle cx="18" cy="7" r="1.5" fill="white" fillOpacity="0.4" />
      </g>

      {/* Crayon */}
      <g transform="translate(52,185) rotate(-35)">
        <rect x="-3" y="-14" width="6" height="22" rx="1" fill="white" fillOpacity="0.25" />
        <path d="M-3 8 L3 8 L0 14 Z" fill="#ffa200" fillOpacity="0.5" />
        <rect x="-3" y="-14" width="6" height="4" rx="1" fill="white" fillOpacity="0.4" />
      </g>
    </svg>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function LoginPage() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [nomEtab,      setNomEtab]      = useState('Bilal Education')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)

  // Charger le nom et logo de l'établissement
  useEffect(() => {
    fetch('/api/public/etablissement')
      .then(r => r.json())
      .then(d => {
        if (d.nom)      setNomEtab(d.nom)
        if (d.logo_url) setLogoUrl(d.logo_url)
      })
      .catch((err) => console.error('[Login] Échec chargement infos établissement:', err))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authRepository.signIn(email, password)
      const now = Math.floor(Date.now() / 1000)
      const secure = process.env.NODE_ENV === 'production' ? ';secure' : ''
      document.cookie = `app-session=${JSON.stringify({ loginTime: now, lastActivity: now })};path=/;max-age=${24 * 3600};samesite=lax${secure}`
      window.location.href = '/dashboard'
    } catch (err: any) {
      const msg = err.message ?? ''
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('Email ou mot de passe incorrect.')
      } else if (msg.includes('Email not confirmed')) {
        setError('Votre adresse email n\'est pas confirmée.')
      } else if (msg.includes('Too many requests')) {
        setError('Trop de tentatives. Veuillez patienter quelques minutes.')
      } else if (msg.includes('User not found')) {
        setError('Aucun compte associé à cet email.')
      } else {
        setError('Erreur de connexion. Vérifiez vos identifiants.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Initiales de l'établissement pour le fallback logo
  const initiales = nomEtab
    .split(' ')
    .filter(w => w.length > 1)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return (
    <div className="min-h-screen flex" style={{ background: '#f0f5f7' }}>

      {/* ── Panneau gauche : illustration ───────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #507583 0%, #18aa99 100%)' }}
      >
        {/* Motif de fond subtil */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white opacity-[0.04]" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white opacity-[0.04]" />
          <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-amber-400 opacity-[0.05]" />
        </div>

        {/* Contenu centré */}
        <div className="relative z-10 flex flex-col items-center gap-10 max-w-md">

          {/* Illustration */}
          <div className="w-full animate-fade-in">
            <IllustrationB />
          </div>

          {/* Citation */}
          <div className="text-center space-y-3">
            <p className="text-white text-xl font-semibold leading-snug">
              L'éducation est la lumière<br />qui guide chaque pas
            </p>
            <p className="text-white/60 text-sm">
              Plateforme de gestion administrative et pédagogique
            </p>
          </div>

          {/* Points de pagination décoratifs */}
          <div className="flex gap-2">
            <span className="w-6 h-1.5 rounded-full bg-amber-400 opacity-90" />
            <span className="w-2 h-1.5 rounded-full bg-white opacity-30" />
            <span className="w-2 h-1.5 rounded-full bg-white opacity-30" />
          </div>
        </div>
      </div>

      {/* ── Panneau droit : formulaire ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:px-12">

        <div className="w-full max-w-sm animate-fade-in">

          {/* Logo + nom établissement */}
          <div className="flex flex-col items-center mb-10">
            <div className="mb-4">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={nomEtab}
                  width={128}
                  height={128}
                  className="h-32 w-auto object-contain"
                  unoptimized
                />
              ) : (
                <div
                  className="w-32 h-32 rounded-2xl flex items-center justify-center text-white font-bold text-4xl shadow-lg select-none"
                  style={{ background: 'linear-gradient(135deg, #507583 0%, #18aa99 100%)' }}
                >
                  {initiales || 'BE'}
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold text-secondary-800">{nomEtab}</h1>
            <p className="text-sm text-warm-400 mt-0.5">Espace de gestion</p>
          </div>

          {/* Carte formulaire */}
          <div className="bg-white rounded-2xl p-8 shadow-card border border-warm-100">

            <h2 className="text-lg font-bold text-secondary-800 mb-1">Connexion</h2>
            <p className="text-sm text-warm-400 mb-6">Connectez-vous à votre compte</p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Erreur */}
              {error && (
                <div className="flex items-start gap-2.5 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold text-secondary-700 uppercase tracking-wide">
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Mot de passe */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-secondary-700 uppercase tracking-wide">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="input pr-11"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-secondary-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Mémoriser / Mot de passe oublié */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-warm-300 text-primary-500 focus:ring-primary-400 accent-primary-500"
                  />
                  <span className="text-sm text-warm-500">Se souvenir de moi</span>
                </label>
                <a href="#" className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                  Mot de passe oublié ?
                </a>
              </div>

              {/* Bouton */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full btn btn-primary py-3 text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connexion en cours…
                  </span>
                ) : 'Se connecter'}
              </button>

            </form>
          </div>

          {/* Version mobile : texte discret */}
          <p className="mt-8 text-center text-xs text-warm-400">
            Bilal Education · Gestion Administrative & Pédagogique
          </p>
        </div>
      </div>

    </div>
  )
}
