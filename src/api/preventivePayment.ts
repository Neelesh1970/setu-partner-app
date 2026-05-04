import axios from "axios";
import { getAuthToken, getRefreshToken } from "../Utils/storage";

/** Keep in sync with `PreventiveHealthAPI` base host. */
const PREVENTIVE_BASE_URL =
  "https://evaluation-alpine-functional-brakes.trycloudflare.com";

const api = axios.create({
  baseURL: `${PREVENTIVE_BASE_URL}/api/v1`,
  timeout: 60000,
});

async function getAuthHeaders(): Promise<Record<string, string>> {
  const [accessToken, refreshToken] = await Promise.all([
    getAuthToken(),
    getRefreshToken(),
  ]);
  return {
    Authorization: `Bearer ${accessToken ?? ""}`,
    "x-refresh-token": refreshToken ?? "",
  };
}

export type PayUpiApiResponse = {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

/** POST /bookings/:bookingId/pay/upi — body {} */
export async function payUpi(bookingId: string): Promise<PayUpiApiResponse> {
  const headers = await getAuthHeaders();
  const res = await api.post(
    `/bookings/${encodeURIComponent(bookingId)}/pay/upi`,
    {},
    { headers },
  );
  return res.data as PayUpiApiResponse;
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
  const res = await api.post(
    `/bookings/${encodeURIComponent(bookingId)}/razorpay/verify`,
    payload,
    { headers },
  );
  return res.data as VerifyRazorpayApiResponse;
}

export type PayCashApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/** POST /bookings/:bookingId/pay/cash — body {} */
export async function payCash(bookingId: string): Promise<PayCashApiResponse> {
  const headers = await getAuthHeaders();
  const res = await api.post(
    `/bookings/${encodeURIComponent(bookingId)}/pay/cash`,
    {},
    { headers },
  );
  return res.data as PayCashApiResponse;
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
  const res = await api.get(`/bookings/${encodeURIComponent(bookingId)}`, {
    headers,
  });
  return res.data as BookingDetailApiResponse;
}
