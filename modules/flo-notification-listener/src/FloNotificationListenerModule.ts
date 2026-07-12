import { requireNativeModule } from 'expo';

import { DetectedNotification, DetectionDebugEntry } from './FloNotificationListener.types';

declare class FloNotificationListenerModule {
  hasNotificationAccess(): boolean;
  openNotificationAccessSettings(): void;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  getAllowedPackages(): string[];
  setAllowedPackages(packages: string[]): void;
  drainDetections(): DetectedNotification[];
  getDebugLog(): DetectionDebugEntry[];
  clearDebugLog(): void;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<FloNotificationListenerModule>('FloNotificationListener');
