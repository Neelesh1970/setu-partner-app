import React, {useState} from 'react';
import {Alert, Button, Linking, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';

type RemidioQRScannerProps = {
  onBack?: () => void;
};

type RemidioQRScannerNav = NativeStackNavigationProp<RootStackParamList, 'RemidioQRScanner'>;
type VisionCameraModule = {
  Camera: React.ComponentType<{
    style?: object;
    device: unknown;
    isActive: boolean;
  }>;
  useCameraDevice: (position: 'front' | 'back') => unknown;
  useCameraPermission: () => {
    hasPermission: boolean;
    requestPermission: () => Promise<boolean> | void;
  };
};

let visionCameraModule: VisionCameraModule | null = null;
try {
  visionCameraModule = require('react-native-vision-camera') as VisionCameraModule;
} catch {
  visionCameraModule = null;
}

const RemidioQRScanner = ({onBack}: RemidioQRScannerProps) => {
  const navigation = useNavigation<RemidioQRScannerNav>();
  const handleBack = onBack ?? navigation.goBack;

  if (!visionCameraModule) {
    return (
      <View style={styles.deviceWrap}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Eye Scan REMIDIO</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.statusText}>
          Camera module is not available in this build. Rebuild Android after native module setup.
        </Text>
      </View>
    );
  }

  return <VisionCameraScanner onBack={handleBack} />;
};

const VisionCameraScanner = ({onBack}: {onBack: () => void}) => {
  const {Camera, useCameraDevice, useCameraPermission} = visionCameraModule as VisionCameraModule;
  const device = useCameraDevice('back');
  const {hasPermission, requestPermission} = useCameraPermission();
  const [qrValue, setQrValue] = useState<string>('');
  const [scanned, setScanned] = useState<boolean>(false);

  const parseQR = async (value: string): Promise<void> => {
    setQrValue(value);

    try {
      const json = JSON.parse(value);
      console.log('QR JSON:', json);
      Alert.alert('QR Data', JSON.stringify(json, null, 2));
      return;
    } catch {
      // Not JSON, continue with URL/raw handling.
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      console.log('QR URL:', value);
      await Linking.openURL(value);
      return;
    }

    console.log('Raw QR:', value);
    Alert.alert('Raw QR Data', value);
  };

  if (!hasPermission) {
    return (
      <View style={styles.deviceWrap}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Eye Scan REMIDIO</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Button title="Allow Camera" onPress={requestPermission} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.deviceWrap}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Eye Scan REMIDIO</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.statusText}>No camera found</Text>
      </View>
    );
  }

  return (
    <View style={styles.deviceWrap}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eye Scan REMIDIO</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={{flex: 1, overflow: 'hidden', borderRadius: 12}}>
        <Camera style={{flex: 1}} device={device} isActive={!scanned} />
      </View>

      <View style={{paddingVertical: 12}}>
        <Text style={styles.metricLabel}>QR Value</Text>
        <Text selectable style={styles.statusText}>
          {qrValue || 'QR scanning API is unavailable in current vision-camera package'}
        </Text>

        <Button
          title="Reset"
          onPress={() => {
            setScanned(false);
            setQrValue('');
          }}
        />
      </View>
    </View>
  );
};

export default RemidioQRScanner;

const styles = StyleSheet.create({
  deviceWrap: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  headerSpacer: {
    width: 20,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#222',
    marginBottom: 10,
  },
});
