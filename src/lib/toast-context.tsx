'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id:      string
  type:    ToastType
  message: string
}

interface ToastContextValue {
  toasts:      Toast[]
  addToast:    (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
  success:     (message: string) => void
  error:       (message: string) => void
  warning:     (message: string) => void
  info:        (message: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 10000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts]   = useState<Toast[]>([])
  const timersRef             = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    clearTimeout(timersRef.current.get(id))
    timersRef.current.delete(id)
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, type, message }])

    const timer = setTimeout(() => removeToast(id), AUTO_DISMISS_MS)
    timersRef.current.set(id, timer)
  }, [removeToast])

  const success = useCallback((msg: string) => addToast(msg, 'success'), [addToast])
  const error   = useCallback((msg: string) => addToast(msg, 'error'),   [addToast])
  const warning = useCallback((msg: string) => addToast(msg, 'warning'), [addToast])
  const info    = useCallback((msg: string) => addToast(msg, 'info'),    [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
