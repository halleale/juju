import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupportedStorage } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
/** The project's publishable key (or legacy anon key). Safe to ship in the app; RLS protects the data. */
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** No-op storage for the static web render, where there is no window. */
const memoryStorage: SupportedStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const storage = Platform.OS === 'web' && typeof window === 'undefined' ? memoryStorage : AsyncStorage;

/** Null when the app runs without a Supabase project (local demo mode). */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, lock: processLock },
      })
    : null;

// Refresh tokens only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
