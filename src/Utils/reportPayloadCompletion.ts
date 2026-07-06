import type { RawDeviceItem, ReportPayloadParameter } from '../Screens/Home/PreventiveUser/PreventiveHealthAPI';
import type { ReportPayloadData } from '../Screens/Home/PreventiveUser/PreventiveHealthAPI';

export function normalizeReportTestName(name: string): string {
  return name.trim().toLowerCase();
}

function hasSavedParameterValues(parameters?: ReportPayloadParameter[]): boolean {
  if (!Array.isArray(parameters) || parameters.length === 0) {
    return false;
  }
  return parameters.some(
    p => typeof p?.value === 'string' && p.value.trim().length > 0,
  );
}

/**
 * Maps server-side report payload to completed booking_item_ids for DeviceSelect cards.
 *
 * Only tests with saved parameter values count as done. `testsDone` lists booked tests,
 * not completed ones, so it must not be used for completion detection.
 */
export function deriveCompletedBookingItemIds(
  devices: RawDeviceItem[],
  payload: ReportPayloadData | null,
): string[] {
  if (!payload || devices.length === 0) {
    return [];
  }

  const testStatus = (payload.booking?.testStatus ?? '').trim().toUpperCase();
  if (testStatus === 'PENDING') {
    return [];
  }

  const testsByName = new Map(
    (payload.tests ?? []).map(test => [normalizeReportTestName(test.testName), test]),
  );

  const completed: string[] = [];

  for (const device of devices) {
    const key = normalizeReportTestName(device.device_name);
    const test = testsByName.get(key);
    if (!test) {
      continue;
    }
    if (hasSavedParameterValues(test.parameters)) {
      completed.push(device.booking_item_id);
    }
  }

  return completed;
}
