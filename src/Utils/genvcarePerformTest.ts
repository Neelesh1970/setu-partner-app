import axiosInstance from '../api/axiosInstance';

import type { LabIotRootStackNavigate } from './labIotPerformTest';



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



export const GENVCARE_REPORT_IN_PROGRESS_TITLE = 'Report in Progress';
export const GENVCARE_REPORT_IN_PROGRESS_MESSAGE =
  'Your report is currently being generated. Please check back shortly.';

export type GenvcarePerformTestResult =
  | { status: 'skipped' }
  | { status: 'success' }
  | { status: 'vendor_server_error'; title: string; message: string };



/**

 * If device is cervical/breast scan: POST lab/bookings/:bookingId/genvcare/perform-test

 * (lab worker Bearer + x-refresh-token via axiosInstance) then navigate to GenvReportWaiting.

 * Returns `skipped` when not a Genvcare device (caller continues IOT flow).

 */

export async function runGenvcarePerformTestIfApplicable(

  navigate: LabIotRootStackNavigate,

  args: GenvcarePerformTestArgs,

): Promise<GenvcarePerformTestResult> {

  const { bookingId, deviceId, deviceName } = args;

  if (!isGenvcareScanDevice(deviceId, deviceName)) {
    return { status: 'skipped' };
  }

  const bid = (bookingId ?? '').trim();

  if (!bid) {
    return { status: 'skipped' };
  }

  const path = `lab/bookings/${encodeURIComponent(bid)}/genvcare/perform-test`;

  try {
    await axiosInstance.post(path, {});

    navigate('GenvReportWaiting', { bookingId: bid });

    return { status: 'success' };

  } catch (error: unknown) {

    return {
      status: 'vendor_server_error',
      title: GENVCARE_REPORT_IN_PROGRESS_TITLE,
      message: GENVCARE_REPORT_IN_PROGRESS_MESSAGE,
    };

  }

}



