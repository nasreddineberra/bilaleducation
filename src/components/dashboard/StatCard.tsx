'use client'

import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'

interface Props {
  title: string
  value: number | string
  subtitle?: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  accentBar: string
}

export default function StatCard({ title, value, subtitle, icon: Icon, iconBg, iconColor, accentBar }: Props) {
  return (
    <div className="card card-hover relative overflow-hidden">
      <div className={clsx('absolute top-0 left-0 right-0 h-1 rounded-t-2xl', accentBar)} />
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-semibold text-warm-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-secondary-800 mt-2 leading-none">{value}</p>
          {subtitle && <p className="text-xs text-warm-400 mt-1.5">{subtitle}</p>}
        </div>
        <div className={clsx('p-3 rounded-2xl shadow-sm flex-shrink-0', iconBg)}>
          <Icon className={clsx('w-7 h-7', iconColor)} />
        </div>
      </div>
    </div>
  )
}
