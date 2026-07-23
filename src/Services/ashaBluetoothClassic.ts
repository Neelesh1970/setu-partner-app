import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import BluetoothModule from 'react-native-bluetooth-classic/lib/BluetoothModule';
import type {
  BluetoothDevice,
  BluetoothEventSubscription,
  StandardOptions,
} from 'react-native-bluetooth-classic';
import { requestBlePermissionsAndroid } from '../Utils/requestBlePermissionsAndroid';

export type AshaDeviceCommand = 'g' | 'm' | 'e' | 's' | 'q' | 't' | 'x' | 'b' | 'p' | 'r';

const SAVED_DEVICE_ADDRESS_KEY = 'asha_saved_bluetooth_device_address';

export const BLUETOOTH_CLASSIC_REBUILD_MESSAGE =
  'Bluetooth Classic native module is not linked. Stop Metro, rebuild the app with: npx react-native run-android';

/**
 * Dual-SPP / ASHA kits typically use insecure RFCOMM.
 * Empty delimiter streams full buffers (needed for ECG / steth binary).
 * Native option code is `secure` (see StandardOption.SECURE_SOCKET).
 */
export const ASHA_RFCOMM_OPTIONS = {
  connectorType: 'rfcomm',
  connectionType: 'delimited',
  delimiter: '',
  charset: 'ascii',
  secureSocket: false,
  secure: false,
} as StandardOptions;

const ASHA_RFCOMM_OPTIONS_SECURE = {
  ...ASHA_RFCOMM_OPTIONS,
  secureSocket: true,
  secure: true,
} as StandardOptions;

let cachedBluetoothModule: BluetoothModule | null = null;

function logBt(context: string, detail?: unknown): void {
  try {
    console.log('[ASHA BT]', context, detail ?? '');
  } catch {
    // never throw from logger
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === 'object') {
    const maybe = error as { message?: unknown; code?: unknown };
    if (typeof maybe.message === 'string' && maybe.message.trim()) {
      return maybe.message.trim();
    }
    if (maybe.code != null) {
      return `${fallback} (${String(maybe.code)})`;
    }
  }
  return fallback;
}

/** Run a native BT promise; never let raw native failures escape uncaught. */
async function safeBtCall<T>(
  label: string,
  action: () => Promise<T>,
  fallback: T,
): Promise<{ ok: true; value: T } | { ok: false; message: string; value: T }> {
  try {
    const value = await action();
    return { ok: true, value };
  } catch (error) {
    const message = toErrorMessage(error, `${label} failed`);
    logBt(`${label} error`, message);
    return { ok: false, message, value: fallback };
  }
}

/** Avoid importing the package default export — it crashes when the native module is null. */
export function isBluetoothClassicNativeLinked(): boolean {
  try {
    return Boolean(NativeModules.RNBluetoothClassic);
  } catch {
    return false;
  }
}

function getBluetoothClassicModule(): BluetoothModule {
  if (cachedBluetoothModule) {
    return cachedBluetoothModule;
  }

  const nativeModule = NativeModules.RNBluetoothClassic;
  if (!nativeModule) {
    throw new Error(BLUETOOTH_CLASSIC_REBUILD_MESSAGE);
  }

  cachedBluetoothModule = new BluetoothModule(nativeModule);
  return cachedBluetoothModule;
}

function mergeDevicesByAddress(devices: BluetoothDevice[]): BluetoothDevice[] {
  const byAddress = new Map<string, BluetoothDevice>();
  devices.forEach(device => {
    if (device?.address) {
      byAddress.set(device.address, device);
    }
  });
  return Array.from(byAddress.values());
}

/** Cancel discovery before RFCOMM connect — discovery+connect crashes on many OEMs (incl. Xiaomi). */
export async function cancelClassicDiscovery(): Promise<void> {
  if (!isBluetoothClassicNativeLinked()) {
    return;
  }
  try {
    const bluetooth = getBluetoothClassicModule();
    await bluetooth.cancelDiscovery();
    logBt('cancelDiscovery ok');
  } catch (error) {
    logBt('cancelDiscovery ignored', toErrorMessage(error, 'cancelDiscovery failed'));
  }
}

