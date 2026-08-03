'use client'

import { useState, useEffect, useRef } from 'react'
import { APP_VERSION } from '@/lib/app-version'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { FloatInput, FloatButton } from '@/components/ui/FloatFields'
import { authRepository } from '@/lib/database/auth'

// ─── Slogan défilant ─────────────────────────────────────────────────────────
// Défilement AUTOMATIQUE horizontal sur toute la largeur du panneau : la
// citation sort par la gauche, la suivante entre par la droite. Pas de points
// de pagination — ce n'est pas un carrousel, l'utilisateur ne pilote rien.
//
// La distance est MESURÉE sur le conteneur, jamais écrite en dur : une valeur
// fixe traverserait tout un petit écran et à peine un grand. Un ResizeObserver
// la tient à jour.
//
// Trois phases et non deux : entre la sortie et l'entrée, il faut REPOSITIONNER
// le texte à droite SANS transition, sinon il traverserait l'écran à l'envers.
// D'où la phase `pre`, appliquée sur deux `requestAnimationFrame` pour que le
// navigateur l'enregistre avant qu'on réactive l'animation.

const CITATIONS = [
  ['L’éducation est la lumière', 'qui guide chaque pas'],
  ['Apprendre aujourd’hui', 'pour éclairer demain'],
  ['Chaque élève compte', 'chaque progrès se mesure'],
  ['Le savoir se transmet', 'il ne se perd jamais'],
]

const DELAI_MS = 15_000
const TRANSITION_MS = 1200

type Phase = 'in' | 'out' | 'pre'

