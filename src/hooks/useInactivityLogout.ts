'use client'

import { useEffect, useRef, useCallback } from 'react'
import { INACTIVITY_MS as INACTIVITY_DELAY } from '@/lib/session-config'

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const

/**
 * Déconnecte automatiquement l'utilisateur après la fenêtre d'inactivité
 * (20 minutes — voir `INACTIVITY_SECONDS`, source unique partagée avec le
 * middleware : les deux doivent tomber ensemble).
 * @param onLogout - Callback appelé à l'expiration du délai
 */
export function useInactivityLogout(onLogout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onLogoutRef = useRef(onLogout)
  onLogoutRef.current = onLogout

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onLogoutRef.current()
    }, INACTIVITY_DELAY)
  }, [])

  useEffect(() => {
    resetTimer()

    ACTIVITY_EVENTS.forEach(event =>
      window.addEventListener(event, resetTimer, { passive: true })
    )

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach(event =>
        window.removeEventListener(event, resetTimer)
      )
    }
  }, [resetTimer])
}
