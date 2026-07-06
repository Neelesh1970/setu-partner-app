import axios from "axios";
import { getRegisteredPatientAuthToken, getRegisteredPatientRefreshToken } from "../Utils/storage";
import { BASE_URL } from "./apiConfig";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Payment endpoints require the patient's token ("Use customer token").
  // Use the patient-specific keys set by saveRegisteredPatientAuthData,
  // NOT the primary auth_token which holds the lab worker's session.
  const [accessToken, refreshToken] = await Promise.all([
    getRegisteredPatientAuthToken(),
    getRegisteredPatientRefreshToken(),
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
  const url = `/bookings/${encodeURIComponent(bookingId)}/pay/upi`;
  const res = await api.post(url, {}, { headers });
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
  const url = `/bookings/${encodeURIComponent(bookingId)}/razorpay/verify`;
  const res = await api.post(url, payload, { headers });
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
  const url = `/bookings/${encodeURIComponent(bookingId)}/pay/cash`;
  const res = await api.post(url, {}, { headers });
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
  const url = `/bookings/${encodeURIComponent(bookingId)}`;
  const res = await api.get(url, { headers });
  return res.data as BookingDetailApiResponse;
}
