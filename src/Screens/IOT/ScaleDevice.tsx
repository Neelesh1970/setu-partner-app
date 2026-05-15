import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ms, s, vs} from 'react-native-size-matters';
import {BleManager, Device, Subscription} from 'react-native-ble-plx';
import {Buffer} from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'SCALE_WEIGHT_HISTORY';

const UUID = {
  SVC_T1: '0000ffe0-0000-1000-8000-00805f9b34fb',
  NOTIFY_T1: '0000ffe1-0000-1000-8000-00805f9b34fb',
  WRITE_CONFIG_T1: '0000ffe3-0000-1000-8000-00805f9b34fb',
  WRITE_TIME_T1: '0000ffe4-0000-1000-8000-00805f9b34fb',
  SVC_T2: '0000fff0-0000-1000-8000-00805f9b34fb',
  NOTIFY_T2: '0000fff1-0000-1000-8000-00805f9b34fb',
  WRITE_SHARED_T2: '0000fff2-0000-1000-8000-00805f9b34fb',
} as const;

const SCALE_UNIX_TIMESTAMP_OFFSET = 946702800;

interface WeightRecord {
  id: string;
  weight: number;
  heightCm: number | null;
  bmi: number | null;
  category: string;
  date: string;
}

function bytesToHex(bytes: number[]): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function base64ToBytes(value: string): number[] {
  return Array.from(Buffer.from(value, 'base64'));
}