function SloganDefilant() {
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>('in')
  const zoneRef = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)

  // Largeur de la zone : la citation part et arrive de ses bords.
  useEffect(() => {
    const el = zoneRef.current
    if (!el) return
    const maj = () => setDistance(el.clientWidth)
    maj()
    const ro = new ResizeObserver(maj)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      setPhase('out')
      setTimeout(() => {
        setI(prev => (prev + 1) % CITATIONS.length)
        setPhase('pre')
        requestAnimationFrame(() => requestAnimationFrame(() => setPhase('in')))
      }, TRANSITION_MS)
    }, DELAI_MS)
    return () => clearInterval(id)
  }, [])

  const x = phase === 'in' ? 0 : phase === 'out' ? -distance : distance
  // Transparence PENDANT le trajet, pleine opacité une fois en place. L'entrée
  // démarre à 0.15 et non à 0 : le texte est déjà là, très estompé, et se
  // densifie en avançant — à 0 il apparaîtrait d'un coup au bord droit.
  const opacity = phase === 'in' ? 1 : phase === 'out' ? 0 : 0.15

  return (
    <div className="w-full text-center space-y-3">
      {/* Hauteur RÉSERVÉE et débordement rogné : sinon une citation plus courte
          ferait sautiller le bloc, et le texte déborderait du panneau pendant
          la traversée. */}
      <div ref={zoneRef} className="w-full min-h-[3.5rem] flex items-center justify-center overflow-hidden">
        <p
          className="text-white text-xl font-semibold leading-snug ease-in-out whitespace-nowrap"
          style={{
            transitionProperty: 'opacity, transform',
            transitionDuration: phase === 'pre' ? '0ms' : `${TRANSITION_MS}ms`,
            opacity,
            transform: `translateX(${x}px)`,
          }}
          aria-live="off"
        >
          {CITATIONS[i][0]}<br />{CITATIONS[i][1]}
        </p>
      </div>
      <p className="text-white/60 text-sm">
        Plateforme de gestion administrative et pédagogique
      </p>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function LoginPage() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Verr. Maj : cause n°1 des echecs de connexion, et la seule que l'utilisateur
  // ne peut PAS voir puisque le champ est masque.
  const [capsLock, setCapsLock] = useState(false)
  const [error,        setError]        = useState('')
  const [notice,       setNotice]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [nomEtab,      setNomEtab]      = useState('Bilal Education')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)

  // Message après déconnexion automatique (inactivité / durée max)
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason')
    if (reason === 'inactivity') setNotice('Votre session a expiré pour inactivité. Veuillez vous reconnecter.')
    else if (reason === 'session') setNotice('Votre session a expiré. Veuillez vous reconnecter.')
  }, [])

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
    // Le bouton reste actif meme a vide : c'est ici qu'on dit ce qui manque,
    // plutot que de laisser l'utilisateur devant un bouton grise sans raison.
    if (!email.trim() || !password) {
      setError(!email.trim()
        ? 'Veuillez saisir votre adresse email.'
        : 'Veuillez saisir votre mot de passe.')
      return
    }
    setLoading(true)
    try {
      await authRepository.signIn(email, password)
      const now = Math.floor(Date.now() / 1000)
      const secure = process.env.NODE_ENV === 'production' ? ';secure' : ''
      document.cookie = `app-session=${JSON.stringify({ loginTime: now, lastActivity: now })};path=/;max-age=${24 * 3600};samesite=lax${secure}`
      window.location.href = '/dashboard'
    } catch (err: any) {
      const msg = err.message ?? ''
      if (msg.includes('ACCOUNT_DISABLED')) {
        setError('Votre compte est désactivé. Contactez l\'administration de l\'établissement.')
      } else if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
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
    // Fond et degrade tires des TOKENS : « #f0f5f7 » n'appartenait a aucune
    // palette du projet, et « #0c5b51 → #063a33 » recopiait --brand-surface et
    // --brand-surface-2. Une teinte de marque qui evolue doit entrainer cette
    // page avec elle (piege deja paye sur l'emploi du temps).
    <div className="min-h-screen flex" style={{ background: 'var(--surface-page)' }}>

      {/* ── Panneau gauche : la MARQUE du produit ─────────────────────────── */}
      {/* Dégradé SEUL (choix utilisateur) : les trois cercles blancs à 4 %
          étaient invisibles sur la plupart des écrans et cassaient le dégradé
          sur les autres. */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
      >
        <div className="relative z-10 flex flex-col items-center gap-8 w-full text-center">

          {/* Bloc de marque : le logo seul ne NOMME pas l'application. Le nom
              est posé à côté, sur deux lignes, aligné sur la hauteur du
              symbole — la disposition classique d'un logotype. */}
          <div className="flex items-center gap-5">
            <Image src="/icon.png" alt="" width={104} height={104} unoptimized className="flex-shrink-0" />
            {/* `.nom-vague` (globals.css) porte le dégradé animé ; ici on ne
                garde que le découpage aux lettres. Les deux lignes sont
                STRICTEMENT identiques — même corps, même graisse, même
                interlettrage : le nom se lit d'un bloc. */}
            <div className="text-left leading-[0.95] bg-clip-text text-transparent nom-vague">
              <p className="text-[40px] font-bold tracking-wide">BILAL</p>
              <p className="text-[40px] font-bold tracking-wide">EDUCATION</p>
            </div>
          </div>

          <SloganDefilant />
        </div>
      </div>

      {/* ── Panneau droit : formulaire ───────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 sm:px-12 pt-12 pb-24">

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
                  style={{ background: 'linear-gradient(135deg, #12887a 0%, #0a504a 100%)' }}
                >
                  {initiales || 'BE'}
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold text-secondary-800">{nomEtab}</h1>
            <p className="text-sm text-warm-700 mt-0.5">Espace de gestion</p>
          </div>

          {/* Carte formulaire */}
          <div className="bg-white rounded-2xl p-8 shadow-card border border-warm-100">

            <h2 className="text-lg font-bold text-secondary-800 mb-1">Connexion</h2>
            <p className="text-sm text-warm-700 mb-6">Connectez-vous à votre compte</p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Notice session expirée */}
              {notice && !error && (
                <div role="status" className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm animate-fade-in">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {/* Erreur */}
              {error && (
                <div role="alert" className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p>{error}</p>
                    {/* Porte de sortie : « identifiants incorrects » ou « compte
                        désactivé » laissent sinon l'utilisateur sans recours.
                        Mention GÉNÉRIQUE, sans adresse : la page est publique et
                        une adresse y serait exposée aux robots. */}
                    <p className="text-red-700/80 text-xs">
                      Contactez l&apos;administration de votre établissement.
                    </p>
                  </div>
                </div>
              )}

              {/* Email */}
              <FloatInput
                label="Adresse email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="votre@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />

              {/* Mot de passe */}
              <div className="relative">
                <FloatInput
                  label="Mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                  onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLock(false)}
                  disabled={loading}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-700 hover:text-secondary-600 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 z-10"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                {capsLock && (
                  <p role="status" className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-700">
                    <AlertCircle size={13} className="shrink-0" />
                    Verr. Maj est activé
                  </p>
                )}
              </div>

              {/* Mot de passe oublié */}
              <div className="flex justify-end">
                <Link href="/auth/forgot-password" className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                  Mot de passe oublié ?
                </Link>
              </div>

              {/* Bouton. Actif même à vide : un bouton grisé n'explique pas ce
                  qui manque — la validation se fait au clic (handleSubmit). */}
              <FloatButton
                variant="brand"
                className="w-full justify-center"
                disabled={loading}
                loading={loading}
              >
                Se connecter
              </FloatButton>

            </form>
          </div>

        </div>

        {/* Meme pied que les ecrans d'authentification, ancre en bas de page.
            SANS le logo : celui du produit trone deja sur le panneau de gauche,
            le repeter en petit au bas du meme ecran ferait doublon. */}
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-1.5 px-4">
          <span className="text-xs text-warm-700">
            &copy; Bilal Education &middot; Gestion administrative &amp; pédagogique &middot;
          </span>
          <span className="text-[11px] font-mono text-warm-700 bg-warm-100 px-1.5 py-0.5 rounded leading-none">
            {APP_VERSION}
          </span>
        </div>
      </div>

    </div>
  )
}
