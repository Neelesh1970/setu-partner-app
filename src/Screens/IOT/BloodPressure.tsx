import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import type { RootStackParamList } from '../../navigation/types';
import { postBloodPressureResult } from '../../api/iotDeviceResults';
import axiosInstance from '../../api/axiosInstance';
import { BACKEND_NIBP_DEVICE_ID } from '../../Utils/labIotPerformTest';
import { setPendingCompletedBookingItemId } from '../../Utils/multiDeviceSession';

const globalBuffer = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
};
globalBuffer.Buffer = globalBuffer.Buffer ?? Buffer;

type BloodPressureScreenNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'BloodPressure'
>;

type BloodPressureScreenProps = {
  navigation: BloodPressureScreenNavigation;
};

type BpMetricState = {
  sys: number | null;
  dia: number | null;
  pulse: number | null;
};

type BpRecord = {
  sys: number;
  dia: number;
  bpm?: number | null;
  pulse?: number | null;
  ihb?: number;
  mov?: number;
  user?: number;
  index?: number;
  source?: string;
  datetime?: string | null;
  rawDateHex?: string;
  rawHex?: string;
  recordNo?: number;
  backPlace?: number;
  area?: number;
  memoryOffset?: number;
  absoluteAddress?: number;
  id?: string;
  map?: number;
  unit?: string;
  timestamp?: string | null;
  userId?: number | null;
  measurementStatus?: number | null;
};

type ScannedDeviceItem = {
  id: string;
  name: string;
  rssi: number | null | undefined;
  deviceRef: Device;
};

type ParsedOmronPacket = {
  packetType: string;
  address: number;
  data: Buffer;
  rawHex: string;
};

type PacketPromiseHandlers = {
  resolve: (packet: ParsedOmronPacket) => void;
  reject: (error: unknown) => void;
};

type LiveBpGuess = {
  sys: number;
  dia: number;
  bpm: number;
  mode: string;
  offset: number;
};

const BP_SERVICE_UUID = '00001810-0000-1000-8000-00805f9b34fb';
const BP_MEASUREMENT_UUID = '00002a35-0000-1000-8000-00805f9b34fb';

const OMRON_SERVICE_UUID = '0000fe4a-0000-1000-8000-00805f9b34fb';
const OMRON_DATA_UUID = '49123040-aee8-11e1-a74d-0002a5d5c51b';
const OMRON_WRITE_UUID = 'db5b55e0-aee7-11e1-965e-0002a5d5c51b';

const USER_START_ADDRESSES = [0x0300, 0x0340];
const PER_USER_RECORD_COUNT = [20, 20];
const RECORD_BYTE_SIZE = 14;
const TRANSMISSION_BLOCK_SIZE = 0x38;

type BloodPressureRoute = RouteProp<RootStackParamList, 'BloodPressure'>;

type BloodPressureRouteParams = RootStackParamList['BloodPressure'] & {
  bookingItemId?: string | null;
  bookingId?: string | null;
  deviceId?: string | null;
  isMultiDevice?: boolean;
};

type BpResultSnapshot = {
  sys: number;
  dia: number;
  pulse: number;
};

function serializeBleDevice(device: Device): Record<string, unknown> {
  return {
    id: device.id,
    name: device.name ?? null,
    localName: device.localName ?? null,
    rssi: device.rssi ?? null,
    mtu: device.mtu ?? null,
    serviceUUIDs: device.serviceUUIDs ?? null,
    solicitedServiceUUIDs: device.solicitedServiceUUIDs ?? null,
    overflowServiceUUIDs: device.overflowServiceUUIDs ?? null,
    manufacturerData: device.manufacturerData ?? null,
    serviceData: device.serviceData ?? null,
    txPowerLevel: device.txPowerLevel ?? null,
    isConnectable: device.isConnectable ?? null,
  };
}

function logNavigationParams(params: BloodPressureRouteParams | undefined): void {
  const p = params ?? {};
  console.log(
    '[BloodPressure] navigation params:',
    JSON.stringify(
      {
        booking_id: p.bookingId ?? null,
        booking_item_id: p.bookingItemId ?? null,
        deviceId: p.deviceId ?? null,
        deviceName: p.deviceName ?? null,
        allRouteParams: p,
      },
      null,
      2,
    ),
  );
}

