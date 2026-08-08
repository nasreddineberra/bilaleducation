'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, CheckCircle2, Check, X } from 'lucide-react'
import { clsx } from 'clsx'
import AuthShell from '@/components/auth/AuthShell'
import { createClient } from '@/lib/supabase/client'
import { PASSWORD_RULES, isPasswordValid } from '@/lib/validation/password'

interface Props {
  motif?: string | null
}

/**
 * Un message par cause, et chacun dit QUOI FAIRE.
 *
 * L'écran annonçait « lien invalide ou expiré » dans les trois cas. Or « expiré »
 * est faux la plupart du temps, et laisse l'utilisateur recommencer à l'identique
 * — donc échouer à l'identique. Le cas « déjà utilisé » se produit sans qu'il ait
 * rien fait : les filtres anti-spam ouvrent les liens pour les inspecter, ce qui
 * consomme un jeton à usage unique. Sortir le message des indésirables est alors
 * la seule action qui change quelque chose, et il faut la lui dire.
 */
const MOTIFS: Record<string, { titre: string; texte: string }> = {
  consomme: {
    titre: 'Ce lien a déjà servi',
    texte:
      "Un lien de réinitialisation ne fonctionne qu'une seule fois, et il expire au bout de dix minutes. " +
      "S'il est arrivé dans vos indésirables, le filtre a pu l'ouvrir avant vous pour l'inspecter : déplacez d'abord le message dans votre boîte de réception, puis demandez un nouveau lien.",
  },
  echange: {
    titre: 'Ouvrez le lien dans le même navigateur',
    texte:
      "Ce lien doit être ouvert dans le navigateur depuis lequel la réinitialisation a été demandée. " +
      "Si vous avez changé d'appareil ou de navigateur entre-temps, refaites la demande depuis celui que vous utilisez maintenant.",
  },
  'sans-jeton': {
    titre: 'Lien incomplet',
    texte:
      "Ce lien ne contient pas les informations attendues — il a probablement été tronqué par la messagerie. " +
      "Demandez-en un nouveau, et cliquez dessus plutôt que de le recopier.",
  },
}

export default function ResetPasswordClient({ motif }: Props) {
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
    if (motif) return
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
  }, [motif])

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
    <AuthShell>

          {/* ── Lien invalide ─────────────────────────────────────────── */}
          {motif && (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-secondary-800">{MOTIFS[motif]?.titre ?? MOTIFS['sans-jeton'].titre}</h2>
              <p className="text-sm text-warm-700">
                {MOTIFS[motif]?.texte ?? MOTIFS['sans-jeton'].texte}
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
          {!motif && success && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-secondary-800">Mot de passe mis à jour</h2>
              <p className="text-sm text-warm-700">
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
          {!motif && !success && (
            <>
              <h2 className="text-xl font-bold text-secondary-800 mb-1">Nouveau mot de passe</h2>
              <p className="text-sm text-warm-700 mb-6">Choisissez un mot de passe sécurisé.</p>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-700 hover:text-warm-700"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-700 hover:text-warm-700"
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

    </AuthShell>
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
            ok ? 'text-green-600' : 'text-warm-700'
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
