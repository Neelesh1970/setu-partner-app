/**
 * Central API root for the preventive / lab worker backend (axios baseURL + refresh calls).
 * Point LAN IP for physical device when `localhost` is not reachable.
 */
// export const BASE_URL = 'https://staging.setuai.com/preventive-health/api/v1';
export const BASE_URL =
  'https://selection-matched-diane-destiny.trycloudflare.com/api/v1';

// AUTH 7005 — registration uses a different host (see `registerAxiosInstance`).
// export const REGISTER_BASE_URL = 'https://staging.setuai.com/api/users/';
export const REGISTER_BASE_URL = 'https://rescue-legendary-assignment-republic.trycloudflare.com/';
