// ── Jugaad Junction Service Worker ──────────────────────────────

// Activate immediately — don't wait for old tabs to close
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

// Claim all clients immediately on activation
self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});

// ── Push notification handler ──────────────────────────────────
self.addEventListener('push', function (event) {
  console.log("🔥 PUSH EVENT RECEIVED", event.data ? 'has data' : 'NO DATA');

  // Parse payload — handle empty / non-JSON payloads from DevTools too
  let data = {};
  try {
    if (event.data) {
      const raw = event.data.text();
      console.log("📦 Raw push payload:", raw);
      if (raw && raw.trim().startsWith('{')) {
        data = JSON.parse(raw);
      } else {
        data = { body: raw || 'You have a new notification.' };
      }
    }
  } catch (e) {
    console.warn("⚠️ Push payload parse error:", e);
    data = {};
  }

  const title = data.title || 'Jugaad Junction';
  const body  = data.body  || 'You have a new notification.';

  const options = {
    body,
    vibrate: [100, 50, 100],
    tag: data.tag || 'jugaad-notification',
    renotify: true,
    data: {
      dateOfArrival: Date.now(),
      url: data.url || '/',
    },
  };

  // Only add icon/badge if it actually exists — a missing file silently
  // kills the notification on Chrome without any error message.
  // Swap these in once you have a proper PNG icon at /icon-192.png
  // options.icon  = '/icon-192.png';
  // options.badge = '/icon-192.png';

  console.log("📣 Calling showNotification:", title, options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log("✅ showNotification resolved successfully"))
      .catch(err => console.error("❌ showNotification FAILED:", err))
  );
});

// ── Notification click handler ─────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
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
