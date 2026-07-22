import type {
  RawDeviceItem,
  RawPackageItem,
} from '../Screens/Home/PreventiveUser/PreventiveHealthAPI';

export function dedupeDevicesById(devices: RawDeviceItem[]): RawDeviceItem[] {
  const seen = new Set<string>();
  const out: RawDeviceItem[] = [];
  for (const device of devices) {
    const id = (device.device_id ?? '').trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(device);
  }
  return out;
}

/** Merge flat booking `devices[]` into each package's `included_tests` (full list from API). */
export function getPackageDisplayTests(
  pkg: RawPackageItem,
  flatDevices: RawDeviceItem[],
): RawDeviceItem[] {
  const included = pkg.included_tests ?? [];
  const flatForPkg = flatDevices.filter(d => d.package_id === pkg.package_id);
  if (included.length === 0) {
    return flatForPkg;
  }
  const seen = new Set(included.map(t => t.device_id));
  const extra = flatForPkg.filter(d => !seen.has(d.device_id));
  return [...included, ...extra];
}

export function mergePackageIncludedTests(
  flatDevices: RawDeviceItem[],
  packages: RawPackageItem[],
): RawPackageItem[] {
  if (packages.length === 0) {
    return packages;
  }
  return packages.map(pkg => ({
    ...pkg,
    included_tests: getPackageDisplayTests(pkg, flatDevices),
  }));
}

export function normalizeLabPatientDeviceData(
  flatDevices: RawDeviceItem[],
  packages: RawPackageItem[],
): {
  devices: RawDeviceItem[];
  packages: RawPackageItem[];
  allDevices: RawDeviceItem[];
} {
  const enrichedPackages = mergePackageIncludedTests(flatDevices, packages);
  const packageTests = enrichedPackages.flatMap(pkg => pkg.included_tests ?? []);
  const allDevices = dedupeDevicesById([...flatDevices, ...packageTests]);
  const devices =
    flatDevices.length > 0 ? flatDevices : allDevices;

  return {
    devices,
    packages: enrichedPackages,
    allDevices,
  };
}

/** Active/booked devices can run Perform Test; inactive ones stay visible but show unavailable on tap. */
export function isPerformableLabDevice(device: RawDeviceItem): boolean {
  if (device.is_active === false) {
    return false;
  }
  if (device.status === 'inactive') {
    return false;
  }
  if (device.booked === false) {
    return false;
  }
  return true;
}
