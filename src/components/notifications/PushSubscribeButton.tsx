'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { Bell, BellOff } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'

export default function PushSubscribeButton() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)

    // Vérifier si déjà abonné
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    })
  }, [])

  if (!supported) return null

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return null

  const handleToggle = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready

      if (subscribed) {
        // Désabonner
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/notifications/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setSubscribed(false)
      } else {
        // Demander la permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setLoading(false)
          return
        }

        // Enregistrer le service worker si pas encore fait
        await navigator.serviceWorker.register('/sw.js')

        // S'abonner
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })

        const subJson = sub.toJSON()
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        })
        setSubscribed(true)
      }
    } catch (e) {
      console.error('Push subscription error:', e)
    }
    setLoading(false)
  }

  return (
    <Tooltip content={subscribed ? 'Désactiver les notifications push' : 'Activer les notifications push'}>
      <button
        onClick={handleToggle}
        disabled={loading}
        aria-pressed={subscribed}
        aria-label={subscribed ? 'Désactiver les notifications push' : 'Activer les notifications push'}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:opacity-50',
          subscribed
            ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
            : 'bg-warm-100 text-warm-700 hover:bg-warm-200',
        )}
      >
        {subscribed ? <Bell size={14} /> : <BellOff size={14} />}
        {loading ? '...' : subscribed ? 'Notifications activées' : 'Activer les notifications'}
      </button>
    </Tooltip>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
