import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { requestBlePermissionsAndroid } from '../../Utils/requestBlePermissionsAndroid';
import { resolveLabIotPerformTestScreen } from '../../Utils/labIotPerformTest';
import { setPendingCompletedBookingItemId } from '../../Utils/multiDeviceSession';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';
import pulseOxymeterPng from '../../assets/iot/pulse_oxymeter.png';
import { COLORS, SPACING } from '../../Constants/theme';
import { BleError, BleErrorCode, BleManager } from 'react-native-ble-plx';
import type { Device, Subscription } from 'react-native-ble-plx';
import styles from './Oxymeter.styles';
import { postPulseOximeterResult } from '../../api/iotDeviceResults';
import axiosInstance from '../../api/axiosInstance';
import { BACKEND_PULSE_OXIMETER_DEVICE_ID } from '../../Utils/labIotPerformTest';

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
  /* {
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
  }, */
];

const OX_LIVE_ICON_BLACK = '#0a0a0a';

/** Harmonics with period P so y(x+P) === y(x) for seamless horizontal tiling. */
type OxHarm = { n: number; a: number; phi: number };

const OX_LAYER_HARMONICS: OxHarm[][] = [
  [
    { n: 1, a: 0.4, phi: 0.12 },
    { n: 2, a: 0.26, phi: 1.02 },
    { n: 3, a: 0.17, phi: 1.95 },
    { n: 4, a: 0.12, phi: 0.55 },
    { n: 5, a: 0.08, phi: 1.78 },
    { n: 6, a: 0.05, phi: 2.65 },
  ],
  [
    { n: 1, a: 0.34, phi: 1.18 },
    { n: 2, a: 0.22, phi: 0.28 },
    { n: 3, a: 0.19, phi: 1.48 },
    { n: 4, a: 0.11, phi: 2.25 },
    { n: 5, a: 0.09, phi: 0.88 },
    { n: 7, a: 0.06, phi: 1.62 },
  ],
  [
    { n: 1, a: 0.24, phi: 2.05 },
    { n: 2, a: 0.2, phi: 0.95 },
    { n: 3, a: 0.14, phi: 0.38 },
    { n: 4, a: 0.11, phi: 2.48 },
    { n: 6, a: 0.08, phi: 1.22 },
    { n: 8, a: 0.05, phi: 0.15 },
  ],
];

function oxLiveWaveSurfaceY(
  x: number,
  height: number,
  period: number,
  layer: 0 | 1 | 2,
): number {
  const P = Math.max(1, period);
  const specs = OX_LAYER_HARMONICS[layer];
  let v = 0;
  for (const { n, a, phi } of specs) {
    v += a * Math.sin((2 * Math.PI * n * x) / P + phi);
  }
  const w = (2 * Math.PI * x) / P;
  const env = 1 + 0.11 * Math.sin(w + 0.25) + 0.07 * Math.sin(2 * w + 0.9);
  const base = height * 0.48;
  const amp = height * 0.24;
  const y = base + amp * v * env;
  return Math.min(height * 0.94, Math.max(height * 0.14, y));
}

function buildOxLiveLayerFillRatios(
  segmentCount: number,
  period: number,
  waveHeight: number,
  layer: 0 | 1 | 2,
): number[] {
  return Array.from({ length: segmentCount }, (_, i) => {
    const x = ((i + 0.5) / segmentCount) * period;
    const ySurf = oxLiveWaveSurfaceY(x, waveHeight, period, layer);
    const fillH = waveHeight - ySurf;
    return Math.max(0.05, Math.min(1, fillH / waveHeight));
  });
}

/** Back = deep royal; mid/front lighter with lower opacity so overlaps read like the reference. */
const OX_WAVE_FILLS: { layer: 0 | 1 | 2; fill: string; opacity: number }[] = [
  { layer: 0, fill: '#0c2a66', opacity: 0.94 },
  { layer: 1, fill: '#2f6ff0', opacity: 0.55 },
  { layer: 2, fill: '#bfe6ff', opacity: 0.48 },
];

