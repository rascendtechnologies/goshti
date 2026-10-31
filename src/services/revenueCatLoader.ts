import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import type { RcModule } from './revenueCatBilling';

/** The native purchases module, or null where it cannot work (web, Expo Go). */
export function loadRevenueCat(): RcModule | null {
  if (Platform.OS === 'web') return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null; // Expo Go
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases');
    return (mod.default ?? mod) as RcModule;
  } catch {
    return null;
  }
}
