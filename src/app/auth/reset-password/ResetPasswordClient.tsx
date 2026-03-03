'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, CheckCircle2, Check, X } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { PASSWORD_RULES, isPasswordValid } from '@/lib/validation/password'

interface Props {
  hasError?: boolean
}

export default function ResetPasswordClient({ hasError }: Props) {
  const router = useRouter()

  const [firstName,    setFirstName]    = useState<string | undefined>()
  const [lastName,     setLastName]     = useState<string | undefined>()
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPwd,      setShowPwd]      = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [pwdTouched,   setPwdTouched]   = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

  // Récupère le profil pour activer les règles "ne contient pas le nom"
  useEffect(() => {
    if (hasError) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single()
      if (data) {
        setFirstName(data.first_name ?? undefined)
        setLastName(data.last_name  ?? undefined)
      }
    })
  }, [hasError])

  const vPassword = !isPasswordValid(password, firstName, lastName)
  const vConfirm  = confirm !== password
  const isValid   = !vPassword && !vConfirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setIsSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setIsSubmitting(false)

    if (error) {
      setError(error.message || 'Une erreur est survenue. Veuillez réessayer.')
    } else {
      setSuccess(true)
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

          {/* ── Lien invalide ─────────────────────────────────────────── */}
          {hasError && (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-secondary-800">Lien invalide ou expiré</h2>
              <p className="text-sm text-warm-500">
                Ce lien de réinitialisation est invalide ou a expiré.
                Veuillez recommencer la procédure depuis votre application.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full btn btn-secondary py-3 text-base"
              >
                Retour à la connexion
              </button>
            </div>
          )}

          {/* ── Succès ────────────────────────────────────────────────── */}
          {!hasError && success && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-secondary-800">Mot de passe mis à jour</h2>
              <p className="text-sm text-warm-500">
                Votre mot de passe a été modifié avec succès.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full btn btn-primary py-3 text-base"
              >
                Se connecter
              </button>
            </div>
          )}

          {/* ── Formulaire ────────────────────────────────────────────── */}
          {!hasError && !success && (
            <>
              <h2 className="text-xl font-bold text-secondary-800 mb-1">Nouveau mot de passe</h2>
              <p className="text-sm text-warm-500 mb-6">Choisissez un mot de passe sécurisé.</p>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">

                {error && (
                  <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {/* Nouveau mot de passe */}
                <div>
                  <label className="block text-sm font-semibold text-secondary-700 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onBlur={() => setPwdTouched(true)}
                      className={clsx('input pr-10', pwdTouched && vPassword && 'input-error')}
                      placeholder="10 caractères minimum"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
                    >
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {pwdTouched && password.length > 0 && (
                    <PasswordChecklist
                      password={password}
                      firstName={firstName}
                      lastName={lastName}
                    />
                  )}
                </div>

                {/* Confirmation */}
                <div>
                  <label className="block text-sm font-semibold text-secondary-700 mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className={clsx('input pr-10', confirm.length > 0 && vConfirm && 'input-error')}
                      placeholder="Retapez votre mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirm.length > 0 && vConfirm && (
                    <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className="w-full btn btn-primary py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enregistrement…
                    </span>
                  ) : 'Enregistrer le mot de passe'}
                </button>

              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Checklist force du mot de passe ──────────────────────────────────────────

function PasswordChecklist({
  password,
  firstName,
  lastName,
}: {
  password:   string
  firstName?: string
  lastName?:  string
}) {
  const hasName = (firstName && firstName.trim().length >= 3) ||
                  (lastName  && lastName.trim().length  >= 3)

  const rules = PASSWORD_RULES.filter(r =>
    hasName ? true : r.key !== 'noFirst' && r.key !== 'noLast'
  )

  return (
    <ul className="mt-1.5 space-y-0.5">
      {rules.map(rule => {
        const ok = rule.test(password, firstName, lastName)
        return (
          <li key={rule.key} className={clsx(
            'flex items-center gap-1.5 text-xs',
            ok ? 'text-green-600' : 'text-warm-400'
          )}>
            {ok
              ? <Check size={11} className="flex-shrink-0" />
              : <X    size={11} className="flex-shrink-0" />
            }
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
