'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ShieldCheck, ScanLine, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { FloatInput, FloatButton } from '@/components/ui/FloatFields'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'

type Step = 'enroll' | 'otp' | 'done'

export default function EnrollTotpPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [step,         setStep]         = useState<Step>('enroll')
  const [factorId,     setFactorId]     = useState('')
  const [qrCodeData,   setQrCodeData]   = useState<{ type: 'image' | 'uri'; value: string } | null>(null)
  const [otp,          setOtp]          = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [isLoadingQr,  setIsLoadingQr]  = useState(false)

  // Générer le QR code quand un URI TOTP est disponible
  useEffect(() => {
    if (qrCodeData?.type === 'uri' && canvasRef.current) {
      setIsLoadingQr(true)
      QRCode.toCanvas(canvasRef.current, qrCodeData.value, {
        width: 200,
        margin: 1,
        color: { dark: '#1c3a4a', light: '#ffffff' },
      }, (err) => {
        setIsLoadingQr(false)
        if (err) {
          console.error('[enroll-totp] QR code generation error:', err)
          setError('Impossible de générer le QR code.')
        }
      })
    } else if (qrCodeData?.type === 'image') {
      setIsLoadingQr(false)
    }
  }, [qrCodeData])

  const handleEnroll = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      // Vérifier que l'utilisateur est authentifié
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Vous devez être connecté pour configurer la 2FA.')
      }
      console.log('[enroll-totp] User authenticated:', user.email)

      // 0. Nettoyer les anciens facteurs non vérifiés
      const { data: existingFactors } = await supabase.auth.mfa.listFactors()
      const unverifiedTotp = existingFactors?.totp?.filter(f => f.status === 'unverified')
      if (unverifiedTotp?.length) {
        console.log('[enroll-totp] Cleaning up', unverifiedTotp.length, 'unverified factors')
        for (const factor of unverifiedTotp) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }
      }

      // 1. Enrôlement du facteur TOTP avec un nom unique
      const friendlyName = `TOTP-${Date.now()}`
      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      })
      if (enrollError) {
        console.error('[enroll-totp] Enroll error:', enrollError)
        throw enrollError
      }

      // Debug : voir la structure exacte de la réponse
      console.log('[enroll-totp] Full response:', JSON.stringify(enrollData, null, 2))
      console.log('[enroll-totp] totp field type:', typeof enrollData.totp)
      console.log('[enroll-totp] totp.qr_code type:', typeof enrollData.totp?.qr_code)
      console.log('[enroll-totp] totp.qr_code length:', (enrollData.totp?.qr_code ?? '').length)
      console.log('[enroll-totp] totp.qr_code first 200 chars:', (enrollData.totp?.qr_code ?? '').substring(0, 200))

      // Si qr_code contient un data URL ou un data URI, il ne faut PAS le réencoder en QR
      // Il faut extraire l'URI TOTP réel
      let totpUri: string | undefined

      if (enrollData.totp?.qr_code) {
        const raw = enrollData.totp.qr_code
        // Si c'est un data URL (data:image/png;base64,...), c'est déjà un QR code image
        if (raw.startsWith('data:')) {
          console.log('[enroll-totp] qr_code is a data URL image, not an URI')
          // Dans ce cas, on utilise directement le data URL comme source d'image
          totpUri = raw
        } else if (raw.startsWith('otpauth://')) {
          // C'est bien un URI TOTP
          totpUri = raw
        } else {
          // Inconnu, on tente quand même
          console.warn('[enroll-totp] Unknown qr_code format, using as-is')
          totpUri = raw
        }
      } else {
        // Fallback sur totp_uri direct
        totpUri = (enrollData as any).totp_uri ?? (enrollData as any).data?.totp?.qr_code
      }

      console.log('[enroll-totp] Final totpUri length:', totpUri?.length)
      console.log('[enroll-totp] Final totpUri preview:', totpUri?.substring(0, 100))

      if (!totpUri) {
        console.error('[enroll-totp] Response keys:', Object.keys(enrollData ?? {}))
        console.error('[enroll-totp] Full data:', JSON.stringify(enrollData))
        throw new Error('Supabase n\'a pas retourné d\'URI TOTP. Vérifiez que la 2FA est activée dans Supabase Auth > MFA.')
      }

      // Stocker selon le type
      if (totpUri.startsWith('data:')) {
        setQrCodeData({ type: 'image', value: totpUri })
      } else {
        setQrCodeData({ type: 'uri', value: totpUri })
      }

      setFactorId(enrollData.id)
      setStep('otp')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? ''
      console.error('[enroll-totp] Caught error:', err)
      setError(msg || "Impossible d'initialiser l'authentification TOTP.")
      setStep('enroll') // Revenir à l'étape enroll en cas d'erreur
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

      // 2. Créer un challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })
      if (challengeError) throw challengeError

      // 3. Vérifier le code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: otp,
      })
      if (verifyError) throw verifyError

      setStep('done')
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

          {/* ── Étape 1 : bouton pour générer le QR code ──────────────────── */}
          {step === 'enroll' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <ScanLine size={18} className="text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-secondary-800 leading-tight">Activer la double authentification</h2>
                  <p className="text-xs text-warm-500 mt-0.5">Scannez le QR code avec Google Authenticator ou une application compatible.</p>
                </div>
              </div>

              <div className="text-center">
                <FloatButton
                  variant="primary"
                  className="w-full justify-center"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  onClick={handleEnroll}
                >
                  Générer le QR code
                </FloatButton>
              </div>
            </>
          )}

          {/* ── Étape 2 : QR code + saisie du code ───────────────────────── */}
          {step === 'otp' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-secondary-800 leading-tight">Configuration TOTP</h2>
                  <p className="text-xs text-warm-500 mt-0.5">Scannez le QR code puis saisissez le code à 6 chiffres.</p>
                </div>
              </div>

              <div className="space-y-5">
                {error && (
                  <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {/* QR Code */}
                <div className="flex flex-col items-center gap-3 bg-warm-50 border border-warm-100 rounded-2xl p-6">
                  {isLoadingQr ? (
                    <div className="w-[200px] h-[200px] flex items-center justify-center">
                      <Loader2 size={32} className="animate-spin text-primary-500" />
                    </div>
                  ) : qrCodeData?.type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrCodeData.value}
                      alt="QR Code TOTP"
                      className="w-[200px] h-[200px] rounded-lg"
                    />
                  ) : qrCodeData?.type === 'uri' ? (
                    <canvas ref={canvasRef} className="rounded-lg" />
                  ) : null}
                  <p className="text-xs text-warm-500 text-center">
                    Scannez avec <span className="font-semibold">Google Authenticator</span>, <span className="font-semibold">Authy</span> ou une application compatible.
                  </p>
                </div>

                {/* Formulaire OTP */}
                <form onSubmit={handleVerify} noValidate className="space-y-4">
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
                    Confirmer le code
                  </FloatButton>
                </form>
              </div>
            </>
          )}

          {/* ── Succès ────────────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-secondary-800">Double authentification activée</h2>
              <p className="text-sm text-warm-500">
                Votre application d'authentification est maintenant configurée.
                Un code à 6 chiffres vous sera demandé à chaque connexion.
              </p>
              <FloatButton
                variant="primary"
                className="w-full justify-center"
                onClick={() => router.push('/dashboard')}
              >
                Accéder au tableau de bord
              </FloatButton>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
