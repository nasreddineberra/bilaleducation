'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useToast, type Toast } from '@/lib/toast-context'

// ─── Config par type ──────────────────────────────────────────────────────────

// Le conteneur des toasts vit dans le layout RACINE, hors `#main-content` :
// le pont de theme ne le couvre pas. D'ou des variantes `dark:` explicites.
// Semantique inchangee (vert succes / rouge erreur / ambre avertissement /
// bleu information) ; en sombre, fond profond et texte clair au lieu de
// l'inverse. Les icones et la barre de progression restent en nuances
// saturees, lisibles sur les deux fonds.
const TOAST_CONFIG = {
  success: {
    icon:      CheckCircle2,
    container: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-100',
    iconCls:   'text-green-500',
    bar:       'bg-green-400',
  },
  error: {
    icon:      XCircle,
    container: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-100',
    iconCls:   'text-red-500',
    bar:       'bg-red-400',
  },
  warning: {
    icon:      AlertTriangle,
    container: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100',
    iconCls:   'text-amber-500',
    bar:       'bg-amber-400',
  },
  info: {
    icon:      Info,
    container: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100',
    iconCls:   'text-blue-500',
    bar:       'bg-blue-400',
  },
} as const

// ─── Composant Toast individuel ───────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const cfg = TOAST_CONFIG[toast.type]
  const Icon = cfg.icon

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
        'w-96 rounded-xl border px-4 py-3 shadow-lg',
        'transition-all duration-200',
        cfg.container,
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3',
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

// ─── Conteneur global (top-center) ───────────────────────────────────────────

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}
