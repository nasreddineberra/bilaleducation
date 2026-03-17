// Service Worker — Notifications push Bilal Education

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload = event.data.json()
    const title = payload.title || 'Bilal Education'
    const options = {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/dashboard/notifications' },
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch (e) {
    // Fallback texte brut
    const text = event.data.text()
    event.waitUntil(
      self.registration.showNotification('Bilal Education', { body: text })
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard/notifications'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
