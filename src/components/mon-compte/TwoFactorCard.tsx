'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function TwoFactorCard() {
  const router = useRouter()
  const toast  = useToast()

  const [loading,      setLoading]      = useState(true)
  const [enrolled,     setEnrolled]     = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting,    setResetting]    = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.mfa.listFactors()
      .then(({ data }) => {
        if (!active) return
        const hasTotp = (data?.totp ?? []).some(f => f.status === 'verified')
        setEnrolled(hasTotp)
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const handleReset = async () => {
    setResetting(true)
    const supabase = createClient()
    try {
      const { data } = await supabase.auth.mfa.listFactors()
      for (const f of data?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      toast.success('Authentificateur réinitialisé. Configurez-en un nouveau.')
      router.push('/auth/enroll-totp')
    } catch {
      toast.error('Erreur lors de la réinitialisation de la 2FA.')
      setResetting(false)
      setConfirmReset(false)
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Double authentification (2FA)</h2>

      {loading ? (
        <p className="text-sm text-warm-700">Chargement…</p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {enrolled
              ? <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
              : <ShieldAlert size={18} className="text-amber-500 flex-shrink-0" />}
            <div>
              <p className="text-sm font-medium text-secondary-800">{enrolled ? 'Activée' : 'Non configurée'}</p>
              <p className="text-[11px] text-warm-700">
                {enrolled
                  ? 'Une application d\'authentification est associée à votre compte.'
                  : 'Sécurisez votre compte avec une application d\'authentification.'}
              </p>
            </div>
          </div>
          {enrolled ? (
            <FloatButton type="button" variant="secondary" onClick={() => setConfirmReset(true)}>
              Réinitialiser
            </FloatButton>
          ) : (
            <FloatButton type="button" variant="submit" onClick={() => router.push('/auth/enroll-totp')}>
              Activer
            </FloatButton>
          )}
        </div>
      )}

      {confirmReset && (
        <ConfirmModal
          title="Réinitialiser la double authentification ?"
          message="Votre authentificateur actuel sera supprimé. Vous devrez en configurer un nouveau immédiatement pour continuer à accéder à l'application."
          confirmLabel={resetting ? 'Réinitialisation…' : 'Réinitialiser'}
          confirmColor="red"
          confirmDisabled={resetting}
          onConfirm={handleReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}
