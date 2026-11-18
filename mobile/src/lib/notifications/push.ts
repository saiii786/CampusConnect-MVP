/**
 * Push notifications (FR-551) via Expo's free push service.
 *
 * Works only in a real app build (EAS development/preview/production build) that has an EAS
 * project id — NOT in Expo Go (Android Expo Go dropped remote push in SDK 53). In Expo Go, or
 * before the EAS project exists (Phase 10), `registerForPush()` quietly does nothing; in-app
 * notifications and the live socket still work.
 *
 * expo-notifications is imported lazily so Expo Go never loads its push code.
 */
import type { NotificationLink } from '@cc/shared';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { api } from '@/lib/api/client';
import { session } from '@/lib/auth/session';
import { hrefForLink } from './notifications-api';

let registeredToken: string | null = null;
let tapSubscription: { remove: () => void } | null = null;

export function pushSupported(): boolean {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && Platform.OS !== 'web' && !!projectId;
}

/** Ask permission (once), get this device's Expo push token and send it to the API. */
export async function registerForPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'CampusConnect', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    // Tapping a push opens the related screen (order, chat, wallet…).
    tapSubscription?.remove();
    tapSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = (response.notification.request.content.data as { link?: NotificationLink | null } | undefined)?.link ?? null;
      const href = hrefForLink(link);
      if (href) router.push(href);
    });

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.post('/me/push-tokens', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    registeredToken = token;
  } catch (error) {
    console.warn('Push registration failed', error);
  }
}

/** On sign-out: stop pushes to this device for this account (best effort). */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await api.delete('/me/push-tokens', { body: { token } });
  } catch {
    // ignore — the server also drops tokens Expo reports as unregistered
  }
}

session.addSignOutHook(unregisterPush);
