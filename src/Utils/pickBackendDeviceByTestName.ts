export type PickBackendDeviceResult = {
  deviceId: string | null;
  deviceName: string | null;
};

function normalizeLabel(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

/**
 * Picks the backend device_id for a given displayed `testName`.
 *
 * Assumes `device_ids[i]` corresponds to `device_names[i]` (index-wise mapping),
 * so it works correctly even when a "package" contains multiple devices.
 */
export function pickBackendDeviceByTestName(args: {
  deviceIds?: Array<string | null | undefined> | null;
  deviceNames?: Array<string | null | undefined> | null;
  testName?: string | null;
}): PickBackendDeviceResult {
  const ids = args.deviceIds ?? [];
  const names = args.deviceNames ?? [];
  const target = normalizeLabel(args.testName);

  const len = Math.min(ids.length, names.length);
  for (let i = 0; i < len; i += 1) {
    const n = names[i];
    const normalized = normalizeLabel(n);
    if (!normalized) continue;
    if (target && normalized === target) {
      const pickedId = String(ids[i] ?? '').trim();
      return {
        deviceId: pickedId || null,
        deviceName: String(n ?? '').trim() || null,
      };
    }
  }

  // Fallback: keep flow unchanged by using device_ids[0] if present.
  const fallbackId = len > 0 ? String(ids[0] ?? '').trim() : '';
  const fallbackName = len > 0 ? String(names[0] ?? '').trim() : '';

  return {
    deviceId: fallbackId || null,
    deviceName: fallbackName || (args.testName ? String(args.testName).trim() : null),
  };
}

