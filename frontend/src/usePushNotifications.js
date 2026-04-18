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

      // Check current subscription
      let sub = await registration.pushManager.getSubscription();
      
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!sub) {
        if (!publicVapidKey) {
          console.error("VITE_VAPID_PUBLIC_KEY is not defined in .env");
          return;
        }

        // Create new subscription
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }

      setSubscription(sub);
      
      // Upsert subscription to Supabase if we have a rollno
      if (rollno && sub) {
        const { error: dbError } = await supabase
          .from('push_subscriptions')
          .upsert({
            roll_number: rollno,
            subscription: JSON.parse(JSON.stringify(sub))
          }, { onConflict: 'roll_number' });

        if (dbError) {
          console.error("Supabase upsert error:", dbError);
          setError(dbError.message);
        }
      }

    } catch (err) {
      console.error('Push registration error:', err);
      setError(err.message);
    }
  };

  return { isSupported, subscription, error };
}
