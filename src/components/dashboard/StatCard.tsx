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
    <div className="card card-hover relative overflow-hidden !py-3 !px-4">
      <div className={clsx('absolute top-0 left-0 right-0 h-1 rounded-t-2xl', accentBar)} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-warm-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-secondary-800 mt-1 leading-none">{value}</p>
          {subtitle && <p className="text-[10px] text-warm-400 mt-1">{subtitle}</p>}
        </div>
        <div className={clsx('p-2 rounded-xl shadow-sm flex-shrink-0', iconBg)}>
          <Icon className={clsx('w-5 h-5', iconColor)} />
        </div>
      </div>
    </div>
  )
}
