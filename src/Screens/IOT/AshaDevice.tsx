import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BluetoothDevice } from 'react-native-bluetooth-classic';
import type { BluetoothEventSubscription } from 'react-native-bluetooth-classic';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { captureRef } from 'react-native-view-shot';
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
  cancelClassicDiscovery,
  BLUETOOTH_CLASSIC_REBUILD_MESSAGE,
  type AshaDeviceCommand,
} from '../../Services/ashaBluetoothClassic';
import {
  buildStoredEcgPayload,
  classifyAshaEcgPayload,
  formatEcgSummary,
  parseAshaEcgSamples,
  payloadToBytes,
  MAX_STORED_ECG_SAMPLES,
  type AshaStoredEcgPayload,
} from '../../Utils/ashaEcgParser';
import {
  postAshaResult,
  type AshaMultipartFile,
  type AshaResultData,
} from '../../api/iotDeviceResults';
import axiosInstance from '../../api/axiosInstance';
import { BACKEND_ASHA_DEVICE_ID } from '../../Utils/labIotPerformTest';
import { setPendingCompletedBookingItemId } from '../../Utils/multiDeviceSession';
import {
  ASHA_STETH_MIN_RECORD_MS,
  ASHA_STETH_POST_STOP_WAIT_MS,
  analyzeStethoscopeBuffer,
  buildStoredStethPayload,
  isAshaStethStatusOnlyPayload,
  parseAshaStethStatusMessage,
  payloadIncludesWav,
  type AshaStoredStethPayload,
} from '../../Utils/ashaStethParser';

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
  stethData?: AshaStoredStethPayload;
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
type AshaDeviceRoute = RouteProp<RootStackParamList, 'AshaDevice'>;

const STORAGE_KEY = 'bluetooth_patient_readings';
const ASHA_TARGET_DEVICE_NAME = 'Dual-SPP';
const ASHA_TARGET_DEVICE_ADDRESS = '34:81:F4:8C:A5:00';

const UI = {
  SCREEN_BG: '#F5F6FA',
  SECTION_BG: '#ECEFF4',
  CARD_BG: '#FFFFFF',
  PRIMARY: '#1C39BB',
  ICON_BOX: '#DCE4FF',
  LABEL: '#6B7280',
  VALUE: '#111827',
  STATUS: '#64748B',
};

const COMMAND_GRID_ROWS: Array<Array<{ command: DeviceType; columns: 2 | 3 }>> = [
  [
    { command: 'g', columns: 3 },
    { command: 'e', columns: 3 },
    { command: 'b', columns: 3 },
  ],
  [
    { command: 'p', columns: 2 },
    { command: 'm', columns: 2 },
  ],
  [
    { command: 's', columns: 2 },
    { command: 'q', columns: 2 },
  ],
  [
    { command: 't', columns: 3 },
    { command: 'x', columns: 3 },
    { command: 'r', columns: 3 },
  ],
];

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

function formatGlucoseDisplay(value?: string): string {
  if (!value?.trim()) return '—';
  const clean = value.trim();
  if (/mg\/dl/i.test(clean)) return clean;
  const numeric = clean.match(/^(\d+(?:\.\d+)?)/);
  if (numeric) return `${numeric[1]} mg/dL`;
  return clean;
}

function formatTemperatureDisplay(value?: string): string {
  if (!value?.trim()) return '—';
  return value.trim();
}

function formatBloodPressureDisplay(value?: string): string {
  if (!value?.trim()) return '—';
  const clean = value.trim();
  if (/mmhg/i.test(clean)) return clean;
  if (/^\d{2,3}\/\d{2,3}$/.test(clean)) return `${clean} mmHg`;
  return clean;
}

function formatPulseOximeterDisplay(spo2?: string, pulse?: string): string {
  const spo2Clean = spo2?.trim() ?? '';
  const pulseClean = pulse?.trim() ?? '';
  const spo2Value = spo2Clean.match(/(\d{2,3})/)?.[1] ?? '';
  const pulseValue = pulseClean.match(/(\d{2,3})/)?.[1] ?? '';

  if (spo2Value && pulseValue) {
    return `${spo2Value}/${pulseValue} bpm`;
  }

  if (spo2Value) {
    return spo2Clean.includes('%') ? spo2Clean : `${spo2Value}%`;
  }

  if (pulseValue) {
    return `${pulseValue} bpm`;
  }

  return '—';
}

function reportAshaError(
  title: string,
  message: string,
  onReport?: (message: string) => void,
): void {
  onReport?.(message);
  Alert.alert(title, message);
}

function formatEcgByteCodes(payload: string): string[] {
  return Array.from(payloadToBytes(payload)).map(
    byte => `0x${byte.toString(16).padStart(2, '0').toUpperCase()}`,
  );
}

function logEcgPayloadDebug(
  _payload: string,
  _context: string,
  _extra?: Record<string, unknown>,
): void {}

/** Console debug for stethoscope / heartbeat audio chunks received over Bluetooth Classic. */
function logStethPayloadDebug(
  payload: string,
  context: string,
  extra?: Record<string, unknown>,
): void {
  const preview =
    payload.length > 120
      ? `${payload.slice(0, 60)}…(${payload.length} chars)…${payload.slice(-40)}`
      : payload;
  console.log('[ASHA Steth]', context, {
    chunkChars: payload.length,
    preview,
    containsWav: payloadIncludesWav(payload),
    ...extra,
  });
}

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
  p: 'Pulse oximeter',
  e: 'ECG',
  s: 'Start stethoscope',
  q: 'Stop stethoscope',
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
  } catch {
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

function extractFirstNumber(value?: string): number | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBpReading(bp?: string): { systolic: number; diastolic: number } | null {
  if (!bp?.trim()) return null;
  const match = bp.trim().match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return null;
  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2]),
  };
}

function parseTemperatureForApi(
  temp?: string,
): { temperature: number; unit: 'F' | 'C' } | null {
  if (!temp?.trim()) return null;
  const fMatch = temp.match(/([\d.]+)\s*°?\s*F/i);
  if (fMatch) {
    const temperature = Number(fMatch[1]);
    return Number.isFinite(temperature) ? { temperature, unit: 'F' } : null;
  }
  const cMatch = temp.match(/([\d.]+)\s*°?\s*C/i);
  if (cMatch) {
    const temperature = Number(cMatch[1]);
    return Number.isFinite(temperature) ? { temperature, unit: 'C' } : null;
  }
  const fallback = extractFirstNumber(temp);
  return fallback !== null ? { temperature: fallback, unit: 'F' } : null;
}

function computeMap(systolic: number, diastolic: number): number {
  return Math.round(diastolic + (systolic - diastolic) / 3);
}

/**
 * Vitals-only `result_data` for multipart upload.
 * Stethoscope audio and ECG image are sent as separate FormData files.
 */
