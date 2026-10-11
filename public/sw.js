// Cartopia service worker: makes the game installable and shows push alerts
// ("jobs done", "fuel full") sent by netlify/functions/push-send.mts.
// Nothing is cached; the game always loads fresh from the network.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { body: e.data ? e.data.text() : '' }
  }
  e.waitUntil((async () => {
    const tag = data.tag || 'cartopia'
    await self.registration.showNotification(data.title || 'Cartopia', {
      body: data.body || 'Your town needs you!',
      icon: '/icons/icon-192.png',
      tag,
      data: { url: data.url || '/' },
    })
    // Someone is already playing: browsers insist every push shows something, so show it and take it straight down.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.some((c) => c.visibilityState === 'visible')) {
      for (const n of await self.registration.getNotifications({ tag })) n.close()
    }
  })())
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of wins) {
      if ('focus' in c) return c.focus()
    }
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || '/')
  })())
})
