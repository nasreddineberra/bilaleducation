'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { FloatInput, FloatButton } from '@/components/ui/FloatFields'
import { createClient } from '@/lib/supabase/client'

export default function TotpChallengePage() {
  const router = useRouter()
  const [otp,          setOtp]          = useState('')
  const [factorId,     setFactorId]     = useState<string | null>(null)
  const [challengeId,  setChallengeId]  = useState<string | null>(null)
  const [isReady,      setIsReady]      = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [nomEtab,      setNomEtab]      = useState('Bilal Education')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)

  // Charger le nom et logo de l'établissement
  useEffect(() => {
    fetch('/api/public/etablissement')
      .then(r => r.json())
      .then(d => {
        if (d.nom) setNomEtab(d.nom)
        if (d.logo_url) setLogoUrl(d.logo_url)
      })
      .catch((err) => console.error('[TOTP] Échec chargement infos établissement:', err))
  }, [])

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

  // Initiales de l'établissement pour le fallback logo
  const initiales = nomEtab
    .split(' ')
    .filter(w => w.length > 1)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

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

        {/* Logo + nom établissement */}
        <div className="flex flex-col items-center mb-8">
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
          <h1 className="text-xl font-bold text-white tracking-tight">{nomEtab}</h1>
          <p className="text-white/75 mt-0.5 text-sm">Espace de gestion</p>
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
              <Loader2 size={32} className="animate-spin text-primary-500 mx-auto" />
              <p className="text-sm text-warm-400 mt-3">Chargement…</p>
            </div>
          ) : (
            <form onSubmit={handleVerify} noValidate className="space-y-4">
              {error && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <FloatInput
                label="Code à 6 chiffres"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setOtp(v)
                }}
                className="text-center text-xl tracking-widest font-mono"
                placeholder="• • • • • •"
                autoFocus
                disabled={isSubmitting}
              />

              <FloatButton
                variant="submit"
                className="w-full justify-center"
                disabled={isSubmitting || otp.length !== 6}
                loading={isSubmitting}
              >
                Valider
              </FloatButton>
            </form>
          )}

          {/* Retour au login */}
          <div className="mt-5 pt-4 border-t border-warm-100 text-center">
            <button
              type="button"
              onClick={() => { window.location.href = '/login' }}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
            >
              <ArrowLeft size={13} />
              Retour à la connexion
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