const OX_RASTER_SEGMENTS = 96;

type OxLiveRasterWaveProps = {
  period: number;
  waveHeight: number;
};

const OxLiveRasterWave: React.FC<OxLiveRasterWaveProps> = ({ period, waveHeight }) => {
  const scroll = useRef(new Animated.Value(0)).current;
  const bobL0 = useRef(new Animated.Value(0)).current;
  const bobL1 = useRef(new Animated.Value(0)).current;
  const bobL2 = useRef(new Animated.Value(0)).current;
  const p = Math.max(80, Math.floor(period));

  const layerRatios = useMemo(
    () =>
      OX_WAVE_FILLS.map(({ layer }) =>
        buildOxLiveLayerFillRatios(OX_RASTER_SEGMENTS, p, waveHeight, layer),
      ),
    [p, waveHeight],
  );

  const ty0 = bobL0.interpolate({
    inputRange: [0, 1],
    outputRange: [5, -10],
  });
  const ty1 = bobL1.interpolate({
    inputRange: [0, 1],
    outputRange: [-7, 8],
  });
  const ty2 = bobL2.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -6],
  });
  const layerBobY = [ty0, ty1, ty2];

  useEffect(() => {
    scroll.setValue(0);
    const scrollLoop = Animated.loop(
      Animated.timing(scroll, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const makeBob = (
      v: Animated.Value,
      upMs: number,
      downMs: number,
      delay = 0,
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: upMs,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: downMs,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

    const b0 = makeBob(bobL0, 1960, 2340, 0);
    const b1 = makeBob(bobL1, 2680, 1890, 120);
    const b2 = makeBob(bobL2, 1540, 2920, 280);

    scrollLoop.start();
    b0.start();
    b1.start();
    b2.start();
    return () => {
      scrollLoop.stop();
      b0.stop();
      b1.stop();
      b2.stop();
    };
  }, [scroll, bobL0, bobL1, bobL2, p]);

  const translateX = scroll.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -p],
  });

  const renderTile = (tileKey: string) => (
    <View key={tileKey} style={[styles.oxLiveRasterTile, { width: p, height: waveHeight }]}>
      {OX_WAVE_FILLS.map(({ layer, fill, opacity }, li) => (
        <Animated.View
          key={`${tileKey}-${layer}`}
          style={[
            styles.oxLiveRasterLayer,
            { height: waveHeight, transform: [{ translateY: layerBobY[li] }] },
          ]}
        >
          <View style={styles.oxLiveRasterBarRow}>
            {layerRatios[li].map((ratio, i) => (
              <View
                key={`${tileKey}-${layer}-${i}`}
                style={[
                  styles.oxLiveRasterBar,
                  styles.oxLiveRasterBarOverlap,
                  {
                    flex: 1,
                    height: `${Math.round(ratio * 1000) / 10}%`,
                    backgroundColor: fill,
                    opacity,
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      ))}
    </View>
  );

  return (
    <View style={[styles.oxLiveLightWaveClip, { height: waveHeight }]}>
      <Animated.View
        style={[
          styles.oxLiveLightWaveScroll,
          {
            width: p * 2,
            height: waveHeight,
            flexDirection: 'row',
            transform: [{ translateX }],
          },
        ]}
      >
        {renderTile('a')}
        {renderTile('b')}
      </Animated.View>
    </View>
  );
};

type OxLiveMetricsWaveCardProps = {
  oxygen: number | null;
  bpm: number | null;
  compact: boolean;
  sidePad: number;
};

const OxLiveMetricsWaveCard: React.FC<OxLiveMetricsWaveCardProps> = ({
  oxygen,
  bpm,
  compact,
  sidePad,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [wavePeriod, setWavePeriod] = useState(() =>
    Math.max(100, Math.floor(windowWidth - sidePad * 2 - 4)),
  );
  const iconSize = compact ? 20 : 24;
  const waveH = compact ? 72 : 92;

  return (
    <View
      style={[
        styles.oxLiveMetricsCard,
        { marginHorizontal: sidePad },
        compact && styles.oxLiveMetricsCardCompact,
      ]}
      onLayout={e => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w > 40) setWavePeriod(w);
      }}
    >
      <View style={[styles.oxLiveLightTop, compact && styles.oxLiveLightTopCompact]}>
        <View style={[styles.oxLiveMetricsRow, compact && styles.oxLiveMetricsRowCompact]}>
          <View style={[styles.oxLiveMetricHalf, compact && styles.oxLiveMetricHalfCompact]}>
            <View style={styles.oxLiveMetricIconRow}>
              <MaterialCommunityIcons
                name="cloud-outline"
                size={iconSize}
                color={OX_LIVE_ICON_BLACK}
                style={styles.oxLiveMetricIconSpacing}
              />
              <Text style={styles.oxLiveLightLabel}>SpO₂%</Text>
            </View>
            <Text style={[styles.oxLiveLightValue, compact && styles.oxLiveLightValueCompact]}>
              {oxygen !== null ? `${oxygen}` : '—'}
            </Text>
          </View>
          <View style={styles.oxLiveLightDivider} />
          <View style={[styles.oxLiveMetricHalf, compact && styles.oxLiveMetricHalfCompact]}>
            <View style={styles.oxLiveMetricIconRow}>
              <MaterialCommunityIcons
                name="heart-pulse"
                size={iconSize}
                color={OX_LIVE_ICON_BLACK}
                style={styles.oxLiveMetricIconSpacing}
              />
              <Text style={styles.oxLiveLightLabel}>PR bpm</Text>
            </View>
            <Text style={[styles.oxLiveLightValue, compact && styles.oxLiveLightValueCompact]}>
              {bpm !== null ? `${bpm}` : '—'}
            </Text>
          </View>
        </View>
      </View>
      <OxLiveRasterWave period={wavePeriod} waveHeight={waveH} />
    </View>
  );
};

type PulseOximeterPairScreenProps = {
  onConnect: () => void;
  isConnecting: boolean;
};

const PulseOximeterPairScreen: React.FC<PulseOximeterPairScreenProps> = ({
  onConnect,
  isConnecting,
}) => {
  const { width, height } = useWindowDimensions();
  const sidePad = Math.min(24, Math.max(16, width * 0.04));
  const compact = height < 640;

  return (
    <View style={styles.oxLightRoot}>
      <View style={[styles.oxLightImageWrap, { paddingHorizontal: sidePad }]}>
        <Image
          source={pulseOxymeterPng}
          style={styles.oxLightHeroImage}
          resizeMode="contain"
        />
      </View>

      <View
        style={[
          styles.oxLightBottomCard,
          { marginHorizontal: sidePad },
          compact && styles.oxLightBottomCardCompact,
        ]}
      >
        <Text style={[styles.oxLightCardTitle, compact && styles.oxLightCardTitleCompact]}>
          Pair Device
        </Text>
        <Text
          style={[styles.oxLightCardCopy, compact && styles.oxLightCardCopyCompact]}
          numberOfLines={compact ? 4 : undefined}
        >
          We have detected your pulse oximeter. Make sure it is turned on and within range, then
          tap Connect to pair your device and start your health test.
        </Text>
        <TouchableOpacity
          style={[styles.oxLightPrimaryBtn, isConnecting && styles.oxLightPrimaryBtnDisabled]}
          onPress={onConnect}
          disabled={isConnecting}
          activeOpacity={0.88}
        >
          <Text style={styles.oxLightPrimaryBtnText}>
            {isConnecting ? 'Requesting Bluetooth…' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

type PulseOximeterLiveScreenProps = {
  oxygen: number | null;
  bpm: number | null;
  connectionStatus: string;
  isConnecting: boolean;
  onSave: () => void;
  isSaving: boolean;
};

const PulseOximeterLiveScreen: React.FC<PulseOximeterLiveScreenProps> = ({
  oxygen,
  bpm,
  connectionStatus,
  isConnecting,
  onSave,
  isSaving,
}) => {
  const { width, height } = useWindowDimensions();
  const sidePad = Math.min(24, Math.max(16, width * 0.04));
  const compact = height < 640;
  const showErrorHint =
    !isConnecting &&
    (connectionStatus.includes('❌') ||
      connectionStatus.toLowerCase().includes('failed') ||
      connectionStatus.toLowerCase().includes('permission'));
  const canSave = oxygen !== null && bpm !== null && !isConnecting;

  return (
    <View style={styles.oxLightRoot}>
      {isConnecting ? (
        <View style={styles.oxLiveCenter}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.oxLiveConnectingText}>{connectionStatus}</Text>
        </View>
      ) : (
        <View style={styles.oxLiveLiveCenterWrap}>
          <View style={styles.oxLiveLiveCenterInner}>
            <OxLiveMetricsWaveCard oxygen={oxygen} bpm={bpm} compact={compact} sidePad={sidePad} />
            <View style={[styles.oxLiveStatusFooter, compact && styles.oxLiveStatusFooterCompact]}>
              <Text
                style={[styles.oxLiveStatusText, showErrorHint && styles.oxLiveStatusTextError]}
                numberOfLines={3}
              >
                {connectionStatus}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Save button — sits at the bottom with breathing room */}
      {!isConnecting && (
        <View style={styles.oxLiveSaveRow}>
          <TouchableOpacity
            style={[
              styles.oxLiveSaveBtn,
              (!canSave || isSaving) && styles.oxLiveSaveBtnDisabled,
            ]}
            onPress={onSave}
            disabled={!canSave || isSaving}
            activeOpacity={0.88}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.oxLiveSaveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── Results bottom-sheet modal ───────────────────────────────────────────────

type OximeterResultsModalProps = {
  visible: boolean;
  oxygen: number | null;
  bpm: number | null;
  isPdfLoading: boolean;
  onGeneratePdf: () => void;
  onClose: () => void;
};

const OximeterResultsModal: React.FC<OximeterResultsModalProps> = ({
  visible,
  oxygen,
  bpm,
  isPdfLoading,
  onGeneratePdf,
  onClose,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.oxModalOverlay}>
      <View style={styles.oxModalSheet}>
        <View style={styles.oxModalHandle} />

        <View style={styles.oxModalTitleRow}>
          <Text style={styles.oxModalTitle}>Results Saved </Text>
          <Text style={{ fontSize: 20 }}>✅</Text>
        </View>
        <Text style={styles.oxModalSubtitle}>
          Pulse oximeter readings have been recorded successfully.
        </Text>

        {/* Two-column result card */}
        <View style={styles.oxModalResultCard}>
          <View style={styles.oxModalMetricCol}>
            <MaterialCommunityIcons
              name="cloud-outline"
              size={22}
              color="#2E5BFF"
              style={styles.oxModalMetricIcon}
            />
            <Text style={styles.oxModalMetricLabel}>SpO₂</Text>
            <Text style={styles.oxModalMetricValue}>
              {oxygen !== null ? `${oxygen}` : '—'}
            </Text>
            <Text style={styles.oxModalMetricUnit}>%</Text>
          </View>
          <View style={styles.oxModalMetricDivider} />
          <View style={styles.oxModalMetricCol}>
            <MaterialCommunityIcons
              name="heart-pulse"
              size={22}
              color="#2E5BFF"
              style={styles.oxModalMetricIcon}
            />
            <Text style={styles.oxModalMetricLabel}>PR bpm</Text>
            <Text style={styles.oxModalMetricValue}>
              {bpm !== null ? `${bpm}` : '—'}
            </Text>
            <Text style={styles.oxModalMetricUnit}>beats/min</Text>
          </View>
        </View>

        {/* Generate PDF */}
        <TouchableOpacity
          style={[styles.oxModalPdfBtn, isPdfLoading && styles.oxModalPdfBtnDisabled]}
          onPress={onGeneratePdf}
          disabled={isPdfLoading}
          activeOpacity={0.88}
        >
          {isPdfLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.oxModalPdfBtnText}>Generate PDF</Text>
          )}
        </TouchableOpacity>

        {/* Close without PDF */}
        <TouchableOpacity
          style={styles.oxModalCloseBtn}
          onPress={onClose}
          disabled={isPdfLoading}
        >
          <Text style={styles.oxModalCloseBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ─── BLE scan helpers ──────────────────────────────────────────────────────────

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
  // On Android, startDeviceScan with service UUID filters fails with an internal
  // BleError: Unknown error (unhandled native promise rejection inside the library).
  // Skip straight to the broad scan; the outcome is identical since the filtered
  // scan always falls back on Android anyway.
  if (Platform.OS !== 'android') {
    try {
      return await scanWithOximeterServices(manager);
    } catch {
      // fall through to broad scan
    }
  }
  return scanBroadForOximeter(manager);
}

const OX_BLE_DISCONNECT_HINT =
  'Oximeter disconnected. Keep it close, powered on, finger in the sensor, then tap Connect again.';

/** Returns true when a BleError is an intentional operation cancellation (e.g. subscription removed on unmount). */
function isBleOperationCancelled(error: unknown): boolean {
  if (error instanceof BleError && error.errorCode === BleErrorCode.OperationCancelled) {
    return true;
  }
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return msg.includes('operation was cancel') || msg.includes('was cancelled') || msg.includes('was canceled');
}

/** Maps BleError / generic errors to UI copy; disconnects are expected sometimes — log as warn. */
function resolveNativeBleUserFeedback(error: unknown): {
  status: string;
  logDetail: string;
  level: 'warn' | 'error';
} {
  if (error instanceof BleError) {
    switch (error.errorCode) {
      case BleErrorCode.OperationCancelled:
        // Subscription was intentionally removed (screen unmount / navigate away) — not an error.
        return {
          status: '',
          logDetail: '',
          level: 'warn',
        };
      case BleErrorCode.DeviceDisconnected:
      case BleErrorCode.DeviceNotConnected:
      case BleErrorCode.OperationTimedOut:
        return {
          status: `🔌 ${OX_BLE_DISCONNECT_HINT}`,
          logDetail: error.message,
          level: 'warn',
        };
      case BleErrorCode.BluetoothPoweredOff:
        return {
          status: '🔌 Bluetooth is off. Turn it on and try again.',
          logDetail: error.message,
          level: 'warn',
        };
      case BleErrorCode.DeviceConnectionFailed:
        return {
          status: '❌ Could not connect. Move closer to the oximeter and try again.',
          logDetail: error.message,
          level: 'warn',
        };
      default:
        break;
    }
  }
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (lower.includes('disconnect') || lower.includes('was disconnected')) {
    return {
      status: `🔌 ${OX_BLE_DISCONNECT_HINT}`,
      logDetail: msg,
      level: 'warn',
    };
  }
  if (lower.includes('bluetooth is off')) {
    return { status: msg, logDetail: msg, level: 'warn' };
  }
  return {
    status: '❌ Connection failed.',
    logDetail: msg,
    level: 'error',
  };
}

const Oxymeter: React.FC = () => {
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
  const [isSaving, setIsSaving] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const webCharacteristicRef = useRef<BluetoothCharacteristicLike | null>(null);
  const webNotificationHandlerRef = useRef<((event: unknown) => void) | null>(null);
  const bleManagerRef = useRef<BleManager | null>(null);
  const isMountedRef = useRef(true);
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
    isMountedRef.current = true;

    if (Platform.OS === 'web') return;

    const manager = new BleManager();
    bleManagerRef.current = manager;

    return () => {
      isMountedRef.current = false;

      void (async () => {
        nativeMonitorSubRef.current?.remove();
        nativeMonitorSubRef.current = null;

        try {
          await nativeDeviceRef.current?.cancelConnection();
        } catch { }

        nativeDeviceRef.current = null;

        manager.stopDeviceScan();

        // small delay avoids destroy race
        setTimeout(() => {
          manager.destroy();
        }, 300);
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
              if (error) {
                // Cancellation is expected when the subscription is intentionally removed
                // (screen unmounts or navigates away). Suppress entirely — not a real error.
                if (isBleOperationCancelled(error)) return;
                const fb = resolveNativeBleUserFeedback(error);
                if (fb.status) setConnectionStatus(fb.status);
                if (fb.logDetail) appendLog(`Stream: ${fb.logDetail}`);
                if (fb.level === 'error') {
                  console.error('Oximeter BLE monitor', error);
                } else {
                  console.warn('Oximeter BLE monitor', error);
                }
                return;
              }
              if (!c?.value) return;
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
        const fb = resolveNativeBleUserFeedback(error);
        setConnectionStatus(fb.status);
        appendLog(fb.logDetail);
        if (fb.level === 'error') {
          console.error('Native BLE error', error);
        } else {
          console.warn('Native BLE error', error);
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

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Oxymeter'>>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const bodyBottomPad = Math.max(insets.bottom, SPACING.SM);
  const dashboardCompact = windowHeight < 700;

  const headerTitle = !activeDevice
    ? 'Setu Device'
    : activeDevice.id === 'setu-oximeter'
      ? 'Pulse Oximeter'
      : activeDevice.name;

  const handleHeaderBack = useCallback(() => {
    if (activeDevice) {
      closeDeviceScreen();
    } else {
      navigation.goBack();
    }
  }, [activeDevice, closeDeviceScreen, navigation]);

  /** Save current SpO₂ + pulse to backend, then open results modal or navigate back for multi-device. */
  const handleSave = useCallback(async () => {
    if (oxygen === null || bpm === null) return;
    const params = route.params;
    const deviceId = params?.deviceId ?? BACKEND_PULSE_OXIMETER_DEVICE_ID;
    const bookingItemId = params?.bookingItemId ?? null;
    const isMultiDevice = params?.isMultiDevice ?? false;

    if (!bookingItemId) {
      Alert.alert(
        'Missing booking info',
        'No booking item linked to this session. Please navigate here from the patient booking.',
      );
      return;
    }

    setIsSaving(true);
    try {
      await postPulseOximeterResult({
        deviceId,
        bookingItemId,
        spo2: oxygen,
        pulseRate: bpm,
      });
      if (isMultiDevice) {
        // Multi-device flow: store the completed item id in a module-level variable then go back.
        // goBack() does not touch DeviceSelect's params — devices/packages stay intact.
        setPendingCompletedBookingItemId(bookingItemId);
        navigation.goBack();
      } else {
        setShowResultsModal(true);
      }
    } catch (err) {
      const e = err as { message?: string };
      Alert.alert('Save failed', e?.message ?? 'Could not save results. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [oxygen, bpm, route.params, navigation]);

  /** Call reports/payload/pdf then navigate to Reports screen. */
  const handleGeneratePdf = useCallback(async () => {
    const bookingId = route.params?.bookingId ?? null;
    setIsPdfLoading(true);
    try {
      if (bookingId) {
        await axiosInstance.post('reports/payload/pdf', { bookingId });
      }
    } catch (err) {
      const e = err as { message?: string };
      console.warn('[Oxymeter] PDF generation failed:', e?.message ?? err);
    } finally {
      setIsPdfLoading(false);
    }
    setShowResultsModal(false);
    navigation.replace('Reports', { bookingId: route.params?.bookingId ?? undefined });
  }, [route.params, navigation]);

  useEffect(() => {
    const params = route.params;
    const deviceIdFromBackend = params?.deviceId ?? null;
    const deviceNameFromBackend = (params?.deviceName ?? null) as string | null;

    // If navigation didn't provide device context, keep original dashboard behavior.
    if (!deviceIdFromBackend && !deviceNameFromBackend) return;

    if (resolveLabIotPerformTestScreen(deviceIdFromBackend, deviceNameFromBackend) === 'Oxymeter') {
      // Open the main Oxymeter dashboard (device cards). Do not auto-open setup/connect.
      setSelectedDeviceId('setu-oximeter');
      return;
    }
  }, [route.params]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY} />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader title={headerTitle} showBack onBackPress={handleHeaderBack} />
        </SafeAreaView>
      </View>
      <View
        style={[
          styles.bodyFlex,
          styles.bodySurface,
          { paddingBottom: bodyBottomPad },
        ]}
      >
        <View style={styles.bodyInner}>
          {!activeDevice && (
            <View style={styles.dashboardColumn}>
              <View style={[styles.hero, dashboardCompact && styles.heroCompact]}>
                <Text style={[styles.heroTitle, dashboardCompact && styles.heroTitleCompact]}>
                  Setu Device
                </Text>
                <Text
                  style={[styles.heroSubtitle, dashboardCompact && styles.heroSubtitleCompact]}
                  numberOfLines={dashboardCompact ? 3 : undefined}
                >
                  Central dashboard for every Setu-enabled sensor. Tap a device to open its
                  individual screen.
                </Text>
                {/* <TouchableOpacity
                  style={[styles.ctaButton, dashboardCompact && styles.ctaButtonCompact]}
                  onPress={addDevice}
                >
                  <Text style={styles.ctaButtonText}>Add new device</Text>
                </TouchableOpacity> */}
              </View>

              <View style={[styles.sectionHeader, dashboardCompact && styles.sectionHeaderCompact]}>
                <View style={styles.sectionHeaderTextWrap}>
                  <Text style={styles.sectionTitle}>All devices</Text>
                  <Text
                    style={[styles.sectionTagline, dashboardCompact && styles.sectionTaglineCompact]}
                    numberOfLines={2}
                  >
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
                      dashboardCompact && styles.deviceCardCompact,
                      selectedDeviceId === device.id && styles.deviceCardActive,
                    ]}
                    onPress={() => openDeviceScreen(device.id, device.name)}
                  >
                    <Text style={styles.deviceIcon}>{device.icon}</Text>
                    <View style={styles.deviceCopy}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {device.name}
                      </Text>
                      <Text style={styles.deviceSubtitle} numberOfLines={2}>
                        {device.subtitle}
                      </Text>
                    </View>
                    <View style={styles.deviceBadge}>
                      <Text style={styles.deviceBadgeText} numberOfLines={1}>
                        {device.badge}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {activeDevice && activeDevice.id === 'setu-oximeter' ? (
            showLiveOximeterScreen ? (
              <PulseOximeterLiveScreen
                oxygen={oxygen}
                bpm={bpm}
                connectionStatus={connectionStatus}
                isConnecting={isConnecting}
                onSave={() => { void handleSave(); }}
                isSaving={isSaving}
              />
            ) : (
              <PulseOximeterPairScreen
                isConnecting={isConnecting}
                onConnect={connectToSelectedDevice}
              />
            )
          ) : null}

          {activeDevice && activeDevice.id !== 'setu-oximeter' ? (
            <View style={styles.deviceDetailWrap}>
              <View style={styles.deviceDetailHeading}>
                <Text style={styles.deviceDetailTitle} numberOfLines={2}>
                  {activeDevice.name}
                </Text>
                <Text style={styles.deviceDetailType}>{activeDevice.type}</Text>
              </View>
              <Text style={styles.deviceDetailBody} numberOfLines={3}>
                {activeDevice.detail}
              </Text>
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
              <Text style={styles.helpText} numberOfLines={2}>
                Allow Bluetooth access when prompted so Setu Device can scan and deliver the latest
                readings.
              </Text>

              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Connection status</Text>
                <Text style={styles.statusValue} numberOfLines={2}>
                  {connectionStatus}
                </Text>
                {statusLog.map((item, index) => (
                  <Text key={`${item}-${index}`} style={styles.statusLine} numberOfLines={1}>
                    • {item}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* Results bottom-sheet — shown after a successful save */}
      <OximeterResultsModal
        visible={showResultsModal}
        oxygen={oxygen}
        bpm={bpm}
        isPdfLoading={isPdfLoading}
        onGeneratePdf={() => { void handleGeneratePdf(); }}
        onClose={() => setShowResultsModal(false)}
      />
    </View>
  );
};

export default Oxymeter;
