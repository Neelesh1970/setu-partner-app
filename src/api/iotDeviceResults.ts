import axiosInstance, { BASE_URL } from './axiosInstance';

const LOG = '[iotDeviceResults]';

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
