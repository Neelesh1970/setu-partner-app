export type PickBackendDeviceResult = {
  deviceId: string | null;
  deviceName: string | null;
  /**
   * Booking-line id corresponding to the matched device (index-aligned with
   * `deviceIds`). Used as `booking_item_id` for device-result POSTs.
   */
  bookingItemId: string | null;
};

function normalizeLabel(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

/**
 * Picks the backend device_id (and matching `booking_item_id`) for a given
 * displayed `testName`.
 *
 * Assumes `device_ids[i]`, `device_names[i]`, and `bookingItemIds[i]` correspond
 * index-wise, so it works correctly even when a "package" contains multiple devices.
 */
export function pickBackendDeviceByTestName(args: {
  deviceIds?: Array<string | null | undefined> | null;
  deviceNames?: Array<string | null | undefined> | null;
  bookingItemIds?: Array<string | null | undefined> | null;
  testName?: string | null;
}): PickBackendDeviceResult {
  const ids = args.deviceIds ?? [];
  const names = args.deviceNames ?? [];
  const bookingItemIds = args.bookingItemIds ?? [];
  const target = normalizeLabel(args.testName);

  const len = Math.min(ids.length, names.length);
  for (let i = 0; i < len; i += 1) {
    const n = names[i];
    const normalized = normalizeLabel(n);
    if (!normalized) continue;
    if (target && normalized === target) {
      const pickedId = String(ids[i] ?? '').trim();
      const pickedBookingItemId = String(bookingItemIds[i] ?? '').trim();
      return {
        deviceId: pickedId || null,
        deviceName: String(n ?? '').trim() || null,
        bookingItemId: pickedBookingItemId || null,
      };
    }
  }

  // Fallback: keep flow unchanged by using device_ids[0] / bookingItemIds[0] if present.
  const fallbackId = len > 0 ? String(ids[0] ?? '').trim() : '';
  const fallbackName = len > 0 ? String(names[0] ?? '').trim() : '';
  const fallbackBookingItemId =
    bookingItemIds.length > 0 ? String(bookingItemIds[0] ?? '').trim() : '';

  return {
    deviceId: fallbackId || null,
    deviceName: fallbackName || (args.testName ? String(args.testName).trim() : null),
    bookingItemId: fallbackBookingItemId || null,
  };
}
