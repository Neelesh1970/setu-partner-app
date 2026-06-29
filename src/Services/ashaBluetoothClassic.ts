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

/** Asha kit responses are not newline-terminated; empty delimiter streams the full buffer. */
export const ASHA_RFCOMM_OPTIONS: StandardOptions = {
  connectorType: 'rfcomm',
  connectionType: 'delimited',
  delimiter: '',
};

let cachedBluetoothModule: BluetoothModule | null = null;

/** Avoid importing the package default export — it crashes when the native module is null. */
export function isBluetoothClassicNativeLinked(): boolean {
  return Boolean(NativeModules.RNBluetoothClassic);
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
    if (device.address) {
      byAddress.set(device.address, device);
    }
  });
  return Array.from(byAddress.values());
}

export async function ensureAshaBluetoothReady(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isBluetoothClassicNativeLinked()) {
    return { ok: false, message: BLUETOOTH_CLASSIC_REBUILD_MESSAGE };
  }

  const granted = await requestBlePermissionsAndroid();
  if (!granted) {
    return { ok: false, message: 'Bluetooth permissions denied. Enable them in Settings.' };
  }

  const bluetooth = getBluetoothClassicModule();
  const available = await bluetooth.isBluetoothAvailable();
  if (!available) {
    return { ok: false, message: 'Bluetooth is not available on this device.' };
  }

  const enabled = await bluetooth.isBluetoothEnabled();
  if (!enabled) {
    if (Platform.OS === 'android') {
      const turnedOn = await bluetooth.requestBluetoothEnabled();
      if (!turnedOn) {
        return { ok: false, message: 'Please turn on Bluetooth to continue.' };
      }
    } else {
      return { ok: false, message: 'Please turn on Bluetooth to continue.' };
    }
  }

  return { ok: true };
}

export async function discoverClassicDevices(): Promise<BluetoothDevice[]> {
  const ready = await ensureAshaBluetoothReady();
  if (!ready.ok) {
    throw new Error(ready.message);
  }

  const bluetooth = getBluetoothClassicModule();
  const bonded = await bluetooth.getBondedDevices();

  if (Platform.OS !== 'android') {
    return bonded;
  }

  try {
    const discovered = await bluetooth.startDiscovery();
    await bluetooth.cancelDiscovery().catch(() => undefined);
    return mergeDevicesByAddress([...bonded, ...discovered]);
  } catch {
    return bonded;
  }
}

export async function saveClassicDeviceAddress(address: string): Promise<void> {
  await AsyncStorage.setItem(SAVED_DEVICE_ADDRESS_KEY, address.trim());
}

export async function getSavedClassicDeviceAddress(): Promise<string | null> {
  const address = await AsyncStorage.getItem(SAVED_DEVICE_ADDRESS_KEY);
  return address?.trim() || null;
}

export async function findClassicDeviceByAddress(
  address: string,
): Promise<BluetoothDevice | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const bluetooth = getBluetoothClassicModule();
  const bonded = await bluetooth.getBondedDevices();
  const fromBonded = bonded.find(device => device.address === trimmed);
  if (fromBonded) return fromBonded;

  try {
    const connected = await bluetooth.getConnectedDevices();
    return connected.find(device => device.address === trimmed) ?? null;
  } catch {
    return null;
  }
}

export async function connectClassicDevice(device: BluetoothDevice): Promise<boolean> {
  const alreadyConnected = await device.isConnected();
  if (alreadyConnected) {
    return true;
  }
  return device.connect(ASHA_RFCOMM_OPTIONS);
}

export async function disconnectClassicDevice(device: BluetoothDevice): Promise<void> {
  try {
    await device.disconnect();
  } catch {
    // ignore disconnect errors
  }
}

export function subscribeClassicDeviceData(
  device: BluetoothDevice,
  onData: (payload: string) => void,
): BluetoothEventSubscription {
  return device.onDataReceived(event => {
    const payload = String(event.data ?? '').trim();
    if (payload) {
      onData(payload);
    }
  });
}

export async function sendClassicDeviceCommand(
  device: BluetoothDevice,
  command: AshaDeviceCommand,
): Promise<boolean> {
  return device.write(command);
}

export function openClassicBluetoothSettings(): void {
  if (Platform.OS === 'android' && isBluetoothClassicNativeLinked()) {
    getBluetoothClassicModule().openBluetoothSettings();
  }
}
