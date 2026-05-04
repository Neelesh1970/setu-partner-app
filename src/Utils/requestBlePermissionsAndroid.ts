import { PermissionsAndroid, Platform } from 'react-native';

const getAndroidSdkInt = (): number => {
  if (Platform.OS !== 'android') return 0;
  const v = Platform.Version;
  return typeof v === 'number' ? v : parseInt(String(v), 10) || 0;
};

/**
 * Runtime BLE permissions on Android. iOS uses Info.plist; no-op returns true.
 */
export async function requestBlePermissionsAndroid(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const sdk = getAndroidSdkInt();
  try {
    if (sdk >= 31) {
      const scan = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: 'Allow Bluetooth scan',
          message:
            'Setu needs nearby Bluetooth scan permission to discover your scale and other devices.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      const connect = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: 'Allow Bluetooth connection',
          message: 'Setu needs Bluetooth connect permission to pair with your devices.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return (
        scan === PermissionsAndroid.RESULTS.GRANTED &&
        connect === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    if (sdk >= 23) {
      const location = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Allow location for Bluetooth scan',
          message:
            'On this Android version, scanning for Bluetooth devices requires location access. It is used only for device discovery.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return location === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch {
    return false;
  }
}
