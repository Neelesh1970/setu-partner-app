import axios from 'axios';
import { BASE_URL } from './apiConfig';

/**
 * Normalize access + refresh from refresh response (top-level or nested `data`, snake_case variants).
 */
function parseRefreshResponse(raw: unknown): { access: string; refresh: string } | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const inner = r.data != null && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : null;

  const access =
    (typeof r.token === 'string' && r.token) ||
    (inner && typeof inner.token === 'string' && inner.token) ||
    (typeof r.access_token === 'string' && r.access_token) ||
    (inner && typeof inner.access_token === 'string' && inner.access_token) ||
    '';

  const refresh =
    (typeof r.refreshToken === 'string' && r.refreshToken) ||
    (typeof r.refresh_token === 'string' && r.refresh_token) ||
    (inner && typeof inner.refreshToken === 'string' && inner.refreshToken) ||
    (inner && typeof inner.refresh_token === 'string' && inner.refresh_token) ||
    '';

  if (!access || !refresh) {
    return null;
  }
  return { access, refresh };
}

/**
 * Exchanges a refresh JWT for a new access+refresh pair. Uses a plain axios call (not `axiosInstance`)
 * so 401/refresh does not recurse into interceptors.
 * Adjust path/body to match your backend (common: `POST /auth/refresh`).
 */
export async function tryRefreshWithRefreshToken(
  refreshToken: string,
): Promise<{ access: string; refresh: string } | null> {
  if (!refreshToken) {
    return null;
  }
  try {
    const { data } = await axios.post<unknown>(`${BASE_URL}/auth/refresh`, { refreshToken }, {
      headers: {
        'Content-Type': 'application/json',
        'x-refresh-token': refreshToken,
      },
      timeout: 12_000,
    });
    return parseRefreshResponse(data);
  } catch (e) {
    console.log('[auth/refresh] failed', e);
    return null;
  }
}
