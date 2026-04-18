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

export function usePushNotifications(rollno) {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Push subscriptions require HTTPS. Skip silently on plain HTTP (local dev).
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      return;
    }

    // Only attempt if the user is logged in and the browser supports push
    if (!rollno) return;

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      registerAndSubscribe();
    }
  }, [rollno]);

  const registerAndSubscribe = async () => {
    try {
      // Register service worker if not already registered
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }

      // Wait for the SW to be active before using pushManager
      await navigator.serviceWorker.ready;

      // Automatically request permission if not granted
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      // If permission is denied, exit
      if (permission !== 'granted') {
        setError('Notification permission denied');
        return;
      }

      // Use the active registration from serviceWorker.ready
      const activeRegistration = await navigator.serviceWorker.ready;

      // Check current subscription
      let sub = await activeRegistration.pushManager.getSubscription();
      
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!sub) {
        if (!publicVapidKey) {
          console.warn("VITE_VAPID_PUBLIC_KEY is not defined — push notifications disabled.");
          return;
        }

        // Create new subscription
        sub = await activeRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }

      setSubscription(sub);
      
      // Upsert subscription to Supabase
      if (rollno && sub) {
        const { error: dbError } = await supabase
          .from('push_subscriptions')
          .upsert({
            roll_number: rollno,
            subscription: JSON.parse(JSON.stringify(sub))
          }, { onConflict: 'roll_number' });

        if (dbError) {
          console.error("Supabase upsert error:", dbError);
          // Non-fatal — don't surface this to the user
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        // Push service unavailable (no HTTPS, network issue, or browser restriction on localhost)
        console.warn('Push notifications unavailable in this environment:', err.message);
      } else {
        console.error('Push registration error:', err);
      }
      setError(err.message);
    }
  };

  return { isSupported, subscription, error };
}
