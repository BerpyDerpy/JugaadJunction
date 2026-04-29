// ── Jugaad Junction Service Worker ──────────────────────────────

// Activate immediately — don't wait for old tabs to close
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Claim all clients immediately on activation
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

// ── Push notification handler ──────────────────────────────────
self.addEventListener('push', function(event) {
  if (event.data) {
    let data;
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Jugaad Junction Notification', body: event.data.text() };
    }
    
    const options = {
      body: data.body,
      icon: '/jj-icon.svg',
      badge: '/jj-icon.svg',
      vibrate: [100, 50, 100],
      tag: data.tag || 'jugaad-notification',
      renotify: true,
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/',
        primaryKey: '2'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Jugaad Junction Notification', options)
    );
  }
});

// ── Notification click handler ─────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to focus an existing window
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
