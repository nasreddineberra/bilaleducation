'use client'

import { useState, useEffect } from 'react'
import { APP_VERSION } from '@/lib/app-version'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import Image from 'next/image'
import OtpInput from '@/components/ui/OtpInput'
import { createClient } from '@/lib/supabase/client'
import AuthBrandHeader from '@/components/auth/AuthBrandHeader'

/**
 * Destination après validation : `next` s'il est fourni, sinon le tableau de
 * bord. La console vit sur son propre sous-domaine et n'a rien à faire d'un
 * renvoi vers `/dashboard` — elle passe donc sa destination en paramètre.
 *
 * Le contrôle « commence par / mais pas // » est un garde-fou contre la
 * redirection ouverte : sans lui, un lien forgé enverrait l'utilisateur vers un
 * site tiers au moment précis où il vient de s'authentifier.
 */
function destinationApres2FA(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
}


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

  // Thème de l'utilisateur : dès la 2FA il est identifié, on applique sa
  // préférence (et on l'amorce dans localStorage → dashboard sans flash).
  useEffect(() => {
    const applyTheme = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: prof } = await supabase.from('profiles').select('theme').eq('id', user.id).maybeSingle()
        const t = prof?.theme === 'dark' ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', t)
        localStorage.setItem('theme', t)
      } catch { /* thème indisponible : on reste en clair */ }
    }
    applyTheme()
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

  // Validation automatique dès que les 6 chiffres sont saisis (OtpInput.onComplete).
  const verify = async (code: string) => {
    if (!factorId || code.length !== 6 || isSubmitting) return

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
        code,
      })
      if (verifyError) throw verifyError

      setChallengeId(challengeData.id)
      router.push(destinationApres2FA())
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? ''
      setError(msg || 'Code incorrect. Vérifiez que votre application est synchronisée.')
      setOtp('')  // réinitialise les cases → refocus auto sur la 1re
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
      className="relative min-h-screen flex items-center justify-center px-4 pt-12 pb-24"
      // Meme degrade que le panneau de marque de la page de connexion : memes
      // TOKENS et meme angle (145°). Les tokens suivent le theme — teal en
      // clair, ardoise en sombre — ce qu'une valeur en dur ne fait pas.
      style={{ background: 'linear-gradient(145deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
    >
      <div className="relative w-full max-w-md">

        <AuthBrandHeader />

        {/* Carte */}
        <div
          className="bg-white dark:bg-[#161f24] rounded-3xl p-8 animate-fade-in"
          style={{ boxShadow: '0 24px 64px rgba(17,28,33,0.22), 0 8px 24px rgba(17,28,33,0.12)' }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-secondary-800 dark:text-[#e7eef0] leading-tight">Vérification en deux étapes</h2>
              <p className="text-xs text-warm-700 dark:text-[#93a2a8] mt-0.5">
                Saisissez le code de votre application d'authentification.
              </p>
            </div>
          </div>

          {!isReady ? (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-primary-500 mx-auto" />
              <p className="text-sm text-warm-700 dark:text-[#93a2a8] mt-3">Chargement…</p>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); verify(otp) }} noValidate className="space-y-4">
              {error && (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <OtpInput
                value={otp}
                onChange={setOtp}
                onComplete={verify}
                disabled={isSubmitting}
                error={!!error}
                ariaLabel="Code à 6 chiffres de votre application d'authentification"
              />

              <p role="status" className="h-5 text-center text-sm text-warm-700 dark:text-[#93a2a8] flex items-center justify-center gap-2">
                {isSubmitting && <><Loader2 size={14} className="animate-spin text-primary-500" /> Vérification…</>}
              </p>
            </form>
          )}

          {/* Retour au login */}
          <div className="mt-5 pt-4 border-t border-warm-100 dark:border-[#243139] text-center">
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

      {/* Marque du PRODUIT, ancree en BAS DE PAGE et non sous la carte : elle
          reste au meme endroit quelle que soit la hauteur du contenu. Le haut
          de page appartient a l'ÉTABLISSEMENT (son logo, son nom), c'est chez
          lui que l'utilisateur entre ; l'application se signe en bas. */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-1.5 px-4">
        <Image src="/icon.png" alt="" width={22} height={22} unoptimized className="opacity-80 flex-shrink-0" />
        <span className="text-white/60 text-xs">
          &copy; Bilal Education &middot; Gestion administrative &amp; pédagogique &middot;
        </span>
        <span className="text-white/50 text-[11px] font-mono bg-white/10 px-1.5 py-0.5 rounded leading-none">
          {APP_VERSION}
        </span>
      </div>
    </div>
  )
}
