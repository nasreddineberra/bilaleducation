'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function TotpChallengePage() {
  const router = useRouter()

  const [otp,          setOtp]          = useState('')
  const [factorId,     setFactorId]     = useState<string | null>(null)
  const [challengeId,  setChallengeId]  = useState<string | null>(null)
  const [isReady,      setIsReady]      = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Au chargement : trouver le facteur TOTP
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()

      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.all?.find(
        f => f.factor_type === 'totp' && f.status === 'verified'
      )

      if (!totpFactor) {
        // Pas de facteur TOTP → enrollment
        router.replace('/auth/enroll-totp')
        return
      }

      setFactorId(totpFactor.id)
      setIsReady(true)
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || otp.length !== 6) return

    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      // 1. Créer un challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })
      if (challengeError) throw challengeError

      // 2. Vérifier le code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: otp,
      })
      if (verifyError) throw verifyError

      setChallengeId(challengeData.id)
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? ''
      setError(msg || 'Code incorrect. Vérifiez que votre application est synchronisée.')
      setOtp('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4"
      style={{ background: 'linear-gradient(135deg, #507583 0%, #18aa99 100%)' }}
    >
      {/* Cercles décoratifs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-10 bg-white" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full opacity-5 bg-amber-400" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg mb-4">
            <span className="text-white font-bold text-3xl leading-none">B</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Bilal <span className="text-amber-400">Education</span>
          </h1>
          <p className="text-white/75 mt-1 text-sm">Gestion Administrative &amp; Pédagogique</p>
        </div>

        {/* Carte */}
        <div
          className="bg-white rounded-3xl p-8 animate-fade-in"
          style={{ boxShadow: '0 24px 64px rgba(17,28,33,0.22), 0 8px 24px rgba(17,28,33,0.12)' }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-secondary-800 leading-tight">Vérification en deux étapes</h2>
              <p className="text-xs text-warm-500 mt-0.5">
                Saisissez le code de votre application d'authentification.
              </p>
            </div>
          </div>

          {!isReady ? (
            <div className="text-center py-8">
              <svg className="w-8 h-8 animate-spin text-primary-500 mx-auto" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-warm-400 mt-3">Chargement…</p>
            </div>
          ) : (
            <form onSubmit={handleVerify} noValidate className="space-y-4">
              {error && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-secondary-700 mb-1.5">
                  Code à 6 chiffres
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setOtp(v)
                  }}
                  className="input text-center text-xl tracking-widest font-mono"
                  placeholder="• • • • • •"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="w-full btn btn-primary py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Vérification…
                  </span>
                ) : 'Valider'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
