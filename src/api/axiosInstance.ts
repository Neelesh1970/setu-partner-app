import axios from 'axios';
import { getAuthToken, getRefreshToken } from '../Utils/storage';

/** API root. Use your LAN IP from a physical device when localhost is unreachable. */
export const BASE_URL = 'http://192.168.1.100:7041/api/v1';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  async config => {
    // RN is not axios "standard browser env", so FormData does not get Content-Type cleared
    // in resolveConfig. Default application/json makes transformRequest stringify FormData.
    // Use false: omit Content-Type in XHR (RN sets multipart boundary) and block dispatchRequest
    // from forcing application/x-www-form-urlencoded on POST (that also breaks multipart).
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      config.headers.setContentType(false);
    }
    const [accessToken, refreshToken] = await Promise.all([
      getAuthToken(),
      getRefreshToken(),
    ]);
    console.log('[axios] access token', accessToken ?? '(none)');
    console.log('[axios] refresh token', refreshToken ?? '(none)');
    // Access JWT (e.g. POST /identity-verification expects this)
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // Refresh token — header name must match your API (common: x-refresh-token)
    if (refreshToken) {
      config.headers['x-refresh-token'] = refreshToken;
    }
    return config;
  },
  error => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  response => response,
  error => {
    const message =
      error?.response?.data?.message ?? error?.message ?? 'Something went wrong';
    return Promise.reject(new Error(message));
  },
);

export default axiosInstance;
