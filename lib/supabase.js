import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import { createClient } from '@supabase/supabase-js';

// AsyncStorage is a plain unencrypted file/SQLite store — fine for most
// data, but the Supabase session includes a long-lived refresh token that
// can mint new access tokens indefinitely until revoked, so it shouldn't
// sit in plaintext on disk. SecureStore (iOS Keychain / Android Keystore)
// is encrypted at rest but has a small per-item size limit that a full
// session blob can exceed. This is Supabase's own documented pattern for
// Expo/React Native: the (large) session is AES-encrypted and stored in
// AsyncStorage; only the small encryption key lives in SecureStore, so the
// AsyncStorage blob is useless without it.
class LargeSecureStore {
  async _encrypt(key, value) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  async _decrypt(key, value) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return encrypted;
    }

    return this._decrypt(key, encrypted);
  }

  async removeItem(key) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key, value) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // flowType deliberately left at the default ('implicit'). PKCE was tried
    // (for the Google sign-in fix) and REVERTED 2026-07-22: PKCE derives its
    // code challenge with SHA-256, which needs the WebCrypto API
    // (crypto.subtle) — React Native doesn't have it (react-native-get-random-
    // values polyfills only crypto.getRandomValues, not crypto.subtle), so
    // auth-js fell back to the `plain` challenge method and logged a warning on
    // every launch ("WebCrypto API is not supported. Code challenge method
    // will default to use plain instead of sha256"). `plain` gives up most of
    // PKCE's benefit, so PKCE bought nothing here. The actual Google sign-in
    // fix is in AuthContext.signInWithGoogle, which parses the OAuth redirect
    // with QueryParams.getQueryParams (reads BOTH the query string and the URL
    // HASH FRAGMENT) — implicit flow returns access/refresh tokens in the hash,
    // which that handles via setSession. So implicit + robust parsing works
    // with no warning; PKCE was never needed.
  },
});
