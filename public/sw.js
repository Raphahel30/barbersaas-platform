const CACHE_NAME = 'barbersaas-static-v1'
const DATA_CACHE_NAME = 'barbersaas-data-v1'
const OFFLINE_URL = '/offline.html'

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/favicon.ico',
]

// 1. Instalação do Service Worker & Precache do fallback offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    }).then(() => self.skipWaiting())
  )
})

// 2. Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// 3. Interceptação de requisições com estratégias inteligentes
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requisições não GET ou extensões do navegador
  if (request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return
  }

  // Estratégia A: Navegações HTML (Páginas do PWA) -> Network-First com fallback Offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Salva cópia da página no cache dinâmico se for 200
          if (response.status === 200) {
            const responseClone = response.clone()
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(async () => {
          // Se offline, tenta resgatar a página já visitada do cache
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse

          // Fallback para a tela amigável offline
          const fallback = await caches.match(OFFLINE_URL)
          return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        })
    )
    return
  }

  // Estratégia B: Assets Estáticos (Imagens, Fontes, CSS, Chunks Next.js) -> Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2|ttf|css|js)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse

        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return networkResponse
        })
      })
    )
    return
  }

  // Estratégia C: APIs de Leitura (/api/tenant/*) -> Network-First com Fallback de Cache
  if (url.pathname.startsWith('/api/tenant/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone()
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Requisições normais
  event.respondWith(fetch(request))
})

// 4. WebPush API - Notificações Nativas no PWA (Android e iOS 16.4+)
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = {
      title: 'BarberSaaS',
      body: event.data.text(),
      url: '/',
    }
  }

  const options = {
    body: payload.body || 'Você tem uma nova notificação da barbearia.',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    vibrate: [150, 50, 150],
    data: {
      url: payload.url || '/',
    },
    actions: payload.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Barbearia', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

