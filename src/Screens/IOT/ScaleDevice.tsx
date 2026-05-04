import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Device } from 'react-native-ble-plx';
import type { RootStackParamList } from '../../navigation/types';
import {
  connectDevice,
  disconnectDevice,
  getScaleBleState,
  scanDevices,
  stopScaleBleScan,
  subscribeScaleBleState,
} from './Controller/ScaleController';
import { requestBlePermissionsAndroid } from '../../Utils/requestBlePermissionsAndroid';

export type ScaleDiscoveredDevice = {
  id: string;
  name: string;
  rssi?: number | null;
  deviceRef: Device;
};

export type ScaleDeviceProps = {
  isScanning: boolean;
  status: string;
  bleState: string;
  connectedDeviceId: string | null;
  connectedDeviceName: string | null;
  lastPacketHex: string | null;
  lastPacketBytes: string | null;
  discoveredDevices: ScaleDiscoveredDevice[];
  onBack: () => void;
  onConnect: (deviceRef: Device) => void;
  onScanAgain: () => void | Promise<void>;
};

const ScaleDevice: React.FC<ScaleDeviceProps> = ({
  isScanning,
  status,
  bleState,
  connectedDeviceId,
  connectedDeviceName,
  lastPacketHex,
  lastPacketBytes,
  discoveredDevices,
  onBack,
  onConnect,
  onScanAgain,
}) => {
  return (
    <View style={styles.deviceWrap}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Power Max Scale</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.statusText}>{status}</Text>
      <Text style={styles.statusText}>
        Bluetooth: {bleState}
        {connectedDeviceId ? ` (${connectedDeviceId})` : ''}
      </Text>
      {connectedDeviceName ? (
        <Text style={styles.statusText}>Connected: {connectedDeviceName}</Text>
      ) : null}
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>FFF1 notify — raw only (no weight math)</Text>
        {lastPacketHex ? (
          <>
            <Text style={styles.rawHex}>HEX: {lastPacketHex}</Text>
            {lastPacketBytes ? (
              <Text style={styles.rawBytes} selectable>
                BYTES (decimal): {lastPacketBytes}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.rawPlaceholder}>
            {connectedDeviceId
              ? 'Waiting for first packet from the scale…'
              : 'Connect a device to see raw notify bytes.'}
          </Text>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Nearby Power Max Scale Devices</Text>
        {isScanning ? <ActivityIndicator size="small" color="#65b546" /> : null}
      </View>

      <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent}>
        {discoveredDevices.map(item => (
          <View key={item.id} style={styles.deviceRow}>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.deviceMeta}>
                {item.id} {typeof item.rssi === 'number' ? ` | RSSI ${item.rssi}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.connectButton} onPress={() => onConnect(item.deviceRef)}>
              <Text style={styles.connectButtonText}>Connect</Text>
            </TouchableOpacity>
          </View>
        ))}
        {!discoveredDevices.length ? <Text style={styles.emptyText}>No matching device found</Text> : null}
      </ScrollView>

      <TouchableOpacity
        style={[styles.scanButton, isScanning ? styles.scanButtonDisabled : null]}
        onPress={() => {
          void onScanAgain();
        }}
        disabled={isScanning}
      >
        <Text style={styles.scanButtonText}>{isScanning ? 'Scanning...' : 'Scan Again'}</Text>
      </TouchableOpacity>
    </View>
  );
};

type ScaleNav = NativeStackNavigationProp<RootStackParamList>;

export function ScaleDeviceScreen() {
  const navigation = useNavigation<ScaleNav>();
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [bleState, setBleState] = useState('');
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [lastPacketHex, setLastPacketHex] = useState<string | null>(null);
  const [lastPacketBytes, setLastPacketBytes] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<ScaleDiscoveredDevice[]>([]);
  const connectedRef = useRef<Device | null>(null);

  useEffect(() => {
    const sub = subscribeScaleBleState(s => setBleState(String(s)));
    return () => sub.remove();
  }, []);

  /** Same flow as Oxymeter: permissions first, then adapter state, then scan. */
  const startScaleDiscovery = useCallback(async (isCancelled: () => boolean) => {
    setStatus(Platform.OS === 'android' ? 'Requesting Bluetooth permission…' : 'Checking Bluetooth…');
    const permitted = await requestBlePermissionsAndroid();
    if (isCancelled()) return;
    if (!permitted) {
      setStatus(
        'Bluetooth permission denied. Enable Bluetooth access in system Settings to use the scale.',
      );
      setIsScanning(false);
      return;
    }

    const state = await getScaleBleState();
    if (isCancelled()) return;
    if (state !== 'PoweredOn') {
      setIsScanning(false);
      if (state === 'PoweredOff') {
        setStatus('Bluetooth is off. Turn it on, then tap Scan again.');
      } else if (state === 'Unauthorized') {
        setStatus('Bluetooth access not allowed. Enable it for this app in system settings.');
      } else {
        setStatus(`Bluetooth not ready (${String(state)}).`);
      }
      return;
    }

    if (isCancelled()) return;
    setDiscoveredDevices([]);
    setIsScanning(true);
    setStatus('Scanning for QN-SCALE…');
    scanDevices(
      setDiscoveredDevices,
      () => {
        setIsScanning(false);
        if (!isCancelled()) {
          setStatus('Scan finished. Tap Scan again to refresh, or Connect on a listed device.');
        }
      },
      () => {
        setIsScanning(false);
        if (!isCancelled()) {
          setStatus('Scan failed. Ensure Bluetooth is on and try Scan again.');
        }
      },
    );
  }, []);

  /** Oxymeter requests permissions on screen focus so the dialog can show after navigation settles. */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void startScaleDiscovery(() => cancelled);
      return () => {
        cancelled = true;
        stopScaleBleScan();
        const d = connectedRef.current;
        connectedRef.current = null;
        if (d) {
          void disconnectDevice(d);
        }
        setLastPacketHex(null);
        setLastPacketBytes(null);
        setConnectedDeviceId(null);
        setConnectedDeviceName(null);
      };
    }, [startScaleDiscovery]),
  );

  const runScan = useCallback(() => {
    void startScaleDiscovery(() => false);
  }, [startScaleDiscovery]);

  const onConnect = useCallback(async (deviceRef: Device) => {
    if (Platform.OS === 'android') {
      const ok = await requestBlePermissionsAndroid();
      if (!ok) {
        setStatus('Bluetooth permission required.');
        return;
      }
    }

    setStatus('Connecting…');
    setLastPacketHex(null);
    setLastPacketBytes(null);
    try {
      const prev = connectedRef.current;
      if (prev && prev.id !== deviceRef.id) {
        await disconnectDevice(prev);
      }
      const d = await connectDevice(deviceRef, (hex, bytes) => {
        setLastPacketHex(hex);
        setLastPacketBytes(bytes.join(', '));
      });
      connectedRef.current = d;
      setConnectedDeviceId(d.id);
      setConnectedDeviceName(
        d.name?.trim() || d.localName?.trim() || deviceRef.name?.trim() || deviceRef.localName?.trim() || null,
      );
      setStatus('Connected');
    } catch {
      setStatus('Connection failed');
    }
  }, []);

  useEffect(() => {
    return () => {
      const d = connectedRef.current;
      connectedRef.current = null;
      if (d) {
        void disconnectDevice(d);
      }
    };
  }, []);

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top', 'bottom']}>
      <ScaleDevice
        isScanning={isScanning}
        status={status}
        bleState={bleState || '—'}
        connectedDeviceId={connectedDeviceId}
        connectedDeviceName={connectedDeviceName}
        lastPacketHex={lastPacketHex}
        lastPacketBytes={lastPacketBytes}
        discoveredDevices={discoveredDevices}
        onBack={() => navigation.goBack()}
        onConnect={onConnect}
        onScanAgain={runScan}
      />
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0c162a',
  },
});

export default ScaleDevice;

const styles = StyleSheet.create({
  deviceWrap: {
    flex: 1,
    backgroundColor: '#0c162a',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    color: '#7dd3fc',
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  metricCard: {
    marginTop: 16,
    backgroundColor: '#152238',
    borderRadius: 12,
    padding: 16,
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  rawHex: {
    color: '#e2e8f0',
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 10,
  },
  rawBytes: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 8,
    lineHeight: 16,
  },
  rawPlaceholder: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 10,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  listTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#152238',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
  },
  deviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  connectButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginLeft: 12,
  },
  connectButtonText: {
    color: '#0c162a',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  scanButton: {
    marginTop: 12,
    backgroundColor: '#65b546',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanButtonDisabled: {
    opacity: 0.55,
  },
  scanButtonText: {
    color: '#0c162a',
    fontSize: 16,
    fontWeight: '700',
  },
});
