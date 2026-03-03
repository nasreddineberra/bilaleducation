'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Phone, ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

type Step = 'phone' | 'otp' | 'done'

export default function EnrollPhonePage() {
  const router = useRouter()

  const [step,         setStep]         = useState<Step>('phone')
  const [phone,        setPhone]        = useState('')
  const [otp,          setOtp]          = useState('')
  const [factorId,     setFactorId]     = useState('')
  const [challengeId,  setChallengeId]  = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [cooldown,     setCooldown]     = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = () => {
    setCooldown(60)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      // 1. Enrollement du facteur téléphone
      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'phone',
        phone: phone.trim(),
      })
      if (enrollError) throw enrollError

      const fId = enrollData.id
      setFactorId(fId)

      // 2. Créer un challenge → envoie le SMS
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: fId })
      if (challengeError) throw challengeError

      setChallengeId(challengeData.id)
      setStep('otp')
      startCooldown()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? ''
      setError(msg || 'Impossible d\'envoyer le SMS. Vérifiez le numéro.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
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
    if (otp.length !== 6) return

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
      setStep('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? ''
      setError(msg || 'Code incorrect. Veuillez réessayer.')
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

          {/* ── Étape 1 : saisie du numéro ────────────────────────────── */}
          {step === 'phone' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Phone size={18} className="text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-secondary-800 leading-tight">Activer la double authentification</h2>
                  <p className="text-xs text-warm-500 mt-0.5">Un code SMS vous sera envoyé à chaque connexion.</p>
                </div>
              </div>

              <form onSubmit={handleEnroll} noValidate className="space-y-4">
                {error && (
                  <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-secondary-700 mb-1.5">
                    Numéro de téléphone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="input"
                    placeholder="+33 6 12 34 56 78"
                  />
                  <p className="text-xs text-warm-400 mt-1">Format international requis (ex. +33612345678).</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !phone.trim()}
                  className="w-full btn btn-primary py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Envoi du SMS…
                    </span>
                  ) : 'Recevoir le code SMS'}
                </button>
              </form>
            </>
          )}

          {/* ── Étape 2 : saisie du code OTP ─────────────────────────── */}
          {step === 'otp' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-secondary-800 leading-tight">Vérification</h2>
                  <p className="text-xs text-warm-500 mt-0.5">
                    Code envoyé au <span className="font-semibold text-secondary-700">{phone}</span>
                  </p>
                </div>
              </div>

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
                  ) : 'Confirmer le code'}
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
            </>
          )}

          {/* ── Succès ────────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-secondary-800">Double authentification activée</h2>
              <p className="text-sm text-warm-500">
                Votre numéro <span className="font-semibold text-secondary-700">{phone}</span> est maintenant enregistré.
                Un code SMS vous sera demandé à chaque connexion.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full btn btn-primary py-3 text-base"
              >
                Accéder au tableau de bord
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
