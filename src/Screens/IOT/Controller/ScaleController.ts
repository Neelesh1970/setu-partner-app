import { BleManager, Device, type State, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const manager = new BleManager();

export function subscribeScaleBleState(onState: (state: State) => void): Subscription {
  void manager.state().then(s => onState(s));
  return manager.onStateChange(state => {
    onState(state);
  });
}

export const getScaleBleState = (): Promise<State> => manager.state();

/**
 * QN-SCALE GATT (nRF Connect): NOTIFY 0xFFF1 + WRITE 0xFFF2 live under service 0xFFF0 — not under 00010203…1912
 * (that long service exposes a different char, e.g. …2b12).
 */
const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const NOTIFY_CHAR = '0000fff1-0000-1000-8000-00805f9b34fb';
const WRITE_CHAR = '0000fff2-0000-1000-8000-00805f9b34fb';

/** Normalized 128-bit UUID for 0xFFF0 (compare advertising `serviceUUIDs` across OS quirks). */
const FFF0_UUID_NORMALIZED = '0000fff00000100080008005f9b34fb';

function normalizedUuid(u: string): string {
  return u.toLowerCase().replace(/-/g, '');
}

function isAdvertisedScaleService(device: Device): boolean {
  const uuids = device.serviceUUIDs;
  if (!uuids?.length) return false;
  return uuids.some(u => normalizedUuid(u) === FFF0_UUID_NORMALIZED);
}

/** Advertised name varies by stack (spaces, hyphen, only localName). */
function isQNScaleDevice(device: Device): boolean {
  const combined = `${device.name ?? ''} ${device.localName ?? ''}`;
  if (/QN[\s_-]*SCALE/i.test(combined)) return true;
  const collapsed = combined.toUpperCase().replace(/\s+/g, '');
  if (collapsed.includes('QNSCALE')) return true;
  return isAdvertisedScaleService(device);
}

function displayNameForScale(device: Device): string {
  return (device.name || device.localName || '').trim() || 'QN-SCALE';
}

let notifySubscription: Subscription | null = null;
let deviceDisconnectSub: Subscription | null = null;
/** Bumped on every teardown so stale notify callbacks exit immediately (scale off / left screen). */
let bleNotifyGeneration = 0;

/** Suppress identical notify spam in Metro (same payload repeating). */
let lastNotifyHex = '';
let lastNotifyHexAt = 0;

function teardownScaleCharacteristicSession(): void {
  bleNotifyGeneration += 1;
  if (notifySubscription) {
    notifySubscription.remove();
    notifySubscription = null;
  }
  if (deviceDisconnectSub) {
    deviceDisconnectSub.remove();
    deviceDisconnectSub = null;
  }
}

/** Stop an in-progress device scan (e.g. when leaving the scale screen). */
export const stopScaleBleScan = (): void => {
  try {
    manager.stopDeviceScan();
  } catch {
    /* noop */
  }
};

/**
 * 🔍 Scan Devices
 */
export const scanDevices = (
  setDevices: (fn: any) => void,
  onFinish?: () => void,
  onScanError?: (error: unknown) => void
) => {
  let completed = false;
  const finish = (notify = true) => {
    if (completed) return;
    completed = true;
    try {
      manager.stopDeviceScan();
    } catch {
      /* already stopped */
    }
    console.log('🛑 Scan stopped');
    if (notify) {
      onFinish?.();
    }
  };

  try {
    manager.stopDeviceScan();
  } catch {
    /* no active scan */
  }

  console.log('🔍 Scale BLE scan started (5s, all advertisers, allowDuplicates)');

  manager.startDeviceScan(
    null,
    { allowDuplicates: true },
    (error, device) => {
    if (error) {
      console.log('❌ Scan error:', error);
      onScanError?.(error);
      finish(false);
      return;
    }

    if (device && isQNScaleDevice(device)) {
      setDevices((prev: any[]) => {
        const exists = prev.find(d => d.id === device.id);
        if (exists) return prev;

        return [
          ...prev,
          {
            id: device.id,
            name: displayNameForScale(device),
            rssi: device.rssi,
            deviceRef: device,
          },
        ];
      });
    }
  });

  setTimeout(() => {
    finish();
  }, 5000);
};

export type ScaleRawNotifyHandler = (hex: string, bytes: number[]) => void;

/**
 * 🔗 Connect + listen on FFF1 — forwards raw notify bytes only (no weight math).
 */
export const connectDevice = async (
  device: Device,
  onRawNotify: ScaleRawNotifyHandler
): Promise<Device> => {
  try {
    console.log('🔌 Connecting...');

    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();

    console.log('✅ Connected:', connected.id);

    startNotification(connected, onRawNotify);

    // Optional: send start command
    await sendStartCommand(connected);

    return connected;
  } catch (error) {
    console.log('❌ Connection error:', error);
    throw error;
  }
};

/**
 * 📡 Start Notifications
 */
const startNotification = (device: Device, onRawNotify: ScaleRawNotifyHandler) => {
  teardownScaleCharacteristicSession();
  const generation = bleNotifyGeneration;

  deviceDisconnectSub = device.onDisconnected((_err, d) => {
    console.log('[Scale BLE] onDisconnected', d.id);
    teardownScaleCharacteristicSession();
  });

  notifySubscription = device.monitorCharacteristicForService(
    SERVICE_UUID,
    NOTIFY_CHAR,
    (error, characteristic) => {
      if (generation !== bleNotifyGeneration) {
        return;
      }
      if (error) {
        console.log('❌ Notify error:', error);
        return;
      }

      if (!characteristic?.value) return;

      const buffer = Buffer.from(characteristic.value, 'base64');
      const hex = buffer.toString('hex');
      const bytes = [...buffer];
      const now = Date.now();

      onRawNotify(hex, bytes);

      const logThis = __DEV__ && (hex !== lastNotifyHex || now - lastNotifyHexAt >= 8000);
      if (logThis) {
        lastNotifyHex = hex;
        lastNotifyHexAt = now;
        console.log('[Scale BLE] notify HEX:', hex);
        console.log('[Scale BLE] notify BYTES:', bytes);
      }
    }
  );
};

/**
 * ✉️ Send Start Command (may be required)
 */
const sendStartCommand = async (device: Device) => {
  try {
    const command = Buffer.from([0x01]); // trial command
    const payload = command.toString('base64');

    // nRF lists FFF2 as WRITE (request); try with-response first, then without.
    try {
      await device.writeCharacteristicWithResponseForService(SERVICE_UUID, WRITE_CHAR, payload);
    } catch {
      await device.writeCharacteristicWithoutResponseForService(SERVICE_UUID, WRITE_CHAR, payload);
    }

    console.log('📤 Start command sent');
  } catch (error) {
    console.log('⚠️ Write failed (maybe not required):', error);
  }
};

/**
 * 🔌 Disconnect
 */
export const disconnectDevice = async (device: Device) => {
  try {
    teardownScaleCharacteristicSession();
    lastNotifyHex = '';
    lastNotifyHexAt = 0;
    await device.cancelConnection();
    console.log('🔌 Disconnected');
  } catch (e) {
    console.log('❌ Disconnect error:', e);
    teardownScaleCharacteristicSession();
    lastNotifyHex = '';
    lastNotifyHexAt = 0;
  }
};

/**
 * 🧹 Cleanup BLE Manager
 */
export const destroyManager = () => {
  try {
    manager.destroy();
  } catch (e) {
    console.log('❌ Destroy error:', e);
  }
};