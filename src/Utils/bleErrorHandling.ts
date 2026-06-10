import {BleError, BleErrorCode} from 'react-native-ble-plx';
import type {Device} from 'react-native-ble-plx';

/** Subscription removed on unmount / navigate away — not a real failure. */
export function isBleOperationCancelled(error: unknown): boolean {
  if (error instanceof BleError && error.errorCode === BleErrorCode.OperationCancelled) {
    return true;
  }
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('operation was cancel') ||
    msg.includes('was cancelled') ||
    msg.includes('was canceled')
  );
}

/** Disconnect / teardown races — safe to swallow (no user-facing error). */
export function isExpectedBleDisconnectError(error: unknown): boolean {
  if (isBleOperationCancelled(error)) {
    return true;
  }
  if (error instanceof BleError) {
    switch (error.errorCode) {
      case BleErrorCode.DeviceDisconnected:
      case BleErrorCode.DeviceNotConnected:
      case BleErrorCode.OperationTimedOut:
      case BleErrorCode.BluetoothPoweredOff:
        return true;
      default:
        break;
    }
  }
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('not connected') ||
    msg.includes('disconnected') ||
    msg.includes('was destroyed')
  );
}

export async function isBleDeviceConnected(device: Device): Promise<boolean> {
  try {
    return await device.isConnected();
  } catch {
    return false;
  }
}
