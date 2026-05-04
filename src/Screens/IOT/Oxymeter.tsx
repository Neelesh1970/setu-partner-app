import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { requestBlePermissionsAndroid } from '../../Utils/requestBlePermissionsAndroid';
import { BleManager } from 'react-native-ble-plx';
import type { Device, Subscription } from 'react-native-ble-plx';
import styles from './Oxymeter.styles';

/** Minimal shape for Web Bluetooth entry (DOM `Navigator` is not in RN typings). */
type WebBluetoothNavigator = {
  bluetooth?: {
    requestDevice: (options: {
      acceptAllDevices?: boolean;
      optionalServices?: string[];
    }) => Promise<{
      gatt?: { connect: () => Promise<BluetoothGattLike> };
    }>;
  };
};

type BluetoothGattLike = {
  getPrimaryServices: () => Promise<BluetoothServiceLike[]>;
};

type BluetoothServiceLike = {
  uuid: string;
  getCharacteristics: () => Promise<BluetoothCharacteristicLike[]>;
};

type BluetoothCharacteristicLike = {
  uuid: string;
  properties: { notify: boolean; indicate: boolean };
  addEventListener: (type: string, listener: (ev: unknown) => void) => void;
  removeEventListener: (type: string, listener: (ev: unknown) => void) => void;
  startNotifications: () => Promise<void>;
};

type DashboardDevice = {
  id: string;
  name: string;
  type: string;
  icon: string;
  badge: string;
  subtitle: string;
  detail: string;
};

const BASE_DEVICES: DashboardDevice[] = [
  {
    id: 'setu-oximeter',
    name: 'Setu BPL iOxy Oximeter',
    type: 'Oximeter',
    icon: '👩',
    badge: 'Bluetooth ready',
    subtitle: 'Finger-based SpO₂ & pulse reader',
    detail:
      'Continuous oximetry with automatic data streaming to the Setu Device dashboard.',
  },
  {
    id: 'setu-thermo',
    name: 'Setu Skin Thermometer',
    type: 'Thermometer',
    icon: '🌡️',
    badge: 'Wi‑Fi mesh',
    subtitle: 'Contact thermometer for quick screenings',
    detail:
      'Measures surface temperature with adaptive filtering (data syncing pending).',
  },
  {
    id: 'setu-patch',
    name: 'Setu Wearable Patch',
    type: 'Patch',
    icon: '📙',
    badge: 'Bluetooth low energy',
    subtitle: 'Accelerometer + pulse patch',
    detail:
      'Tracks motion patterns, heart rate, and sends summaries every 15 minutes.',
  },
];

const BACKEND_PULSE_OXIMETER_DEVICE_ID = '1b9b9ae7-74e5-4056-a0c2-754e7be8288e';
const BACKEND_PULSE_OXIMETER_DEVICE_NAME = 'Pulse Oxymeter';

type PulseOximeterScreenProps = {
  oxygen: number | null;
  bpm: number | null;
  connectionStatus: string;
  statusLog: string[];
};

