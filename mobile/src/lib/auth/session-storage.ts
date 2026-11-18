/**
 * Persists the session across app restarts (FR-002) in the device's secure storage
 * (iOS Keychain / Android Keystore via expo-secure-store). Only the REFRESH token is stored;
 * the short-lived access token lives in memory and is re-obtained on start-up.
 *
 * Never use AsyncStorage for tokens: it is unencrypted.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'cc.session.v1';

export interface StoredSession {
  refreshToken: string;
}

export interface SessionStorage {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

export const secureSessionStorage: SessionStorage = {
  async load() {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      return typeof parsed.refreshToken === 'string' && parsed.refreshToken ? { refreshToken: parsed.refreshToken } : null;
    } catch {
      return null; // corrupted entry → treat as signed out
    }
  },
  async save(session) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  },
  async clear() {
    await SecureStore.deleteItemAsync(KEY);
  },
};
