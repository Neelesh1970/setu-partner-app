import axiosInstance, { BASE_URL } from './axiosInstance';

// ─── Pulse Oximeter ──────────────────────────────────────────────────────────

export type PostPulseOximeterResultArgs = {
  deviceId: string;
  bookingItemId: string;
  spo2: number;
  pulseRate: number;
};

export type PostPulseOximeterResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/pulse-oxymeter-results` with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 */
export async function postPulseOximeterResult(
  args: PostPulseOximeterResultArgs,
): Promise<PostPulseOximeterResultResponse> {
  const { deviceId, bookingItemId, spo2, pulseRate } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/pulse-oxymeter-results`;
  const body = {
    spo2,
    pulse_rate: pulseRate,
    booking_item_id: bookingItemId,
  };
  const LOG = '[postPulseOximeterResult]';
  console.log(`${LOG} POST start`);
  console.log(`${LOG} POST URL:`, `${BASE_URL}/${path}`);
  console.log(`${LOG} POST body:`, JSON.stringify(body, null, 2));
  try {
    const res = await axiosInstance.post<PostPulseOximeterResultResponse>(path, body);
    console.log(`${LOG} POST status:`, res.status);
    console.log(`${LOG} POST response:`, JSON.stringify(res.data ?? {}, null, 2));
    return res.data ?? {};
  } catch (err) {
    const e = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    console.log(`${LOG} POST FAILED status:`, e?.response?.status ?? 'no-status');
    console.log(`${LOG} POST FAILED data:`, JSON.stringify(e?.response?.data ?? {}, null, 2));
    console.log(`${LOG} POST FAILED message:`, e?.message ?? '(none)');
    throw err;
  }
}

// ─── BMI / Smart Scale ────────────────────────────────────────────────────────

export type PostBmiResultArgs = {
  deviceId: string;
  bookingItemId: string;
  height: number;
  weight: number;
  bmi: number;
};

export type PostBmiResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/bmi-results` with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 */
export async function postBmiResult(
  args: PostBmiResultArgs,
): Promise<PostBmiResultResponse> {
  const { deviceId, bookingItemId, height, weight, bmi } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/bmi-results`;
  const body = {
    height,
    weight,
    bmi,
    ph_booking_item_id: bookingItemId,
  };
  const LOG = '[postBmiResult]';
  console.log(`${LOG} POST start`);
  console.log(`${LOG} POST URL:`, `${BASE_URL}/${path}`);
  console.log(`${LOG} POST body:`, JSON.stringify(body, null, 2));
  try {
    const res = await axiosInstance.post<PostBmiResultResponse>(path, body);
    console.log(`${LOG} POST status:`, res.status);
    console.log(`${LOG} POST response:`, JSON.stringify(res.data ?? {}, null, 2));
    return res.data ?? {};
  } catch (err) {
    const e = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    console.log(`${LOG} POST FAILED status:`, e?.response?.status ?? 'no-status');
    console.log(`${LOG} POST FAILED data:`, JSON.stringify(e?.response?.data ?? {}, null, 2));
    console.log(`${LOG} POST FAILED message:`, e?.message ?? '(none)');
    throw err;
  }
}

// ─── Remidio QR ──────────────────────────────────────────────────────────────

// ─── Types shared across device result functions ─────────────────────────────

/**
 * Generic Remidio QR `result` shape: keyed by reading label (e.g. `R1`, `L1`, `R-Avg`, `L-Avg`)
 * with `S`/`C`/`A` strings. We forward whatever the device emitted untouched, so this is
 * intentionally loose to accommodate per-reading shape variation across device firmwares.
 */
export type RemidioQrResultMap = Record<string, unknown>;

export type PostRemidioQrResultArgs = {
  /** Backend device id (auto refractometer uuid). */
  deviceId: string;
  /** Booking item id (from `LabPatientRecord.booking_item_ids`, index-aligned with device_ids). */
  bookingItemId: string;
  /** Exam id provided by the device QR. */
  examID: string;
  /** Full `result` object captured from the device QR (forwarded as-is). */
  result: RemidioQrResultMap;
};

export type PostRemidioQrResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/qr-results` with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 */
export async function postRemidioQrResult(
  args: PostRemidioQrResultArgs,
): Promise<PostRemidioQrResultResponse> {
  const { deviceId, bookingItemId, examID, result } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/qr-results`;
  const body = {
    booking_item_id: bookingItemId,
    examID,
    result,
  };
  console.log(`${LOG} POST start`);
  console.log(`${LOG} POST URL:`, `${BASE_URL}/${path}`);
  console.log(`${LOG} POST body:`, JSON.stringify(body, null, 2));
  try {
    const res = await axiosInstance.post<PostRemidioQrResultResponse>(path, body);
    console.log(`${LOG} POST status:`, res.status);
    console.log(`${LOG} POST response:`, JSON.stringify(res.data ?? {}, null, 2));
    return res.data ?? {};
  } catch (err) {
    const e = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    console.log(`${LOG} POST FAILED status:`, e?.response?.status ?? 'no-status');
    console.log(`${LOG} POST FAILED data:`, JSON.stringify(e?.response?.data ?? {}, null, 2));
    console.log(`${LOG} POST FAILED message:`, e?.message ?? '(none)');
    throw err;
  }
}
