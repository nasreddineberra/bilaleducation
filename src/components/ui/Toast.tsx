'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useToast, type Toast } from '@/lib/toast-context'

// ─── Config par type ──────────────────────────────────────────────────────────

const TOAST_CONFIG = {
  success: {
    icon:      CheckCircle2,
    container: 'bg-green-50 border-green-200 text-green-800',
    iconCls:   'text-green-500',
    bar:       'bg-green-400',
  },
  error: {
    icon:      XCircle,
    container: 'bg-red-50 border-red-200 text-red-800',
    iconCls:   'text-red-500',
    bar:       'bg-red-400',
  },
  warning: {
    icon:      AlertTriangle,
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    iconCls:   'text-amber-500',
    bar:       'bg-amber-400',
  },
  info: {
    icon:      Info,
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    iconCls:   'text-blue-500',
    bar:       'bg-blue-400',
  },
} as const

// ─── Composant Toast individuel ───────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const cfg = TOAST_CONFIG[toast.type]
  const Icon = cfg.icon

  // Entrée : légère animation slide-in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 200)
  }

  return (
    <div
      className={[
        'relative overflow-hidden flex items-start gap-3',
        'w-80 rounded-xl border px-4 py-3 shadow-lg',
        'transition-all duration-200',
        cfg.container,
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8',
      ].join(' ')}
      role="alert"
    >
      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${cfg.iconCls}`} />
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
        aria-label="Fermer"
      >
        <X size={15} />
      </button>

      {/* Barre de progression */}
      <span
        className={`absolute bottom-0 left-0 h-0.5 ${cfg.bar} animate-toast-progress`}
      />
    </div>
  )
}

// ─── Conteneur global (bottom-right) ─────────────────────────────────────────

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}