const PulseOximeterScreen: React.FC<PulseOximeterScreenProps> = ({
  oxygen,
  bpm,
  connectionStatus,
  statusLog,
}) => {
  const { width } = useWindowDimensions();
  const isStackedMetrics = width < 420;
  const metricLayoutStyle = isStackedMetrics ? styles.oximeterMetricsStacked : null;
  const secondMetricSpacing = isStackedMetrics ? styles.oximeterMetricStackedSpacing : null;

  return (
    <View style={styles.oximeterScreenBase}>
      <View
        style={[
          styles.oximeterScreen,
          {
            paddingHorizontal: Math.min(40, Math.max(16, width * 0.05)),
            paddingVertical: isStackedMetrics ? 18 : 22,
          },
        ]}
      >
        <View style={styles.oximeterHero}>
          <Text style={styles.oximeterLabel}>Pulse Oximeter</Text>
          <View style={styles.oximeterDeviceWrap}>
            <View style={styles.oximeterDeviceShell}>
              <View style={styles.oximeterWave} />
            </View>
          </View>
        </View>

        <View style={[styles.oximeterMetrics, metricLayoutStyle]}>
          <View style={[styles.oximeterMetricCard, styles.oximeterMetricPrimary]}>
            <Text style={styles.oximeterMetricLabel}>SpO₂</Text>
            <Text style={styles.oximeterMetricValue}>
              {oxygen !== null ? `${oxygen}%` : '--'}
            </Text>
            <Text style={styles.oximeterMetricUnit}>
              {oxygen !== null ? 'saturation' : 'waiting data'}
            </Text>
          </View>
          <View style={[styles.oximeterMetricCard, secondMetricSpacing]}>
            <Text style={styles.oximeterMetricLabel}>PR bpm</Text>
            <Text style={styles.oximeterMetricValue}>{bpm !== null ? `${bpm}` : '--'}</Text>
            <Text style={styles.oximeterMetricUnit}>
              {bpm !== null ? 'pulse rate' : 'waiting data'}
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Connection status</Text>
          <Text style={styles.statusValue}>{connectionStatus}</Text>
          {statusLog.map((item, index) => (
            <Text key={`${item}-${index}`} style={styles.statusLine}>
              • {item}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};

type PulseOximeterSetupScreenProps = {
  onConnect: () => void;
  isConnecting: boolean;
};

const PulseOximeterSetupScreen: React.FC<PulseOximeterSetupScreenProps> = ({
  onConnect,
  isConnecting,
}) => {
  const { width } = useWindowDimensions();
  const cardPadding = width < 360 ? 18 : 22;

  return (
    <View style={styles.oximeterScreenBase}>
      <View style={[styles.oximeterSetupCard, { padding: cardPadding }]}>
        <View style={styles.oximeterSetupHeader}>
          <Text style={styles.oximeterLabel}>Pulse Oximeter</Text>
          <View style={styles.oximeterDeviceWrap}>
            <View style={styles.oximeterDeviceShell}>
              <View style={styles.oximeterWave} />
            </View>
          </View>
        </View>
        <View style={styles.oximeterBody}>
          <Text style={styles.oximeterTitle}>Pair Device</Text>
          <Text style={styles.oximeterCopy}>
            We detected your pulse oximeter nearby. Make sure it is powered on and within Bluetooth
            range before tapping Connect.
          </Text>
          <TouchableOpacity
            style={[styles.oximeterConnectButton, isConnecting && styles.connectButtonDisabled]}
            onPress={onConnect}
            disabled={isConnecting}
          >
            <Text style={styles.oximeterConnectButtonText}>
              {isConnecting ? 'Requesting Bluetooth…' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

type OxymeterNav = NativeStackNavigationProp<RootStackParamList>;

const OXY_SERVICES_FILTER = [
  'f000ffc0-0451-4000-b000-000000000000',
  '0000ffc0-0000-1000-8000-00805f9b34fb',
] as const;

function isTargetServiceUuid(uuidLower: string): boolean {
  return (
    uuidLower === 'f000ffc0-0451-4000-b000-000000000000' ||
    uuidLower === 'cdeacb80-5235-4c07-8846-93a37ee6b86d' ||
    uuidLower === '0000ffc0-0000-1000-8000-00805f9b34fb'
  );
}

function base64ToByteArray(b64: string): number[] {
  const binary = (globalThis as unknown as { atob: (data: string) => string }).atob(b64);
  const out: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    out.push(binary.charCodeAt(i) & 0xff);
  }
  return out;
}

function deviceMatchesOximeter(d: Device): boolean {
  const name = (d.name ?? d.localName ?? '').toLowerCase();
  if (
    name.includes('oxi') ||
    name.includes('spo2') ||
    name.includes('bpl') ||
    name.includes('pulse') ||
    name.includes('ioxy')
  ) {
    return true;
  }
  const su = d.serviceUUIDs ?? [];
  return su.some(u => {
    const x = u.toLowerCase();
    return x.includes('ffc0') || x.includes('cdeacb80');
  });
}

async function ensureBluetoothPoweredOn(manager: BleManager): Promise<void> {
  const state = await manager.state();
  if (state === 'PoweredOn') return;

  // If Bluetooth is off, we can't force-enable it from JS, but we can wait for the user
  // to enable it in Settings instead of surfacing a "Connection failed" error.
  // (BleManager will emit state change once user enables Bluetooth.)
  if (state === 'Unsupported') {
    throw new Error('Bluetooth LE is not supported on this device.');
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutMs = 30_000;
    let sub: { remove: () => void } | null = null;
    const timer = setTimeout(() => {
      sub?.remove();
      reject(new Error('Bluetooth is off. Turn it on in Settings.'));
    }, timeoutMs);

    sub = manager.onStateChange(s => {
      if (s === 'PoweredOn') {
        clearTimeout(timer);
        sub?.remove();
        resolve();
      } else if (s === 'Unsupported') {
        clearTimeout(timer);
        sub?.remove();
        reject(new Error('Bluetooth LE is not supported on this device.'));
      }
      // If still PoweredOff/TurningOn/etc, keep waiting.
    }, true);
  });
}

async function scanWithOximeterServices(manager: BleManager): Promise<Device> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const stop = (fn: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      manager.stopDeviceScan();
      fn();
    };
    const timer = setTimeout(() => {
      stop(() => reject(new Error('SCAN_SERVICE_TIMEOUT')));
    }, 18000);
    manager.startDeviceScan([...OXY_SERVICES_FILTER], { allowDuplicates: false }, (error, device) => {
      if (finished) return;
      if (error) {
        stop(() => reject(error));
        return;
      }
      if (device) {
        stop(() => resolve(device));
      }
    });
  });
}

async function scanBroadForOximeter(manager: BleManager): Promise<Device> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const stop = (fn: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      manager.stopDeviceScan();
      fn();
    };
    const timer = setTimeout(() => {
      stop(() => reject(new Error('No oximeter found nearby.')));
    }, 22000);
    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (finished) return;
      if (error) {
        stop(() => reject(error));
        return;
      }
      if (device && deviceMatchesOximeter(device)) {
        stop(() => resolve(device));
      }
    });
  });
}

