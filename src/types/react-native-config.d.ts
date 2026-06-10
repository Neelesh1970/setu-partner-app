declare module 'react-native-config' {
  export interface NativeConfig {
    BASE_URL?: string;
    REGISTER_BASE_URL?: string;
    PREVENTIVE_BASE_URL?: string;
    RAZORPAY_TEST_KEY_ID?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
