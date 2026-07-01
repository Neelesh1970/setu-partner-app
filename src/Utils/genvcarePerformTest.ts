import axiosInstance from '../api/axiosInstance';
import type { LabIotRootStackNavigate } from './labIotPerformTest';

const LOG_TAG = '[GenvcarePerformTest]';

/** Backend device ids for Genvcare cervical / breast scan (no in-app IOT screen). */
export const BACKEND_CERVICAL_SCAN_DEVICE_ID = '';
export const BACKEND_BREAST_SCAN_DEVICE_ID = '';

const GENCARE_SCAN_DEVICE_IDS: readonly string[] = [
  BACKEND_CERVICAL_SCAN_DEVICE_ID,
  BACKEND_BREAST_SCAN_DEVICE_ID,
].filter(Boolean);

function normalizeDeviceId(deviceId?: string | null): string {
  return (deviceId ?? '').trim().toLowerCase();
}

function normalizeDeviceName(deviceName?: string | null): string {
  return (deviceName ?? '').trim().toLowerCase();
}

/** Cervical / breast scan bookings use Genvcare perform-test API instead of IOT device screens. */
export function isGenvcareScanDevice(
  deviceId?: string | null,
  deviceName?: string | null,
): boolean {
  const id = normalizeDeviceId(deviceId);
  const name = normalizeDeviceName(deviceName);

  if (id && GENCARE_SCAN_DEVICE_IDS.some(d => normalizeDeviceId(d) === id)) {
    return true;
  }

  return name.includes('cervical') || name.includes('breast');
}

export type GenvcarePerformTestArgs = {
  bookingId: string | null | undefined;
  deviceId?: string | null;
  deviceName?: string | null;
  logContext: string;
};

/**
 * If device is cervical/breast scan: POST lab/bookings/:bookingId/genvcare/perform-test
 * (lab worker Bearer + x-refresh-token via axiosInstance) then navigate to GenvReportWaiting.
 * Returns true when handled; false when not a Genvcare device (caller continues IOT flow).
 */
export async function runGenvcarePerformTestIfApplicable(
  navigate: LabIotRootStackNavigate,
  args: GenvcarePerformTestArgs,
): Promise<boolean> {
  const { bookingId, deviceId, deviceName, logContext } = args;

  console.log(`${LOG_TAG} ${logContext} — button pressed`);
  console.log(`${LOG_TAG} ${logContext} — deviceId:`, deviceId ?? '(none)');
  console.log(`${LOG_TAG} ${logContext} — deviceName:`, deviceName ?? '(none)');
  console.log(`${LOG_TAG} ${logContext} — bookingId:`, bookingId ?? '(none)');

  if (!isGenvcareScanDevice(deviceId, deviceName)) {
    console.log(`${LOG_TAG} ${logContext} — not cervical/breast scan; keep existing device flow`);
    return false;
  }

  console.log(`${LOG_TAG} ${logContext} — Genvcare scan detected; skipping IOT device logic`);

  const bid = (bookingId ?? '').trim();
  if (!bid) {
    console.warn(`${LOG_TAG} ${logContext} — abort: bookingId missing`);
    return false;
  }

  const path = `lab/bookings/${encodeURIComponent(bid)}/genvcare/perform-test`;
  console.log(`${LOG_TAG} ${logContext} — POST /api/v1/${path}`);
  console.log(
    `${LOG_TAG} ${logContext} — headers: lab worker access + refresh token (axiosInstance)`,
  );

  try {
    const res = await axiosInstance.post(path, {});
    console.log(
      `${LOG_TAG} ${logContext} — API success:`,
      JSON.stringify(res.data, null, 2),
    );
    console.log(`${LOG_TAG} ${logContext} — navigate → GenvReportWaiting, bookingId:`, bid);
    navigate('GenvReportWaiting', { bookingId: bid });
    return true;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`${LOG_TAG} ${logContext} — API error:`, err?.message ?? error);
    throw error;
  }
}
