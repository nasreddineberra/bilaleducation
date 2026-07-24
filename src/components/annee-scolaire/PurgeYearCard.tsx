'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { FloatButton, FloatInput } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/lib/toast-context'
import { purgeYear } from '@/app/dashboard/annee-scolaire/cloture/actions'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PurgeYearCard({ yearId, yearLabel, purgedAt }: { yearId: string; yearLabel: string; purgedAt: string | null }) {
  const router = useRouter()
  const toast  = useToast()
  const [open, setOpen]   = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy]   = useState(false)

  if (purgedAt) {
    return (
      <div className="card p-4 space-y-1">
        <h3 className="text-sm font-bold text-secondary-800">Année purgée</h3>
        <p className="text-xs text-warm-700">
          Les données transactionnelles ont été supprimées le {fmt(purgedAt)}. Bulletins (PDF), snapshots d’historique et impayés conservés.
        </p>
      </div>
    )
  }

  const run = async () => {
    setBusy(true)
    try {
      const res = await purgeYear(yearId, typed)
      if (res.error) { toast.error(res.error); return }
      const s = res.summary
      toast.success(`Année ${yearLabel} purgée : ${s?.notes ?? 0} note(s), ${s?.absences ?? 0} absence(s), ${s?.fees_paid ?? 0} foyer(s) soldé(s).`)
      setOpen(false); setTyped('')
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-4 space-y-2 border-red-200 bg-red-50/30">
      <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
        <AlertTriangle size={15} className="text-red-500" /> Purge de l’année
      </h3>
      <p className="text-xs text-warm-700">
        Supprime définitivement les données transactionnelles de {yearLabel} (notes, absences, temps de présence, EDT,
        cahier de texte, et finances des foyers <strong>soldés</strong>). Les <strong>bulletins PDF</strong>, les
        <strong> snapshots d’historique</strong> et les <strong>impayés</strong> sont conservés.
      </p>
      <FloatButton type="button" variant="danger" onClick={() => { setTyped(''); setOpen(true) }}>
        Purger l’année
      </FloatButton>

      {open && (
        <ConfirmModal
          title={`Purger définitivement ${yearLabel} ?`}
          confirmLabel={busy ? 'Purge…' : 'Purger définitivement'}
          cancelLabel="Annuler"
          confirmColor="red"
          confirmDisabled={busy || typed.trim() !== yearLabel}
          onCancel={() => { if (!busy) { setOpen(false); setTyped('') } }}
          onConfirm={run}
        >
          <div className="space-y-2 text-left">
            <p className="text-xs text-warm-700">
              Action <strong>irréversible</strong>. Les bulletins (PDF) et l’historique restent consultables ; seules les
              données transactionnelles sont supprimées.
            </p>
            <p className="text-xs text-warm-700">
              Pour confirmer, saisissez le libellé exact de l’année : <strong>{yearLabel}</strong>
            </p>
            <FloatInput label="Libellé de l’année" value={typed} onChange={e => setTyped(e.target.value)} />
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}
