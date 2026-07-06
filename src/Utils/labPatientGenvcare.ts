import type { LabPatientRecord } from '../Screens/Home/PreventiveUser/PreventiveHealthAPI';
import { isGenvcareScanDevice } from './genvcarePerformTest';

export function getPatientBookingDevices(patient: LabPatientRecord) {
  const standalone = patient.devices ?? [];
  const fromPackages = (patient.packages ?? []).flatMap(pkg => pkg.included_tests ?? []);
  return [...standalone, ...fromPackages];
}

/** True when the booking has exactly one test and it is cervical / breast scan. */
export function isSingleGenvcareScanPatient(patient: LabPatientRecord): boolean {
  const devices = getPatientBookingDevices(patient);
  if (devices.length === 1) {
    return isGenvcareScanDevice(devices[0].device_id, devices[0].device_name);
  }
  if (devices.length === 0) {
    return isGenvcareScanDevice(null, patient.device_names?.[0] ?? null);
  }
  return false;
}

export function bookingDevicesIncludeGenvcareScan(
  devices: { device_id: string; device_name: string }[],
): boolean {
  return devices.some(d => isGenvcareScanDevice(d.device_id, d.device_name));
}
