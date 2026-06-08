import axiosInstance from './axiosInstance';

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
  try {
    const res = await axiosInstance.post<PostPulseOximeterResultResponse>(path, body);
    return res.data ?? {};
  } catch (err) {
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
  try {
    const res = await axiosInstance.post<PostBmiResultResponse>(path, body);
    return res.data ?? {};
  } catch (err) {
    throw err;
  }
}

// ─── Blood Pressure / NIBP ───────────────────────────────────────────────────

export type PostBloodPressureResultArgs = {
  deviceId: string;
  bookingItemId: string;
  systolic: number;
  diastolic: number;
  pulseRate: number;
};

export type PostBloodPressureResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/blood-pressure-results` with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 */
export async function postBloodPressureResult(
  args: PostBloodPressureResultArgs,
): Promise<PostBloodPressureResultResponse> {
  const { deviceId, bookingItemId, systolic, diastolic, pulseRate } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/blood-pressure-results`;
  const body = {
    systolic,
    diastolic,
    pulse_rate: pulseRate,
    booking_item_id: bookingItemId,
  };
  try {
    const res = await axiosInstance.post<PostBloodPressureResultResponse>(path, body);
    return res.data ?? {};
  } catch (err) {
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
  try {
    const res = await axiosInstance.post<PostRemidioQrResultResponse>(path, body);
    return res.data ?? {};
  } catch (err) {
    throw err;
  }
}
