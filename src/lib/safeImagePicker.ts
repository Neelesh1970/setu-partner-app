/**
 * react-native-image-picker's JS uses TurboModuleRegistry.get('ImagePicker') when the new
 * architecture is on; that can be null while NativeModules.ImagePicker still works, which
 * throws "Cannot read property 'launchCamera' of null". This module resolves the native
 * implementation with fallbacks (same approach as the library, with extra lookups).
 */
import { NativeModules, PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';
import type {
  CameraOptions,
  ImageLibraryOptions,
  ImagePickerResponse,
} from 'react-native-image-picker';

type NativePicker = {
  launchCamera: (options: object, callback: (result: ImagePickerResponse) => void) => void;
  launchImageLibrary: (options: object, callback: (result: ImagePickerResponse) => void) => void;
};

const DEFAULT_OPTIONS: ImageLibraryOptions & CameraOptions = {
  mediaType: 'photo',
  restrictMimeTypes: [],
  videoQuality: 'high',
  quality: 1,
  maxWidth: 0,
  maxHeight: 0,
  includeBase64: false,
  cameraType: 'back',
  selectionLimit: 1,
  saveToPhotos: false,
  durationLimit: 0,
  includeExtra: false,
  presentationStyle: 'pageSheet',
  assetRepresentationMode: 'auto',
};

/** Android: manifest CAMERA must be requested at runtime before opening the camera. */
async function ensureAndroidCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera access',
      message: 'Allow camera access to take a photo.',
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function getNativeImagePicker(): NativePicker | null {
  const legacy = NativeModules.ImagePicker as NativePicker | undefined;
  if (legacy && typeof legacy.launchCamera === 'function') {
    return legacy;
  }

  const tryTurbo = (name: string): NativePicker | null => {
    const mod = TurboModuleRegistry.get(name) as NativePicker | null | undefined;
    if (mod && typeof mod.launchCamera === 'function') {
      return mod;
    }
    return null;
  };

  return tryTurbo('ImagePicker') ?? tryTurbo('RNImagePickerSpec');
}

export async function safeLaunchCamera(options: CameraOptions): Promise<ImagePickerResponse> {
  const native = getNativeImagePicker();
  if (!native) {
    return Promise.reject(
      new Error(
        'Camera is not available. Rebuild the app after installing react-native-image-picker (clean build).',
      ),
    );
  }
  const allowed = await ensureAndroidCameraPermission();
  if (!allowed) {
    return {
      didCancel: false,
      errorCode: 'permission',
      errorMessage: 'Camera permission was not granted.',
    };
  }
  return new Promise(resolve => {
    native.launchCamera({ ...DEFAULT_OPTIONS, ...options }, (result: ImagePickerResponse) => {
      resolve(result);
    });
  });
}

export function safeLaunchImageLibrary(
  options: ImageLibraryOptions,
): Promise<ImagePickerResponse> {
  const native = getNativeImagePicker();
  if (!native) {
    return Promise.reject(
      new Error(
        'Photo library is not available. Rebuild the app after installing react-native-image-picker (clean build).',
      ),
    );
  }
  return new Promise(resolve => {
    native.launchImageLibrary({ ...DEFAULT_OPTIONS, ...options }, (result: ImagePickerResponse) => {
      resolve(result);
    });
  });
}
