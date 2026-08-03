'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { useToast } from '@/lib/toast-context'
import { FloatButton } from '@/components/ui/FloatFields'
import { setCurrentPeriod } from '@/app/dashboard/annee-scolaire/actions'

const PERIOD_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}
const periodLabel = (label: string) => PERIOD_LABELS[label] ?? label

interface PeriodRow { id: string; label: string; order_index: number; is_current?: boolean }

interface Props {
  schoolYearId: string
  periods: PeriodRow[]
  canEdit: boolean
}

// Encadre autonome : la direction choisit la periode « en cours » de l'annee.
// Sert de valeur par defaut du selecteur de periode sur tous les ecrans.
export default function CurrentPeriodCard({ schoolYearId, periods, canEdit }: Props) {
  const router = useRouter()
  const toast = useToast()

  const sorted = useMemo(() => [...periods].sort((a, b) => a.order_index - b.order_index), [periods])
  const initialId = sorted.find(p => p.is_current)?.id ?? ''

  // Aucune période en cours — cas de l'année qu'on vient d'activer : on
  // PRÉ-SÉLECTIONNE la première, il ne reste qu'à valider. Le bouton s'active
  // de lui-même, la sélection différant de ce qui est enregistré (chaîne vide).
  // Rien n'est écrit sans un clic : la pré-sélection est une suggestion.
  const [selected, setSelected] = useState(initialId || (sorted[0]?.id ?? ''))
  const [saving, setSaving] = useState(false)

  const changed = selected !== initialId

  const handleSave = async () => {
    if (!selected || !changed) return
    setSaving(true)
    const res = await setCurrentPeriod(schoolYearId, selected)
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Période en cours enregistrée.')
    router.refresh()
  }

  if (sorted.length === 0) return null

  return (
    <section className="card p-3 space-y-2">
      <div>
        <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Période en cours</h2>
        {!initialId && (
          <p role="alert" className="text-[11px] font-semibold text-red-600 mt-0.5">
            Aucune période en cours définie. La première est présélectionnée : validez pour l&apos;enregistrer.
          </p>
        )}
      </div>

      {/* Périodes + bouton sur la même ligne */}
      <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Période en cours">
        {sorted.map(p => {
          const active = selected === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!canEdit || saving}
              onClick={() => setSelected(p.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed',
                active
                  ? 'border-primary-400 bg-primary-500 text-white'
                  : 'border-warm-300 text-secondary-700 bg-white hover:bg-warm-50 disabled:opacity-60',
              )}
            >
              {periodLabel(p.label)}
            </button>
          )
        })}
        {canEdit && (
          <FloatButton
            type="button"
            variant={initialId ? 'edit' : 'submit'}
            onClick={handleSave}
            loading={saving}
            disabled={!selected || !changed || saving}
            className="ml-auto"
          >
            {initialId ? 'Modifier' : 'Valider'}
          </FloatButton>
        )}
      </div>
    </section>
  )
}
