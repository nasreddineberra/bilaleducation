'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { FloatInput, FloatButton } from '@/components/ui/FloatFields'
import { createClient } from '@/lib/supabase/client'

// ─── Illustration (même que login) ─────────────────────────────────────────

function IllustrationB() {
  return (
    <svg viewBox="0 0 280 220" className="w-full max-w-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="140" cy="130" rx="90" ry="55" fill="white" fillOpacity="0.06" />
      <path d="M60 90 Q60 80 70 78 L128 72 L128 158 L70 164 Q60 166 60 156 Z"
        fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
      <path d="M220 90 Q220 80 210 78 L152 72 L152 158 L210 164 Q220 166 220 156 Z"
        fill="white" fillOpacity="0.22" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
      <path d="M128 72 Q140 68 152 72 L152 158 Q140 162 128 158 Z"
        fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
      {[96,104,112,120,128,136,144].map((y, i) => (
        <line key={i} x1="78" y1={y} x2={i % 2 === 0 ? 120 : 115} y2={y - 2}
          stroke="white" strokeOpacity={i % 2 === 0 ? 0.35 : 0.25} strokeWidth="1.5" strokeLinecap="round" />
      ))}
      {[96,104,112,120,128,136,144].map((y, i) => (
        <line key={i} x1="160" y1={y} x2={i % 2 === 0 ? 202 : 196} y2={y - 2}
          stroke="white" strokeOpacity={i % 2 === 0 ? 0.35 : 0.25} strokeWidth="1.5" strokeLinecap="round" />
      ))}
      <path d="M148 68 L148 48 L154 52 L154 68 Z" fill="#ffa200" fillOpacity="0.9" />
      <ellipse cx="140" cy="168" rx="62" ry="7" fill="black" fillOpacity="0.12" />
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
        <path d="M0 -6 L1.4 -1.9 L5.7 -1.9 L2.3 0.7 L3.7 4.9 L0 2.4 L-3.7 4.9 L-2.3 0.7 L-5.7 -1.9 L-1.4 -1.9 Z" fill="white" fillOpacity="0.7" />
      </g>
      <circle cx="58" cy="65" r="4" fill="white" fillOpacity="0.15" />
      <circle cx="222" cy="70" r="3" fill="white" fillOpacity="0.15" />
      <circle cx="48" cy="140" r="5" fill="white" fillOpacity="0.1" />
      <circle cx="240" cy="148" r="4" fill="white" fillOpacity="0.12" />
      <circle cx="200" cy="32" r="3" fill="#ffa200" fillOpacity="0.3" />
      <circle cx="80" cy="30" r="2.5" fill="white" fillOpacity="0.3" />
      <g transform="translate(205,170)">
        <path d="M0 -8 L18 -2 L0 4 L-18 -2 Z" fill="white" fillOpacity="0.25" />
        <path d="M-10 -1 L-10 8 Q-5 12 0 12 Q5 12 10 8 L10 -1" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" fill="none" />
        <line x1="18" y1="-2" x2="18" y2="6" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
        <circle cx="18" cy="7" r="1.5" fill="white" fillOpacity="0.4" />
      </g>
      <g transform="translate(52,185) rotate(-35)">
        <rect x="-3" y="-14" width="6" height="22" rx="1" fill="white" fillOpacity="0.25" />
        <path d="M-3 8 L3 8 L0 14 Z" fill="#ffa200" fillOpacity="0.5" />
        <rect x="-3" y="-14" width="6" height="4" rx="1" fill="white" fillOpacity="0.4" />
      </g>
    </svg>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [nomEtab, setNomEtab] = useState('Bilal Education')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/public/etablissement')
      .then(r => r.json())
      .then(d => {
        if (d.nom) setNomEtab(d.nom)
        if (d.logo_url) setLogoUrl(d.logo_url)
      })
      .catch((err) => console.error('[ForgotPassword] Échec chargement infos:', err))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      })

      if (resetError) {
        // Ne pas révéler si l'email existe ou non (sécurité)
        setSuccess(true)
        return
      }

      setSuccess(true)
    } catch {
      // Ne jamais révéler si l'email existe ou non
      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

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
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white opacity-[0.04]" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white opacity-[0.04]" />
          <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-amber-400 opacity-[0.05]" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-10 max-w-md">
          <div className="w-full animate-fade-in">
            <IllustrationB />
          </div>

          <div className="text-center space-y-3">
            <p className="text-white text-xl font-semibold leading-snug">
              L'éducation est la lumière<br />qui guide chaque pas
            </p>
            <p className="text-white/60 text-sm">
              Plateforme de gestion administrative et pédagogique
            </p>
          </div>

          <div className="flex gap-2">
            <span className="w-2 h-1.5 rounded-full bg-white opacity-30" />
            <span className="w-6 h-1.5 rounded-full bg-amber-400 opacity-90" />
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

            {/* ── Succès ──────────────────────────────────────────────────── */}
            {success ? (
              <div className="text-center space-y-5 animate-fade-in">
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle size={32} className="text-green-500" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-secondary-800 mb-2">Email envoyé</h2>
                  <p className="text-sm text-warm-500 leading-relaxed">
                    Si un compte est associé à <span className="font-semibold text-secondary-700">{email}</span>,
                    vous recevrez un lien de réinitialisation par email.
                  </p>
                </div>
                <FloatButton
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => router.push('/login')}
                >
                  Retour à la connexion
                </FloatButton>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-secondary-800 mb-1">Mot de passe oublié ?</h2>
                <p className="text-sm text-warm-400 mb-6">
                  Entrez votre email pour recevoir un lien de réinitialisation.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                  {/* Erreur */}
                  {error && (
                    <div className="flex items-start gap-2.5 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Email */}
                  <FloatInput
                    label="Adresse email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={loading}
                  />

                  {/* Bouton */}
                  <FloatButton
                    variant="submit"
                    className="w-full justify-center"
                    disabled={loading || !email}
                    loading={loading}
                  >
                    Envoyer le lien
                  </FloatButton>

                </form>
              </>
            )}

            {/* Retour au login */}
            <div className="mt-5 pt-4 border-t border-warm-100 text-center">
              <button
                onClick={() => router.push('/login')}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
              >
                <ArrowLeft size={13} />
                Retour à la connexion
              </button>
            </div>

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
