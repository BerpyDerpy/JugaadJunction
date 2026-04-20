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
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  });

  useEffect(() => {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      return;
    }
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, [rollno]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        setSubscription(sub);
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  };

  const subscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
      await navigator.serviceWorker.ready;

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
        setPermissionStatus(permission);
      }

      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const activeRegistration = await navigator.serviceWorker.ready;
      let sub = await activeRegistration.pushManager.getSubscription();
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!sub) {
        if (!publicVapidKey) {
          throw new Error("VITE_VAPID_PUBLIC_KEY is not defined");
        }
        sub = await activeRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }

      setSubscription(sub);
      if (rollno && sub) {
        await supabase
          .from('push_subscriptions')
          .upsert({
            roll_number: rollno,
            subscription: JSON.parse(JSON.stringify(sub))
          }, { onConflict: 'roll_number' });
      }
      return true;
    } catch (err) {
      setError(err.message);
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
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      }
      setSubscription(null);
      if (rollno) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('roll_number', rollno);
      }
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Push unregistration error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { isSupported, permissionStatus, subscription, subscribe, unsubscribe, loading, error };
}
