'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { prepareNextYear } from '@/app/dashboard/annee-scolaire/actions'

export default function PrepareNextYearButton({ currentYearId, yearLabel }: { currentYearId: string; yearLabel: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true); setError(null)
    try {
      const res = await prepareNextYear(currentYearId)
      if (res.error) { setError(res.error); return }
      if (res.newYearId) router.push(`/dashboard/annee-scolaire/${res.newYearId}`)
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <FloatButton
        type="button"
        variant="secondary"
        loading={busy}
        onClick={() => { setError(null); setConfirm(true) }}
        className="!py-2 text-xs !rounded-lg"
      >
        Préparer l’année suivante
      </FloatButton>

      {confirm && (
        <ConfirmModal
          title="Préparer l’année suivante ?"
          confirmLabel="Préparer"
          cancelLabel="Annuler"
          confirmVariant="submit"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); run() }}
        >
          <div className="space-y-2 text-left text-xs text-warm-700">
            <p>Crée l’année suivante à partir de <strong>{yearLabel}</strong> : périodes, types de présence et <strong>report des cotisations</strong> (montants, frais, remises, échéances).</p>
            <p>La nouvelle année <strong>n’est pas</strong> mise « en cours » — vous l’activerez plus tard. Les <strong>classes, l’emploi du temps et les affectations restent à faire manuellement</strong>.</p>
          </div>
        </ConfirmModal>
      )}

      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
    </>
  )
}
