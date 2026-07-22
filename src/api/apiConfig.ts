import Config from 'react-native-config';

/**
 * API config — values are defined in `.env` and injected at build time by react-native-config.
 * After changing `.env`, rebuild the native app (not just Metro reload).
 */
export const BASE_URL = Config.BASE_URL!;
// export const BASE_URL = "https://workflow-exclude-atlantic-jake.trycloudflare.com/api/v1";
export const REGISTER_BASE_URL = Config.REGISTER_BASE_URL!;
export const PREVENTIVE_BASE_URL = Config.PREVENTIVE_BASE_URL!;
// export const PREVENTIVE_BASE_URL = "https://workflow-exclude-atlantic-jake.trycloudflare.com";
export const RAZORPAY_TEST_KEY_ID = Config.RAZORPAY_TEST_KEY_ID!;
