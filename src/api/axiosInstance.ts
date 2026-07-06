import axios from 'axios';
import {
  getAuthToken,
  getRefreshToken,
  getLabWorkerAccessToken,
  getLabWorkerRefreshToken,
  persistRefreshedAccessPair,
} from '../Utils/storage';
import { tryRefreshWithRefreshToken } from './refreshAccessToken.ts';
import { logoutUser } from '../auth/logoutUser';
import { BASE_URL, REGISTER_BASE_URL } from './apiConfig';

export { BASE_URL, REGISTER_BASE_URL } from './apiConfig';

export const registerAxiosInstance = axios.create({
  baseURL: REGISTER_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});


const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Lab/partner login OTP calls must not send a prior session's JWT, or the server may
 * resolve the session from headers and return the same tokens for a different mobile.
 */
function isAuthOtpPublicPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].replace(/\/$/, '');
  const base = path.startsWith('/') ? path.slice(1) : path;
  return (
    base === 'auth/otp/send' ||
    base === 'auth/otp/verify' ||
    base === 'auth/otp/resend'
  );
}

/** Lab worker routes must use the OTP session pair; primary keys may hold a patient JWT after signup. */
export function isLabWorkerApiPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].replace(/\/$/, '');
  const base = path.startsWith('/') ? path.slice(1) : path;
  return (
    base.startsWith('lab/') ||
    /** Same auth as lab/reports (member JWT cannot open lab report by booking). */
    base.startsWith('reports/') ||
    /** IOT device result submissions (qr-results, pulse-oxymeter-results, etc.) use lab-worker session. */
    base.startsWith('devices/') ||
  /** Lab worker booking detail (e.g. hospital MRN for Genvcare scans). */
    (base.startsWith('bookings/') && !base.includes('/pay/')) ||
    base === 'identity-verification'
  );
}

axiosInstance.interceptors.request.use(
  async config => {
    // RN is not axios "standard browser env", so FormData does not get Content-Type cleared
    // in resolveConfig. Default application/json makes transformRequest stringify FormData.
    // Use false: omit Content-Type in XHR (RN sets multipart boundary) and block dispatchRequest
    // from forcing application/x-www-form-urlencoded on POST (that also breaks multipart).
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      config.headers.setContentType(false);
    }
    const skipSessionHeaders = isAuthOtpPublicPath(config.url);
    const useLabWorkerSession = isLabWorkerApiPath(config.url);
    const [accessToken, refreshToken, labAccess, labRefresh] = await Promise.all([
      getAuthToken(),
      getRefreshToken(),
      getLabWorkerAccessToken(),
      getLabWorkerRefreshToken(),
    ]);
    const tokenForRequest =
      useLabWorkerSession && labAccess ? labAccess : accessToken;
    const refreshForRequest =
      useLabWorkerSession && labRefresh ? labRefresh : refreshToken;
    if (skipSessionHeaders) {
      return config;
    }
    // Access JWT (e.g. POST /identity-verification expects this)
    if (tokenForRequest) {
      config.headers.Authorization = `Bearer ${tokenForRequest}`;
    }
    // Refresh token — header name must match your API (common: x-refresh-token)
    if (refreshForRequest) {
      config.headers['x-refresh-token'] = refreshForRequest;
    }
    return config;
  },
  error => Promise.reject(error),
);

function toApiError(error: unknown): Error & { status?: number; responseData?: unknown } {
  const e = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
  const message =
    e?.response?.data?.message ?? e?.message ?? 'Something went wrong';
  const apiError = new Error(message) as Error & { status?: number; responseData?: unknown };
  if (e?.response?.status) {
    apiError.status = e.response.status;
  }
  if (e?.response?.data !== undefined) {
    apiError.responseData = e.response.data;
  }
  return apiError;
}

/** Single-flight refresh so parallel 401s share one refresh call. */
let refreshQueue: Promise<boolean> | null = null;

async function refreshAndPersistForRequest(originalRequest: { url?: string }): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    const useLabWorkerSession = isLabWorkerApiPath(originalRequest.url);
    const [accessToken, refreshToken, labAccess, labRefresh] = await Promise.all([
      getAuthToken(),
      getRefreshToken(),
      getLabWorkerAccessToken(),
      getLabWorkerRefreshToken(),
    ]);
    const refreshToUse =
      useLabWorkerSession && labRefresh ? labRefresh : refreshToken;
    if (!refreshToUse) {
      return false;
    }
    const pair = await tryRefreshWithRefreshToken(refreshToUse);
    if (!pair) {
      return false;
    }
    const isSplit = Boolean(
      accessToken && labAccess && accessToken !== labAccess,
    );
    const usedLabPair = useLabWorkerSession && Boolean(labRefresh);
    if (!isSplit) {
      await persistRefreshedAccessPair(pair.access, pair.refresh, { target: 'both' });
    } else if (usedLabPair) {
      await persistRefreshedAccessPair(pair.access, pair.refresh, { target: 'labWorker' });
    } else {
      await persistRefreshedAccessPair(pair.access, pair.refresh, { target: 'primary' });
    }
    return true;
  };
  if (!refreshQueue) {
    refreshQueue = run().finally(() => {
      refreshQueue = null;
    });
  }
  return refreshQueue;
}

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const status = error?.response?.status;
    const originalRequest = error?.config as
      | ({ url?: string; _retry?: boolean } & Record<string, unknown>)
      | undefined;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isAuthOtpPublicPath(originalRequest.url)) {
        return Promise.reject(toApiError(error));
      }
      const urlStr = String(originalRequest.url ?? '');
      if (urlStr.includes('auth/refresh')) {
        await logoutUser();
        return Promise.reject(toApiError(error));
      }
      originalRequest._retry = true;
      const refreshed = await refreshAndPersistForRequest(originalRequest);
      if (refreshed) {
        const useLabWorkerSession = isLabWorkerApiPath(originalRequest.url);
        const [accessToken, refreshToken, labAccess, labRefresh] = await Promise.all([
          getAuthToken(),
          getRefreshToken(),
          getLabWorkerAccessToken(),
          getLabWorkerRefreshToken(),
        ]);
        const tokenForRequest =
          useLabWorkerSession && labAccess ? labAccess : accessToken;
        const refreshForRequest =
          useLabWorkerSession && labRefresh ? labRefresh : refreshToken;
        const headers = originalRequest.headers ?? {};
        if (tokenForRequest) {
          (headers as Record<string, string>)['Authorization'] = `Bearer ${tokenForRequest}`;
        }
        if (refreshForRequest) {
          (headers as Record<string, string>)['x-refresh-token'] = refreshForRequest;
        }
        originalRequest.headers = headers as typeof originalRequest.headers;
        return axiosInstance(originalRequest as never);
      }
      await logoutUser();
      return Promise.reject(toApiError(error));
    }

    return Promise.reject(toApiError(error));
  },
);


// second base url interceptors
registerAxiosInstance.interceptors.request.use(
  async config => {
    const [accessToken, refreshToken] = await Promise.all([
      getAuthToken(),
      getRefreshToken(),
    ]);

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (refreshToken) {
      config.headers['x-refresh-token'] = refreshToken;
    }

    return config;
  },
  error => Promise.reject(error),
);

registerAxiosInstance.interceptors.response.use(
  response => response,
  error => Promise.reject(error),
);

export default axiosInstance;
