import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

/** Stack `navigate` used for lab IOT perform-test routing (avoids screen-specific navigation typing issues). */
export type LabIotRootStackNavigate =
  NativeStackNavigationProp<RootStackParamList>['navigate'];

/** Backend integration id for Setu pulse oximeter (same as legacy HomeScreen check). */
export const BACKEND_PULSE_OXIMETER_DEVICE_ID =
  '1b9b9ae7-74e5-4056-a0c2-754e7be8288e';
export const BACKEND_PULSE_OXIMETER_DEVICE_NAME = 'Pulse Oxymeter';

/** Backend integration id for BMI / smart scale flow → `ScaleDevice` screen. */
export const BACKEND_BMI_DEVICE_ID =
  'fedee681-6cfa-43a0-97e3-a297211074b9';
export const BACKEND_BMI_DEVICE_NAME = 'BMI';

/** Backend integration id for Auto Refractometer → `RemidioQRScanner` screen. */
export const BACKEND_AUTO_REFRACTOMETER_DEVICE_ID =
  'c8ddc832-b5d8-499b-89b0-f8364a203408';
export const BACKEND_AUTO_REFRACTOMETER_DEVICE_NAME = 'Auto Refractometer';

/** Backend integration id for NIBP / blood pressure → `BloodPressure` screen. */
export const BACKEND_NIBP_DEVICE_ID =
  '86a40bfb-c313-4d1d-8231-3349af35146b';
export const BACKEND_NIBP_DEVICE_NAME = 'NIBP';

export type LabIotPerformTestScreen = keyof Pick<
  RootStackParamList,
  'Oxymeter' | 'ScaleDevice' | 'RemidioQRScanner' | 'BloodPressure'
>;

function normalizeDeviceId(deviceId?: string | null): string {
  return (deviceId ?? '').trim().toLowerCase();
}

function normalizeDeviceName(deviceName?: string | null): string {
  return (deviceName ?? '').trim().toLowerCase();
}

/**
 * Maps backend device id/name (from booking / lab patient) to the in-app IOT screen
 * used for "Perform test", mirroring pulse oximeter behaviour.
 */
export function resolveLabIotPerformTestScreen(
  deviceId?: string | null,
  deviceName?: string | null,
): LabIotPerformTestScreen | null {
  const id = normalizeDeviceId(deviceId);
  const name = normalizeDeviceName(deviceName);

  if (
    id === BACKEND_PULSE_OXIMETER_DEVICE_ID ||
    name === BACKEND_PULSE_OXIMETER_DEVICE_NAME.toLowerCase()
  ) {
    return 'Oxymeter';
  }

  if (id === BACKEND_BMI_DEVICE_ID || name === BACKEND_BMI_DEVICE_NAME.toLowerCase()) {
    return 'ScaleDevice';
  }

  if (
    id === BACKEND_NIBP_DEVICE_ID ||
    name === BACKEND_NIBP_DEVICE_NAME.toLowerCase() ||
    name.includes('nibp')
  ) {
    return 'BloodPressure';
  }

  if (
    id === BACKEND_AUTO_REFRACTOMETER_DEVICE_ID ||
    name === BACKEND_AUTO_REFRACTOMETER_DEVICE_NAME.toLowerCase() ||
    name.includes('refractometer')
  ) {
    return 'RemidioQRScanner';
  }

  return null;
}

export function isLabIotPerformTestSupported(
  deviceId?: string | null,
  deviceName?: string | null,
): boolean {
  return resolveLabIotPerformTestScreen(deviceId, deviceName) !== null;
}

/**
 * Navigates to the correct IOT stack screen for the mapped device. Returns true if handled.
 *
 * `bookingItemId` (when known) is forwarded to flows that need to POST device-side results
 * keyed by booking line (e.g. Remidio Auto Refractometer QR results).
 * `bookingId` (when known) is forwarded to the Remidio flow for PDF report generation.
 * `isMultiDevice` signals that this test is part of a multi-device booking — the IOT screen
 * should skip the Generate PDF step and navigate back to DeviceSelectScreen after saving.
 */
export function applyLabIotPerformTestNavigation(
  navigate: LabIotRootStackNavigate,
  deviceId?: string | null,
  deviceName?: string | null,
  bookingItemId?: string | null,
  bookingId?: string | null,
  isMultiDevice?: boolean,
): boolean {
  const screen = resolveLabIotPerformTestScreen(deviceId, deviceName);
  if (!screen) {
    return false;
  }
  if (screen === 'Oxymeter') {
    navigate('Oxymeter', {
      deviceId: deviceId ?? null,
      deviceName: deviceName ?? null,
      bookingItemId: bookingItemId ?? null,
      bookingId: bookingId ?? null,
      isMultiDevice: isMultiDevice ?? false,
    });
    return true;
  }
  if (screen === 'ScaleDevice') {
    navigate('ScaleDevice', {
      deviceId: deviceId ?? null,
      bookingItemId: bookingItemId ?? null,
      bookingId: bookingId ?? null,
      isMultiDevice: isMultiDevice ?? false,
    });
    return true;
  }
  if (screen === 'BloodPressure') {
    navigate('BloodPressure', {
      deviceId: deviceId ?? null,
      deviceName: deviceName ?? null,
      bookingItemId: bookingItemId ?? null,
      bookingId: bookingId ?? null,
      isMultiDevice: isMultiDevice ?? false,
    });
    return true;
  }
  navigate('RemidioQRScanner', {
    deviceId: deviceId ?? null,
    deviceName: deviceName ?? null,
    bookingItemId: bookingItemId ?? null,
    bookingId: bookingId ?? null,
    isMultiDevice: isMultiDevice ?? false,
  });
  return true;
}