export async function ensureAshaBluetoothReady(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!isBluetoothClassicNativeLinked()) {
      return { ok: false, message: BLUETOOTH_CLASSIC_REBUILD_MESSAGE };
    }

    const granted = await requestBlePermissionsAndroid();
    if (!granted) {
      return { ok: false, message: 'Bluetooth permissions denied. Enable them in Settings.' };
    }

    const bluetooth = getBluetoothClassicModule();

    const availableResult = await safeBtCall(
      'isBluetoothAvailable',
      () => bluetooth.isBluetoothAvailable(),
      false,
    );
    if (!availableResult.ok) {
      return { ok: false, message: availableResult.message };
    }
    if (!availableResult.value) {
      return { ok: false, message: 'Bluetooth is not available on this device.' };
    }

    const enabledResult = await safeBtCall(
      'isBluetoothEnabled',
      () => bluetooth.isBluetoothEnabled(),
      false,
    );
    if (!enabledResult.ok) {
      return { ok: false, message: enabledResult.message };
    }
    if (!enabledResult.value) {
      if (Platform.OS === 'android') {
        const turnedOn = await safeBtCall(
          'requestBluetoothEnabled',
          () => bluetooth.requestBluetoothEnabled(),
          false,
        );
        if (!turnedOn.ok || !turnedOn.value) {
          return { ok: false, message: 'Please turn on Bluetooth to continue.' };
        }
      } else {
        return { ok: false, message: 'Please turn on Bluetooth to continue.' };
      }
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: toErrorMessage(error, 'Bluetooth setup failed'),
    };
  }
}

export async function discoverClassicDevices(): Promise<BluetoothDevice[]> {
  const ready = await ensureAshaBluetoothReady();
  if (!ready.ok) {
    throw new Error(ready.message);
  }

  const bluetooth = getBluetoothClassicModule();
  const bondedResult = await safeBtCall(
    'getBondedDevices',
    () => bluetooth.getBondedDevices(),
    [] as BluetoothDevice[],
  );
  const bonded = bondedResult.value ?? [];

  if (Platform.OS !== 'android') {
    return bonded;
  }

  try {
    const discovered = await bluetooth.startDiscovery();
    await cancelClassicDiscovery();
    return mergeDevicesByAddress([...bonded, ...(discovered ?? [])]);
  } catch (error) {
    logBt('startDiscovery failed — using bonded only', toErrorMessage(error, 'discovery failed'));
    await cancelClassicDiscovery();
    return bonded;
  }
}

export async function saveClassicDeviceAddress(address: string): Promise<void> {
  await AsyncStorage.setItem(SAVED_DEVICE_ADDRESS_KEY, address.trim());
}

export async function getSavedClassicDeviceAddress(): Promise<string | null> {
  try {
    const address = await AsyncStorage.getItem(SAVED_DEVICE_ADDRESS_KEY);
    return address?.trim() || null;
  } catch {
    return null;
  }
}

export async function findClassicDeviceByAddress(
  address: string,
): Promise<BluetoothDevice | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  try {
    if (!isBluetoothClassicNativeLinked()) {
      return null;
    }

    const bluetooth = getBluetoothClassicModule();
    const bondedResult = await safeBtCall(
      'getBondedDevices',
      () => bluetooth.getBondedDevices(),
      [] as BluetoothDevice[],
    );
    const fromBonded = (bondedResult.value ?? []).find(device => device.address === trimmed);
    if (fromBonded) {
      logBt('found bonded device', trimmed);
      return fromBonded;
    }

    const connectedResult = await safeBtCall(
      'getConnectedDevices',
      () => bluetooth.getConnectedDevices(),
      [] as BluetoothDevice[],
    );
    return (connectedResult.value ?? []).find(device => device.address === trimmed) ?? null;
  } catch (error) {
    logBt('findClassicDeviceByAddress failed', toErrorMessage(error, 'lookup failed'));
    return null;
  }
}