export default function BloodPressure({
  navigation,
}: BloodPressureScreenProps) {
  const route = useRoute<BloodPressureRoute>();
  const routeParams =
    (route.params as BloodPressureRouteParams | undefined) ?? {};
  const bookingItemId = routeParams.bookingItemId ?? '';
  const bookingId = routeParams.bookingId ?? '';
  const routeDeviceId = routeParams.deviceId ?? null;
  const routeIsMultiDevice = routeParams.isMultiDevice ?? false;

  const logBpResultPayload = (systolic: number, diastolic: number) => {
    console.log(
      '[BloodPressure] result payload:',
      JSON.stringify(
        {
          systolic,
          diastolic,
          booking_id: bookingId || null,
          ph_booking_item_id: bookingItemId || null,
        },
        null,
        4,
      ),
    );
  };

  const managerRef = useRef<BleManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new BleManager();
  }

  const manager = managerRef.current;
  const connectedRef = useRef<Device | null>(null);
  const monitorSubRef = useRef<Subscription[]>([]);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectingRef = useRef(false);
  const packetPromiseRef = useRef<PacketPromiseHandlers | null>(null);
  // Cached after first discovery — avoids re-calling device.services() on every TX,
  // which can silently reset CCCD notification subscriptions on Android BLE.
  const writeCharRef = useRef<Awaited<ReturnType<typeof getWriteChar>> | null>(
    null,
  );

  const rxBufferRef = useRef(Buffer.alloc(0));
  const liveModeRef = useRef(false);
  const liveMeasurementResolverRef = useRef<
    ((record: BpRecord) => void) | null
  >(null);

  const [status, setStatus] = useState('Ready');
  const [bleState, setBleState] = useState('Unknown');
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedDeviceItem[]>([]);
  const [connectedName, setConnectedName] = useState('');
  const [lastPacketHex, setLastPacketHex] = useState('');
  const [records, setRecords] = useState<BpRecord[]>([]);
  const [bpValue, setBpValue] = useState<BpMetricState>({
    sys: null,
    dia: null,
    pulse: null,
  });

  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [savedResult, setSavedResult] = useState<BpResultSnapshot | null>(null);
  const [isDoneLoading, setIsDoneLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const hasValidBpReading =
    bpValue.sys !== null &&
    bpValue.dia !== null &&
    bpValue.pulse !== null &&
    isValidBP(bpValue.sys, bpValue.dia, bpValue.pulse);

  const openResultModal = useCallback(() => {
    if (
      bpValue.sys === null ||
      bpValue.dia === null ||
      bpValue.pulse === null
    ) {
      return;
    }
    setSavedResult({
      sys: bpValue.sys,
      dia: bpValue.dia,
      pulse: bpValue.pulse,
    });
    setResultModalVisible(true);
  }, [bpValue.sys, bpValue.dia, bpValue.pulse]);

  const handleResultDone = useCallback(async (): Promise<void> => {
    if (!savedResult) {
      setResultModalVisible(false);
      return;
    }

    const deviceId = routeDeviceId ?? BACKEND_NIBP_DEVICE_ID;
    if (!deviceId || !bookingItemId) {
      setResultModalVisible(false);
      return;
    }

    setIsDoneLoading(true);
    try {
      await postBloodPressureResult({
        deviceId,
        bookingItemId,
        systolic: savedResult.sys,
        diastolic: savedResult.dia,
        pulseRate: savedResult.pulse,
      });
    } catch {
      // proceed like Remidio flow
    } finally {
      setIsDoneLoading(false);
    }

    setResultModalVisible(false);

    if (routeIsMultiDevice && bookingItemId) {
      setPendingCompletedBookingItemId(bookingItemId);
      navigation.goBack();
      return;
    }

    setPdfModalVisible(true);
  }, [
    savedResult,
    routeDeviceId,
    bookingItemId,
    routeIsMultiDevice,
    navigation,
  ]);

  const handleGeneratePdf = useCallback(async (): Promise<void> => {
    if (!bookingId) {
      setPdfModalVisible(false);
      navigation.replace('Reports');
      return;
    }

    setIsPdfLoading(true);
    try {
      await axiosInstance.post('reports/payload/pdf', { bookingId });
    } catch {
      // proceed to Reports regardless
    } finally {
      setIsPdfLoading(false);
    }

    setPdfModalVisible(false);
    navigation.replace('Reports', { bookingId: bookingId ?? undefined });
  }, [bookingId, navigation]);

  const handleCloseResultModal = useCallback(() => {
    setResultModalVisible(false);
    setSavedResult(null);
  }, []);

  const handleClosePdfModal = useCallback(() => {
    setPdfModalVisible(false);
    setSavedResult(null);
  }, []);

  useEffect(() => {
    logNavigationParams(route.params as BloodPressureRouteParams | undefined);
  }, [route.params]);

  useEffect(() => {
    let mounted = true;

    const sub = manager.onStateChange(state => {
      if (!mounted) return;
      setBleState(state);

      if (state === 'PoweredOn') {
        startScan();
      }
    }, true);

    return () => {
      mounted = false;
      stopScan();
      removeMonitors();

      try {
        sub.remove();
      } catch {
        /* ignore */
      }

      try {
        void connectedRef.current?.cancelConnection?.();
      } catch {
        /* ignore */
      }

      connectedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- BleManager lifecycle: run once on mount
  }, []);

  async function requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    if (typeof Platform.Version === 'number' && Platform.Version >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return (
        res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        res[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return res === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function startScan() {
    const ok = await requestPermissions();

    if (!ok) {
      setStatus('Bluetooth permission denied');
      return;
    }

    stopScan();
    setDevices([]);
    setIsScanning(true);
    setStatus('Scanning Omron device...');

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log('SCAN ERROR:', error);
        setStatus(error.message || 'Scan error');
        setIsScanning(false);
        return;
      }

      if (!device) return;

      const name = device.name || device.localName || '';

      const isOmron =
        name.toLowerCase().includes('hem') ||
        name.toLowerCase().includes('omron') ||
        device.serviceUUIDs?.some(uuid => {
          const u = uuid.toLowerCase();
          return u === OMRON_SERVICE_UUID || u === BP_SERVICE_UUID;
        });

      if (!isOmron) return;

      const bleSnapshot = serializeBleDevice(device);

      setDevices(prev => {
        const exists = prev.find(x => x.id === device.id);

        if (exists) {
          return prev.map(x =>
            x.id === device.id
              ? { ...x, rssi: device.rssi, deviceRef: device }
              : x,
          );
        }

        console.log(
          '[BloodPressure] BLE device discovered:',
          JSON.stringify(bleSnapshot, null, 2),
        );

        return [
          ...prev,
          {
            id: device.id,
            name: name || 'Omron BP Monitor',
            rssi: device.rssi,
            deviceRef: device,
          },
        ];
      });
    });

    scanTimerRef.current = setTimeout(() => {
      stopScan();
      setStatus('Scan finished. Select device to connect.');
      setDevices(prev => {
        console.log(
          '[BloodPressure] scan finished — total devices:',
          prev.length,
        );
        prev.forEach((item, index) => {
          console.log(
            `[BloodPressure] scanned device [${index}]:`,
            JSON.stringify(
              {
                id: item.id,
                name: item.name,
                rssi: item.rssi ?? null,
                ble: serializeBleDevice(item.deviceRef),
              },
              null,
              2,
            ),
          );
        });
        return prev;
      });
    }, 12000);
  }

  function stopScan() {
    try {
      manager.stopDeviceScan();
    } catch {
      /* ignore */
    }

    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    setIsScanning(false);
  }

  function removeMonitors() {
    try {
      monitorSubRef.current.forEach(sub => {
        try {
          sub?.remove?.();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }

    monitorSubRef.current = [];
  }

  function clearConnectionState(message?: string) {
    removeMonitors();
    connectedRef.current = null;
    writeCharRef.current = null;
    connectingRef.current = false;
    packetPromiseRef.current = null;
    liveModeRef.current = false;
    liveMeasurementResolverRef.current = null;
    rxBufferRef.current = Buffer.alloc(0);
    setConnectedName('');

    if (message) setStatus(message);
  }

  async function connectScannedDevice(item: ScannedDeviceItem) {
    if (!item?.id) {
      setStatus('Invalid device');
      return;
    }

    console.log(
      '[BloodPressure] connect selected device:',
      JSON.stringify(
        {
          booking_id: bookingId || null,
          booking_item_id: bookingItemId || null,
          selected: {
            id: item.id,
            name: item.name,
            rssi: item.rssi ?? null,
          },
          ble: serializeBleDevice(item.deviceRef),
        },
        null,
        2,
      ),
    );

    await connectDeviceById(item.id, item.name);
  }

  async function connectDeviceById(deviceId: string, fallbackName: string) {
    if (connectingRef.current) return;
    connectingRef.current = true;

    try {
      stopScan();
      removeMonitors();

      setRecords([]);
      setLastPacketHex('');
      setBpValue({ sys: null, dia: null, pulse: null });
      setStatus('Connecting to Omron...');

      liveModeRef.current = true;
      rxBufferRef.current = Buffer.alloc(0);

      if (connectedRef.current) {
        await connectedRef.current.cancelConnection().catch(() => {});
        connectedRef.current = null;
        await delay(1000);
      }

      console.log('CONNECT: attempting to connect to', deviceId);

      const device = await manager.connectToDevice(deviceId, {
        autoConnect: false,
        requestMTU: 185,
        timeout: 20000,
      });

      connectedRef.current = device;
      const mtu = (device as Device & { mtu?: number }).mtu;
      console.log('CONNECT: connected. name=', device.name, '| mtu=', mtu ?? 'unknown');
      setConnectedName(device.name || fallbackName || 'Omron BP Monitor');

      setStatus('Discovering services...');
      await device.discoverAllServicesAndCharacteristics();
      console.log('CONNECT: service discovery done');
      await delay(1000);

      await printServices(device);

      await setupStandardBloodPressureLive(device).catch(e => {
        console.log(
          'STANDARD BP LIVE NOT AVAILABLE:',
          e instanceof Error ? e.message : String(e),
        );
      });

      await setupOmronNotifications(device).catch(e => {
        console.log(
          'OMRON FE4A NOT AVAILABLE:',
          e instanceof Error ? e.message : String(e),
        );
      });

      // Pre-cache the write characteristic NOW, while notifications are active.
      // This prevents re-calling device.services() later which can silently
      // reset CCCD subscriptions on Android and cause RX timeouts.
      try {
        writeCharRef.current = await getWriteChar(device);
        console.log(
          'CONNECT: write char cached:',
          writeCharRef.current.uuid,
          '| withResponse=', writeCharRef.current.isWritableWithResponse,
          '| withoutResponse=', writeCharRef.current.isWritableWithoutResponse,
        );
      } catch (e) {
        console.log('CONNECT: failed to cache write char:', e instanceof Error ? e.message : String(e));
      }

      // Give the CCCD subscription time to settle before first TX.
      console.log('CONNECT: waiting 800ms before first TX...');
      await delay(800);

      const isNowConnected = await device.isConnected().catch(() => false);
      console.log('CONNECT: isConnected before first TX =', isNowConnected);

      if (!isNowConnected) {
        throw new Error('Device disconnected before transmission could start');
      }

      liveModeRef.current = true;

      const livePromise = waitForLiveMeasurement(180000);

      try {
        setStatus('Reading stored records...');
        console.log(
          'CONNECT: packetPromiseRef before startTransmission =',
          packetPromiseRef.current !== null ? 'set' : 'null',
        );

        await startTransmission();

        const allRecords = await readHem7141T1Records();

        await endTransmission().catch(e =>
          console.log('END TRANSMISSION ERROR:', e),
        );

        console.log('FINAL EEPROM RECORDS COUNT:', allRecords.length);
        console.log('FINAL EEPROM RECORDS:', allRecords);

        const sortedRecords = sortOmronRecords(allRecords);

        console.log(
          'SORTED RECORD NOS:',
          sortedRecords.map(r => r.recordNo),
        );
        console.log('SORTED RECORDS:', sortedRecords);

        setRecords(sortedRecords);

        if (sortedRecords.length > 0) {
          const latest = sortedRecords[0];

          console.log('LATEST RECORD:', latest);

          setBpValue({
            sys: latest.sys,
            dia: latest.dia,
            pulse: latest.bpm ?? latest.pulse ?? null,
          });
          logBpResultPayload(latest.sys, latest.dia);

          setStatus(
            `History loaded: ${sortedRecords.length}. Latest: ${latest.sys}/${
              latest.dia
            }, Pulse ${latest.bpm ?? latest.pulse ?? '--'}`,
          );
        } else {
          setStatus('No history found. Start BP measurement for live.');
        }
      } catch (historyErr) {
        console.log('EEPROM HISTORY ERROR:', historyErr);
        setStatus('History failed. Live mode still active.');
      }

      livePromise.then(live => {
        if (!live) {
          console.log('LIVE TIMEOUT: no live BP received');
          setStatus('No live BP received. Try measuring again.');
          return;
        }

        console.log('LIVE FINAL RESULT:', live);

        setBpValue({
          sys: live.sys,
          dia: live.dia,
          pulse: live.bpm ?? live.pulse ?? null,
        });

        setRecords(prev => {
          const exists = prev.some(r => r.rawHex === live.rawHex);
          if (exists) return prev;

          const updated: BpRecord[] = [
            ...prev,
            {
              ...live,
              index: prev.length + 1,
            },
          ];

          return sortOmronRecords(updated);
        });

        setStatus(
          `Live BP: ${live.sys}/${live.dia}, Pulse ${
            live.bpm ?? live.pulse ?? '--'
          }`,
        );
      });
    } catch (e) {
      console.log('CONNECT ERROR:', e);
      Alert.alert('Omron Error', e instanceof Error ? e.message : String(e));
      clearConnectionState(
        'Connection failed. Pair device in Android Bluetooth first.',
      );
    } finally {
      connectingRef.current = false;
    }
  }

  async function printServices(device: Device) {
    const services = await device.services();

    for (const s of services) {
      console.log('SERVICE:', s.uuid);

      const chars = await s.characteristics();
      for (const c of chars) {
        console.log('CHAR:', {
          service: s.uuid,
          char: c.uuid,
          isNotifiable: c.isNotifiable,
          isIndicatable: c.isIndicatable,
          isWritableWithResponse: c.isWritableWithResponse,
          isWritableWithoutResponse: c.isWritableWithoutResponse,
        });
      }
    }
  }

  async function setupStandardBloodPressureLive(device: Device) {
    const services = await device.services();

    const bpService = services.find(
      s => s.uuid.toLowerCase() === BP_SERVICE_UUID,
    );

    if (!bpService) {
      throw new Error('Standard Blood Pressure service 1810 not found');
    }

    const chars = await bpService.characteristics();

    const bpChar = chars.find(
      c => c.uuid.toLowerCase() === BP_MEASUREMENT_UUID,
    );

    if (!bpChar) {
      throw new Error('BP Measurement characteristic 2A35 not found');
    }

    if (!bpChar.isNotifiable && !bpChar.isIndicatable) {
      throw new Error('BP Measurement 2A35 is not notifiable');
    }

    console.log('SUBSCRIBE STANDARD BP LIVE:', bpChar.uuid);

    const sub = bpChar.monitor((error, characteristic) => {
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (
          msg.includes('cancelled') ||
          msg.includes('disconnected') ||
          msg.includes('not connected')
        ) {
          return;
        }

        console.log('STANDARD BP NOTIFY ERROR:', error.message);
        return;
      }

      if (!characteristic?.value) return;

      const bytes = Buffer.from(characteristic.value, 'base64');
      const hex = bytes.toString('hex').toUpperCase();

      console.log('STANDARD BP LIVE HEX:', hex);
      setLastPacketHex(hex);

      const parsed = parseStandardBpMeasurement(bytes);

      if (!parsed) {
        console.log('STANDARD BP PARSE FAILED');
        return;
      }

      const liveRecord: BpRecord = {
        ...parsed,
        pulse: parsed.bpm,
        ihb: 0,
        mov: 0,
        user: 1,
        index: records.length + 1,
        source: 'LIVE_STANDARD_2A35',
        datetime: new Date().toISOString().replace('T', ' ').slice(0, 19),
        rawDateHex: 'LIVE',
        rawHex: hex,
      };

      console.log('STANDARD BP LIVE RESULT:', liveRecord);
      publishLiveRecord(liveRecord);
    });

    monitorSubRef.current.push(sub);
  }

  function parseStandardBpMeasurement(bytes: Buffer): BpRecord | null {
    if (!bytes || bytes.length < 7) return null;

    let offset = 0;
    const flags = bytes[offset++];

    const unitKpa = (flags & 0x01) !== 0;
    const hasTimestamp = (flags & 0x02) !== 0;
    const hasPulse = (flags & 0x04) !== 0;
    const hasUserId = (flags & 0x08) !== 0;
    const hasStatus = (flags & 0x10) !== 0;

    let sys = parseSFloat(bytes[offset], bytes[offset + 1]);
    offset += 2;

    let dia = parseSFloat(bytes[offset], bytes[offset + 1]);
    offset += 2;

    let mapVal = parseSFloat(bytes[offset], bytes[offset + 1]);
    offset += 2;

    if (unitKpa) {
      sys = sys * 7.50062;
      dia = dia * 7.50062;
      mapVal = mapVal * 7.50062;
    }

    let timestamp: string | null = null;

    if (hasTimestamp && bytes.length >= offset + 7) {
      const year = bytes[offset] | (bytes[offset + 1] << 8);
      const month = bytes[offset + 2];
      const day = bytes[offset + 3];
      const hour = bytes[offset + 4];
      const minute = bytes[offset + 5];
      const second = bytes[offset + 6];
      timestamp = `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(
        minute,
      )}:${pad2(second)}`;
      offset += 7;
    }

    let bpm: number | null = null;
    if (hasPulse && bytes.length >= offset + 2) {
      bpm = parseSFloat(bytes[offset], bytes[offset + 1]);
      offset += 2;
    }

    let userId: number | null = null;
    if (hasUserId && bytes.length >= offset + 1) {
      userId = bytes[offset];
      offset += 1;
    }

    let measurementStatus: number | null = null;
    if (hasStatus && bytes.length >= offset + 2) {
      measurementStatus = bytes[offset] | (bytes[offset + 1] << 8);
    }

    const result: BpRecord = {
      sys: Math.round(sys),
      dia: Math.round(dia),
      map: Math.round(mapVal),
      bpm: bpm ? Math.round(bpm) : null,
      unit: 'mmHg',
      timestamp,
      userId,
      measurementStatus,
    };

    if (!isValidBP(result.sys, result.dia, result.bpm ?? 70)) {
      return null;
    }

    return result;
  }

  function parseSFloat(lo: number, hi: number): number {
    const raw = lo | (hi << 8);

    let mantissa = raw & 0x0fff;
    let exponent = raw >> 12;

    if (mantissa >= 0x0800) mantissa = -((0x1000 - mantissa) & 0x0fff);
    if (exponent >= 0x0008) exponent = -((0x0010 - exponent) & 0x000f);

    return mantissa * Math.pow(10, exponent);
  }

  async function setupOmronNotifications(device: Device) {
    const service = await getOmronService(device);
    const chars = await service.characteristics();

    const notifyChar = chars.find(
      c => c.uuid.toLowerCase() === OMRON_DATA_UUID,
    );

    if (!notifyChar) {
      throw new Error('HEM notify characteristic not found');
    }

    if (!notifyChar.isNotifiable && !notifyChar.isIndicatable) {
      throw new Error('HEM data characteristic is not notifiable');
    }

    console.log('SUBSCRIBE OMRON FE4A: subscribing to', notifyChar.uuid);

    let rxCallCount = 0;

    const sub = notifyChar.monitor((error, characteristic) => {
      if (error) {
        const msg = String(
          error.message ||
            ('reason' in error ? String(error.reason) : '') ||
            '',
        ).toLowerCase();

        if (
          msg.includes('cancelled') ||
          msg.includes('disconnected') ||
          msg.includes('not connected')
        ) {
          console.log('OMRON NOTIFY: silenced error (disconnect/cancel):', msg);
          return;
        }

        console.log('OMRON NOTIFY ERROR:', error);
        return;
      }

      rxCallCount += 1;
      console.log('OMRON NOTIFY: RX #' + rxCallCount + ' fired');

      if (!characteristic?.value) {
        console.log('OMRON NOTIFY: characteristic.value is empty');
        return;
      }

      const bytes = Buffer.from(characteristic.value, 'base64');
      const hex = bytes.toString('hex').toUpperCase();

      console.log('RX CHUNK:', hex);
      console.log('RX CHUNK LENGTH:', bytes.length);
      console.log(
        'RX CHUNK: packetPromiseRef=', packetPromiseRef.current !== null ? 'set' : 'null',
        '| liveMode=', liveModeRef.current,
      );

      setLastPacketHex(hex);

      if (liveModeRef.current) {
        handleLiveMeasurementPacket(bytes);
      }

      if (packetPromiseRef.current) {
        handleRxPacket(bytes);
      } else {
        console.log('RX ignored for command parser: no pending promise');
      }
    });

    console.log('SUBSCRIBE OMRON FE4A: monitor registered');
    monitorSubRef.current.push(sub);
  }

  function handleLiveMeasurementPacket(bytes: Buffer) {
    if (!bytes || !bytes.length) return;

    const hex = bytes.toString('hex').toUpperCase();

    console.log('LIVE RX CHECK:', hex);

    const found = findBpInPacket(bytes);

    if (!found) {
      console.log('LIVE BP NOT FOUND IN THIS PACKET');
      return;
    }

    const liveRecord: BpRecord = {
      ...found,
      pulse: found.bpm,
      ihb: 0,
      mov: 0,
      user: 1,
      index: records.length + 1,
      source: 'LIVE_FE4A_GUESS',
      datetime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      rawDateHex: 'LIVE',
      rawHex: hex,
    };

    console.log('LIVE BP FOUND:', liveRecord);

    publishLiveRecord(liveRecord);
  }

  function publishLiveRecord(liveRecord: BpRecord) {
    setBpValue({
      sys: liveRecord.sys,
      dia: liveRecord.dia,
      pulse: liveRecord.bpm ?? null,
    });
    logBpResultPayload(liveRecord.sys, liveRecord.dia);

    setRecords(prev => {
      const exists = prev.some(r => r.rawHex === liveRecord.rawHex);
      if (exists) return prev;
      return [...prev, liveRecord];
    });

    setStatus(
      `Live BP: ${liveRecord.sys}/${liveRecord.dia}, Pulse ${
        liveRecord.bpm ?? '--'
      }`,
    );

    if (liveMeasurementResolverRef.current) {
      liveMeasurementResolverRef.current(liveRecord);
      liveMeasurementResolverRef.current = null;
    }
  }

  function findBpInPacket(bytes: Buffer): LiveBpGuess | null {
    const hex = bytes.toString('hex').toUpperCase();

    if (
      hex.startsWith('0880') ||
      hex.startsWith('0881') ||
      hex.startsWith('4081') ||
      hex.startsWith('088F')
    ) {
      console.log('LIVE SKIP EEPROM PACKET:', hex);
      return null;
    }

    for (let i = 0; i <= bytes.length - 3; i++) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];

      const candidates: LiveBpGuess[] = [
        { sys: b0, dia: b1, bpm: b2, mode: 'DIRECT', offset: i },
        { sys: b0 + 25, dia: b1, bpm: b2, mode: 'PLUS_25', offset: i },
      ];

      for (const c of candidates) {
        console.log('LIVE CANDIDATE:', c);

        if (isValidBP(c.sys, c.dia, c.bpm)) {
          console.log('LIVE VALID CANDIDATE:', c);
          return c;
        }
      }
    }

    return null;
  }

  function waitForLiveMeasurement(
    timeoutMs = 180000,
  ): Promise<BpRecord | null> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        liveMeasurementResolverRef.current = null;
        resolve(null);
      }, timeoutMs);

      liveMeasurementResolverRef.current = data => {
        clearTimeout(timer);
        resolve(data);
      };
    });
  }

  function handleRxPacket(bytes: Buffer) {
    try {
      const packetSize = bytes[0];

      console.log('HANDLE RX PACKET SIZE:', packetSize);
      console.log('HANDLE RX RAW:', bytes.toString('hex').toUpperCase());

      if (!packetSize || bytes.length < packetSize) {
        console.log(
          'RX incomplete packet:',
          bytes.toString('hex').toUpperCase(),
        );
        return;
      }

      const packet = Buffer.from(bytes.subarray(0, packetSize));

      let xorCrc = 0;
      for (const b of packet) xorCrc ^= b;

      console.log('RX XOR CRC:', xorCrc);

      if (xorCrc !== 0) {
        const err = new Error(`CRC failed: ${xorCrc}`);
        console.log('RX CRC ERROR:', err.message);

        if (packetPromiseRef.current) {
          const resolver = packetPromiseRef.current;
          packetPromiseRef.current = null;
          resolver.reject(err);
        }

        return;
      }

      const parsed = parseOmronResponsePacket(packet);

      console.log('PARSED RX PACKET:', {
        packetType: parsed.packetType,
        address: parsed.address.toString(16),
        dataLength: parsed.data.length,
        dataHex: parsed.data.toString('hex').toUpperCase(),
        rawHex: parsed.rawHex,
      });

      if (packetPromiseRef.current) {
        const resolver = packetPromiseRef.current;
        packetPromiseRef.current = null;
        resolver.resolve(parsed);
      } else {
        console.log('RX received but no pending promise');
      }
    } catch (e) {
      console.log('HANDLE RX ERROR:', e);

      if (packetPromiseRef.current) {
        const resolver = packetPromiseRef.current;
        packetPromiseRef.current = null;
        resolver.reject(e);
      }
    }
  }

  function parseOmronResponsePacket(packet: Buffer): ParsedOmronPacket {
    const packetType = Buffer.from(packet.subarray(1, 3))
      .toString('hex')
      .toLowerCase();
    const address = packet.readUInt16BE(3);
    const dataLength = packet[5];

    let data: Buffer;

    if (packetType === '8f00') {
      data = Buffer.from(packet.subarray(6, 7));
    } else if (dataLength <= packet.length - 8) {
      data = Buffer.from(packet.subarray(6, 6 + dataLength));
    } else {
      data = Buffer.alloc(dataLength, 0xff);
    }

    return {
      packetType,
      address,
      data,
      rawHex: packet.toString('hex').toUpperCase(),
    };
  }

  async function startTransmission() {
    const command = Buffer.from('0800000000100018', 'hex');
    const packet = await writeAndWaitPacket(command);

    console.log('START RESPONSE:', packet);

    if (packet.packetType !== '8000') {
      throw new Error(`Invalid start response: ${packet.packetType}`);
    }
  }

  async function endTransmission() {
    const command = Buffer.from('080f000000000007', 'hex');
    const packet = await writeAndWaitPacket(command);

    console.log('END RESPONSE:', packet);

    if (packet.packetType !== '8f00') {
      throw new Error(`Invalid end response: ${packet.packetType}`);
    }

    if (packet.data?.[0]) {
      throw new Error(`Device end transmission error: ${packet.data[0]}`);
    }
  }

  async function readHem7141T1Records(): Promise<BpRecord[]> {
    const finalRecords: BpRecord[] = [];

    for (
      let userIndex = 0;
      userIndex < USER_START_ADDRESSES.length;
      userIndex++
    ) {
      const startAddress = USER_START_ADDRESSES[userIndex];
      const count = PER_USER_RECORD_COUNT[userIndex];

      const totalBytes = count * RECORD_BYTE_SIZE;
      let offset = 0;

      console.log(
        `READ AREA ${userIndex + 1}: start=0x${startAddress
          .toString(16)
          .toUpperCase()}, totalBytes=${totalBytes}`,
      );

      // Store all chunks first, then merge with overlap recovery
      const allChunks: Buffer[] = [];

      while (offset < totalBytes) {
        const address = startAddress + offset;
        const readSize = Math.min(TRANSMISSION_BLOCK_SIZE, totalBytes - offset);

        const block = await readBlockEeprom(address, readSize);

        console.log(
          `EEPROM BLOCK ${userIndex + 1} 0x${address
            .toString(16)
            .toUpperCase()}:`,
          block.toString('hex').toUpperCase(),
        );

        allChunks.push(block);
        offset += readSize;
        await delay(120);
      }

      // Merge chunks with overlap recovery — prepend last 20 bytes from
      // previous chunk so BP records at block boundaries are not lost
      let userBytes = Buffer.alloc(0);
      for (let ci = 0; ci < allChunks.length; ci++) {
        if (ci === 0) {
          userBytes = allChunks[ci];
        } else {
          const prev = allChunks[ci - 1];
          const overlap = Buffer.from(
            prev.subarray(Math.max(0, prev.length - 20)),
          );
          userBytes = Buffer.concat([userBytes, overlap, allChunks[ci]]);
        }
      }

      for (let i = 0; i <= userBytes.length - 5; i++) {
        const isMarker =
          userBytes[i] === 0x15 &&
          userBytes[i + 1] === 0x20 &&
          userBytes[i + 3] === 0x3f;

        if (!isMarker) continue;

        console.log('MARKER FOUND:', {
          area: userIndex + 1,
          markerOffset: i,
          markerAddress: '0x' + (startAddress + i).toString(16).toUpperCase(),
          markerHex: Buffer.from(userBytes.subarray(i, i + 5))
            .toString('hex')
            .toUpperCase(),
        });

        const candidates: {
          bpStart: number;
          back: number;
          sys: number;
          dia: number;
          bpm: number;
        }[] = [];

        for (let back = 1; back <= 30; back++) {
          const bpStart = i - back;

          if (bpStart < 0 || bpStart + 2 >= userBytes.length) continue;

          const sys = userBytes[bpStart] + 25;
          const dia = userBytes[bpStart + 1];
          const bpm = userBytes[bpStart + 2];

          if (isValidBP(sys, dia, bpm)) {
            candidates.push({
              bpStart,
              back,
              sys,
              dia,
              bpm,
            });
          }
        }

        if (!candidates.length) {
          console.log('NO BP FOR MARKER:', {
            markerAddress: '0x' + (startAddress + i).toString(16).toUpperCase(),
            nearHex: Buffer.from(
              userBytes.subarray(
                Math.max(0, i - 30),
                Math.min(userBytes.length, i + 20),
              ),
            )
              .toString('hex')
              .toUpperCase(),
          });
          continue;
        }

        const best = candidates[0];

        const recordNo = userBytes[i + 7] ?? 0;

        const item: BpRecord = {
          sys: best.sys,
          dia: best.dia,
          bpm: best.bpm,
          pulse: best.bpm,
          recordNo,
          backPlace: best.back,
          rawDateHex: Buffer.from(userBytes.subarray(i, i + 5))
            .toString('hex')
            .toUpperCase(),
          rawHex: Buffer.from(
            userBytes.subarray(
              best.bpStart,
              Math.min(userBytes.length, i + 10),
            ),
          )
            .toString('hex')
            .toUpperCase(),
          area: userIndex + 1,
          user: 1,
          index: finalRecords.length + 1,
          source: 'EEPROM',
          memoryOffset: best.bpStart,
          absoluteAddress: startAddress + best.bpStart,
        };

        console.log('VALID EEPROM RECORD:', item);
        finalRecords.push(item);
      }
    }

    const unique = uniqueRecords(finalRecords);
    const sorted = sortOmronRecords(unique);

    console.log('UNIQUE RECORD COUNT:', unique.length);
    console.log(
      'FINAL SORTED RECORD NOS:',
      sorted.map(r => r.recordNo),
    );
    console.log('FINAL SORTED RECORDS:', sorted);

    return sorted.map((item, index) => ({
      ...item,
      index: index + 1,
    }));
  }

  function cleanAndSortLatestFirst(list: BpRecord[]): BpRecord[] {
    if (!Array.isArray(list)) return [];

    // Remove FFFF packets, 0000 packets, and invalid records
    let filtered = list.filter(r => {
      if (!r || typeof r.sys !== 'number') return false;
      const hex = r.rawHex ?? '';
      if (/^F+$/i.test(hex)) return false;
      if (/^0+$/.test(hex)) return false;
      return isValidBP(r.sys, r.dia, r.bpm ?? r.pulse ?? 0);
    });

    // Deduplicate records
    const seen = new Set<string>();
    filtered = filtered.filter(r => {
      const key = `${r.recordNo ?? ''}_${r.sys}_${r.dia}_${r.bpm ?? r.pulse ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!filtered.length) return [];

    // Detect latest record using highest memoryOffset
    let latestByOffset = filtered[0];
    for (const r of filtered) {
      if ((r.memoryOffset ?? 0) > (latestByOffset.memoryOffset ?? 0)) {
        latestByOffset = r;
      }
    }
    const latestRecordNo = latestByOffset.recordNo ?? 0;

    // Sort newest first using circular recordNo rollover handling.
    // Tie-breaker: highest memoryOffset first (matches original JS).
    filtered.sort((a, b) => {
      const ageA = (latestRecordNo - (a.recordNo ?? 0) + 256) % 256;
      const ageB = (latestRecordNo - (b.recordNo ?? 0) + 256) % 256;
      if (ageA === ageB) {
        return Number(b.memoryOffset ?? 0) - Number(a.memoryOffset ?? 0);
      }
      return ageA - ageB;
    });

    return filtered;
  }

  function sortOmronRecords(list: BpRecord[]): BpRecord[] {
    return cleanAndSortLatestFirst(list);
  }

  function uniqueRecords(list: BpRecord[]): BpRecord[] {
    return cleanAndSortLatestFirst(list);
  }

  async function readBlockEeprom(address: number, blockSize: number) {
    const command = Buffer.alloc(8);

    command[0] = 0x08;
    command[1] = 0x01;
    command[2] = 0x00;
    command[3] = (address >> 8) & 0xff;
    command[4] = address & 0xff;
    command[5] = blockSize & 0xff;
    command[6] = 0x00;

    let crc = 0;
    for (let i = 0; i < 6; i++) crc ^= command[i];

    command[7] = crc;

    const packet = await writeAndWaitPacket(command);

    if (packet.packetType !== '8100') {
      throw new Error(`Invalid EEPROM read response: ${packet.packetType}`);
    }

    return packet.data;
  }

  async function writeAndWaitPacket(command: Buffer) {
    const device = connectedRef.current;
    if (!device) throw new Error('Device not connected');

    const isConn = await device.isConnected().catch(() => false);
    console.log('TX: isConnected=', isConn, '| writeCharCached=', writeCharRef.current !== null);

    if (!isConn) throw new Error('Device not connected (isConnected=false)');

    // Use cached write char to avoid re-calling device.services() which can
    // reset active CCCD notification subscriptions on Android BLE.
    const writeChar = writeCharRef.current ?? (await getWriteChar(device));

    if (!writeCharRef.current) {
      console.log('TX: write char not cached — using fresh discovery (CCCD may reset)');
      writeCharRef.current = writeChar;
    }

    // Set up RX promise AFTER we have the write char, so there's no gap where
    // a spurious packet could arrive and find an already-cleared promise.
    const waitPromise = waitRxPacket(7000);

    const base64 = Buffer.from(command).toString('base64');

    console.log('TX:', Buffer.from(command).toString('hex').toUpperCase());
    console.log(
      'TX: writing to', writeChar.uuid,
      '| withResponse=', writeChar.isWritableWithResponse,
    );

    if (writeChar.isWritableWithResponse) {
      await writeChar.writeWithResponse(base64);
    } else if (writeChar.isWritableWithoutResponse) {
      await writeChar.writeWithoutResponse(base64);
    } else {
      throw new Error('HEM write characteristic is not writable');
    }

    console.log('TX: write completed, waiting for RX...');
    return waitPromise;
  }

  function waitRxPacket(timeoutMs = 7000): Promise<ParsedOmronPacket> {
    return new Promise((resolve, reject) => {
      if (packetPromiseRef.current) {
        packetPromiseRef.current = null;
      }

      const timer = setTimeout(() => {
        console.log('RX TIMEOUT - no packet resolved');
        packetPromiseRef.current = null;
        reject(new Error('Omron response timeout'));
      }, timeoutMs);

      packetPromiseRef.current = {
        resolve: packet => {
          clearTimeout(timer);
          resolve(packet);
        },
        reject: error => {
          clearTimeout(timer);
          reject(error);
        },
      };
    });
  }

  async function getOmronService(device: Device) {
    const services = await device.services();

    const service = services.find(
      s => s.uuid.toLowerCase() === OMRON_SERVICE_UUID,
    );

    if (!service) {
      throw new Error('HEM FE4A service not found');
    }

    return service;
  }

  async function getWriteChar(device: Device) {
    const service = await getOmronService(device);
    const chars = await service.characteristics();

    const writeChar = chars.find(
      c => c.uuid.toLowerCase() === OMRON_WRITE_UUID,
    );

    if (!writeChar) {
      throw new Error('HEM write characteristic not found');
    }

    return writeChar;
  }

  function parseHem7141T1Record(recordBytes: Buffer): BpRecord | null {
    if (!recordBytes || recordBytes.length < 14) return null;

    const rawHex = Buffer.from(recordBytes).toString('hex').toUpperCase();

    if (
      rawHex === '0000000000000000000000000000' ||
      rawHex === 'FFFFFFFFFFFFFFFFFFFFFFFFFFFF'
    ) {
      return null;
    }

    for (let shift = 0; shift <= 8; shift++) {
      const sys = recordBytes[shift] + 25;
      const dia = recordBytes[shift + 1];
      const bpm = recordBytes[shift + 2];

      console.log('TRY BP CANDIDATE:', {
        shift,
        sys,
        dia,
        bpm,
        rawHex,
      });

      if (
        sys >= 60 &&
        sys <= 260 &&
        dia >= 30 &&
        dia <= 180 &&
        sys > dia &&
        bpm >= 20 &&
        bpm <= 240
      ) {
        console.log('ACCEPT RECORD:', { shift, sys, dia, bpm, rawHex });
        return buildRecord(recordBytes, sys, dia, bpm);
      }
    }

    console.log('REJECT RECORD:', rawHex);
    return null;
  }

  function buildRecord(
    recordBytes: Buffer,
    sys: number,
    dia: number,
    bpm: number,
  ): BpRecord {
    return {
      sys,
      dia,
      bpm,
      pulse: bpm,
      ihb: 0,
      mov: 0,
      datetime: null,
      rawDateHex: Buffer.from(recordBytes.subarray(3, 8))
        .toString('hex')
        .toUpperCase(),
      rawHex: Buffer.from(recordBytes).toString('hex').toUpperCase(),
    };
  }

  function isValidBP(sys: number, dia: number, pulse: number): boolean {
    return (
      Number.isFinite(sys) &&
      Number.isFinite(dia) &&
      Number.isFinite(pulse) &&
      sys >= 70 &&
      sys <= 250 &&
      dia >= 40 &&
      dia <= 160 &&
      sys > dia &&
      pulse >= 30 &&
      pulse <= 220
    );
  }

  function pad2(v: number): string {
    return String(v).padStart(2, '0');
  }

  async function disconnectDevice() {
    try {
      removeMonitors();

      if (connectedRef.current) {
        const isConnected = await connectedRef.current
          .isConnected()
          .catch(() => false);

        if (isConnected) {
          await connectedRef.current.cancelConnection();
        }
      }
    } catch (e) {
      console.log('DISCONNECT ERROR:', e);
    }

    clearConnectionState('Disconnected');
  }

  function delay(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  return (
    <View style={styles.deviceWrap}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack?.()}
        >
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Blood Pressure</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.statusText}>{status}</Text>
      <Text style={styles.statusText}>Bluetooth: {bleState}</Text>

      {connectedName ? (
        <Text style={styles.statusText}>Connected: {connectedName}</Text>
      ) : null}

      {lastPacketHex ? (
        <Text style={styles.packetText}>Packet: {lastPacketHex}</Text>
      ) : null}

      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>SYS</Text>
          <Text style={styles.metricValue}>
            {bpValue.sys !== null ? bpValue.sys : '--'}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>DIA</Text>
          <Text style={styles.metricValue}>
            {bpValue.dia !== null ? bpValue.dia : '--'}
          </Text>
        </View>

        <View style={[styles.metricCard, styles.metricCardLast]}>
          <Text style={styles.metricLabel}>Pulse</Text>
          <Text style={styles.metricValue}>
            {bpValue.pulse !== null ? bpValue.pulse : '--'}
          </Text>
        </View>
      </View>

      {records.length > 0 ? (
        <View style={styles.recordsBox}>
          <Text style={styles.recordsTitle}>Records: {records.length}</Text>

          <ScrollView style={styles.recordsScroll}>
            {records.map((item, index) => {
                const pulse = item.bpm ?? item.pulse ?? '--';

                return (
                  <View
                    key={`${item.rawHex || item.id || String(index)}`}
                    style={styles.recordRow}
                  >
                    <Text style={styles.recordText}>
                      {item.source || 'EEPROM'} | U{item.user || 1} | #
                      {item.index || index + 1}
                    </Text>

                    <Text style={styles.recordValueText}>
                      {item.sys}/{item.dia} mmHg
                    </Text>

                    <Text style={styles.recordText}>Pulse: {pulse}</Text>

                    <Text style={styles.recordText}>
                      Addr:{' '}
                      {item.absoluteAddress
                        ? item.absoluteAddress.toString(16)
                        : '-'}{' '}
                      | Offset: {item.memoryOffset ?? '-'}
                    </Text>
                  </View>
                );
              })}
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.emptyText}>No records to display</Text>
      )}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Nearby Omron Devices</Text>
        {isScanning ? <ActivityIndicator size="small" color="#65b546" /> : null}
      </View>

      <ScrollView
        style={styles.listWrap}
        contentContainerStyle={styles.listContent}
      >
        {devices.map(item => (
          <View key={item.id} style={styles.deviceRow}>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.deviceMeta}>
                {item.id}
                {typeof item.rssi === 'number' ? ` | RSSI ${item.rssi}` : ''}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => connectScannedDevice(item)}
              disabled={connectingRef.current}
            >
              <Text style={styles.connectButtonText}>Connect</Text>
            </TouchableOpacity>
          </View>
        ))}

        {!devices.length ? (
          <Text style={styles.emptyText}>No Omron device found</Text>
        ) : null}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.scanButton,
          isScanning ? styles.scanButtonDisabled : null,
        ]}
        onPress={startScan}
        disabled={isScanning}
      >
        <Text style={styles.scanButtonText}>
          {isScanning ? 'Scanning...' : 'Scan Again'}
        </Text>
      </TouchableOpacity>

      {connectedName ? (
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={disconnectDevice}
        >
          <Text style={styles.scanButtonText}>Disconnect</Text>
        </TouchableOpacity>
      ) : null}

      {hasValidBpReading ? (
        <TouchableOpacity
          style={styles.doneButton}
          onPress={openResultModal}
        >
          <Text style={styles.scanButtonText}>Done</Text>
        </TouchableOpacity>
      ) : null}

      {savedResult ? (
        <BpResultModal
          visible={resultModalVisible}
          result={savedResult}
          onClose={handleCloseResultModal}
          onDone={() => {
            void handleResultDone();
          }}
          isDoneLoading={isDoneLoading}
        />
      ) : null}

      <GeneratePdfModal
        visible={pdfModalVisible}
        onGeneratePdf={() => {
          void handleGeneratePdf();
        }}
        onClose={handleClosePdfModal}
        isPdfLoading={isPdfLoading}
      />
    </View>
  );
}

const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const GREEN = '#059669';
const GREEN_LIGHT = '#ECFDF5';
const AMBER_LIGHT = '#FFFBEB';

const BpMetricRow = ({ label, value }: { label: string; value: string }) => (
  <View style={bpModalStyles.metricRow}>
    <Text style={bpModalStyles.metricLabel}>{label}</Text>
    <Text style={bpModalStyles.metricValue}>{value}</Text>
  </View>
);

type BpResultModalProps = {
  visible: boolean;
  result: BpResultSnapshot;
  onClose: () => void;
  onDone: () => void;
  isDoneLoading: boolean;
};

const BpResultModal = ({
  visible,
  result,
  onClose,
  onDone,
  isDoneLoading,
}: BpResultModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={bpModalStyles.modalOverlay}>
      <View style={bpModalStyles.modalContainer}>
        <View style={bpModalStyles.modalHeader}>
          <View style={bpModalStyles.modalTitleWrap}>
            <Text style={bpModalStyles.modalTitle}>Blood Pressure Results</Text>
            <View style={bpModalStyles.readingBadge}>
              <Text style={bpModalStyles.readingBadgeLabel}>Reading</Text>
              <Text style={bpModalStyles.readingBadgeValue}>
                {result.sys}/{result.dia} mmHg
              </Text>
            </View>
          </View>
          <TouchableOpacity style={bpModalStyles.closeBtn} onPress={onClose}>
            <Text style={bpModalStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={bpModalStyles.cardsRow}>
          <View style={[bpModalStyles.metricCard, bpModalStyles.sysCard]}>
            <View style={bpModalStyles.metricCardHeader}>
              <Text style={bpModalStyles.metricCardIcon}>🩺</Text>
              <Text style={bpModalStyles.metricCardTitle}>Systolic</Text>
            </View>
            <View style={bpModalStyles.divider} />
            <BpMetricRow label="SYS" value={`${result.sys} mmHg`} />
          </View>

          <View style={[bpModalStyles.metricCard, bpModalStyles.diaCard]}>
            <View style={bpModalStyles.metricCardHeader}>
              <Text style={bpModalStyles.metricCardIcon}>🩺</Text>
              <Text style={bpModalStyles.metricCardTitle}>Diastolic</Text>
            </View>
            <View style={bpModalStyles.divider} />
            <BpMetricRow label="DIA" value={`${result.dia} mmHg`} />
          </View>
        </View>

        <View style={[bpModalStyles.metricCard, bpModalStyles.pulseCard]}>
          <View style={bpModalStyles.metricCardHeader}>
            <Text style={bpModalStyles.metricCardIcon}>💓</Text>
            <Text style={bpModalStyles.metricCardTitle}>Pulse Rate</Text>
          </View>
          <View style={bpModalStyles.divider} />
          <BpMetricRow label="Pulse" value={`${result.pulse} bpm`} />
        </View>

        <View style={bpModalStyles.legend}>
          <Text style={bpModalStyles.legendText}>
            SYS: Systolic pressure &nbsp;·&nbsp; DIA: Diastolic pressure
            &nbsp;·&nbsp; Pulse: Heart rate
          </Text>
        </View>

        <View style={bpModalStyles.actionsRow}>
          <TouchableOpacity
            style={[bpModalStyles.actionBtn, bpModalStyles.scanAgainOutline]}
            onPress={onClose}
          >
            <Text style={bpModalStyles.scanAgainOutlineText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              bpModalStyles.actionBtn,
              bpModalStyles.doneBtn,
              isDoneLoading && bpModalStyles.disabledBtn,
            ]}
            onPress={onDone}
            disabled={isDoneLoading}
          >
            {isDoneLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={bpModalStyles.doneBtnText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

type GeneratePdfModalProps = {
  visible: boolean;
  onGeneratePdf: () => void;
  onClose: () => void;
  isPdfLoading: boolean;
};

const GeneratePdfModal = ({
  visible,
  onGeneratePdf,
  onClose,
  isPdfLoading,
}: GeneratePdfModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={bpModalStyles.modalOverlay}>
      <View style={bpModalStyles.modalContainer}>
        <View style={bpModalStyles.modalHeader}>
          <View style={bpModalStyles.modalTitleWrap}>
            <Text style={bpModalStyles.modalTitle}>Results Saved</Text>
            <Text style={bpModalStyles.pdfModalSubtitle}>
              Blood pressure data has been recorded. Generate a PDF report to
              view detailed results.
            </Text>
          </View>
          <TouchableOpacity
            style={bpModalStyles.closeBtn}
            onPress={onClose}
            disabled={isPdfLoading}
          >
            <Text style={bpModalStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            bpModalStyles.generatePdfBtn,
            isPdfLoading && bpModalStyles.disabledBtn,
          ]}
          onPress={onGeneratePdf}
          disabled={isPdfLoading}
        >
          {isPdfLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={bpModalStyles.generatePdfBtnText}>Generate PDF</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  deviceWrap: {
    flex: 1,
    backgroundColor: '#f6f8f5',
    padding: 16,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
  },
  backButtonText: {
    fontSize: 28,
    color: '#222',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#222',
  },
  headerSpacer: {
    width: 40,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  packetText: {
    marginTop: 8,
    fontSize: 12,
    color: '#555',
  },
  metricRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    elevation: 2,
  },
  metricCardLast: {
    marginRight: 0,
  },
  metricLabel: {
    fontSize: 13,
    color: '#777',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 30,
    color: '#65b546',
    fontWeight: '800',
    marginTop: 6,
  },
  recordsBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    maxHeight: 260,
  },
  recordsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#222',
    marginBottom: 8,
  },
  recordsScroll: {
    maxHeight: 210,
  },
  recordRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
  },
  recordText: {
    fontSize: 13,
    color: '#333',
  },
  recordValueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  rawText: {
    fontSize: 10,
    color: '#777',
    marginTop: 3,
  },
  listHeader: {
    marginTop: 24,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  deviceRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  deviceMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  connectButton: {
    backgroundColor: '#65b546',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#777',
    marginTop: 30,
  },
  scanButton: {
    backgroundColor: '#65b546',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  disconnectButton: {
    backgroundColor: '#d9534f',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  doneButton: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
});

const bpModalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  pdfModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 4,
  },
  readingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    gap: 6,
  },
  readingBadgeLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  readingBadgeValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    borderRadius: 16,
    padding: 14,
  },
  sysCard: {
    flex: 1,
    backgroundColor: BLUE_LIGHT,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  diaCard: {
    flex: 1,
    backgroundColor: GREEN_LIGHT,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pulseCard: {
    backgroundColor: AMBER_LIGHT,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  metricCardIcon: {
    fontSize: 18,
  },
  metricCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  metricLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'right',
  },
  legend: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scanAgainOutline: {
    borderWidth: 1.5,
    borderColor: BLUE,
    backgroundColor: 'transparent',
  },
  scanAgainOutlineText: {
    color: BLUE,
    fontWeight: '700',
    fontSize: 15,
  },
  doneBtn: {
    backgroundColor: BLUE,
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  generatePdfBtn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  generatePdfBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
