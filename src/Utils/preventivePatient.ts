import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPatients } from '../Screens/Home/PreventiveUser/PreventiveHealthAPI';
import { getPreventivePatientId } from './storage';

const FLOW_LOG = '[PreventiveFlow]';
const PATIENT_ID_V1_KEY = 'preventive_patient_id_v1';

export type PreventiveBookingIdentity = {
  patientId: string | null;
  addressId: string | null;
};

function isPreventivePatientUuid(value: string | null | undefined): boolean {
  const v = value == null ? '' : String(value).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function readPatientIdV1(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(PATIENT_ID_V1_KEY);
    if (v && isPreventivePatientUuid(v)) {
      return String(v).trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/** Resolves patient UUID for booking (`POST /bookings`). Reads `preventive_patient_id_v1` first. */
export async function resolvePreventiveBookingIdentity(): Promise<PreventiveBookingIdentity> {
  const fromV1 = await readPatientIdV1();
  if (fromV1) {
    console.log(`${FLOW_LOG} resolvePreventiveBookingIdentity`, { source: 'preventive_patient_id_v1', patientId: fromV1 });
    return { patientId: fromV1, addressId: null };
  }

  const cached = await getPreventivePatientId();
  if (cached && isPreventivePatientUuid(cached)) {
    console.log(`${FLOW_LOG} resolvePreventiveBookingIdentity`, { source: 'preventive_patient_id', patientId: cached });
    return { patientId: cached, addressId: null };
  }

  try {
    const list = await getPatients();
    console.log(`${FLOW_LOG} resolvePreventiveBookingIdentity GET /patients`, { count: list.length });
    const row = list.find((p) => p.id != null && isPreventivePatientUuid(String(p.id)));
    if (row?.id) {
      const patientId = String(row.id);
      console.log(`${FLOW_LOG} resolvePreventiveBookingIdentity`, { source: 'api_list', patientId });
      return { patientId, addressId: null };
    }
  } catch (e) {
    console.log(`${FLOW_LOG} resolvePreventiveBookingIdentity GET /patients failed`, e);
  }

  console.log(`${FLOW_LOG} resolvePreventiveBookingIdentity — no patient id found`);
  return { patientId: null, addressId: null };
}

export async function resolvePreventivePatientUuid(): Promise<string | null> {
  const { patientId } = await resolvePreventiveBookingIdentity();
  return patientId;
}
