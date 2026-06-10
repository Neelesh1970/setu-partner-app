import axios from "axios";
import { getRegisteredPatientAuthToken, getRegisteredPatientRefreshToken } from "../Utils/storage";
import { BASE_URL } from "./apiConfig";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

/** Mask a JWT to first 20 chars so logs are safe but still debuggable. */
function maskToken(t: string | null | undefined): string {
  if (!t) return "(empty)";
  return t.length > 20 ? `${t.slice(0, 20)}…[${t.length} chars]` : t;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Payment endpoints require the patient's token ("Use customer token").
  // Use the patient-specific keys set by saveRegisteredPatientAuthData,
  // NOT the primary auth_token which holds the lab worker's session.
  const [accessToken, refreshToken] = await Promise.all([
    getRegisteredPatientAuthToken(),
    getRegisteredPatientRefreshToken(),
  ]);
  if (__DEV__) {
    console.log("[API][AUTH] patient access_token  :", maskToken(accessToken));
    console.log("[API][AUTH] patient refresh_token :", maskToken(refreshToken));
  }
  return {
    Authorization: `Bearer ${accessToken ?? ""}`,
    "x-refresh-token": refreshToken ?? "",
  };
}

/** Log a failed axios request with every useful field. */
function logAxiosError(tag: string, e: unknown): void {
  const err = e as {
    message?: string;
    code?: string;
    response?: { status?: number; statusText?: string; data?: unknown; headers?: unknown };
    request?: unknown;
    config?: { url?: string; method?: string; baseURL?: string; data?: unknown; headers?: unknown };
  };
  console.error(`[API][${tag}] ❌ REQUEST FAILED ────────────────────────────`);
  console.error(`[API][${tag}]    axios message   :`, err?.message);
  console.error(`[API][${tag}]    axios code      :`, err?.code);
  console.error(`[API][${tag}]    config.method   :`, err?.config?.method?.toUpperCase());
  console.error(`[API][${tag}]    config.baseURL  :`, err?.config?.baseURL);
  console.error(`[API][${tag}]    config.url      :`, err?.config?.url);
  console.error(`[API][${tag}]    config.body     :`, err?.config?.data);
  if (err?.response) {
    console.error(`[API][${tag}]    HTTP status     :`, err.response.status, err.response.statusText);
    console.error(`[API][${tag}]    response body   :`, JSON.stringify(err.response.data, null, 2));
  } else if (err?.request) {
    console.error(`[API][${tag}]    ⚠️  request was sent but NO response received (network / timeout / CORS)`);
  } else {
    console.error(`[API][${tag}]    ⚠️  request never left the device (config error)`);
  }
}

export type PayUpiApiResponse = {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

/** POST /bookings/:bookingId/pay/upi — body {} */
export async function payUpi(bookingId: string): Promise<PayUpiApiResponse> {
  const headers = await getAuthHeaders();
  const url = `/bookings/${encodeURIComponent(bookingId)}/pay/upi`;
  try {
    const res = await api.post(url, {}, { headers });
    return res.data as PayUpiApiResponse;
  } catch (e) {
    logAxiosError("PAY-UPI", e);
    throw e;
  }
}

export type VerifyRazorpayPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type VerifyRazorpayApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/** POST /bookings/:bookingId/razorpay/verify */
export async function verifyRazorpay(
  bookingId: string,
  payload: VerifyRazorpayPayload,
): Promise<VerifyRazorpayApiResponse> {
  const headers = await getAuthHeaders();
  const url = `/bookings/${encodeURIComponent(bookingId)}/razorpay/verify`;
  try {
    const res = await api.post(url, payload, { headers });
    return res.data as VerifyRazorpayApiResponse;
  } catch (e) {
    logAxiosError("VERIFY", e);
    throw e;
  }
}

export type PayCashApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/** POST /bookings/:bookingId/pay/cash — body {} */
export async function payCash(bookingId: string): Promise<PayCashApiResponse> {
  const headers = await getAuthHeaders();
  const url = `/bookings/${encodeURIComponent(bookingId)}/pay/cash`;
  try {
    const res = await api.post(url, {}, { headers });
    return res.data as PayCashApiResponse;
  } catch (e) {
    logAxiosError("PAY-CASH", e);
    throw e;
  }
}

export type BookingDetailApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    booking?: Record<string, unknown>;
    payment?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

/** GET /bookings/:bookingId */
export async function getBooking(
  bookingId: string,
): Promise<BookingDetailApiResponse> {
  const headers = await getAuthHeaders();
  const url = `/bookings/${encodeURIComponent(bookingId)}`;
  try {
    const res = await api.get(url, { headers });
    return res.data as BookingDetailApiResponse;
  } catch (e) {
    logAxiosError("GET-BOOKING", e);
    throw e;
  }
}
