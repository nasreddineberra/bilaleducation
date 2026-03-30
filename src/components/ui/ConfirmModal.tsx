'use client'

import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { FloatButton } from '@/components/ui/FloatFields'

export interface ConfirmModalProps {
  open:           boolean
  message:        string
  title?:         string
  confirmLabel?:  string
  cancelLabel?:   string
  variant?:       'danger' | 'warning'
  onConfirm:      () => void
  onCancel:       () => void
}

export default function ConfirmModal({
  open, message, title, confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  variant = 'warning', onConfirm, onCancel,
}: ConfirmModalProps) {
  // Fermer sur Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={16}
              className={isDanger ? 'text-red-500' : 'text-amber-500'}
            />
            <h3 className="text-sm font-bold text-secondary-800">
              {title ?? (isDanger ? 'Confirmer la suppression' : 'Confirmation')}
            </h3>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-warm-100 text-warm-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-warm-700 whitespace-pre-line">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-warm-100">
          <FloatButton variant="secondary" type="button" onClick={onCancel}>
            {cancelLabel}
          </FloatButton>
          <FloatButton
            variant={isDanger ? 'danger' : 'edit'}
            type="button"
            onClick={() => { onConfirm(); onCancel() }}
          >
            {confirmLabel}
          </FloatButton>
        </div>
      </div>
    </div>
  )
}
