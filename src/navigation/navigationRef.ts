import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Global ref for navigation actions that happen outside React components (e.g. axios 401 → logout).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
