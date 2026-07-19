import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'

// Tons de la charte (turquoise / orange / rouge / ardoise / vert). Centralise les
// couleurs pour ne plus disperser success-*/danger-*/blue-* dans les dashboards.
// Tons issus de la PALETTE de l'app (pas de vert : la charte n'en a pas).
type Tone = 'primary' | 'orange' | 'red' | 'ardoise' | 'amber'

const TONES: Record<Tone, { bg: string; fg: string; bar: string }> = {
  primary: { bg: 'bg-primary-100',   fg: 'text-primary-600',   bar: 'bg-primary-500' },
  orange:  { bg: 'bg-orange-100',    fg: 'text-orange-600',    bar: 'bg-orange-500' },
  red:     { bg: 'bg-red-100',       fg: 'text-red-600',       bar: 'bg-red-500' },
  ardoise: { bg: 'bg-secondary-100', fg: 'text-secondary-600', bar: 'bg-secondary-500' },
  amber:   { bg: 'bg-amber-100',     fg: 'text-amber-700',     bar: 'bg-amber-500' },
}

interface Props {
  title: string
  value: number | string
  subtitle?: string
  icon: LucideIcon
  tone?: Tone
}

export default function StatCard({ title, value, subtitle, icon: Icon, tone = 'primary' }: Props) {
  const t = TONES[tone]
  return (
    <div className="card card-hover relative overflow-hidden !py-3 !px-4">
      <div className={clsx('absolute top-0 left-0 right-0 h-1 rounded-t-2xl', t.bar)} />
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="stat-label">{title}</p>
          <p className="text-2xl font-bold text-secondary-800 mt-1 leading-none tabular-nums">{value}</p>
          {subtitle && <p className="text-[10px] text-warm-700 mt-1">{subtitle}</p>}
        </div>
        <div className={clsx('p-2 rounded-xl shadow-sm flex-shrink-0', t.bg)}>
          <Icon className={clsx('w-5 h-5', t.fg)} />
        </div>
      </div>
    </div>
  )
}
