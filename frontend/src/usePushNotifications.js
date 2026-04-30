import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Platform detection helpers ──────────────────────────────────
function getIsIos() {
  const ua = navigator.userAgent || '';
  return /iP(hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getIsInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function getIsSafariBrowser() {
  const ua = navigator.userAgent || '';
  // Safari but NOT Chrome/Firefox/Edge (which all contain "Safari" in their UA on iOS)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  return isSafari;
}

// ── Secure context check (HTTPS, localhost, or 127.0.0.1) ───────
function isSecureContext() {
  // window.isSecureContext is the browser's own check — covers HTTPS, localhost, 127.0.0.1, ::1
  if (window.isSecureContext) return true;
  // Fallback for older browsers
  const proto = window.location.protocol;
  const host = window.location.hostname;
  return proto === 'https:' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function usePushNotifications(rollno) {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  });

  // iOS / standalone / Safari detection
  const [isIos] = useState(getIsIos);
  const [isInStandaloneMode] = useState(getIsInStandaloneMode);
  const [isSafariBrowser] = useState(getIsSafariBrowser);

  // True when the user is on iOS but hasn't added to home screen yet
  const needsInstall = isIos && !isInStandaloneMode;

  useEffect(() => {
    if (!isSecureContext()) {
      console.warn('Push: Not a secure context (need HTTPS or localhost). Push disabled.');
      return;
    }
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      // Register/update service worker proactively
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then(() => navigator.serviceWorker.ready)
        .then(() => checkSubscription())
        .catch(err => console.warn('SW registration check failed:', err));
    }
  }, [rollno]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        setSubscription(sub);

        // Auto-sync: if a valid browser subscription exists AND we have a rollno,
        // ensure the DB always has an entry for this device.  This makes multi-device
        // robust — even if a previous 410 cleanup removed the row, the next page
        // load will re-register the endpoint so the user keeps getting notifications.
        if (sub && rollno) {
          const subJson = JSON.parse(JSON.stringify(sub));
          supabase
            .from('push_subscriptions')
            .upsert(
              { roll_number: rollno, endpoint: subJson.endpoint, subscription: subJson },
              { onConflict: 'roll_number,endpoint' }
            )
            .then(({ error: syncErr }) => {
              if (syncErr) console.warn('Push: DB auto-sync failed (non-fatal):', syncErr.message);
              else console.log('Push: Subscription auto-synced to DB for', rollno);
            });
        }
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  };

  const subscribe = async () => {
    // ── Guard: never request permission in Safari (non-PWA) ──
    // Safari ignores the push permission prompt unless running as an installed PWA.
    // Requesting it wastes the one-time prompt opportunity.
    if (isSafariBrowser && !isInStandaloneMode) {
      const msg = isIos
        ? 'Add this site to your Home Screen first, then enable notifications from there.'
        : 'Push notifications require the app to be installed. Add to Home Screen first.';
      setError(msg);
      console.warn('Push: blocked permission request in Safari (not standalone).', msg);
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Ensure service worker is registered and active
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        console.log('Push: Service worker registered fresh.');
      }
      const activeReg = await navigator.serviceWorker.ready;
      console.log('Push: Service worker active, scope:', activeReg.scope);

      // 2. Request notification permission
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
        setPermissionStatus(permission);
      }

      if (permission !== 'granted') {
        throw new Error('Notification permission denied. Check your browser settings.');
      }

      // 3. Get VAPID key
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        throw new Error('VITE_VAPID_PUBLIC_KEY is not set in environment.');
      }
      const applicationServerKey = urlBase64ToUint8Array(publicVapidKey);

      // 4. Clean up any existing stale subscription before creating a new one
      //    This fixes "Registration failed - push service error" caused by
      //    leftover subscriptions from previous VAPID keys or corrupted state.
      let sub = await activeReg.pushManager.getSubscription();
      if (sub) {
        try {
          // Test if the existing subscription is still valid by checking its key
          const existingKey = sub.options?.applicationServerKey;
          const existingKeyArray = existingKey ? new Uint8Array(existingKey) : null;

          // Compare keys — if they differ, the old sub is stale and must go
          let keysMatch = false;
          if (existingKeyArray && existingKeyArray.length === applicationServerKey.length) {
            keysMatch = existingKeyArray.every((byte, i) => byte === applicationServerKey[i]);
          }

          if (keysMatch) {
            // Existing subscription is good — reuse it
            console.log('Push: Reusing existing valid subscription.');
          } else {
            // Keys don't match or can't be read — nuke the old sub
            console.warn('Push: Stale subscription detected (key mismatch). Cleaning up...');
            await sub.unsubscribe();
            sub = null;
          }
        } catch (keyCheckErr) {
          // Can't inspect the old sub — just nuke it to be safe
          console.warn('Push: Could not verify existing subscription. Cleaning up...', keyCheckErr);
          try { await sub.unsubscribe(); } catch (_) { /* ignore */ }
          sub = null;
        }
      }

      // 5. Create new subscription if needed
      if (!sub) {
        console.log('Push: Creating new push subscription...');
        console.log('Push: applicationServerKey length:', applicationServerKey.length, '(expect 65)');
        try {
          sub = await activeReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
          });
        } catch (subErr) {
          if (subErr.name === 'AbortError') {
            // Stale push registration (e.g. leftover from old gcm_sender_id or different VAPID key).
            // Nuclear cleanup: unregister everything, re-register fresh, and retry once.
            console.warn('Push: AbortError — nuking stale SW registrations and retrying...');

            // 5a. Unsubscribe any lingering push subscription
            try {
              const staleSub = await activeReg.pushManager.getSubscription();
              if (staleSub) await staleSub.unsubscribe();
            } catch (_) { /* ignore */ }

            // 5b. Unregister ALL service workers for this origin
            const allRegs = await navigator.serviceWorker.getRegistrations();
            for (const r of allRegs) {
              await r.unregister();
            }
            console.log('Push: All SWs unregistered. Re-registering...');

            // 5c. Re-register and wait for activation
            await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
            const freshReg = await navigator.serviceWorker.ready;
            console.log('Push: Fresh SW active, scope:', freshReg.scope);

            // 5d. Retry subscribe
            sub = await freshReg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: applicationServerKey
            });
            console.log('Push: Subscription created after cleanup!');
          } else {
            throw subErr;
          }
        }
        if (sub) {
          console.log('Push: Subscription created successfully!', sub.endpoint);
        }
      }

      // 6. Save to state and database
      setSubscription(sub);
      if (rollno && sub) {
        const subJson = JSON.parse(JSON.stringify(sub));
        const { error: dbErr } = await supabase
          .from('push_subscriptions')
          .upsert({
            roll_number: rollno,
            endpoint: subJson.endpoint,
            subscription: subJson
          }, { onConflict: 'roll_number,endpoint' });
        if (dbErr) {
          console.warn('Push: DB upsert failed (non-fatal):', dbErr.message);
        }
      }
      console.log('Push: Subscription flow complete!');
      return true;
    } catch (err) {
      const friendlyMsg = err.name === 'AbortError'
        ? 'Push service error. Please clear this site\'s data in browser settings (Settings → Site Settings → Clear Data) and reload.'
        : err.message;
      setError(friendlyMsg);
      console.error('Push registration error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      let currentEndpoint = null;
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          currentEndpoint = sub.endpoint;
          await sub.unsubscribe();
        }
      }
      setSubscription(null);
      if (rollno && currentEndpoint) {
        // Only remove THIS device's subscription — never touch other devices
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('roll_number', rollno)
          .eq('endpoint', currentEndpoint);
      }
      // NOTE: if we can't identify the endpoint we do nothing.
      // Deleting ALL subscriptions would nuke notifications on the user's other devices.
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Push unregistration error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupported,
    permissionStatus,
    subscription,
    subscribe,
    unsubscribe,
    loading,
    error,
    // iOS / PWA awareness
    isIos,
    isInStandaloneMode,
    isSafariBrowser,
    needsInstall,
  };
}