function buildAshaResultData(values: Reading['values']): AshaResultData {
  const result: AshaResultData = {};
  const pulseRate = extractFirstNumber(values.pulse);

  const bp = parseBpReading(values.bp);
  if (bp) {
    result.blood_pressure = {
      systolic: bp.systolic,
      diastolic: bp.diastolic,
      map: computeMap(bp.systolic, bp.diastolic),
      pulse_rate: pulseRate ?? 0,
    };
  }

  const spo2 = extractFirstNumber(values.spo2);
  if (spo2 !== null) {
    result.pulse_oximeter = {
      spo2,
      pulse_rate: pulseRate ?? 0,
    };
  }

  const temp = parseTemperatureForApi(values.temperature);
  if (temp) {
    result.thermometer = temp;
  }

  const glucose = extractFirstNumber(values.glucose);
  if (glucose !== null) {
    result.glucometer = {
      blood_glucose: glucose,
      test_type: 'fasting',
      unit: 'mg/dL',
    };
  }

  return result;
}

function toFileUri(path: string): string {
  if (!path) return path;
  if (path.startsWith('file://') || path.startsWith('content://')) {
    return path;
  }
  return `file://${path}`;
}

function stripFileScheme(path: string): string {
  return path.replace(/^file:\/\//, '');
}

async function writeHeartbeatAudioTempFile(
  payload: AshaStoredStethPayload,
): Promise<AshaMultipartFile> {
  const name = `heartbeat_${Date.now()}.wav`;
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${name}`;
  await ReactNativeBlobUtil.fs.writeFile(path, payload.audioBase64, 'base64');
  return {
    uri: toFileUri(path),
    name,
    type: payload.audioMime || 'audio/wav',
  };
}

function hasAshaApiResultData(resultData: AshaResultData): boolean {
  return Object.keys(resultData).length > 0;
}

/** Text vitals from Asha device — must never be routed through the ECG binary parser. */
function isKnownAshaVitalTextPayload(payload: string): boolean {
  const clean = String(payload || '').trim();
  if (!clean) return false;
  return (
    /^O_\d{2,3}_\d{2,3}_#$/i.test(clean) ||
    /^T_\d+(?:\.\d+)?_\d+(?:\.\d+)?_#$/i.test(clean) ||
    /^B_\d{2,3}_\d{2,3}_#$/i.test(clean)
  );
}

/** Stethoscope status lines from Asha kit, e.g. `C_Steth Recording..._#` or `C_Saved..._#` */
function isAshaStethStatusPayload(payload: string): boolean {
  return isAshaStethStatusOnlyPayload(payload);
}

function parseAshaStethStatusMessageLocal(payload: string): string {
  return parseAshaStethStatusMessage(payload);
}

function mergeSessionValues(
  previous: Reading['values'],
  parsed: Reading['values'],
): Reading['values'] {
  const next = { ...previous };
  if (parsed.glucose?.trim()) next.glucose = parsed.glucose;
  if (parsed.temperature?.trim()) next.temperature = parsed.temperature;
  if (parsed.bp?.trim()) next.bp = parsed.bp;
  if (parsed.spo2?.trim()) next.spo2 = parsed.spo2;
  if (parsed.pulse?.trim()) next.pulse = parsed.pulse;
  if (parsed.ecg?.trim()) next.ecg = parsed.ecg;
  if (parsed.steth?.trim()) next.steth = parsed.steth;
  return next;
}

function parseDeviceValues(
  rawData: string,
  deviceType: DeviceType | 'unknown',
): Reading['values'] {
  const clean = String(rawData || '').trim();
  const values: Reading['values'] = {};

  const ashOximeterReading = clean.match(/^O_(\d{2,3})_(\d{2,3})_#$/i);
  if (ashOximeterReading) {
    values.spo2 = `${ashOximeterReading[1]} %`;
    values.pulse = ashOximeterReading[2];
    return values;
  }

  const ashThermometerReading = clean.match(/^T_(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)_#$/i);
  if (ashThermometerReading) {
    values.temperature = formatAshaThermometerDisplay(
      ashThermometerReading[1],
      ashThermometerReading[2],
    );
    return values;
  }

  const ashBloodPressureReading = clean.match(/^B_(\d{2,3})_(\d{2,3})_#$/i);
  if (ashBloodPressureReading) {
    values.bp = `${ashBloodPressureReading[1]}/${ashBloodPressureReading[2]}`;
    return values;
  }

  if (/^C_.*#$/i.test(clean)) {
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

  return values;
}

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
  disabled?: boolean;
};

type MetricCardProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
};

type CommandGridButtonProps = {
  label: string;
  command: DeviceType;
  selectedCommand: DeviceType | 'unknown';
  columns: 2 | 3;
  onPress: () => void;
  disabled?: boolean;
};

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value }) => (
  <View style={styles.metricCard}>
    <View style={styles.metricHeader}>
      <View style={styles.metricIconBox}>
        <MaterialCommunityIcons name={icon} size={18} color={UI.PRIMARY} />
      </View>
      <Text style={styles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
    <Text style={styles.metricValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const CommandGridButton: React.FC<CommandGridButtonProps> = ({
  label,
  command,
  selectedCommand,
  columns,
  onPress,
  disabled = false,
}) => {
  const active = selectedCommand === command;
  return (
    <TouchableOpacity
      style={[
        styles.commandButton,
        columns === 3 ? styles.commandButtonThird : styles.commandButtonHalf,
        active ? styles.commandButtonActive : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text
        style={[
          styles.commandButtonText,
          active ? styles.commandButtonTextActive : null,
          disabled ? styles.buttonTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
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
      variant === 'ghost' ? styles.buttonGhost : null,
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
        variant === 'ghost' ? styles.buttonTextGhost : null,
        disabled ? styles.buttonTextDisabled : null,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const AshaDevice: React.FC = () => {
  const navigation = useNavigation<AshaDeviceNav>();
  const route = useRoute<AshaDeviceRoute>();
  const routeDeviceId = route.params?.deviceId ?? null;
  const routeBookingItemId = route.params?.bookingItemId ?? null;
  const routeBookingId = route.params?.bookingId ?? null;
  const routeIsMultiDevice = route.params?.isMultiDevice ?? false;
  const connectedDeviceRef = useRef<BluetoothDevice | null>(null);
  const dataSubscriptionRef = useRef<BluetoothEventSubscription | null>(null);
  const listeningDeviceAddressRef = useRef<string | null>(null);
  const readingsHydratedRef = useRef(false);
  const selectedCommandRef = useRef<DeviceType | 'unknown'>('unknown');
  const ecgCaptureActiveRef = useRef(false);
  const ecgPayloadBufferRef = useRef('');
  const stethCaptureActiveRef = useRef(false);
  /** True from Start (`s`) until finalize after Stop — prevents post-stop mic data from re-arming capture. */
  const stethSessionOpenRef = useRef(false);
  const stethPayloadBufferRef = useRef('');
  const stethStopFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stethMinRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stethStatusMessageRef = useRef('');
  const stethCanStopRef = useRef(false);
  const stethRecordStartedAtRef = useRef<number | null>(null);

  const [patientId, setPatientId] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<DeviceType | 'unknown'>('unknown');
  const [latestRawData, setLatestRawData] = useState('');
  const [sessionValues, setSessionValues] = useState<Reading['values']>({});
  const [ecgSamples, setEcgSamples] = useState<number[]>([]);
  const [status, setStatus] = useState('Ready');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [savedDeviceAddress, setSavedDeviceAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [stethRecordingActive, setStethRecordingActive] = useState(false);
  const [stethCanStop, setStethCanStop] = useState(false);
  const [capturedStethPayload, setCapturedStethPayload] =
    useState<AshaStoredStethPayload | null>(null);
  const [capturedEcgImage, setCapturedEcgImage] = useState<AshaMultipartFile | null>(null);
  const [isCapturingEcg, setIsCapturingEcg] = useState(false);
  const ecgWaveformCaptureRef = useRef<View>(null);

  const latestValues = useMemo(() => {
    try {
      const values = { ...sessionValues };
      if (selectedCommand === 'e' && ecgSamples.length > 0) {
        values.ecg = formatEcgSummary(ecgSamples.length);
      }
      return values;
    } catch {
      return {};
    }
  }, [sessionValues, ecgSamples.length, selectedCommand]);

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
        return;
      }

      clearDataSubscription();
      dataSubscriptionRef.current = subscribeClassicDeviceData(device, payload => {
        try {
          const activeCommand = selectedCommandRef.current;

          const isStethStream =
            stethSessionOpenRef.current &&
            (stethCaptureActiveRef.current ||
              activeCommand === 's' ||
              activeCommand === 'q');

          if (isStethStream) {
            if (!stethCaptureActiveRef.current) {
              stethCaptureActiveRef.current = true;
              setStethRecordingActive(true);
              if (!stethRecordStartedAtRef.current) {
                stethRecordStartedAtRef.current = Date.now();
              }
              if (!stethCanStopRef.current && !stethMinRecordTimerRef.current) {
                const elapsed = Date.now() - (stethRecordStartedAtRef.current ?? Date.now());
                const remaining = Math.max(0, ASHA_STETH_MIN_RECORD_MS - elapsed);
                stethMinRecordTimerRef.current = setTimeout(() => {
                  setStethCanStop(true);
                  stethCanStopRef.current = true;
                  stethMinRecordTimerRef.current = null;
                  console.log('[ASHA Steth] min-record elapsed — Stop unlocked');
                }, remaining);
              }
            }

            if (isAshaStethStatusPayload(payload)) {
              const statusMsg = parseAshaStethStatusMessageLocal(payload);
              stethStatusMessageRef.current = statusMsg;
              setLatestRawData(payload);
              setSessionValues(current =>
                mergeSessionValues(current, { steth: `Status: ${statusMsg}` }),
              );
              setStatus(`Stethoscope: ${statusMsg}`);
              logStethPayloadDebug(payload, 'status', {
                activeCommand,
                statusMsg,
                sessionOpen: stethSessionOpenRef.current,
              });
              return;
            }

            if (payloadIncludesWav(payload)) {
              const statusInChunk = parseAshaStethStatusMessageLocal(payload);
              if (statusInChunk && statusInChunk !== payload) {
                stethStatusMessageRef.current = statusInChunk;
              }
            }

            stethPayloadBufferRef.current += payload;
            logStethPayloadDebug(payload, 'audio-chunk', {
              activeCommand,
              chunkBytes: payload.length,
              bufferBytes: stethPayloadBufferRef.current.length,
              containsWav: payloadIncludesWav(payload),
              canStop: stethCanStopRef.current,
            });

            const analysis = analyzeStethoscopeBuffer(stethPayloadBufferRef.current);

            const stethSummary = analysis.isWav
              ? `Stethoscope WAV (${analysis.wavByteCount} bytes, ${analysis.sampleRate}Hz, ~${analysis.beatCount} beats)`
              : `Stethoscope audio (${stethPayloadBufferRef.current.length} bytes)`;
            setLatestRawData(stethSummary);
            setSessionValues(current =>
              mergeSessionValues(current, { steth: stethSummary }),
            );
            setStatus(stethSummary);
            return;
          }

          if (isKnownAshaVitalTextPayload(payload)) {
            ecgCaptureActiveRef.current = false;
            setLatestRawData(payload);
            setSessionValues(current =>
              mergeSessionValues(current, parseDeviceValues(payload, activeCommand)),
            );
            setStatus('Data received');
            return;
          }

          const isEcgStream = activeCommand === 'e' || ecgCaptureActiveRef.current;

          if (isEcgStream) {
            const kind = classifyAshaEcgPayload(payload);
            logEcgPayloadDebug(payload, 'onDataReceived', {
              kind,
              activeCommand,
              ecgCaptureActive: ecgCaptureActiveRef.current,
            });

            if (kind === 'wave-start') {
              ecgPayloadBufferRef.current = '';
              setStatus('ECG wave streaming...');
              return;
            }
            if (kind === 'status') {
              ecgCaptureActiveRef.current = false;
              setLatestRawData(payload);
              setStatus(payload);
              return;
            }

            ecgPayloadBufferRef.current += payload;
            logEcgPayloadDebug(ecgPayloadBufferRef.current, 'buffered', {
              kind,
              chunkLength: payload.length,
              bufferLength: ecgPayloadBufferRef.current.length,
            });

            const incoming = parseAshaEcgSamples(ecgPayloadBufferRef.current);

            if (incoming.length > 0) {
              const clipped =
                incoming.length > MAX_STORED_ECG_SAMPLES
                  ? incoming.slice(-MAX_STORED_ECG_SAMPLES)
                  : incoming;
              setEcgSamples(clipped);
              const ecgSummary = formatEcgSummary(clipped.length);
              setLatestRawData(ecgSummary);
              setSessionValues(current =>
                mergeSessionValues(current, { ecg: ecgSummary }),
              );
              setStatus(`ECG streaming — ${clipped.length} samples`);
              return;
            }

            return;
          }

          setLatestRawData(payload);
          setSessionValues(current =>
            mergeSessionValues(current, parseDeviceValues(payload, activeCommand)),
          );
          setStatus('Data received');
        } catch (error) {
          const message = getErrorMessage(error, 'Failed to process device data.');
          reportAshaError('Data Error', message, setStatus);
        }
      });
      listeningDeviceAddressRef.current = device.address;
    },
    [clearDataSubscription],
  );

  const refreshDeviceConnectionStatus = useCallback(async () => {
    if (!isBluetoothClassicNativeLinked()) {
      setIsDeviceConnected(false);
      return;
    }

    try {
      let device = connectedDeviceRef.current;
      if (!device || device.address !== ASHA_TARGET_DEVICE_ADDRESS) {
        device = await findClassicDeviceByAddress(ASHA_TARGET_DEVICE_ADDRESS);
      }

      if (!device) {
        setIsDeviceConnected(false);
        return;
      }

      const connected = await device.isConnected().catch(() => false);
      setIsDeviceConnected(connected);

      if (connected) {
        connectedDeviceRef.current = device;
        attachDataListener(device);
      }
    } catch {
      setIsDeviceConnected(false);
    }
  }, [attachDataListener]);

  useEffect(() => {
    void loadReadings()
      .then(loaded => {
        setReadings(loaded);
        readingsHydratedRef.current = true;
      })
      .catch(error => {
        const message = getErrorMessage(error, 'Could not load stored readings.');
        reportAshaError('Load Error', message, setStatus);
      });
    void getSavedClassicDeviceAddress()
      .then(address => {
        if (address === ASHA_TARGET_DEVICE_ADDRESS) {
          setSavedDeviceAddress(address);
        }
      })
      .catch(error => {
        const message = getErrorMessage(error, 'Could not load saved Bluetooth device.');
        reportAshaError('Bluetooth Error', message, setStatus);
      });

    if (!isBluetoothClassicNativeLinked()) {
      reportAshaError('Bluetooth Unavailable', BLUETOOTH_CLASSIC_REBUILD_MESSAGE, setStatus);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshDeviceConnectionStatus();
    }, [refreshDeviceConnectionStatus]),
  );

  useEffect(() => {
    if (savedDeviceAddress === ASHA_TARGET_DEVICE_ADDRESS) {
      void refreshDeviceConnectionStatus();
    }
  }, [refreshDeviceConnectionStatus, savedDeviceAddress]);

  useEffect(() => {
    if (!readingsHydratedRef.current) {
      return;
    }
    void persistReadings(readings).then(saved => {
      if (!saved) {
        reportAshaError('Save Error', 'Failed to save readings locally.', setStatus);
      }
    }).catch(error => {
      const message = getErrorMessage(error, 'Failed to save readings locally.');
      reportAshaError('Save Error', message, setStatus);
    });
  }, [readings]);

  useEffect(() => {
    return () => {
      clearDataSubscription();
      const device = connectedDeviceRef.current;
      connectedDeviceRef.current = null;
      setIsDeviceConnected(false);
      if (device) {
        void disconnectClassicDevice(device);
      }
    };
  }, [clearDataSubscription]);

  const ensureConnectedDevice = useCallback(async (
    addressOverride?: string,
  ): Promise<BluetoothDevice | null> => {
    try {
      const address = (addressOverride ?? savedDeviceAddress)?.trim();
      if (!address) {
        reportAshaError(
          'Device Not Saved',
          'Save a Bluetooth device before running a test.',
          setStatus,
        );
        return null;
      }

      const ready = await ensureAshaBluetoothReady();
      if (!ready.ok) {
        reportAshaError('Bluetooth Error', ready.message, setStatus);
        return null;
      }

      let device = connectedDeviceRef.current;
      if (!device || device.address !== address) {
        device = await findClassicDeviceByAddress(address);
        if (!device) {
          reportAshaError(
            'Device Not Found',
            'Saved device not found. Pair Dual-SPP in Bluetooth settings, then tap to connect again.',
            setStatus,
          );
          return null;
        }
      }

      setStatus(`Connecting to ${device.name || device.address}...`);

      // If already connected with an active listener, reuse — do NOT disconnect/reconnect
      // (disconnect+reconnect during connect is a common Xiaomi/MIUI native crash trigger).
      try {
        const alreadyConnected = await device.isConnected();
        if (alreadyConnected && dataSubscriptionRef.current) {
          connectedDeviceRef.current = device;
          setIsDeviceConnected(true);
          setStatus(`Connected to ${device.name || ASHA_TARGET_DEVICE_NAME}`);
          return device;
        }
        if (alreadyConnected && !dataSubscriptionRef.current) {
          connectedDeviceRef.current = device;
          attachDataListener(device);
          setIsDeviceConnected(true);
          setStatus(`Connected to ${device.name || ASHA_TARGET_DEVICE_NAME}`);
          return device;
        }
      } catch (error) {
        console.log('[ASHA BT] isConnected check failed', error);
      }

      await cancelClassicDiscovery();

      const connected = await connectClassicDevice(device);
      if (!connected) {
        setIsDeviceConnected(false);
        reportAshaError(
          'Connection Failed',
          'Could not connect to Dual-SPP over Bluetooth Classic. Make sure the kit is on, paired, and close to the phone, then try again.',
          setStatus,
        );
        return null;
      }

      connectedDeviceRef.current = device;
      attachDataListener(device);
      setIsDeviceConnected(true);
      setStatus(`Connected to ${device.name || ASHA_TARGET_DEVICE_NAME}`);
      return device;
    } catch (error) {
      const message = getErrorMessage(error, 'Bluetooth connection failed.');
      console.log('[ASHA BT] ensureConnectedDevice error', message);
      setIsDeviceConnected(false);
      reportAshaError('Connection Error', message, setStatus);
      return null;
    }
  }, [attachDataListener, savedDeviceAddress]);

  const connectBluetoothDevice = useCallback(async () => {
    if (isConnecting || isBusy) {
      return;
    }

    setIsConnecting(true);
    setStatus('Checking Bluetooth...');
    console.log('[ASHA BT] Dual-SPP connect tapped');
    try {
      if (!isBluetoothClassicNativeLinked()) {
        reportAshaError('Bluetooth Unavailable', BLUETOOTH_CLASSIC_REBUILD_MESSAGE, setStatus);
        return;
      }

      const ready = await ensureAshaBluetoothReady();
      if (!ready.ok) {
        reportAshaError('Bluetooth Error', ready.message, setStatus);
        return;
      }

      setStatus(`Looking up ${ASHA_TARGET_DEVICE_NAME}...`);
      let device = await findClassicDeviceByAddress(ASHA_TARGET_DEVICE_ADDRESS);

      // Prefer already-paired device. Discovery is a fallback only (discovery+connect crashes on some OEMs).
      if (!device) {
        setStatus(`Searching for ${ASHA_TARGET_DEVICE_NAME}...`);
        try {
          const devices = await discoverClassicDevices();
          device =
            devices.find(
              discoveredDevice => discoveredDevice.address === ASHA_TARGET_DEVICE_ADDRESS,
            ) ??
            devices.find(discoveredDevice =>
              String(discoveredDevice.name || '')
                .toLowerCase()
                .includes('dual-spp'),
            ) ??
            null;
        } catch (discoverError) {
          const message = getErrorMessage(
            discoverError,
            'Bluetooth discovery failed. Pair Dual-SPP in system Bluetooth settings first.',
          );
          console.log('[ASHA BT] discovery error', message);
          reportAshaError('Discovery Error', message, setStatus);
          return;
        } finally {
          await cancelClassicDiscovery();
        }
      }

      if (!device) {
        const message =
          Platform.OS === 'android'
            ? `${ASHA_TARGET_DEVICE_NAME} not found. Open Bluetooth Settings, pair Dual-SPP, then return and tap Connect.`
            : `${ASHA_TARGET_DEVICE_NAME} not found among paired devices.`;
        reportAshaError('Device Not Found', message, setStatus);
        return;
      }

      await saveClassicDeviceAddress(device.address || ASHA_TARGET_DEVICE_ADDRESS);
      setSavedDeviceAddress(device.address || ASHA_TARGET_DEVICE_ADDRESS);

      const connected = await ensureConnectedDevice(device.address || ASHA_TARGET_DEVICE_ADDRESS);
      if (connected) {
        setStatus(`Connected to ${connected.name || ASHA_TARGET_DEVICE_NAME}`);
        console.log('[ASHA BT] Dual-SPP connected', connected.address);
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Bluetooth connection failed.');
      console.log('[ASHA BT] connectBluetoothDevice error', message);
      reportAshaError('Connection Error', message, setStatus);
    } finally {
      setIsConnecting(false);
      void refreshDeviceConnectionStatus();
    }
  }, [ensureConnectedDevice, isBusy, isConnecting, refreshDeviceConnectionStatus]);

  const finalizeStethCapture = useCallback((reason: string) => {
    if (stethStopFinalizeTimerRef.current) {
      clearTimeout(stethStopFinalizeTimerRef.current);
      stethStopFinalizeTimerRef.current = null;
    }
    if (stethMinRecordTimerRef.current) {
      clearTimeout(stethMinRecordTimerRef.current);
      stethMinRecordTimerRef.current = null;
    }

    const buffer = stethPayloadBufferRef.current;
    const analysis = analyzeStethoscopeBuffer(buffer);
    const storedPayload = buildStoredStethPayload(
      buffer,
      new Date().toISOString(),
      stethStatusMessageRef.current || undefined,
    );

    if (storedPayload) {
      setCapturedStethPayload(storedPayload);
      setStatus(
        `Stethoscope saved (${storedPayload.byteCount} bytes WAV, ~${storedPayload.beatCount} beats)`,
      );
    } else {
      setStatus(
        analysis.isWav
          ? 'Stethoscope WAV incomplete — try Stop again after device finishes sending.'
          : 'No stethoscope WAV received — keep the session open until audio arrives, then Stop.',
      );
    }

    logStethPayloadDebug(buffer, 'capture-complete', {
      reason,
      totalBytes: buffer.length,
      isWav: analysis.isWav,
      wavBytes: analysis.wavByteCount,
      sampleRate: analysis.sampleRate,
      pcmSamples: analysis.sampleCount,
      beatCount: analysis.beatCount,
      hasStoredPayload: Boolean(storedPayload),
    });

    stethSessionOpenRef.current = false;
    stethRecordStartedAtRef.current = null;
    setStethRecordingActive(false);
    setStethCanStop(false);
    stethCanStopRef.current = false;
    stethCaptureActiveRef.current = false;
  }, []);

  const unlockStethStopIfReady = useCallback((): boolean => {
    if (stethCanStopRef.current) {
      return true;
    }

    const startedAt = stethRecordStartedAtRef.current;
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    const hasWav = payloadIncludesWav(stethPayloadBufferRef.current);
    const hasSubstantialAudio = stethPayloadBufferRef.current.length > 2048;

    if (elapsed >= ASHA_STETH_MIN_RECORD_MS || hasWav || hasSubstantialAudio) {
      stethCanStopRef.current = true;
      setStethCanStop(true);
      console.log('[ASHA Steth] Stop unlocked', {
        elapsedMs: elapsed,
        hasWav,
        bufferBytes: stethPayloadBufferRef.current.length,
      });
      return true;
    }

    return false;
  }, []);

  const runCommand = useCallback(
    async (command: DeviceType) => {
      if (isBusy) {
        return;
      }

      if (command === 'q' && stethSessionOpenRef.current) {
        const canStop = unlockStethStopIfReady();
        console.log('[ASHA Steth] Stop pressed', {
          canStop,
          sessionOpen: stethSessionOpenRef.current,
          captureActive: stethCaptureActiveRef.current,
          startedAt: stethRecordStartedAtRef.current,
          elapsedMs: stethRecordStartedAtRef.current
            ? Date.now() - stethRecordStartedAtRef.current
            : null,
          bufferBytes: stethPayloadBufferRef.current.length,
          containsWav: payloadIncludesWav(stethPayloadBufferRef.current),
        });
        if (!canStop) {
          reportAshaError(
            'Stethoscope',
            `Please record for at least ${ASHA_STETH_MIN_RECORD_MS / 1000} seconds before stopping.`,
            setStatus,
          );
          return;
        }
      }

      setIsBusy(true);
      selectedCommandRef.current = command;
      setSelectedCommand(command);
      setLatestRawData('');
      if (command === 'e') {
        ecgCaptureActiveRef.current = true;
        ecgPayloadBufferRef.current = '';
        stethSessionOpenRef.current = false;
        stethCaptureActiveRef.current = false;
        stethPayloadBufferRef.current = '';
        stethRecordStartedAtRef.current = null;
        setEcgSamples([]);
        setCapturedEcgImage(null);
        setSessionValues(current => {
          const next = { ...current };
          delete next.ecg;
          return next;
        });
      } else if (command === 's') {
        if (stethStopFinalizeTimerRef.current) {
          clearTimeout(stethStopFinalizeTimerRef.current);
          stethStopFinalizeTimerRef.current = null;
        }
        if (stethMinRecordTimerRef.current) {
          clearTimeout(stethMinRecordTimerRef.current);
          stethMinRecordTimerRef.current = null;
        }
        ecgCaptureActiveRef.current = false;
        ecgPayloadBufferRef.current = '';
        stethSessionOpenRef.current = true;
        stethCaptureActiveRef.current = true;
        stethPayloadBufferRef.current = '';
        stethStatusMessageRef.current = '';
        stethRecordStartedAtRef.current = Date.now();
        setCapturedStethPayload(null);
        setStethRecordingActive(true);
        setStethCanStop(false);
        stethCanStopRef.current = false;
        setEcgSamples([]);
        setSessionValues(current => {
          const next = { ...current };
          delete next.steth;
          return next;
        });
        stethMinRecordTimerRef.current = setTimeout(() => {
          setStethCanStop(true);
          stethCanStopRef.current = true;
          stethMinRecordTimerRef.current = null;
          console.log('[ASHA Steth] min-record elapsed — Stop unlocked');
        }, ASHA_STETH_MIN_RECORD_MS);
        console.log('[ASHA Steth] Start session opened', {
          minRecordMs: ASHA_STETH_MIN_RECORD_MS,
        });
      } else if (command === 'q') {
        ecgCaptureActiveRef.current = false;
        ecgPayloadBufferRef.current = '';
        setEcgSamples([]);
      } else {
        ecgCaptureActiveRef.current = false;
        ecgPayloadBufferRef.current = '';
        setEcgSamples([]);
      }
      setStatus(`Connecting ${DEVICE_LABEL[command]}...`);

      try {
        const device = await ensureConnectedDevice();
        if (!device) return;

        const sent = await sendClassicDeviceCommand(device, command);
        if (!sent) {
          reportAshaError(
            'Command Failed',
            `Failed to send ${DEVICE_LABEL[command]} command.`,
            setStatus,
          );
          return;
        }
        if (command === 'q') {
          setStatus(
            `Waiting up to ${ASHA_STETH_POST_STOP_WAIT_MS / 1000}s for stethoscope audio from device...`,
          );
        } else {
          setStatus(`Waiting for ${DEVICE_LABEL[command]} data...`);
        }
      } catch (error) {
        const message = getErrorMessage(error, 'Bluetooth command failed.');
        reportAshaError('Command Error', message, setStatus);
      } finally {
        if (command === 'q') {
          if (stethStopFinalizeTimerRef.current) {
            clearTimeout(stethStopFinalizeTimerRef.current);
          }
          console.log('[ASHA Steth] Stop command sent — waiting for audio', {
            waitMs: ASHA_STETH_POST_STOP_WAIT_MS,
            bufferBytes: stethPayloadBufferRef.current.length,
          });
          stethStopFinalizeTimerRef.current = setTimeout(() => {
            finalizeStethCapture('stop-wait-complete');
          }, ASHA_STETH_POST_STOP_WAIT_MS);
        }
        setIsBusy(false);
      }
    },
    [ensureConnectedDevice, finalizeStethCapture, isBusy, unlockStethStopIfReady],
  );

  const storeLatestReading = useCallback(() => {
    if (!patientId.trim()) {
      setStatus('Please enter Patient ID before storing data.');
      return;
    }

    const hasEcgWave = ecgSamples.length > 0;
    const isEcgReading = selectedCommand === 'e' && hasEcgWave;

    if (isEcgReading) {
      try {
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
      } catch (error) {
        const message = getErrorMessage(error, 'Could not store ECG wave data.');
        reportAshaError('Store Error', message, setStatus);
      }
      return;
    }

    if (selectedCommand === 'e' && !hasEcgWave) {
      setStatus('No ECG wave data available to store.');
      return;
    }

    const hasStethAudio = stethPayloadBufferRef.current.length > 0 || Boolean(capturedStethPayload);
    if ((selectedCommand === 's' || selectedCommand === 'q') && hasStethAudio) {
      try {
        const capturedAt = new Date().toISOString();
        const stethPayload =
          capturedStethPayload ??
          buildStoredStethPayload(
            stethPayloadBufferRef.current,
            capturedAt,
            stethStatusMessageRef.current || undefined,
          );
        if (!stethPayload) {
          setStatus('No stethoscope audio available to store.');
          return;
        }
        const reading: Reading = {
          id: `${Date.now()}`,
          patientId: patientId.trim(),
          deviceType: 's',
          deviceName: DEVICE_LABEL.s,
          rawData: `Stethoscope WAV (${stethPayload.byteCount} bytes, ${stethPayload.sampleRate}Hz, ~${stethPayload.beatCount} beats)`,
          values: {
            steth: `Stethoscope WAV (${stethPayload.byteCount} bytes, ${stethPayload.sampleRate}Hz, ~${stethPayload.beatCount} beats)`,
          },
          createdAt: capturedAt,
          stethData: stethPayload,
        };
        setReadings(old => [reading, ...old]);
        setCapturedStethPayload(stethPayload);
        setStatus('Stethoscope audio stored successfully');
      } catch (error) {
        const message = getErrorMessage(error, 'Could not store stethoscope audio.');
        reportAshaError('Store Error', message, setStatus);
      }
      return;
    }

    if (!latestRawData.trim() && !hasParsedReadingValues(latestValues)) {
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
      rawData: latestRawData.trim() || formatStoredReadingDisplay(selectedCommand, latestValues, ''),
      values: latestValues,
      createdAt: new Date().toISOString(),
    };

    setReadings(old => [reading, ...old]);
    setStatus('Reading stored successfully');
  }, [capturedStethPayload, ecgSamples, latestRawData, latestValues, patientId, selectedCommand]);

  const clearSessionValues = useCallback(() => {
    if (stethStopFinalizeTimerRef.current) {
      clearTimeout(stethStopFinalizeTimerRef.current);
      stethStopFinalizeTimerRef.current = null;
    }
    if (stethMinRecordTimerRef.current) {
      clearTimeout(stethMinRecordTimerRef.current);
      stethMinRecordTimerRef.current = null;
    }
    ecgCaptureActiveRef.current = false;
    ecgPayloadBufferRef.current = '';
    stethSessionOpenRef.current = false;
    stethCaptureActiveRef.current = false;
    stethPayloadBufferRef.current = '';
    stethStatusMessageRef.current = '';
    stethCanStopRef.current = false;
    stethRecordStartedAtRef.current = null;
    setStethRecordingActive(false);
    setStethCanStop(false);
    setCapturedStethPayload(null);
    setCapturedEcgImage(null);
    setSessionValues({});
    setLatestRawData('');
    setEcgSamples([]);
    setStatus('Latest values cleared');
  }, []);

  const clearReadings = useCallback(() => {
    setReadings([]);
    if (readingsHydratedRef.current) {
      void persistReadings([]).catch(error => {
        const message = getErrorMessage(error, 'Failed to clear stored readings.');
        reportAshaError('Clear Error', message, setStatus);
      });
    }
    setStatus('Stored readings cleared');
  }, []);

  const handleOpenBluetoothSettings = useCallback(() => {
    try {
      openClassicBluetoothSettings();
    } catch (error) {
      const message = getErrorMessage(error, 'Could not open Bluetooth settings.');
      reportAshaError('Bluetooth Settings', message, setStatus);
    }
  }, []);

  const glucoseDisplay = formatGlucoseDisplay(latestValues.glucose);
  const temperatureDisplay = formatTemperatureDisplay(latestValues.temperature);
  const bpDisplay = formatBloodPressureDisplay(latestValues.bp);
  const spo2Display = formatPulseOximeterDisplay(latestValues.spo2, latestValues.pulse);

  const ashaResultData = useMemo(
    () => buildAshaResultData(latestValues),
    [latestValues],
  );
  const canSaveResult =
    hasAshaApiResultData(ashaResultData) ||
    Boolean(capturedStethPayload) ||
    Boolean(capturedEcgImage);

  const handleCaptureEcg = useCallback(async (): Promise<void> => {
    console.log('ECG sample count:', ecgSamples.length);

    if (ecgSamples.length === 0) {
      Alert.alert(
        'No ECG waveform',
        'Start ECG and wait until the full waveform is visible before capturing.',
      );
      return;
    }

    if (!ecgWaveformCaptureRef.current) {
      Alert.alert('Capture failed', 'ECG waveform view is not ready. Please try again.');
      return;
    }

    setIsCapturingEcg(true);
    try {
      // Full-width report strip: capture the full showFullWave plot (all stored samples).
      const captureWidth = Math.min(
        2480,
        Math.max(1400, Math.ceil(ecgSamples.length / 2) * 4),
      );
      const imagePath = await captureRef(ecgWaveformCaptureRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: captureWidth,
      });
      const normalizedPath = stripFileScheme(String(imagePath));
      let fileSize: number | string = 'unknown';
      try {
        const stat = await ReactNativeBlobUtil.fs.stat(normalizedPath);
        fileSize = stat.size;
      } catch {
        // size is debug-only
      }

      console.log('ECG image path:', imagePath);
      console.log('ECG image size:', fileSize);

      const file: AshaMultipartFile = {
        uri: toFileUri(String(imagePath)),
        name: `ecg_${Date.now()}.png`,
        type: 'image/png',
      };
      setCapturedEcgImage(file);
      setStatus('ECG waveform captured successfully');
      Alert.alert('ECG captured', 'Full ECG waveform image is ready to upload with Save result.');
    } catch (error) {
      const message = getErrorMessage(error, 'Could not capture ECG waveform image.');
      reportAshaError('ECG Capture', message, setStatus);
    } finally {
      setIsCapturingEcg(false);
    }
  }, [ecgSamples.length]);

  const handleSaveResult = useCallback(async (): Promise<void> => {
    const deviceId = routeDeviceId ?? BACKEND_ASHA_DEVICE_ID;
    const bookingItemId = routeBookingItemId;

    if (!bookingItemId) {
      Alert.alert(
        'Missing booking info',
        'No booking item linked to this session. Please navigate here from the patient booking.',
      );
      return;
    }

    if (!canSaveResult) {
      Alert.alert(
        'No readings',
        'Collect at least one vital reading from the device before saving results.',
      );
      return;
    }

    if (ecgSamples.length > 0 && !capturedEcgImage) {
      Alert.alert(
        'ECG not captured',
        'Please press "Capture ECG" to save the full waveform image before uploading results.',
      );
      return;
    }

    setIsSavingResult(true);
    try {
      let heartbeatAudio: AshaMultipartFile | null = null;
      if (capturedStethPayload?.audioBase64) {
        heartbeatAudio = await writeHeartbeatAudioTempFile(capturedStethPayload);
      }

      await postAshaResult({
        deviceId,
        bookingItemId,
        resultData: ashaResultData,
        ecgImage: capturedEcgImage,
        heartbeatAudio,
      });
    } catch {
    } finally {
      setIsSavingResult(false);
    }

    if (routeIsMultiDevice && bookingItemId) {
      setPendingCompletedBookingItemId(bookingItemId);
      navigation.goBack();
      return;
    }

    setPdfModalVisible(true);
  }, [
    routeDeviceId,
    routeBookingItemId,
    routeIsMultiDevice,
    ashaResultData,
    canSaveResult,
    capturedEcgImage,
    capturedStethPayload,
    ecgSamples.length,
    navigation,
  ]);

  const handleGeneratePdf = useCallback(async (): Promise<void> => {
    if (!routeBookingId) {
      setPdfModalVisible(false);
      navigation.replace('Reports');
      return;
    }

    setIsPdfLoading(true);
    try {
      const pdfBody = { bookingId: routeBookingId };
      await axiosInstance.post('reports/payload/pdf', pdfBody);
    } catch {
    } finally {
      setIsPdfLoading(false);
    }

    setPdfModalVisible(false);
    navigation.replace('Reports', { bookingId: routeBookingId ?? undefined });
  }, [routeBookingId, navigation]);

  const handleClosePdfModal = useCallback(() => {
    setPdfModalVisible(false);
  }, []);

  const connectionStatusLabel = isConnecting
    ? 'Connecting...'
    : isDeviceConnected
      ? 'Connected'
      : 'Tap to connect';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={UI.PRIMARY} />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="ASHA device"
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected device</Text>
          <TouchableOpacity
            style={styles.connectedDeviceCard}
            onPress={() => {
              try {
                void connectBluetoothDevice();
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : 'Bluetooth connect failed unexpectedly.';
                console.log('[ASHA BT] connect tap sync error', message);
                reportAshaError('Connection Error', message, setStatus);
                setIsConnecting(false);
              }
            }}
            activeOpacity={0.9}
            disabled={isConnecting || isBusy}
          >
            <View style={styles.connectedDeviceIconBox}>
              <MaterialCommunityIcons
                name={isDeviceConnected ? 'monitor-dashboard' : 'bluetooth-connect'}
                size={22}
                color={UI.PRIMARY}
              />
            </View>
            <View style={styles.connectedDeviceTextWrap}>
              <Text style={styles.connectedDeviceName}>{ASHA_TARGET_DEVICE_NAME}</Text>
              <Text style={styles.connectedDeviceStatus}>{connectionStatusLabel}</Text>
            </View>
            {isConnecting ? (
              <ActivityIndicator color={UI.PRIMARY} size="small" />
            ) : (
              <MaterialCommunityIcons
                name={isDeviceConnected ? 'check-circle' : 'chevron-right'}
                size={22}
                color={isDeviceConnected ? UI.PRIMARY : UI.LABEL}
              />
            )}
          </TouchableOpacity>
          {status !== 'Ready' ? <Text style={styles.statusText}>{status}</Text> : null}
          {Platform.OS === 'android' ? (
            <ActionButton
              label="Open Bluetooth Settings"
              onPress={handleOpenBluetoothSettings}
              variant="ghost"
              disabled={isBusy || isConnecting}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get device data</Text>
          <View style={styles.commandGrid}>
            {COMMAND_GRID_ROWS.map((row, rowIndex) => (
              <View key={`command-row-${rowIndex}`} style={styles.commandRow}>
                {row.map(({ command, columns }) => (
                  <CommandGridButton
                    key={command}
                    label={COMMAND_BUTTON_LABEL[command]}
                    command={command}
                    columns={columns}
                    selectedCommand={selectedCommand}
                    onPress={() => {
                      void runCommand(command);
                    }}
                    disabled={
                      isBusy ||
                      !savedDeviceAddress ||
                      (command === 's' && stethRecordingActive)
                    }
                  />
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Latest received data</Text>
            <ActionButton label="Clear" onPress={clearSessionValues} variant="ghost" />
          </View>
          <View style={styles.metricsGrid}>
            <MetricCard icon="water-outline" label="Blood Glucose" value={glucoseDisplay} />
            <MetricCard icon="thermometer" label="Temperature" value={temperatureDisplay} />
            <MetricCard icon="heart-pulse" label="Blood Pressure" value={bpDisplay} />
            <MetricCard icon="pulse" label="Pulse oximeter" value={spo2Display} />
          </View>

          {selectedCommand === 'e' ? (
            <View style={styles.ecgCard}>
              <View style={styles.ecgCardHeader}>
                <View style={styles.metricIconBox}>
                  <MaterialCommunityIcons name="heart-pulse" size={18} color={UI.PRIMARY} />
                </View>
                <Text style={styles.metricLabel}>ECG</Text>
              </View>
              <View
                ref={ecgWaveformCaptureRef}
                collapsable={false}
                style={styles.ecgCaptureTarget}
              >
                <EcgWaveform samples={ecgSamples} showFullWave />
              </View>
              <ActionButton
                label={
                  isCapturingEcg
                    ? 'Capturing...'
                    : capturedEcgImage
                      ? 'Capture ECG (done)'
                      : 'Capture ECG'
                }
                onPress={() => {
                  void handleCaptureEcg();
                }}
                variant="primary"
                fullWidth
                disabled={isCapturingEcg || isBusy || ecgSamples.length === 0}
              />
              {capturedEcgImage ? (
                <Text style={styles.ecgCaptureHint}>Full ECG waveform image captured</Text>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.label}>Patient ID</Text>
          <TextInput
            style={styles.input}
            value={patientId}
            onChangeText={setPatientId}
            placeholder="Enter Patient ID"
            placeholderTextColor={COLORS.TEXT_MUTED}
          />

          <ActionButton
            label="Store Latest Data"
            onPress={storeLatestReading}
            variant="primary"
            fullWidth
          />

          <ActionButton
            label={isSavingResult ? 'Saving...' : 'Save result'}
            onPress={() => {
              void handleSaveResult();
            }}
            variant="primary"
            fullWidth
            disabled={isSavingResult || isBusy || !canSaveResult}
          />
        </View>

        {/* <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Stored readings</Text>
            <ActionButton label="Clear" onPress={clearReadings} variant="ghost" />
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
                <View key={item.id} style={styles.readingCard}>
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
        </View> */}
      </ScrollView>

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
};

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
    <View style={pdfModalStyles.modalOverlay}>
      <View style={pdfModalStyles.modalContainer}>
        <View style={pdfModalStyles.modalHeader}>
          <View style={pdfModalStyles.modalTitleWrap}>
            <Text style={pdfModalStyles.modalTitle}>Results Saved</Text>
            <Text style={pdfModalStyles.pdfModalSubtitle}>
              ASHA screening data has been recorded. Generate a PDF report to view
              detailed results.
            </Text>
          </View>
          <TouchableOpacity
            style={pdfModalStyles.closeBtn}
            onPress={onClose}
            disabled={isPdfLoading}
          >
            <Text style={pdfModalStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[pdfModalStyles.generatePdfBtn, isPdfLoading && pdfModalStyles.disabledBtn]}
          onPress={onGeneratePdf}
          disabled={isPdfLoading}
        >
          {isPdfLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={pdfModalStyles.generatePdfBtnText}>Generate PDF</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

export default AshaDevice;

const RADIUS_LG = 16;
const RADIUS_MD = 14;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.SCREEN_BG,
  },
  headerShell: {
    backgroundColor: UI.PRIMARY,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: UI.PRIMARY,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.MD,
    paddingBottom: SPACING.XL,
    gap: SPACING.MD,
  },
  section: {
    backgroundColor: UI.SECTION_BG,
    borderRadius: RADIUS_LG,
    padding: SPACING.MD,
    gap: SPACING.SM,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: UI.VALUE,
    marginBottom: SPACING.XS,
  },
  statusText: {
    fontSize: FONT_SIZE.SM,
    color: UI.STATUS,
    marginTop: SPACING.XS,
  },
  connectedDeviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.CARD_BG,
    borderRadius: RADIUS_MD,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.SM,
    gap: SPACING.SM,
    ...CARD_SHADOW,
  },
  connectedDeviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: UI.ICON_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedDeviceTextWrap: {
    flex: 1,
    gap: 2,
  },
  connectedDeviceName: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: UI.VALUE,
  },
  connectedDeviceStatus: {
    fontSize: FONT_SIZE.SM,
    color: UI.LABEL,
    fontWeight: '500',
  },
  commandGrid: {
    gap: SPACING.SM,
  },
  commandRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  commandButton: {
    backgroundColor: UI.CARD_BG,
    borderRadius: 12,
    paddingVertical: 10,      // was 14
    paddingHorizontal: 10,    // or SPACING.XS (was SPACING.SM)
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,            // was 48
    ...CARD_SHADOW,
  },
  commandButtonThird: {
    flex: 1,
  },
  commandButtonHalf: {
    flex: 1,
  },
  commandButtonActive: {
    backgroundColor: UI.PRIMARY,
  },
  commandButtonText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: UI.VALUE,
    textAlign: 'center',
  },
  commandButtonTextActive: {
    color: COLORS.WHITE,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.SM,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: UI.CARD_BG,
    borderRadius: RADIUS_MD,
    padding: SPACING.MD,
    minHeight: 112,
    ...CARD_SHADOW,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  metricIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: UI.ICON_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    flex: 1,
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: UI.LABEL,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: UI.VALUE,
    lineHeight: 28,
  },
  ecgCard: {
    backgroundColor: UI.CARD_BG,
    borderRadius: RADIUS_MD,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.XS,
    marginTop: SPACING.XS,
    ...CARD_SHADOW,
  },
  ecgCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginBottom: SPACING.SM,
    paddingHorizontal: SPACING.SM,
  },
  ecgCaptureTarget: {
    backgroundColor: COLORS.WHITE,
    alignSelf: 'stretch',
    width: '100%',
  },
  ecgCaptureHint: {
    marginTop: SPACING.XS,
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: UI.PRIMARY,
    textAlign: 'center',
  },
  ecgPlaceholder: {
    fontSize: FONT_SIZE.SM,
    color: UI.LABEL,
    paddingVertical: SPACING.MD,
    textAlign: 'center',
  },
  label: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: UI.VALUE,
    marginTop: SPACING.SM,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.SM,
    fontSize: FONT_SIZE.MD,
    color: UI.VALUE,
    backgroundColor: UI.CARD_BG,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.SM,
  },
  button: {
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    backgroundColor: UI.CARD_BG,
    ...CARD_SHADOW,
  },
  buttonPrimary: {
    backgroundColor: UI.PRIMARY,
    borderColor: UI.PRIMARY,
    marginTop: SPACING.SM,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
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
    color: UI.VALUE,
  },
  buttonTextPrimary: {
    color: COLORS.WHITE,
  },
  buttonTextGhost: {
    color: UI.PRIMARY,
  },
  buttonTextDisabled: {
    color: COLORS.TEXT_MUTED,
  },
  emptyText: {
    fontSize: FONT_SIZE.MD,
    color: UI.LABEL,
  },
  readingCard: {
    backgroundColor: UI.CARD_BG,
    borderRadius: RADIUS_MD,
    padding: SPACING.MD,
    marginTop: SPACING.SM,
    gap: SPACING.SM,
    ...CARD_SHADOW,
  },
  readingMeta: {
    gap: 2,
  },
  readingPatient: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: UI.VALUE,
  },
  readingDevice: {
    fontSize: FONT_SIZE.SM,
    color: UI.LABEL,
  },
  readingDate: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_MUTED,
  },
  readingData: {
    fontSize: FONT_SIZE.SM,
    color: UI.VALUE,
    lineHeight: 20,
  },
});

const pdfModalStyles = StyleSheet.create({
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
  generatePdfBtn: {
    backgroundColor: '#2563EB',
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
  disabledBtn: {
    opacity: 0.6,
  },
});
