import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BluetoothDevice } from 'react-native-bluetooth-classic';
import type { BluetoothEventSubscription } from 'react-native-bluetooth-classic';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';
import type { RootStackParamList } from '../../navigation/types';
import EcgWaveform from '../../Components/EcgWaveform/EcgWaveform';
import {
  connectClassicDevice,
  disconnectClassicDevice,
  discoverClassicDevices,
  ensureAshaBluetoothReady,
  findClassicDeviceByAddress,
  getSavedClassicDeviceAddress,
  isBluetoothClassicNativeLinked,
  openClassicBluetoothSettings,
  saveClassicDeviceAddress,
  sendClassicDeviceCommand,
  subscribeClassicDeviceData,
  BLUETOOTH_CLASSIC_REBUILD_MESSAGE,
  type AshaDeviceCommand,
} from '../../Services/ashaBluetoothClassic';
import {
  appendEcgSamples,
  buildStoredEcgPayload,
  classifyAshaEcgPayload,
  formatEcgSummary,
  parseAshaEcgSamples,
  type AshaStoredEcgPayload,
} from '../../Utils/ashaEcgParser';

type DeviceType = AshaDeviceCommand;

type Reading = {
  id: string;
  patientId: string;
  deviceType: DeviceType | 'unknown';
  deviceName: string;
  rawData: string;
  createdAt: string;
  ecgSamples?: number[];
  ecgData?: AshaStoredEcgPayload;
  values: {
    glucose?: string;
    temperature?: string;
    bp?: string;
    spo2?: string;
    pulse?: string;
    ecg?: string;
    steth?: string;
  };
};

type AshaDeviceNav = NativeStackNavigationProp<RootStackParamList, 'AshaDevice'>;

const STORAGE_KEY = 'bluetooth_patient_readings';

const DEVICE_LABEL: Record<DeviceType, string> = {
  g: 'Glucometer',
  m: 'Thermometer',
  e: 'ECG',
  s: 'Stethoscope Start',
  q: 'Stethoscope Stop',
  t: 'Torch On',
  x: 'Torch Off',
  b: 'Blood Pressure',
  p: 'Pulse Oximeter',
  r: 'Read All Values',
};

const DEVICE_COMMANDS: DeviceType[] = ['g', 'm', 'b', 'p', 'e', 's', 'q', 't', 'x', 'r'];

const COMMAND_BUTTON_LABEL: Record<DeviceType, string> = {
  g: 'Glucometer',
  m: 'Thermometer',
  b: 'B.P',
  p: 'Pulse Oximeter',
  e: 'ECG',
  s: 'Start Steth',
  q: 'Stop Steth',
  t: 'Torch On',
  x: 'Torch Off',
  r: 'Read All',
};

async function loadReadings(): Promise<Reading[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Reading[]) : [];
  } catch {
    return [];
  }
}

async function persistReadings(readings: Reading[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
    return true;
  } catch (error) {
    console.log('[AshaDevice] persistReadings failed:', error);
    return false;
  }
}

function formatAshaThermometerDisplay(celsius: string, fahrenheit: string): string {
  return `${fahrenheit}°F (${celsius}°C)`;
}

