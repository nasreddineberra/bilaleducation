'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

export default function MfaChallengePage() {
  const router = useRouter()

  const [otp,          setOtp]          = useState('')
  const [factorId,     setFactorId]     = useState<string | null>(null)
  const [challengeId,  setChallengeId]  = useState<string | null>(null)
  const [maskedPhone,  setMaskedPhone]  = useState<string>('')
  const [isReady,      setIsReady]      = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [cooldown,     setCooldown]     = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = () => {
    setCooldown(60)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  // Au chargement : trouver le facteur phone et créer le premier challenge
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()

      const { data: factors } = await supabase.auth.mfa.listFactors()
      const phoneFactor = factors?.all?.find(
        f => f.factor_type === 'phone' && f.status === 'verified'
      )

      if (!phoneFactor) {
        router.replace('/auth/enroll-phone')
        return
      }

      setFactorId(phoneFactor.id)

      // Masquer le numéro : garder les 2 derniers chiffres
      const raw = (phoneFactor as { phone?: string }).phone ?? ''
      if (raw.length >= 4) {
        setMaskedPhone(raw.slice(0, -2).replace(/\d/g, '•') + raw.slice(-2))
      }

      // Créer le challenge → SMS envoyé automatiquement
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: phoneFactor.id,
      })

      if (challengeError) {
        setError('Impossible d\'envoyer le SMS. Veuillez réessayer.')
        setIsReady(true)
        return
      }

      setChallengeId(challenge.id)
      setIsReady(true)
      startCooldown()
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleResend = async () => {
    if (cooldown > 0 || !factorId) return
    setError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.challenge({ factorId })
      if (error) throw error
      setChallengeId(data.id)
      startCooldown()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? ''
      setError(msg || 'Erreur lors du renvoi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || !challengeId || otp.length !== 6) return

    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: otp,
      })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? ''
      setError(msg || 'Code incorrect. Veuillez réessayer.')
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
              {maskedPhone && (
                <p className="text-xs text-warm-500 mt-0.5">
                  Code envoyé au <span className="font-semibold text-secondary-700">{maskedPhone}</span>
                </p>
              )}
            </div>
          </div>

          {!isReady ? (
            <div className="text-center py-8">
              <svg className="w-8 h-8 animate-spin text-primary-500 mx-auto" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-warm-400 mt-3">Envoi du SMS…</p>
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

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isSubmitting}
                  className={clsx(
                    'text-sm font-medium transition-colors',
                    cooldown > 0 || isSubmitting
                      ? 'text-warm-300 cursor-not-allowed'
                      : 'text-primary-600 hover:text-primary-700'
                  )}
                >
                  {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : 'Renvoyer le code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