function bytesToBase64(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

function checksum(
  bytes: number[],
  from = 0,
  toInclusive = bytes.length - 1,
): number {
  let sum = 0;
  for (let i = from; i <= toInclusive; i++) {
    sum = (sum + (bytes[i] & 0xff)) & 0xff;
  }
  return sum;
}

function u16be(a: number, b: number): number {
  return ((a & 0xff) << 8) | (b & 0xff);
}

function hasService(device: Device, serviceUuid: string): boolean {
  const list = device.serviceUUIDs ?? [];
  return list.map(x => x.toLowerCase()).includes(serviceUuid.toLowerCase());
}

function getBmiCategory(bmi: number | null): string {
  if (!bmi) return '-';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export default function ScaleDeviceScreen() {
  const {width: windowWidth} = useWindowDimensions();
  const [status, setStatus] = useState('Idle');
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedName, setConnectedName] = useState('');
  const [weight, setWeight] = useState<number | null>(null);
  const [lastHex, setLastHex] = useState('');

  const [heightCm, setHeightCm] = useState('');
  const [bmi, setBmi] = useState<number | null>(null);
  const [history, setHistory] = useState<WeightRecord[]>([]);

  const deviceMap = useRef(new Map<string, Device>());
  const connectedDevice = useRef<Device | null>(null);
  const notifySubs = useRef<Subscription[]>([]);

  // Per-mount BleManager. The previous module-scoped manager survived navigation
  // and got destroyed on first unmount → every subsequent visit threw
  // "BleManager was destroyed" because the dead instance kept being reused.
  const managerRef = useRef<BleManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new BleManager();
  }
  const manager = managerRef.current;

  const seenProtocolType = useRef<number>(0x00);
  const weightScaleFactor = useRef<number>(100);
  const hasReceivedProtocolType = useRef<boolean>(false);
  const sameCount = useRef<number>(0);
  const lastWeight = useRef<number | null>(null);
  const savedStableWeight = useRef<number | null>(null);

  useEffect(() => {
    void loadHistory();
    return () => {
      // Drain async BLE work BEFORE destroying the manager, otherwise the in-flight
      // cancelConnection / monitor promises reject with "BleManager was destroyed"
      // and surface as unhandled rejections.
      void (async () => {
        try {
          await stopAll();
        } catch (e) {
          console.log('CLEANUP STOPALL ERROR:', e);
        }
        try {
          managerRef.current?.destroy();
        } catch (e) {
          console.log('CLEANUP DESTROY ERROR:', e);
        }
        managerRef.current = null;
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    calculateBmi(weight, heightCm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weight, heightCm]);

  async function loadHistory(): Promise<void> {
    try {
      const old = await AsyncStorage.getItem(STORAGE_KEY);
      if (old) {
        setHistory(JSON.parse(old) as WeightRecord[]);
      }
    } catch (e) {
      console.log('LOAD HISTORY ERROR:', e);
    }
  }

  function calculateBmi(w: number | null, hCm: string): void {
    const height = parseFloat(hCm);
    const wt = w ?? 0;

    if (!height || !wt || height <= 0) {
      setBmi(null);
      return;
    }

    const meter = height / 100;
    const result = wt / (meter * meter);
    setBmi(Number(result.toFixed(1)));
  }

  async function saveWeightRecord(finalWeight: number): Promise<void> {
    try {
      if (!finalWeight) return;
      if (savedStableWeight.current === finalWeight) return;
      savedStableWeight.current = finalWeight;

      const height = parseFloat(heightCm);
      const meter = height ? height / 100 : null;
      const bmiValue =
        meter && finalWeight
          ? Number((finalWeight / (meter * meter)).toFixed(1))
          : null;

      const record: WeightRecord = {
        id: Date.now().toString(),
        weight: finalWeight,
        heightCm: height || null,
        bmi: bmiValue,
        category: getBmiCategory(bmiValue),
        date: new Date().toLocaleString(),
      };

      const newHistory = [record, ...history].slice(0, 20);
      setHistory(newHistory);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));

      console.log('SAVED WEIGHT RECORD:', record);
    } catch (e) {
      console.log('SAVE HISTORY ERROR:', e);
    }
  }

  async function clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setHistory([]);
    } catch (e) {
      console.log('CLEAR HISTORY ERROR:', e);
    }
  }

  async function requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function startScan(): Promise<void> {
    const ok = await requestPermissions();
    if (!ok) {
      setStatus('Bluetooth permission denied');
      return;
    }

    setDevices([]);
    deviceMap.current.clear();
    setWeight(null);
    setStatus('Scanning... Step on scale now');

    manager.startDeviceScan(null, {allowDuplicates: true}, (error, device) => {
      if (!managerRef.current) {
        // Component unmounted mid-scan; ignore late callbacks.
        return;
      }
      if (error) {
        console.log('SCAN ERROR:', error);
        setStatus(error.message);
        return;
      }

      if (!device) return;

      const name = device.name ?? device.localName ?? '';
      const isTarget =
        name.startsWith('FT_') ||
        name.toLowerCase().includes('qn') ||
        name.toLowerCase().includes('renpho') ||
        hasService(device, UUID.SVC_T1) ||
        hasService(device, UUID.SVC_T2);

      console.log('FOUND:', {
        id: device.id,
        name,
        rssi: device.rssi,
        serviceUUIDs: device.serviceUUIDs,
      });

      if (!isTarget) return;

      deviceMap.current.set(device.id, device);
      setDevices(Array.from(deviceMap.current.values()));
    });
  }

  async function connect(device: Device): Promise<void> {
    try {
      manager.stopDeviceScan();

      setStatus(`Connecting ${device.name ?? device.id}...`);
      const d = await manager.connectToDevice(device.id, {
        autoConnect: false,
      });

      connectedDevice.current = d;
      setConnectedName(d.name ?? d.localName ?? d.id);

      setStatus('Discovering services...');
      await d.discoverAllServicesAndCharacteristics();

      const mtuDevice = await d.requestMTU(185).catch(() => d);
      connectedDevice.current = mtuDevice;

      resetProtocolState();

      setStatus('Subscribing notifications...');
      await subscribeAll(mtuDevice);

      setStatus('Connected. Step on scale and wait for weight...');
    } catch (e) {
      console.log('CONNECT ERROR:', e);
      setStatus(`Connect error: ${(e as Error).message}`);
    }
  }

  function resetProtocolState(): void {
    seenProtocolType.current = 0x00;
    weightScaleFactor.current = 100;
    hasReceivedProtocolType.current = false;
    sameCount.current = 0;
    lastWeight.current = null;
    savedStableWeight.current = null;
    setWeight(null);
    setLastHex('');
  }

  async function subscribeAll(device: Device): Promise<void> {
    notifySubs.current.forEach(s => s?.remove?.());
    notifySubs.current = [];

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

    await tryMonitor(device, UUID.SVC_T1, UUID.NOTIFY_T1);
    await tryMonitor(device, UUID.SVC_T2, UUID.NOTIFY_T2);
  }

  async function tryMonitor(
    device: Device,
    serviceUuid: string,
    charUuid: string,
  ): Promise<void> {
    try {
      const sub = device.monitorCharacteristicForService(
        serviceUuid,
        charUuid,
        (error, characteristic) => {
          if (error) {
            console.log(
              'NOTIFY ERROR:',
              serviceUuid,
              charUuid,
              error.message,
            );
            return;
          }

          if (!characteristic?.value) return;

          const bytes = base64ToBytes(characteristic.value);
          const hex = bytesToHex(bytes);

          console.log('LIVE NOTIFY HEX:', hex);
          console.log('BYTES:', bytes);

          setLastHex(hex);
          handleVendorPacket(bytes, device);
        },
      );

      notifySubs.current.push(sub);
      console.log('MONITOR OK:', serviceUuid, charUuid);
    } catch (e) {
      console.log('MONITOR SKIP:', serviceUuid, charUuid, (e as Error).message);
    }
  }

  function handleVendorPacket(bytes: number[], device: Device): void {
    if (bytes.length < 3) return;

    if (seenProtocolType.current === 0x00 && bytes.length > 2) {
      seenProtocolType.current = bytes[2] & 0xff;
      console.log(
        'CAPTURED protocol type:',
        seenProtocolType.current.toString(16),
      );
    }

    const opcode = bytes[0] & 0xff;

    if (opcode === 0x12) {
      handleScaleInfoFrame(bytes, device);
      return;
    }

    if (opcode === 0x10) {
      handleLiveWeightFrame(bytes);
      return;
    }

    if (opcode === 0x14) {
      console.log('0x14 ACK received, sending time sync');
      void sendTimeSync(device);
      return;
    }

    console.log('UNHANDLED OPCODE:', opcode.toString(16), bytesToHex(bytes));
  }

  function handleScaleInfoFrame(bytes: number[], device: Device): void {
    console.log('SCALE INFO 0x12:', bytesToHex(bytes));

    if (bytes.length > 10) {
      weightScaleFactor.current = bytes[10] === 1 ? 100 : 10;
      console.log('weightScaleFactor:', weightScaleFactor.current);
    }

    if (bytes.length >= 12) {
      const rawMaybeWeight = u16be(bytes[10], bytes[11]);
      const kg10 = rawMaybeWeight / 10;
      const kg100 = rawMaybeWeight / 100;

      console.log('0x12 candidate weight /10:', kg10);
      console.log('0x12 candidate weight /100:', kg100);

      if (kg10 > 5 && kg10 < 250) {
        updateWeight(kg10, false);
      }
    }

    if (!hasReceivedProtocolType.current) {
      hasReceivedProtocolType.current = true;
      void sendConfigurationCommands(device);
    }
  }

  function handleLiveWeightFrame(bytes: number[]): void {
    console.log('LIVE WEIGHT 0x10:', bytesToHex(bytes));

    if (bytes.length < 10) return;

    const raw = u16be(bytes[3], bytes[4]);
    const kg = raw / 100;
    const stable = bytes[5] === 1 || bytes[5] === 2;

    console.log({
      stable,
      raw,
      kg,
      r1: u16be(bytes[6], bytes[7]),
      r2: u16be(bytes[8], bytes[9]),
    });

    if (kg > 5 && kg < 250) {
      updateWeight(kg, stable);
    }
  }

  function updateWeight(kg: number, stable: boolean): void {
    const rounded = Math.round(kg * 10) / 10;

    if (lastWeight.current === rounded) {
      sameCount.current += 1;
    } else {
      sameCount.current = 0;
      savedStableWeight.current = null;
    }

    lastWeight.current = rounded;
    setWeight(rounded);

    console.log(
      'WEIGHT RESULT:',
      rounded,
      'stable:',
      stable,
      'same:',
      sameCount.current,
    );

    if (stable || sameCount.current >= 3) {
      setStatus(`Stable weight: ${rounded} kg`);
      console.log('STABLE WEIGHT:', rounded);
      void saveWeightRecord(rounded);
    } else {
      setStatus(`Live weight: ${rounded} kg`);
    }
  }

  async function sendConfigurationCommands(device: Device): Promise<void> {
    console.log('Sending QN config...');

    const unitKg = 0x01;
    const protocol = seenProtocolType.current || 0x00;

    const cfg: number[] = [
      0x13, 0x09, protocol, unitKg, 0x10, 0x00, 0x00, 0x00, 0x00,
    ];
    cfg[cfg.length - 1] = checksum(cfg, 0, cfg.length - 1);

    await writeAny(device, cfg, 'CONFIG');
    await sendTimeSync(device);
  }

  async function sendTimeSync(device: Device): Promise<void> {
    const epochSecs =
      Math.floor(Date.now() / 1000) - SCALE_UNIX_TIMESTAMP_OFFSET;

    const t = epochSecs >>> 0;
    const protocol = seenProtocolType.current || 0x00;

    const msg20: number[] = [
      0x20,
      0x08,
      protocol,
      t & 0xff,
      (t >>> 8) & 0xff,
      (t >>> 16) & 0xff,
      (t >>> 24) & 0xff,
      0x00,
    ];
    msg20[msg20.length - 1] = checksum(msg20, 0, msg20.length - 2);

    await writeAny(device, msg20, 'TIME 0x20');

    const timeMagic: number[] = [
      0x02,
      t & 0xff,
      (t >>> 8) & 0xff,
      (t >>> 16) & 0xff,
      (t >>> 24) & 0xff,
    ];

    await writeAny(device, timeMagic, 'TIME MAGIC');
  }

  async function writeAny(
    device: Device,
    bytes: number[],
    label: string,
  ): Promise<boolean> {
    const b64 = bytesToBase64(bytes);

    const targets: [string, string][] = [
      [UUID.SVC_T1, UUID.WRITE_CONFIG_T1],
      [UUID.SVC_T1, UUID.WRITE_TIME_T1],
      [UUID.SVC_T2, UUID.WRITE_SHARED_T2],
    ];

    for (const [svc, chr] of targets) {
      try {
        await device.writeCharacteristicWithResponseForService(svc, chr, b64);
        console.log('WRITE OK:', label, svc, chr, bytesToHex(bytes));
        return true;
      } catch (e) {
        console.log('WRITE SKIP:', label, svc, chr, (e as Error).message);
      }
    }

    return false;
  }

  async function stopAll(): Promise<void> {
    try {
      manager.stopDeviceScan();
    } catch {
      /* noop */
    }

    notifySubs.current.forEach(s => s?.remove?.());
    notifySubs.current = [];

    try {
      if (connectedDevice.current) {
        await connectedDevice.current.cancelConnection();
      }
    } catch {
      /* noop */
    }

    connectedDevice.current = null;
    setConnectedName('');
    setStatus('Stopped');
  }

  const weightFontSize = windowWidth < 340 ? ms(40) : windowWidth < 380 ? ms(48) : ms(56);
  const weightUnitFontSize = windowWidth < 340 ? ms(16) : ms(20);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Smart Scale</Text>
          <Text style={styles.headerSub}>QN / FT BLE Weight Monitor</Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>{status}</Text>
          <Text style={styles.connectedText}>
            Connected: {connectedName || 'Not connected'}
          </Text>
        </View>

        <View style={styles.weightCard}>
          <Text style={styles.smallTitle}>Current Weight</Text>
          <Text
            style={[styles.weightValue, {fontSize: weightFontSize}]}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            numberOfLines={1}>
            {weight ? `${weight}` : '--'}
            <Text style={[styles.weightUnit, {fontSize: weightUnitFontSize}]}> kg</Text>
          </Text>

          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>
              {weight ? 'Receiving data' : 'Waiting for scale'}
            </Text>
          </View>
        </View>

        <View style={styles.bmiCard}>
          <Text style={styles.sectionTitle}>BMI Calculator</Text>

          <Text style={styles.inputLabel}>Height</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              placeholder="Enter height"
              placeholderTextColor="#999"
              style={styles.input}
            />
            <Text style={styles.cmText}>cm</Text>
          </View>

          <View style={styles.bmiResultRow}>
            <View>
              <Text style={styles.bmiLabel}>BMI</Text>
              <Text style={styles.bmiValue}>{bmi ?? '--'}</Text>
            </View>

            <View style={styles.categoryBox}>
              <Text style={styles.categoryText}>{getBmiCategory(bmi)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => void startScan()}>
            <Text style={styles.primaryBtnText}>Scan Scale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stopBtn}
            onPress={() => void stopAll()}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.debugCard}>
          <Text style={styles.debugTitle}>Last Packet</Text>
          <Text style={styles.debugHex}>{lastHex || '-'}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Found Devices</Text>
        </View>

        {devices.length === 0 ? (
          <Text style={styles.emptyText}>No scale found yet</Text>
        ) : (
          devices.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.deviceCard}
              onPress={() => void connect(item)}>
              <View style={styles.deviceLeft}>
                <Text style={styles.deviceName} numberOfLines={2} ellipsizeMode="tail">
                  {item.name ?? item.localName ?? 'Unknown Device'}
                </Text>
                <Text style={styles.deviceId} numberOfLines={2} ellipsizeMode="middle">
                  {item.id}
                </Text>
                <Text style={styles.deviceInfo}>RSSI: {item.rssi}</Text>
              </View>
              <Text style={styles.connectText}>Connect</Text>
            </TouchableOpacity>
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Records</Text>

          {history.length > 0 && (
            <TouchableOpacity onPress={() => void clearHistory()}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {history.length === 0 ? (
          <Text style={styles.emptyText}>No saved weight records</Text>
        ) : (
          history.map(item => (
            <View key={item.id} style={styles.historyCard}>
              <View>
                <Text style={styles.historyWeight}>{item.weight} kg</Text>
                <Text style={styles.historyDate}>{item.date}</Text>
              </View>

              <View style={styles.historyRight}>
                <Text style={styles.historyBmi}>
                  BMI {item.bmi ?? '--'}
                </Text>
                <Text style={styles.historyCategory}>{item.category}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  content: {
    padding: ms(16),
    paddingBottom: vs(40),
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#2F387E',
    padding: ms(20),
    borderRadius: ms(22),
    marginBottom: vs(14),
  },
  headerTitle: {
    fontSize: ms(24),
    fontWeight: '800',
    color: '#fff',
  },
  headerSub: {
    fontSize: ms(13),
    color: '#DDE2FF',
    marginTop: vs(4),
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: ms(14),
    borderRadius: ms(16),
    marginBottom: vs(12),
    elevation: 2,
  },
  statusLabel: {
    fontSize: ms(11),
    color: '#777',
    marginBottom: vs(4),
  },
  statusText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#111',
  },
  connectedText: {
    marginTop: vs(8),
    fontSize: ms(12),
    color: '#666',
  },
  weightCard: {
    backgroundColor: '#080B37',
    paddingVertical: vs(20),
    paddingHorizontal: ms(16),
    borderRadius: ms(22),
    marginBottom: vs(12),
    alignItems: 'center',
    width: '100%',
    maxWidth: '100%',
  },
  smallTitle: {
    color: '#BFC4FF',
    fontSize: ms(13),
    marginBottom: vs(8),
  },
  weightValue: {
    color: '#fff',
    fontWeight: '900',
    textAlign: 'center',
    maxWidth: '100%',
  },
  weightUnit: {
    fontWeight: '600',
  },
  liveBadge: {
    backgroundColor: '#1B2187',
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
    borderRadius: ms(18),
    marginTop: vs(10),
    maxWidth: '100%',
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: ms(11),
    fontWeight: '700',
    textAlign: 'center',
  },
  bmiCard: {
    backgroundColor: '#fff',
    padding: ms(16),
    borderRadius: ms(20),
    marginBottom: vs(12),
    elevation: 2,
  },
  sectionTitle: {
    fontSize: ms(17),
    fontWeight: '800',
    color: '#111',
    flexShrink: 1,
  },
  inputLabel: {
    marginTop: vs(12),
    marginBottom: vs(8),
    color: '#666',
    fontSize: ms(12),
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    borderRadius: ms(12),
    paddingHorizontal: ms(12),
    borderWidth: 1,
    borderColor: '#E5E7F0',
    minWidth: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: vs(46),
    fontSize: ms(16),
    color: '#111',
    fontWeight: '700',
  },
  cmText: {
    fontSize: ms(14),
    color: '#666',
    fontWeight: '700',
  },
  bmiResultRow: {
    marginTop: vs(16),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    rowGap: vs(8),
    columnGap: ms(8),
  },
  bmiLabel: {
    color: '#777',
    fontSize: ms(12),
  },
  bmiValue: {
    fontSize: ms(30),
    fontWeight: '900',
    color: '#2F387E',
  },
  categoryBox: {
    backgroundColor: '#FFF5F0',
    borderColor: '#E2956B',
    borderWidth: 1,
    paddingHorizontal: ms(12),
    paddingVertical: vs(8),
    borderRadius: ms(16),
    maxWidth: '100%',
  },
  categoryText: {
    color: '#B75B2B',
    fontWeight: '800',
    fontSize: ms(12),
  },
  actionRow: {
    flexDirection: 'row',
    gap: ms(10),
    marginBottom: vs(12),
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    minWidth: 0,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: vs(48),
    backgroundColor: '#080B37',
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(8),
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: ms(14),
    textAlign: 'center',
  },
  stopBtn: {
    width: s(92),
    flexShrink: 0,
    minHeight: vs(48),
    backgroundColor: '#fff',
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DADCE8',
    paddingHorizontal: ms(6),
  },
  stopBtnText: {
    color: '#080B37',
    fontWeight: '800',
    fontSize: ms(13),
  },
  debugCard: {
    backgroundColor: '#fff',
    padding: ms(12),
    borderRadius: ms(14),
    marginBottom: vs(14),
  },
  debugTitle: {
    fontSize: ms(12),
    color: '#777',
    marginBottom: vs(6),
  },
  debugHex: {
    fontSize: ms(10),
    color: '#333',
  },
  sectionHeader: {
    marginTop: vs(8),
    marginBottom: vs(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: vs(6),
    columnGap: ms(8),
  },
  emptyText: {
    color: '#777',
    marginBottom: vs(10),
    fontSize: ms(13),
  },
  deviceCard: {
    backgroundColor: '#fff',
    padding: ms(12),
    borderRadius: ms(16),
    marginBottom: vs(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: ms(8),
    minWidth: 0,
  },
  deviceLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: ms(8),
  },
  deviceName: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#111',
  },
  deviceId: {
    fontSize: ms(11),
    color: '#666',
    marginTop: vs(3),
  },
  deviceInfo: {
    fontSize: ms(11),
    color: '#888',
    marginTop: vs(3),
  },
  connectText: {
    color: '#1B2187',
    fontWeight: '800',
    fontSize: ms(13),
    flexShrink: 0,
  },
  clearText: {
    color: '#D94A4A',
    fontWeight: '800',
    fontSize: ms(13),
  },
  historyCard: {
    backgroundColor: '#fff',
    padding: ms(14),
    borderRadius: ms(16),
    marginBottom: vs(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: ms(10),
    minWidth: 0,
  },
  historyWeight: {
    fontSize: ms(20),
    fontWeight: '900',
    color: '#111',
  },
  historyDate: {
    fontSize: ms(11),
    color: '#777',
    marginTop: vs(4),
    flexShrink: 1,
  },
  historyRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    maxWidth: '48%',
  },
  historyBmi: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#2F387E',
    textAlign: 'right',
  },
  historyCategory: {
    fontSize: ms(11),
    color: '#777',
    marginTop: vs(4),
    textAlign: 'right',
  },
});