function formatAshaRawDisplay(rawData: string): string {
  const clean = String(rawData || '').trim();
  const oximeterReading = clean.match(/^O_(\d{2,3})_(\d{2,3})_#$/i);
  if (oximeterReading) {
    return `SpO2: ${oximeterReading[1]} %\nPulse: ${oximeterReading[2]}`;
  }
  const thermometerReading = clean.match(/^T_(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)_#$/i);
  if (thermometerReading) {
    return formatAshaThermometerDisplay(thermometerReading[1], thermometerReading[2]);
  }
  const bloodPressureReading = clean.match(/^B_(\d{2,3})_(\d{2,3})_#$/i);
  if (bloodPressureReading) {
    return `${bloodPressureReading[1]}/${bloodPressureReading[2]}`;
  }
  if (/^ECG wave \(\d+ samples\)$/i.test(clean)) {
    return clean;
  }
  return clean;
}

function formatStoredReadingDisplay(
  deviceType: DeviceType | 'unknown',
  values: Reading['values'],
  rawData: string,
): string {
  if (deviceType === 'b' && values.bp) {
    return `B.P: ${values.bp}`;
  }
  if (deviceType === 'm' && values.temperature) {
    return `Temperature: ${values.temperature}`;
  }
  if (deviceType === 'p') {
    const lines: string[] = [];
    if (values.spo2) lines.push(`SpO2: ${values.spo2}`);
    if (values.pulse) lines.push(`Pulse: ${values.pulse}`);
    if (lines.length > 0) return lines.join('\n');
  }
  if (deviceType === 'g' && values.glucose) {
    return `Glucose: ${values.glucose}`;
  }
  if (deviceType === 'e' && values.ecg) {
    return values.ecg;
  }
  if (deviceType === 's' && values.steth) {
    return `Stethoscope: ${values.steth}`;
  }
  if (deviceType === 'r' && values.pulse) {
    return `Pulse: ${values.pulse}`;
  }

  const formattedRaw = formatAshaRawDisplay(rawData);
  return formattedRaw || rawData;
}

function hasParsedReadingValues(values: Reading['values']): boolean {
  return Object.values(values).some(value => Boolean(String(value || '').trim()));
}

function parseDeviceValues(
  rawData: string,
  deviceType: DeviceType | 'unknown',
): Reading['values'] {
  const clean = String(rawData || '').trim();
  console.log('[AshaDevice] parseDeviceValues input:', {
    rawData,
    clean,
    deviceType,
    cleanLength: clean.length,
  });
  const values: Reading['values'] = {};

  const ashOximeterReading = clean.match(/^O_(\d{2,3})_(\d{2,3})_#$/i);
  if (ashOximeterReading) {
    values.spo2 = `${ashOximeterReading[1]} %`;
    values.pulse = ashOximeterReading[2];
    console.log('[AshaDevice] parseDeviceValues output:', values);
    return values;
  }

  const ashThermometerReading = clean.match(/^T_(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)_#$/i);
  if (ashThermometerReading) {
    values.temperature = formatAshaThermometerDisplay(
      ashThermometerReading[1],
      ashThermometerReading[2],
    );
    console.log('[AshaDevice] parseDeviceValues output:', values);
    return values;
  }

  const ashBloodPressureReading = clean.match(/^B_(\d{2,3})_(\d{2,3})_#$/i);
  if (ashBloodPressureReading) {
    values.bp = `${ashBloodPressureReading[1]}/${ashBloodPressureReading[2]}`;
    console.log('[AshaDevice] parseDeviceValues output:', values);
    return values;
  }

  if (/^C_.*#$/i.test(clean)) {
    console.log('[AshaDevice] parseDeviceValues output:', values);
    return values;
  }

  const spo2 = clean.match(/spo2\s*[:=]?\s*(\d{2,3})/i);
  const pulse = clean.match(/pulse\s*[:=]?\s*(\d{2,3})/i);
  const temp = clean.match(/temp(?:erature)?\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const glucose = clean.match(/(?:glucose|gluco)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const bp = clean.match(/(?:bp|blood pressure)\s*[:=]?\s*(\d{2,3}\s*\/\s*\d{2,3})/i);

  if (spo2) values.spo2 = spo2[1];
  if (pulse) values.pulse = pulse[1];
  if (temp) values.temperature = temp[1];
  if (glucose) values.glucose = glucose[1];
  if (bp) values.bp = bp[1].replace(/\s/g, '');

  if (Object.keys(values).length === 0 && clean) {
    if (deviceType === 'g') values.glucose = clean;
    if (deviceType === 'm') values.temperature = clean;
    if (deviceType === 'b') values.bp = clean;
    if (deviceType === 'p') values.spo2 = clean;
    if (deviceType === 'e' && /^ECG wave \(\d+ samples\)$/i.test(clean)) {
      values.ecg = clean;
    }
    if (deviceType === 's') values.steth = clean;
    if (deviceType === 'r') values.pulse = clean;
  }

  console.log('[AshaDevice] parseDeviceValues output:', values);
  return values;
}

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  disabled?: boolean;
};

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  variant = 'secondary',
  fullWidth = false,
  disabled = false,
}) => (
  <TouchableOpacity
    style={[
      styles.button,
      variant === 'primary' ? styles.buttonPrimary : null,
      fullWidth ? styles.buttonFullWidth : null,
      disabled ? styles.buttonDisabled : null,
    ]}
    onPress={onPress}
    activeOpacity={0.85}
    disabled={disabled}
  >
    <Text
      style={[
        styles.buttonText,
        variant === 'primary' ? styles.buttonTextPrimary : null,
        disabled ? styles.buttonTextDisabled : null,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const AshaDevice: React.FC = () => {
  const navigation = useNavigation<AshaDeviceNav>();
  const connectedDeviceRef = useRef<BluetoothDevice | null>(null);
  const dataSubscriptionRef = useRef<BluetoothEventSubscription | null>(null);
  const listeningDeviceAddressRef = useRef<string | null>(null);
  const readingsHydratedRef = useRef(false);
  const selectedCommandRef = useRef<DeviceType | 'unknown'>('unknown');

  const [patientId, setPatientId] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<DeviceType | 'unknown'>('unknown');
  const [latestRawData, setLatestRawData] = useState('');
  const [ecgSamples, setEcgSamples] = useState<number[]>([]);
  const [status, setStatus] = useState('Ready');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDeviceAddress, setSelectedDeviceAddress] = useState<string | null>(null);
  const [savedDeviceAddress, setSavedDeviceAddress] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const latestValues = useMemo(() => {
    const parsed = parseDeviceValues(latestRawData, selectedCommand);
    if (selectedCommand === 'e' && ecgSamples.length > 0) {
      parsed.ecg = formatEcgSummary(ecgSamples.length);
    }
    return parsed;
  }, [latestRawData, selectedCommand, ecgSamples.length]);

  useEffect(() => {
    selectedCommandRef.current = selectedCommand;
  }, [selectedCommand]);

  useEffect(() => {
    console.log('[AshaDevice] screen state for display:', {
      latestRawData,
      latestRawDataLength: latestRawData.length,
      selectedCommand,
      latestValues,
      status,
    });
  }, [latestRawData, selectedCommand, latestValues, status]);

  const selectedDeviceLabel = useMemo(() => {
    if (!selectedDeviceAddress) {
      return '- Select device from list -';
    }
    const match = discoveredDevices.find(device => device.address === selectedDeviceAddress);
    return match?.name?.trim() || match?.address || selectedDeviceAddress;
  }, [discoveredDevices, selectedDeviceAddress]);

  const clearDataSubscription = useCallback(() => {
    dataSubscriptionRef.current?.remove();
    dataSubscriptionRef.current = null;
    listeningDeviceAddressRef.current = null;
  }, []);

  const attachDataListener = useCallback(
    (device: BluetoothDevice) => {
      if (
        dataSubscriptionRef.current &&
        listeningDeviceAddressRef.current === device.address
      ) {
        console.log('[AshaDevice] attachDataListener: already active for', device.address);
        return;
      }

      console.log('[AshaDevice] attachDataListener:', {
        address: device.address,
        name: device.name,
      });
      clearDataSubscription();
      dataSubscriptionRef.current = subscribeClassicDeviceData(device, payload => {
        console.log('[AshaDevice] onDataReceived callback:', {
          payload,
          payloadLength: payload.length,
          payloadType: typeof payload,
        });

        const activeCommand = selectedCommandRef.current;
        if (activeCommand === 'e') {
          const kind = classifyAshaEcgPayload(payload);
          if (kind === 'wave-start') {
            setStatus('ECG wave streaming...');
            return;
          }
          if (kind === 'status') {
            setLatestRawData(payload);
            setStatus(payload);
            return;
          }
          if (kind === 'samples') {
            const incoming = parseAshaEcgSamples(payload);
            if (incoming.length > 0) {
              let nextCount = 0;
              setEcgSamples(prev => {
                const merged = appendEcgSamples(prev, incoming);
                nextCount = merged.length;
                return merged;
              });
              setLatestRawData(formatEcgSummary(nextCount));
              setStatus(`ECG streaming — ${nextCount} samples`);
            }
            return;
          }
        }

        setLatestRawData(payload);
        setStatus('Data received');
      });
      listeningDeviceAddressRef.current = device.address;
      console.log('[AshaDevice] data subscription attached:', !!dataSubscriptionRef.current);
    },
    [clearDataSubscription],
  );

  useEffect(() => {
    void loadReadings().then(loaded => {
      setReadings(loaded);
      readingsHydratedRef.current = true;
    });
    void getSavedClassicDeviceAddress().then(address => {
      setSavedDeviceAddress(address);
      if (address) {
        setSelectedDeviceAddress(address);
      }
    });

    if (!isBluetoothClassicNativeLinked()) {
      setStatus(BLUETOOTH_CLASSIC_REBUILD_MESSAGE);
    }
  }, []);

  useEffect(() => {
    if (!readingsHydratedRef.current) {
      return;
    }
    void persistReadings(readings).then(saved => {
      if (!saved) {
        setStatus('Failed to save readings locally.');
      }
    });
  }, [readings]);

  useEffect(() => {
    return () => {
      clearDataSubscription();
      const device = connectedDeviceRef.current;
      connectedDeviceRef.current = null;
      if (device) {
        void disconnectClassicDevice(device);
      }
    };
  }, [clearDataSubscription]);

  const ensureConnectedDevice = useCallback(async (): Promise<BluetoothDevice | null> => {
    const address = savedDeviceAddress?.trim();
    console.log('[AshaDevice] ensureConnectedDevice start:', { savedDeviceAddress: address });
    if (!address) {
      console.log('[AshaDevice] ensureConnectedDevice aborted: no saved address');
      setStatus('Save a Bluetooth device before running a test.');
      return null;
    }

    let device = connectedDeviceRef.current;
    console.log('[AshaDevice] ensureConnectedDevice cached device:', {
      hasCachedDevice: !!device,
      cachedAddress: device?.address,
    });
    if (!device || device.address !== address) {
      device = await findClassicDeviceByAddress(address);
      console.log('[AshaDevice] ensureConnectedDevice findByAddress result:', {
        found: !!device,
        address: device?.address,
        name: device?.name,
      });
      if (!device) {
        setStatus('Saved device not found. Pair it in Bluetooth settings, then rediscover.');
        return null;
      }
    }

    const ready = await ensureAshaBluetoothReady();
    console.log('[AshaDevice] ensureConnectedDevice bluetooth ready:', ready);
    if (!ready.ok) {
      setStatus(ready.message);
      return null;
    }

    setStatus(`Connecting to ${device.name || device.address}...`);

    const needsFreshConnection = !dataSubscriptionRef.current;
    if (needsFreshConnection) {
      try {
        if (await device.isConnected()) {
          console.log('[AshaDevice] disconnecting stale connection before Asha RFCOMM setup');
          await disconnectClassicDevice(device);
        }
      } catch (error) {
        console.log('[AshaDevice] stale disconnect failed:', error);
      }
    }

    const connected = await connectClassicDevice(device);
    console.log('[AshaDevice] ensureConnectedDevice connect result:', connected);
    if (!connected) {
      setStatus('Could not connect over Bluetooth Classic (RFCOMM).');
      return null;
    }

    connectedDeviceRef.current = device;
    attachDataListener(device);
    console.log('[AshaDevice] ensureConnectedDevice success:', device.address);
    return device;
  }, [attachDataListener, savedDeviceAddress]);

  const discoverBluetoothDevices = useCallback(async () => {
    setIsDiscovering(true);
    setStatus('Searching Bluetooth devices...');
    try {
      const devices = await discoverClassicDevices();
      setDiscoveredDevices(devices);
      if (devices.length === 0) {
        setStatus(
          Platform.OS === 'android'
            ? 'No devices found. Pair your Asha kit in Bluetooth settings, then try again.'
            : 'No paired devices found.',
        );
        return;
      }
      setStatus(`Found ${devices.length} device(s). Select one and tap Save Device.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bluetooth discovery failed.';
      setStatus(message);
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  const saveBluetoothDevice = useCallback(async () => {
    if (!selectedDeviceAddress) {
      setStatus('Please select a Bluetooth device from the list.');
      return;
    }

    try {
      await saveClassicDeviceAddress(selectedDeviceAddress);
      setSavedDeviceAddress(selectedDeviceAddress);
      clearDataSubscription();
      if (connectedDeviceRef.current) {
        await disconnectClassicDevice(connectedDeviceRef.current);
        connectedDeviceRef.current = null;
      }
      setStatus('Bluetooth device saved.');
    } catch {
      setStatus('Failed to save selected device.');
    }
  }, [clearDataSubscription, selectedDeviceAddress]);

  const runCommand = useCallback(
    async (command: DeviceType) => {
      if (isBusy) {
        console.log('[AshaDevice] runCommand skipped: isBusy');
        return;
      }

      console.log('[AshaDevice] runCommand start:', { command, label: DEVICE_LABEL[command] });
      setIsBusy(true);
      selectedCommandRef.current = command;
      setSelectedCommand(command);
      setLatestRawData('');
      if (command === 'e') {
        setEcgSamples([]);
      }
      setStatus(`Connecting ${DEVICE_LABEL[command]}...`);

      try {
        const device = await ensureConnectedDevice();
        console.log('[AshaDevice] runCommand after connect:', {
          command,
          hasDevice: !!device,
          deviceAddress: device?.address,
        });
        if (!device) return;

        const sent = await sendClassicDeviceCommand(device, command);
        console.log('[AshaDevice] runCommand send result:', { command, sent });
        if (!sent) {
          setStatus(`Failed to send ${DEVICE_LABEL[command]} command.`);
          return;
        }
        setStatus(`Waiting for ${DEVICE_LABEL[command]} data...`);
        console.log('[AshaDevice] runCommand waiting for data:', command);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bluetooth command failed.';
        console.log('[AshaDevice] runCommand error:', { command, message, error });
        setStatus(message);
      } finally {
        setIsBusy(false);
        console.log('[AshaDevice] runCommand finished:', command);
      }
    },
    [ensureConnectedDevice, isBusy],
  );

  const storeLatestReading = useCallback(() => {
    if (!patientId.trim()) {
      setStatus('Please enter Patient ID before storing data.');
      return;
    }

    const hasEcgWave = ecgSamples.length > 0;
    const isEcgReading = selectedCommand === 'e' && hasEcgWave;

    if (isEcgReading) {
      const capturedAt = new Date().toISOString();
      const ecgPayload = buildStoredEcgPayload(ecgSamples, capturedAt);
      const reading: Reading = {
        id: `${Date.now()}`,
        patientId: patientId.trim(),
        deviceType: 'e',
        deviceName: DEVICE_LABEL.e,
        rawData: formatEcgSummary(ecgPayload.sampleCount),
        values: { ecg: formatEcgSummary(ecgPayload.sampleCount) },
        createdAt: capturedAt,
        ecgSamples: ecgPayload.samples,
        ecgData: ecgPayload,
      };

      setReadings(old => [reading, ...old]);
      setStatus('ECG wave stored successfully');
      return;
    }

    if (selectedCommand === 'e' && !hasEcgWave) {
      setStatus('No ECG wave data available to store.');
      return;
    }

    if (!latestRawData.trim()) {
      setStatus('No device data available to store.');
      return;
    }
    if (!hasParsedReadingValues(latestValues)) {
      setStatus('No parsed reading available to store.');
      return;
    }

    const reading: Reading = {
      id: `${Date.now()}`,
      patientId: patientId.trim(),
      deviceType: selectedCommand,
      deviceName: selectedCommand === 'unknown' ? 'Unknown' : DEVICE_LABEL[selectedCommand],
      rawData: latestRawData,
      values: latestValues,
      createdAt: new Date().toISOString(),
    };

    setReadings(old => [reading, ...old]);
    setStatus('Reading stored successfully');
  }, [ecgSamples, latestRawData, latestValues, patientId, selectedCommand]);

  const clearReadings = useCallback(() => {
    setReadings([]);
    if (readingsHydratedRef.current) {
      void persistReadings([]);
    }
    setStatus('Stored readings cleared');
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY} />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="ASHA Device"
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Bluetooth Device Data</Text>
          <Text style={styles.status}>{status}</Text>

          <Text style={styles.label}>Patient ID</Text>
          <TextInput
            style={styles.input}
            value={patientId}
            onChangeText={setPatientId}
            placeholder="Enter Patient ID"
            placeholderTextColor={COLORS.TEXT_MUTED}
          />

          <View style={styles.row}>
            <ActionButton
              label={isDiscovering ? 'Searching...' : 'Discover Bluetooth'}
              onPress={() => {
                void discoverBluetoothDevices();
              }}
              disabled={isDiscovering || isBusy}
            />
            <ActionButton
              label="Save Device"
              onPress={() => {
                void saveBluetoothDevice();
              }}
              disabled={isBusy}
            />
          </View>

          {Platform.OS === 'android' ? (
            <ActionButton
              label="Open Bluetooth Settings"
              onPress={openClassicBluetoothSettings}
              disabled={isBusy}
            />
          ) : null}

          {isDiscovering ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Discovering nearby devices...</Text>
            </View>
          ) : null}

          <Text style={styles.deviceListTitle}>{selectedDeviceLabel}</Text>
          {discoveredDevices.length > 0 ? (
            discoveredDevices.map(device => {
              const isSelected = selectedDeviceAddress === device.address;
              const isSaved = savedDeviceAddress === device.address;
              return (
                <TouchableOpacity
                  key={device.address}
                  style={[styles.deviceRow, isSelected ? styles.deviceRowSelected : null]}
                  onPress={() => setSelectedDeviceAddress(device.address)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deviceName}>{device.name || 'Unknown device'}</Text>
                  <Text style={styles.deviceAddress}>{device.address}</Text>
                  {isSaved ? <Text style={styles.deviceSavedTag}>Saved</Text> : null}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyDevicesText}>
              No devices listed yet. Tap Discover Bluetooth to load paired/nearby devices.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitle}>Get Device Data</Text>
          <View style={styles.grid}>
            {DEVICE_COMMANDS.map(command => (
              <ActionButton
                key={command}
                label={COMMAND_BUTTON_LABEL[command]}
                onPress={() => {
                  void runCommand(command);
                }}
                disabled={isBusy || !savedDeviceAddress}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitle}>Latest Received Data</Text>
          {selectedCommand === 'e' ? (
            <EcgWaveform
              samples={ecgSamples}
              sampleCountLabel={
                ecgSamples.length > 0 ? `${ecgSamples.length} samples` : undefined
              }
            />
          ) : null}
          <View style={styles.rawBox}>
            <Text style={styles.rawBoxText}>
              {selectedCommand === 'e' && ecgSamples.length > 0
                ? formatEcgSummary(ecgSamples.length)
                : latestRawData
                  ? formatAshaRawDisplay(latestRawData)
                  : 'No data received yet'}
            </Text>
          </View>

          <View style={styles.valuesBox}>
            <Text style={styles.valueLine}>Glucose: {latestValues.glucose || '-'}</Text>
            <Text style={styles.valueLine}>Temperature: {latestValues.temperature || '-'}</Text>
            <Text style={styles.valueLine}>B.P: {latestValues.bp || '-'}</Text>
            <Text style={styles.valueLine}>Spo2: {latestValues.spo2 || '-'}</Text>
            <Text style={styles.valueLine}>Pulse: {latestValues.pulse || '-'}</Text>
          </View>

          <ActionButton
            label="Store Latest Data"
            onPress={storeLatestReading}
            variant="primary"
            fullWidth
          />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.subtitle}>Stored Readings</Text>
            <ActionButton label="Clear" onPress={clearReadings} />
          </View>

          {readings.length === 0 ? (
            <Text style={styles.emptyText}>No stored readings.</Text>
          ) : (
            readings.map(item => {
              const storedEcgSamples =
                item.ecgData?.samples ?? item.ecgSamples ?? [];
              const showStoredEcgWave =
                item.deviceType === 'e' && storedEcgSamples.length > 0;

              return (
                <View key={item.id} style={styles.readingRow}>
                  <View style={styles.readingMeta}>
                    <Text style={styles.readingPatient}>{item.patientId}</Text>
                    <Text style={styles.readingDevice}>{item.deviceName}</Text>
                    <Text style={styles.readingDate}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  {showStoredEcgWave ? (
                    <EcgWaveform
                      samples={storedEcgSamples}
                      sampleCountLabel={formatEcgSummary(storedEcgSamples.length)}
                    />
                  ) : null}
                  <Text style={styles.readingData}>
                    {formatStoredReadingDisplay(item.deviceType, item.values, item.rawData)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default AshaDevice;

const RADIUS_MD = 12;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  headerShell: {
    backgroundColor: COLORS.PRIMARY,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: COLORS.PRIMARY,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.MD,
    paddingBottom: SPACING.XL,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderRadius: RADIUS_MD,
    padding: SPACING.MD,
    marginBottom: SPACING.MD,
    backgroundColor: COLORS.WHITE,
  },
  title: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS,
  },
  subtitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  status: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.MD,
  },
  label: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderRadius: 8,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.SM,
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  deviceListTitle: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.SM,
    marginBottom: SPACING.XS,
  },
  deviceRow: {
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderRadius: 8,
    padding: SPACING.SM,
    marginBottom: SPACING.XS,
    backgroundColor: COLORS.WHITE,
  },
  deviceRowSelected: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: `${COLORS.PRIMARY}10`,
  },
  deviceName: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  deviceAddress: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_MUTED,
    marginTop: 2,
  },
  deviceSavedTag: {
    marginTop: 4,
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.PRIMARY,
  },
  emptyDevicesText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginTop: SPACING.SM,
  },
  loadingText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.SM,
    gap: SPACING.SM,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.SM,
  },
  button: {
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    backgroundColor: COLORS.WHITE,
  },
  buttonPrimary: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
    marginTop: SPACING.SM,
  },
  buttonFullWidth: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  buttonTextPrimary: {
    color: COLORS.WHITE,
  },
  buttonTextDisabled: {
    color: COLORS.TEXT_MUTED,
  },
  rawBox: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderRadius: 8,
    padding: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  rawBoxText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_PRIMARY,
  },
  valuesBox: {
    gap: SPACING.XS,
    marginBottom: SPACING.SM,
  },
  valueLine: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_PRIMARY,
  },
  emptyText: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
  },
  readingRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.CARD_BORDER,
    paddingVertical: SPACING.SM,
    gap: SPACING.XS,
  },
  readingMeta: {
    gap: 2,
  },
  readingPatient: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  readingDevice: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
  },
  readingDate: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_MUTED,
  },
  readingData: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_PRIMARY,
  },
});