async function scanForOximeterDevice(manager: BleManager): Promise<Device> {
  manager.stopDeviceScan();
  try {
    return await scanWithOximeterServices(manager);
  } catch {
    return scanBroadForOximeter(manager);
  }
}

const Oxymeter: React.FC = () => {
  const navigation = useNavigation<OxymeterNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Oxymeter'>>();
  const [devices, setDevices] = useState<DashboardDevice[]>(BASE_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(BASE_DEVICES[0].id);
  const [connectionStatus, setConnectionStatus] = useState<string>(
    'Tap connect to start scanning.',
  );
  const [oxygen, setOxygen] = useState<number | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [rawData, setRawData] = useState<number[]>([]);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showLiveOximeterScreen, setShowLiveOximeterScreen] = useState(false);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const webCharacteristicRef = useRef<BluetoothCharacteristicLike | null>(null);
  const webNotificationHandlerRef = useRef<((event: unknown) => void) | null>(null);
  const bleManagerRef = useRef<BleManager | null>(null);
  const nativeDeviceRef = useRef<Device | null>(null);
  const nativeMonitorSubRef = useRef<Subscription | null>(null);

  const activeDevice = devices.find(d => d.id === activeDeviceId);
  const selectedDevice = devices.find(d => d.id === selectedDeviceId) ?? devices[0];

  const appendLog = useCallback((entry: string) => {
    setStatusLog(prev => [entry, ...prev].slice(0, 5));
  }, []);

  const cleanupWebGatt = useCallback(() => {
    const char = webCharacteristicRef.current;
    const handler = webNotificationHandlerRef.current;
    if (char && handler) {
      char.removeEventListener('characteristicvaluechanged', handler);
      webCharacteristicRef.current = null;
      webNotificationHandlerRef.current = null;
    }
  }, []);

  const disconnectNativeBle = useCallback(async () => {
    nativeMonitorSubRef.current?.remove();
    nativeMonitorSubRef.current = null;
    try {
      await nativeDeviceRef.current?.cancelConnection();
    } catch {
      /* ignore */
    }
    nativeDeviceRef.current = null;
    bleManagerRef.current?.stopDeviceScan();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const manager = new BleManager();
    bleManagerRef.current = manager;
    return () => {
      void (async () => {
        nativeMonitorSubRef.current?.remove();
        nativeMonitorSubRef.current = null;
        try {
          await nativeDeviceRef.current?.cancelConnection();
        } catch {
          /* ignore */
        }
        nativeDeviceRef.current = null;
        manager.stopDeviceScan();
        manager.destroy();
      })();
      bleManagerRef.current = null;
    };
  }, []);

  useEffect(() => () => cleanupWebGatt(), [cleanupWebGatt]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const ok = await requestBlePermissionsAndroid();
        if (cancelled || ok) return;
        appendLog(
          'Bluetooth permissions were denied. Enable Bluetooth access in system Settings to use the oximeter.',
        );
        setConnectionStatus('Bluetooth permission required.');
      })();
      return () => {
        cancelled = true;
        void disconnectNativeBle();
        cleanupWebGatt();
      };
    }, [appendLog, disconnectNativeBle, cleanupWebGatt]),
  );

  const applyOximeterPayload = useCallback(
    (rawBytes: number[]) => {
      setRawData(rawBytes);
      if (rawBytes.length === 4 && rawBytes[0] === 129) {
        const pulse = rawBytes[1];
        const spo2 = rawBytes[2];
        if (pulse >= 30 && pulse <= 250 && spo2 >= 50 && spo2 <= 100) {
          setOxygen(spo2);
          setBpm(pulse);
          setConnectionStatus('✅ Valid data received');
          appendLog(`SpO₂ ${spo2}% · Pulse ${pulse} bpm`);
        } else {
          appendLog(`⚠️ Invalid values: ${rawBytes.join(',')}`);
        }
      }
    },
    [appendLog],
  );

  const connectToOximeter = useCallback(async () => {
    if (Platform.OS === 'android') {
      const ok = await requestBlePermissionsAndroid();
      if (!ok) {
        setConnectionStatus('Bluetooth permission required.');
        appendLog('Cannot connect: Bluetooth permissions not granted.');
        return;
      }
    }

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const manager = bleManagerRef.current;
      if (!manager) {
        appendLog('BLE manager not ready.');
        return;
      }

      setIsConnecting(true);
      setStatusLog([]);
      setConnectionStatus('🔍 Preparing Bluetooth…');
      appendLog('Native BLE: scanning for oximeter.');
      await disconnectNativeBle();
      cleanupWebGatt();

      try {
        const btState = await manager.state();
        if (btState === 'PoweredOff') {
          setConnectionStatus('🔌 Bluetooth is off. Turn it on to connect.');
          appendLog('Bluetooth is off. Waiting for user to enable Bluetooth.');
          if (Platform.OS === 'android') {
            Alert.alert(
              'Bluetooth is off',
              'Please enable Bluetooth in Settings to connect the pulse oximeter.',
              [
                {
                  text: 'Open Settings',
                  onPress: () => {
                    // Open Android's system Bluetooth settings (not app permission settings).
                    const bluetoothSettingsUrl = 'android.settings.BLUETOOTH_SETTINGS';
                    void Linking.openURL(bluetoothSettingsUrl).catch(() => {
                      // Fallback: open general app settings if direct Bluetooth settings can't be opened.
                      void Linking.openSettings();
                    });
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ],
              { cancelable: true },
            );
          }
        }
        await ensureBluetoothPoweredOn(manager);
        setConnectionStatus('🔍 Scanning for oximeter…');
        const picked = await scanForOximeterDevice(manager);
        appendLog(`Connecting to ${picked.name ?? picked.localName ?? picked.id}…`);
        setConnectionStatus('Connecting…');
        const connected = await picked.connect();
        nativeDeviceRef.current = connected;
        await connected.discoverAllServicesAndCharacteristics();
        const services = await connected.services();
        let subscribed = false;
        for (const service of services) {
          const uuidLower = service.uuid.toLowerCase();
          if (!isTargetServiceUuid(uuidLower)) continue;
          const characteristics = await connected.characteristicsForService(service.uuid);
          for (const ch of characteristics) {
            if (!(ch.isNotifiable || ch.isIndicatable)) continue;
            nativeMonitorSubRef.current = ch.monitor((error, c) => {
              if (error || !c?.value) return;
              applyOximeterPayload(base64ToByteArray(c.value));
            });
            subscribed = true;
            setConnectionStatus('📡 Subscribed to oximeter data…');
            appendLog(`Listening on ${ch.uuid}`);
            break;
          }
          if (subscribed) break;
        }
        if (!subscribed) {
          setConnectionStatus('❌ No notify/indicate characteristic found.');
          appendLog('Try inserting finger, then connect again.');
          await disconnectNativeBle();
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        if (msg.toLowerCase().includes('bluetooth is off')) {
          setConnectionStatus(msg);
          appendLog(msg);
        } else {
          console.error('Native BLE error', error);
          setConnectionStatus('❌ Connection failed.');
          appendLog(`Error: ${msg}`);
        }
        await disconnectNativeBle();
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    if (Platform.OS !== 'web') {
      setConnectionStatus('BLE is not available on this platform.');
      appendLog('Use Android, iOS, or a Web Bluetooth capable browser.');
      return;
    }

    const nav = (
      typeof globalThis !== 'undefined'
        ? (globalThis as unknown as { navigator?: WebBluetoothNavigator }).navigator
        : undefined
    ) as WebBluetoothNavigator | undefined;
    if (!nav?.bluetooth) {
      setConnectionStatus('Web Bluetooth is not available in this environment.');
      appendLog('Browser does not expose navigator.bluetooth.');
      return;
    }

    setIsConnecting(true);
    setStatusLog([]);
    setConnectionStatus('🔍 Requesting Bluetooth device...');
    appendLog('Requesting permission and scanning for Setu Oximeter.');
    cleanupWebGatt();

    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'device_information',
          'battery_service',
          'f000ffc0-0451-4000-b000-000000000000',
          'cdeacb80-5235-4c07-8846-93a37ee6b86d',
        ],
      });

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('GATT server unavailable');
      }
      const services = await server.getPrimaryServices();

      let found = false;

      for (const service of services) {
        const uuidLower = service.uuid.toLowerCase();
        const isTargetService =
          uuidLower === 'f000ffc0-0451-4000-b000-000000000000' ||
          uuidLower === 'cdeacb80-5235-4c07-8846-93a37ee6b86d' ||
          uuidLower === '0000ffc0-0000-1000-8000-00805f9b34fb';
        if (!isTargetService) {
          continue;
        }

        const characteristics = await service.getCharacteristics();

        for (const char of characteristics) {
          if (!char.properties.notify && !char.properties.indicate) {
            continue;
          }

          found = true;

          const handler = (event: unknown) => {
            const value = (event as { target?: { value?: DataView } })?.target?.value;
            if (!value) return;

            const rawBytes = Array.from(new Uint8Array(value.buffer));
            applyOximeterPayload(rawBytes);
          };

          webNotificationHandlerRef.current = handler;
          webCharacteristicRef.current = char;

          char.addEventListener('characteristicvaluechanged', handler);

          try {
            await char.startNotifications();
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn('Notify failed:', msg);
            continue;
          }

          setConnectionStatus('📡 Subscribed to oximeter data...');
          appendLog(`Listening on ${char.uuid}`);

          return;
        }
      }

      if (!found) {
        setConnectionStatus('❌ No notify/indicate characteristic found.');
        appendLog('Try inserting finger before connecting.');
      }
    } catch (error: unknown) {
      console.error('Connection error', error);
      setConnectionStatus('❌ Connection failed.');
      const msg = error instanceof Error ? error.message : 'unknown error';
      appendLog(`Error: ${msg}`);
    } finally {
      setIsConnecting(false);
    }
  }, [appendLog, cleanupWebGatt, disconnectNativeBle, applyOximeterPayload]);

  const connectToSelectedDevice = useCallback(() => {
    if (!selectedDevice) return;
    if (selectedDevice.id !== 'setu-oximeter') {
      setConnectionStatus(`${selectedDevice.name} requires a dedicated adapter.`);
      appendLog(`${selectedDevice.name} pairing is not implemented yet.`);
      return;
    }
    setShowLiveOximeterScreen(true);
    void connectToOximeter();
  }, [selectedDevice, appendLog, connectToOximeter]);

  const openDeviceScreen = useCallback(
    (deviceId: string, deviceName: string) => {
      setSelectedDeviceId(deviceId);
      setActiveDeviceId(deviceId);
      setShowLiveOximeterScreen(false);
      setConnectionStatus('Tap connect to start scanning.');
      setStatusLog([]);
      appendLog(`Viewing ${deviceName} screen.`);
    },
    [appendLog],
  );

  const closeDeviceScreen = useCallback(() => {
    setActiveDeviceId(null);
    setShowLiveOximeterScreen(false);
  }, []);

  const addDevice = useCallback(() => {
    const placeholderId = `setu-device-${devices.length + 1}`;
    const newDevice: DashboardDevice = {
      id: placeholderId,
      name: `Setu Sensor ${devices.length + 1}`,
      type: 'Custom',
      icon: '🌀',
      badge: 'Pending',
      subtitle: 'Placeholder sensor that can join the dashboard later.',
      detail: 'Capture more biometrics by connecting this module to your gateway.',
    };
    setDevices(prev => [...prev, newDevice]);
    setSelectedDeviceId(placeholderId);
    appendLog('Added a placeholder device to the dashboard.');
  }, [devices.length, appendLog]);

  const canGoBack = navigation.canGoBack();

  useEffect(() => {
    const params = route.params;
    const deviceIdFromBackend = params?.deviceId ?? null;
    const deviceNameFromBackend = (params?.deviceName ?? null) as string | null;

    // If navigation didn't provide device context, keep original dashboard behavior.
    if (!deviceIdFromBackend && !deviceNameFromBackend) return;

    // Map backend device -> internal supported integration.
    const normalizedName = (deviceNameFromBackend ?? '').trim().toLowerCase();
    const isPulseOximeter =
      deviceIdFromBackend === BACKEND_PULSE_OXIMETER_DEVICE_ID ||
      normalizedName === BACKEND_PULSE_OXIMETER_DEVICE_NAME.toLowerCase();

    if (isPulseOximeter) {
      // Open the main Oxymeter dashboard (device cards). Do not auto-open setup/connect.
      setSelectedDeviceId('setu-oximeter');
      return;
    }
  }, [route.params]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0c162a" />
      {canGoBack ? (
        <TouchableOpacity style={styles.stackBackRow} onPress={() => navigation.goBack()}>
          <Text style={styles.stackBackText}>← Back</Text>
        </TouchableOpacity>
      ) : null}
      <ScrollView contentContainerStyle={styles.scrollArea}>
        {!activeDevice && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Setu Device</Text>
              <Text style={styles.heroSubtitle}>
                Central dashboard for every Setu-enabled sensor. Tap a device to open its individual
                screen.
              </Text>
              <TouchableOpacity style={styles.ctaButton} onPress={addDevice}>
                <Text style={styles.ctaButtonText}>Add new device</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>All devices</Text>
                <Text style={styles.sectionTagline}>
                  Each card opens an individual screen with a live feed.
                </Text>
              </View>
              <Text style={styles.sectionAction}>Total {devices.length}</Text>
            </View>

            <View style={styles.deviceList}>
              {devices.map(device => (
                <TouchableOpacity
                  key={device.id}
                  style={[
                    styles.deviceCard,
                    selectedDeviceId === device.id && styles.deviceCardActive,
                  ]}
                  onPress={() => openDeviceScreen(device.id, device.name)}
                >
                  <Text style={styles.deviceIcon}>{device.icon}</Text>
                  <View style={styles.deviceCopy}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceSubtitle}>{device.subtitle}</Text>
                  </View>
                  <View style={styles.deviceBadge}>
                    <Text style={styles.deviceBadgeText}>{device.badge}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {activeDevice && (
          <>
            <View style={styles.deviceScreenHeader}>
              <TouchableOpacity onPress={closeDeviceScreen} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.deviceScreenTitle}>{activeDevice.name}</Text>
              <View style={styles.backButtonPlaceholder} />
            </View>

            {activeDevice.id === 'setu-oximeter' ? (
              showLiveOximeterScreen ? (
                <PulseOximeterScreen
                  oxygen={oxygen}
                  bpm={bpm}
                  connectionStatus={connectionStatus}
                  statusLog={statusLog}
                />
              ) : (
                <PulseOximeterSetupScreen
                  isConnecting={isConnecting}
                  onConnect={connectToSelectedDevice}
                />
              )
            ) : (
              <View style={styles.deviceDetail}>
                <View style={styles.deviceDetailHeading}>
                  <Text style={styles.deviceDetailTitle}>{activeDevice.name}</Text>
                  <Text style={styles.deviceDetailType}>{activeDevice.type}</Text>
                </View>
                <Text style={styles.deviceDetailBody}>{activeDevice.detail}</Text>
                <View style={styles.metrics}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>SpO₂</Text>
                    <Text style={styles.metricValue}>
                      {oxygen !== null ? `${oxygen}%` : '--'}
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Pulse</Text>
                    <Text style={styles.metricValue}>
                      {bpm !== null ? `${bpm} bpm` : '--'}
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Last packet</Text>
                    <Text style={styles.metricValue}>
                      {rawData.length ? `${rawData.length} bytes` : 'n/a'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
                  onPress={connectToSelectedDevice}
                  disabled={isConnecting}
                >
                  <Text style={styles.connectButtonText}>
                    {isConnecting ? 'Waiting for permission…' : 'Connect & start scan'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.helpText}>
                  Allow Bluetooth access when prompted so Setu Device can scan and deliver the latest
                  readings.
                </Text>

                <View style={styles.statusCard}>
                  <Text style={styles.statusLabel}>Connection status</Text>
                  <Text style={styles.statusValue}>{connectionStatus}</Text>
                  {statusLog.map((item, index) => (
                    <Text key={`${item}-${index}`} style={styles.statusLine}>
                      • {item}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Oxymeter;
