import {
  ensurePreventivePatientRecord,
  getPatientAddresses,
  getPatientAuthProfile,
  getPatients,
  type PreventivePatientRow,
} from '../Screens/Home/PreventiveUser/PreventiveHealthAPI';
import {
  getPreventiveMemberAppUserId,
  getPreventivePatientId,
  getPreventivePatientOwnerAppUserId,
  getRegisteredPatientProfile,
  savePreventivePatientId,
} from './storage';

/** Booking API `patient_id` is the preventive `patients` table row id (not auth account id). */
const PATIENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PreventiveBookingIdentity = {
  patientId: string | null;
  addressId: string | null;
};

function isPreventivePatientUuid(value: string | null | undefined): boolean {
  return !!value && PATIENT_UUID_RE.test(String(value).trim());
}

/** Patients-row id for POST /bookings — must differ from auth `app_user_id` when backend splits tables. */
function pickPatientsTableId(
  row: PreventivePatientRow,
  appUserId?: string | null,
): string | null {
  const authUserId =
    appUserId != null
      ? String(appUserId)
      : row.user_id != null
        ? String(row.user_id)
        : null;

  for (const key of ['patient_id', 'patient_profile_id', 'profile_id'] as const) {
    const v = row[key];
    if (!isPreventivePatientUuid(v == null ? null : String(v))) continue;
    const candidate = String(v).trim();
    if (authUserId && candidate === authUserId) continue;
    return candidate;
  }

  const nested = row.patient;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const fromNested = pickPatientsTableId(nested as PreventivePatientRow, authUserId);
    if (fromNested) return fromNested;
  }

  if (row.id != null) {
    const candidate = String(row.id).trim();
    if (isPreventivePatientUuid(candidate) && (!authUserId || candidate !== authUserId)) {
      return candidate;
    }
  }

  return null;
}

function pickAddressId(row: PreventivePatientRow): string | null {
  for (const key of ['address_id', 'default_address_id'] as const) {
    const v = row[key];
    if (isPreventivePatientUuid(v == null ? null : String(v))) {
      return String(v).trim();
    }
  }

  if (row.id != null && isPreventivePatientUuid(String(row.id))) {
    return String(row.id).trim();
  }

  const nested = row.address;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const id = (nested as Record<string, unknown>).id;
    if (isPreventivePatientUuid(id == null ? null : String(id))) {
      return String(id).trim();
    }
  }

  return null;
}

function phoneDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function pickFromPatientList(
  list: PreventivePatientRow[],
  appUserId: string,
  registeredMobile: string,
): PreventivePatientRow | null {
  const byUserId = list.find((p) => String(p?.user_id) === String(appUserId));
  if (byUserId) return byUserId;

  if (registeredMobile) {
    const byPhone = list.find((p) => {
      const ph = phoneDigits(p.phone_number ?? p.phone ?? p.mobile);
      return ph.length >= 10 && ph === registeredMobile;
    });
    if (byPhone) return byPhone;
  }

  return list.length === 1 ? list[0] : null;
}

function identityFromRow(
  row: PreventivePatientRow,
  appUserId: string,
): PreventiveBookingIdentity {
  return {
    patientId: pickPatientsTableId(row, appUserId),
    addressId: pickAddressId(row),
  };
}

function identityFromAddressRows(
  rows: PreventivePatientRow[],
  appUserId: string,
): PreventiveBookingIdentity {
  for (const row of rows) {
    const addressId = pickAddressId(row);
    const patientId =
      pickPatientsTableId(row, appUserId) ??
      (row.patient_id != null && isPreventivePatientUuid(String(row.patient_id))
        ? String(row.patient_id).trim()
        : null);
    if (patientId && patientId !== appUserId) {
      return { patientId, addressId };
    }
    if (addressId) {
      return { patientId: null, addressId };
    }
  }
  return { patientId: null, addressId: null };
}

async function readValidCachedPatientId(appUserId: string): Promise<string | null> {
  const [cached, owner] = await Promise.all([
    getPreventivePatientId(),
    getPreventivePatientOwnerAppUserId(),
  ]);

  if (!isPreventivePatientUuid(cached)) {
    return null;
  }

  const patientId = String(cached).trim();

  if (!owner || String(owner).trim() !== String(appUserId).trim()) {
    return null;
  }

  if (patientId === String(appUserId).trim()) {
    return null;
  }

  return patientId;
}

async function persistIdentity(
  appUserId: string,
  identity: PreventiveBookingIdentity,
): Promise<PreventiveBookingIdentity> {
  if (identity.patientId) {
    await savePreventivePatientId(identity.patientId, appUserId);
  }
  return identity;
}

/** Resolve patients-row id + address id for POST /bookings (matches Postman body). */
export async function resolvePreventiveBookingIdentity(): Promise<PreventiveBookingIdentity> {
  const appUserId = await getPreventiveMemberAppUserId();
  if (!appUserId) {
    return { patientId: null, addressId: null };
  }

  const cachedPatientId = await readValidCachedPatientId(appUserId);
  if (cachedPatientId) {
    return { patientId: cachedPatientId, addressId: null };
  }

  try {
    let list = await getPatients();
    if (!list.length) {
      const created = await ensurePreventivePatientRecord();
      if (created) {
        list = [created];
      } else {
        list = await getPatients();
      }
    }

    if (list.length) {
      const registered = await getRegisteredPatientProfile();
      const registeredMobile = registered?.mobile ? phoneDigits(registered.mobile) : '';
      const row = pickFromPatientList(list, appUserId, registeredMobile) ?? list[0];
      const identity = identityFromRow(row, appUserId);
      if (identity.patientId) {
        return persistIdentity(appUserId, identity);
      }
    }

    const addresses = await getPatientAddresses();
    if (addresses.length) {
      const fromAddresses = identityFromAddressRows(addresses, appUserId);
      if (fromAddresses.patientId) {
        return persistIdentity(appUserId, fromAddresses);
      }
      if (fromAddresses.addressId && list.length) {
        const row = list[0];
        const patientId = pickPatientsTableId(row, appUserId);
        if (patientId) {
          const identity = { patientId, addressId: fromAddresses.addressId };
          return persistIdentity(appUserId, identity);
        }
      }
    }

    const profile = await getPatientAuthProfile();
    if (profile) {
      const identity = identityFromRow(profile, appUserId);
      if (identity.patientId) {
        return persistIdentity(appUserId, identity);
      }
    }
  } catch {
    return { patientId: null, addressId: null };
  }

  return { patientId: null, addressId: null };
}

/** Resolve and cache the preventive patient row UUID for the active member session. */
export async function resolvePreventivePatientUuid(): Promise<string | null> {
  const appUserId = await getPreventiveMemberAppUserId();
  if (!appUserId) {
    return null;
  }

  const cachedPatientId = await readValidCachedPatientId(appUserId);
  if (cachedPatientId) {
    return cachedPatientId;
  }

  const { patientId } = await resolvePreventiveBookingIdentity();
  return patientId;
}
