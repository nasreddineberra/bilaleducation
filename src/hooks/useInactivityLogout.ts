'use client'

import { useEffect, useRef, useCallback } from 'react'

const INACTIVITY_DELAY = 30 * 60 * 1000 // 30 minutes

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const

/**
 * Déconnecte automatiquement l'utilisateur après 30 minutes d'inactivité.
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
