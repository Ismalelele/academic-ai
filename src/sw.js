// src/sw.js
import { precacheAndRoute } from 'workbox-precaching';

// Precaching automáticamente generado por Vite PWA
precacheAndRoute(self.__WB_MANIFEST);

let activeChatId = null;

const getAppAssetUrl = (assetPath) => {
  const scopeUrl = self.registration?.scope || self.location.origin;
  return new URL(assetPath, scopeUrl).toString();
};

const getNotificationIcon = () => getAppAssetUrl('/logo.png');
const getNotificationBadge = () => getAppAssetUrl('/badge.svg');

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_ACTIVE_CHAT') {
    activeChatId = event.data.id_grupo;
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const client = windowClients.find((c) => c.visibilityState === 'visible');
      if (client && 'focus' in client) {
        return client.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'AURA', body: 'Nueva notificación' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'AURA', body: event.data.text() };
    }
  }

  const notifType = data.data?.type || '';
  const isAcademicAlert = notifType.startsWith('academic_');

  const options = {
    body: data.body || data.message || '',
    icon: getNotificationIcon(),
    badge: getNotificationBadge(),
    vibrate: [200, 100, 200],
    data: data.data || {},
    requireInteraction: true,
    tag: data.tag || `aura-${notifType || 'general'}`,
  };

  if (isAcademicAlert) {
    event.waitUntil(self.registration.showNotification(data.title, options));
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const targetGroupId = data.data?.id_grupo;

      const isActiveInTargetChat = windowClients.some((client) => {
        try {
          const url = new URL(client.url);
          return (
            client.focused &&
            url.pathname.includes('/chats') &&
            activeChatId === targetGroupId
          );
        } catch {
          return false;
        }
      });

      if (isActiveInTargetChat) {
        return; // Suprimido: usuario activo en el chat
      }

      return self.registration.showNotification(data.title, options);
    })
  );
});