async function tryConnectWithOptions(
  device: BluetoothDevice,
  options: StandardOptions,
  label: string,
): Promise<boolean> {
  logBt(`connect attempt (${label})`, { address: device.address, options });
  const result = await safeBtCall(
    `device.connect:${label}`,
    () => device.connect(options),
    false,
  );
  if (result.ok && result.value) {
    logBt(`connect success (${label})`, device.address);
    return true;
  }
  logBt(`connect failed (${label})`, result.ok ? 'returned false' : result.message);
  return false;
}

/**
 * Connect RFCOMM to Dual-SPP.
 * Always cancels discovery first. Tries insecure then secure.
 * Never force-crashes the JS thread — failures resolve to false / throw Error strings only.
 */
export async function connectClassicDevice(device: BluetoothDevice): Promise<boolean> {
  if (!device?.address) {
    throw new Error('Invalid Bluetooth device (missing address).');
  }

  try {
    const connectedCheck = await safeBtCall(
      'isConnected',
      () => device.isConnected(),
      false,
    );
    if (connectedCheck.ok && connectedCheck.value) {
      logBt('already connected — skip reconnect', device.address);
      return true;
    }

    await cancelClassicDiscovery();
    // Brief pause so the adapter releases discovery locks (Xiaomi / MIUI).
    await new Promise<void>(resolve => setTimeout(resolve, 250));

    const insecureOk = await tryConnectWithOptions(device, ASHA_RFCOMM_OPTIONS, 'insecure');
    if (insecureOk) {
      return true;
    }

    await cancelClassicDiscovery();
    await new Promise<void>(resolve => setTimeout(resolve, 200));

    const secureOk = await tryConnectWithOptions(
      device,
      ASHA_RFCOMM_OPTIONS_SECURE,
      'secure',
    );
    if (secureOk) {
      return true;
    }

    return false;
  } catch (error) {
    const message = toErrorMessage(error, 'Bluetooth connect failed');
    logBt('connectClassicDevice fatal-guard', message);
    throw new Error(message);
  }
}

export async function disconnectClassicDevice(device: BluetoothDevice): Promise<void> {
  if (!device?.address) {
    return;
  }
  try {
    await cancelClassicDiscovery();
    await device.disconnect();
    logBt('disconnect ok', device.address);
  } catch (error) {
    logBt('disconnect ignored', toErrorMessage(error, 'disconnect failed'));
  }
}

export function subscribeClassicDeviceData(
  device: BluetoothDevice,
  onData: (payload: string) => void,
): BluetoothEventSubscription {
  return device.onDataReceived(event => {
    try {
      const raw = event?.data;
      if (raw === null || raw === undefined) return;
      const payload = typeof raw === 'string' ? raw : String(raw);
      if (!payload.length) return;
      onData(payload);
    } catch (error) {
      logBt('onDataReceived handler error', toErrorMessage(error, 'data handler failed'));
    }
  });
}

export async function sendClassicDeviceCommand(
  device: BluetoothDevice,
  command: AshaDeviceCommand,
): Promise<boolean> {
  try {
    const result = await safeBtCall(
      `write:${command}`,
      () => device.write(command),
      false,
    );
    return result.ok ? Boolean(result.value) : false;
  } catch (error) {
    logBt('sendClassicDeviceCommand failed', toErrorMessage(error, 'write failed'));
    return false;
  }
}

export function openClassicBluetoothSettings(): void {
  try {
    if (Platform.OS === 'android' && isBluetoothClassicNativeLinked()) {
      getBluetoothClassicModule().openBluetoothSettings();
    }
  } catch (error) {
    logBt('openBluetoothSettings failed', toErrorMessage(error, 'settings failed'));
  }
}
