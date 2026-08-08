'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'
import { FloatInput, FloatButton } from '@/components/ui/FloatFields'
import { createClient } from '@/lib/supabase/client'
import AuthShell from '@/components/auth/AuthShell'
import { canonicalOrigin } from '@/lib/tenant/canonical-host'

// ─── Illustration (même que login) ─────────────────────────────────────────

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        // Origine NORMALISÉE : un `www.` de tête n'est couvert par aucun
        // certificat sur un sous-domaine d'école. Voir `canonical-host`.
        redirectTo: `${canonicalOrigin(window.location.origin)}/auth/confirm?next=/auth/reset-password`,
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

  return (
    <AuthShell>

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
                  <p className="text-sm text-warm-700 leading-relaxed">
                    Si un compte est associé à <span className="font-semibold text-secondary-700">{email}</span>,
                    vous recevrez un lien de réinitialisation par email.
                  </p>
                </div>
                <FloatButton
                  variant="submit"
                  className="w-full justify-center"
                  onClick={() => router.push('/login')}
                >
                  Retour à la connexion
                </FloatButton>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-secondary-800 mb-1">Mot de passe oublié ?</h2>
                <p className="text-sm text-warm-700 mb-6">
                  Entrez votre email pour recevoir un lien de réinitialisation.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                  {/* Erreur */}
                  {error && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
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

            {/* Retour au login — masqué une fois le lien envoyé : l'écran de
                succès porte déjà ce bouton, et le proposer deux fois ferait
                douter qu'il s'agisse de la même action. */}
            {!success && (
            <div className="mt-5 pt-4 border-t border-warm-100 text-center">
              <button
                onClick={() => router.push('/login')}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
              >
                <ArrowLeft size={13} />
                Retour à la connexion
              </button>
            </div>
            )}

    </AuthShell>
  )
}
