// Local Expo module — Android only, no web/iOS build. Always import through
// lib/detect.js at the app level, never directly: the native module throws
// on requireNativeModule() in Expo Go, and lib/detect.js is what gates that
// (same pattern as lib/notifications.js's IS_EXPO_GO guard).
export { default } from './src/FloNotificationListenerModule';
export * from './src/FloNotificationListener.types';
