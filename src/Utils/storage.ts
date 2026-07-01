import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  // JSON for the logged-in partner/vendor from primary app auth (e.g. role "Health Soldier").
  // This is not the end-user patient collected on Home → Register New User; that lives in REGISTERED_PATIENT_PROFILE.
  REGISTERED_PATIENT_PROFILE: 'registered_patient_profile',
  REGISTERED_PATIENT_AUTH_TOKEN: 'registered_patient_auth_token',
  REGISTERED_PATIENT_REFRESH_TOKEN: 'registered_patient_refresh_token',
  REGISTERED_PATIENT_APP_USER_ID: 'registered_patient_app_user_id',
  USER_ID: 'user_id',
  LAB_USER_ID: 'lab_user_id',
  /** Patient row UUID for bookings (`GET /patients[].id` or `/patient-auth/profile` `id`). Not the same key as `registered_patient_app_user_id` unless the API uses one id for both. */
  PREVENTIVE_PATIENT_ID: 'preventive_patient_id',
  /** `registered_patient_app_user_id` that owns `preventive_patient_id` (invalidates stale cache on new Register New User). */
  PREVENTIVE_PATIENT_OWNER_APP_USER_ID: 'preventive_patient_owner_app_user_id',
  /** JSON map `centerId|yyyy-mm-dd` → slot UUIDs successfully booked on this device (slots API can lag). */
  PREVENTIVE_CLIENT_BOOKED_SLOTS: 'preventive_client_booked_slots_v1',
  PRIMARY_CENTER_ID: 'primary_center_id',
  /**
   * Copy of the Health Soldier session from OTP verify. Kept when `saveAuthData` overwrites
   * primary `auth_token` / `refresh_token` with a registered patient session so `/lab/*` APIs
   * still receive a matching access + refresh pair.
   */
  LAB_WORKER_ACCESS_TOKEN: 'lab_worker_access_token',
  LAB_WORKER_REFRESH_TOKEN: 'lab_worker_refresh_token',
} as const;

// --- Generic typed helpers (optional app-wide keys) ---
export const storeItem = async (key: string, value: string): Promise<void> => {
  await AsyncStorage.setItem(key, value);
};

export const getItem = async (key: string): Promise<string | null> => {
  return AsyncStorage.getItem(key);
};

export const removeItem = async (key: string): Promise<void> => {
  await AsyncStorage.removeItem(key);
};

/** Primary access token (AsyncStorage `auth_token`). */
export const storeToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.AUTH_TOKEN, token);
};

export const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.AUTH_TOKEN);
};

export const storeRefreshToken = async (refreshToken: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
};

/**
 * After 401 + `/auth/refresh`, persist the new pair in the right slot(s).
 * When primary and lab copies differ (e.g. patient vs lab worker), only update the used pair; otherwise keep them in sync.
 */
export const persistRefreshedAccessPair = async (
  access: string,
  refresh: string,
  options: { target: 'primary' | 'labWorker' | 'both' },
): Promise<void> => {
  if (options.target === 'both') {
    await saveAuthTokens(access, refresh);
    return;
  }
  if (options.target === 'labWorker') {
    await AsyncStorage.multiSet([
      [KEYS.LAB_WORKER_ACCESS_TOKEN, access],
      [KEYS.LAB_WORKER_REFRESH_TOKEN, refresh],
    ]);
    return;
  }
  await AsyncStorage.multiSet([
    [KEYS.AUTH_TOKEN, access],
    [KEYS.REFRESH_TOKEN, refresh],
  ]);
};

export const saveAuthTokens = async (token: string, refreshToken: string): Promise<void> => {
  await AsyncStorage.multiSet([
    [KEYS.AUTH_TOKEN, token],
    [KEYS.REFRESH_TOKEN, refreshToken],
    [KEYS.LAB_WORKER_ACCESS_TOKEN, token],
    [KEYS.LAB_WORKER_REFRESH_TOKEN, refreshToken],
  ]);
};

export const getAuthToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.AUTH_TOKEN);
};

export const getRefreshToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
};

export const getLabWorkerAccessToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.LAB_WORKER_ACCESS_TOKEN);
};

export const getLabWorkerRefreshToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.LAB_WORKER_REFRESH_TOKEN);
};

/** Persists the partner/vendor account from login/register OTP (not the Register New User patient). */
export const saveUser = async (user: object): Promise<void> => {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  const primaryCenterId = (user as { primary_center_id?: string | null }).primary_center_id;
  if (typeof primaryCenterId === 'string' && primaryCenterId.length > 0) {
    await AsyncStorage.setItem(KEYS.PRIMARY_CENTER_ID, primaryCenterId);
  }
};

export const getUser = async <T>(): Promise<T | null> => {
  const raw = await AsyncStorage.getItem(KEYS.USER);
  return raw ? (JSON.parse(raw) as T) : null;
};

/** Patient/end-user from Home → Register New User (name, phone, DOB, gender, lab user id). */
export type RegisteredPatientProfile = {
  mobile: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  lab_user_id: string;
};

export const saveRegisteredPatientProfile = async (
  profile: RegisteredPatientProfile,
): Promise<void> => {
  await AsyncStorage.setItem(KEYS.REGISTERED_PATIENT_PROFILE, JSON.stringify(profile));
};

export const getRegisteredPatientProfile = async (): Promise<RegisteredPatientProfile | null> => {
  const raw = await AsyncStorage.getItem(KEYS.REGISTERED_PATIENT_PROFILE);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as RegisteredPatientProfile;
  } catch {
    return null;
  }
};

/**
 * Patient/member JWT session from RegisterPlans after payment
 * (confirmRegistration / confirmAutopay5). Separate from partner auth_token keys.
 */
export const saveRegisteredPatientAuthData = async (
  token: string,
  appUserId: string,
  refreshToken?: string,
): Promise<void> => {
  const previousAppUserId = await getRegisteredPatientAppUserId();
  if (
    previousAppUserId &&
    String(previousAppUserId).trim() !== String(appUserId).trim()
  ) {
    await AsyncStorage.multiRemove([
      KEYS.PREVENTIVE_PATIENT_ID,
      KEYS.PREVENTIVE_PATIENT_OWNER_APP_USER_ID,
    ]);
  }

  const pairs: [string, string][] = [
    [KEYS.REGISTERED_PATIENT_AUTH_TOKEN, token],
    [KEYS.REGISTERED_PATIENT_APP_USER_ID, appUserId],
  ];
  if (refreshToken) {
    pairs.push([KEYS.REGISTERED_PATIENT_REFRESH_TOKEN, refreshToken]);
  }
  await AsyncStorage.multiSet(pairs);
};

export const getRegisteredPatientAuthToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.REGISTERED_PATIENT_AUTH_TOKEN);
};

export const getRegisteredPatientRefreshToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.REGISTERED_PATIENT_REFRESH_TOKEN);
};

export const getRegisteredPatientAppUserId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.REGISTERED_PATIENT_APP_USER_ID);
};

/**
 * App user id for preventive member APIs (`GET /patients`, bookings).
 * After Home → Register New User, `user_id` stays the lab worker; the patient id lives in
 * `registered_patient_app_user_id`.
 */
export const getPreventiveMemberAppUserId = async (): Promise<string | null> => {
  const registered = await getRegisteredPatientAppUserId();
  if (registered != null && String(registered).trim()) {
    return String(registered).trim();
  }
  return getUserID();
};

export const savePreventivePatientId = async (
  patientId: string,
  ownerAppUserId?: string | null,
): Promise<void> => {
  const pairs: [string, string][] = [
    [KEYS.PREVENTIVE_PATIENT_ID, String(patientId).trim()],
  ];
  const owner =
    ownerAppUserId != null && String(ownerAppUserId).trim()
      ? String(ownerAppUserId).trim()
      : await getPreventiveMemberAppUserId();
  if (owner) {
    pairs.push([KEYS.PREVENTIVE_PATIENT_OWNER_APP_USER_ID, owner]);
  }
  await AsyncStorage.multiSet(pairs);
};

export const getPreventivePatientId = async (): Promise<string | null> => {
  const v = await AsyncStorage.getItem(KEYS.PREVENTIVE_PATIENT_ID);
  return v != null && String(v).trim() ? String(v).trim() : null;
};

export const getPreventivePatientOwnerAppUserId = async (): Promise<string | null> => {
  const v = await AsyncStorage.getItem(KEYS.PREVENTIVE_PATIENT_OWNER_APP_USER_ID);
  return v != null && String(v).trim() ? String(v).trim() : null;
};

type PreventiveClientBookedSlotsMap = Record<string, string[]>;

const preventiveBookedKey = (centerId: string, date: string) =>
  `${String(centerId).trim()}|${String(date).trim()}`;

export const recordPreventiveClientBookedSlot = async (
  centerId: string,
  date: string,
  slotId: string,
): Promise<void> => {
  const k = preventiveBookedKey(centerId, date);
  const sid = String(slotId).trim();
  if (!k || !sid) return;

  const raw = await AsyncStorage.getItem(KEYS.PREVENTIVE_CLIENT_BOOKED_SLOTS);
  let map: PreventiveClientBookedSlotsMap = {};
  if (raw) {
    try {
      map = JSON.parse(raw) as PreventiveClientBookedSlotsMap;
      if (map == null || typeof map !== 'object') map = {};
    } catch {
      map = {};
    }
  }
  const prev = Array.isArray(map[k]) ? map[k] : [];
  const next = Array.from(new Set([...prev, sid]));
  map[k] = next;
  await AsyncStorage.setItem(KEYS.PREVENTIVE_CLIENT_BOOKED_SLOTS, JSON.stringify(map));
};

export const getPreventiveClientBookedSlotIds = async (
  centerId: string,
  date: string,
): Promise<string[]> => {
  const k = preventiveBookedKey(centerId, date);
  const raw = await AsyncStorage.getItem(KEYS.PREVENTIVE_CLIENT_BOOKED_SLOTS);
  if (!raw) return [];
  try {
    const map = JSON.parse(raw) as PreventiveClientBookedSlotsMap;
    const arr = map[k];
    return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
  } catch {
    return [];
  }
};

export type RegisteredPatientAuthSnapshot = {
  auth_token: string | null;
  refresh_token: string | null;
  app_user_id: string | null;
};

/** Everything persisted for the signed-in session (tokens, ids, partner user, registered patient). */
export type StoredSessionSnapshot = {
  auth_token: string | null;
  refresh_token: string | null;
  /** Partner/vendor JSON from primary login (often includes role e.g. Health Soldier). */
  vendor_partner_user: unknown | null;
  user_id: string | null;
  lab_user_id: string | null;
  primary_center_id: string | null;
  /** End-user from Home → Register New User; not the vendor_partner_user. */
  registered_patient: RegisteredPatientProfile | null;
  /** Patient/member tokens from register plan confirm (not Health Soldier session). */
  registered_patient_auth: RegisteredPatientAuthSnapshot;
  /** Patient row UUID from GET /api/v1/patients for current Bearer token. */
  preventive_patient_id: string | null;
  /** Copy kept when primary `auth_token` is swapped to a registered member (see `saveAuthData`). */
  lab_worker_access_token: string | null;
  lab_worker_refresh_token: string | null;
};

/**
 * If patient-auth keys were never written (older builds / login-only paths) but the active
 * session is a member user (user_id !== vendor profile id), copy auth_token into patient keys once.
 */
const hydrateRegisteredPatientAuthFromActiveSessionIfNeeded = async (
  map: Record<string, string | null>,
  vendor_partner_user: unknown | null,
): Promise<RegisteredPatientAuthSnapshot> => {
  const existing = map[KEYS.REGISTERED_PATIENT_AUTH_TOKEN];
  if (existing) {
    return {
      auth_token: map[KEYS.REGISTERED_PATIENT_AUTH_TOKEN] ?? null,
      refresh_token: map[KEYS.REGISTERED_PATIENT_REFRESH_TOKEN] ?? null,
      app_user_id: map[KEYS.REGISTERED_PATIENT_APP_USER_ID] ?? null,
    };
  }

  const activeToken = map[KEYS.AUTH_TOKEN];
  const activeUserId = map[KEYS.USER_ID];
  const activeRefresh = map[KEYS.REFRESH_TOKEN];
  if (!activeToken || !activeUserId) {
    return {
      auth_token: null,
      refresh_token: null,
      app_user_id: null,
    };
  }

  const vendorId =
    vendor_partner_user &&
    typeof vendor_partner_user === 'object' &&
    'id' in vendor_partner_user
      ? String((vendor_partner_user as { id: unknown }).id)
      : null;

  const activeIsVendorSession =
    vendorId != null && vendorId.length > 0 && String(activeUserId) === vendorId;

  if (activeIsVendorSession) {
    return {
      auth_token: null,
      refresh_token: null,
      app_user_id: null,
    };
  }

  await saveRegisteredPatientAuthData(activeToken, activeUserId, activeRefresh ?? undefined);
  return {
    auth_token: activeToken,
    refresh_token: activeRefresh ?? null,
    app_user_id: activeUserId,
  };
};

export const getAllStoredSessionData = async (): Promise<StoredSessionSnapshot> => {
  const keyList = Object.values(KEYS);
  const pairs = await AsyncStorage.multiGet(keyList);
  const map = Object.fromEntries(pairs) as Record<(typeof keyList)[number], string | null>;

  let vendor_partner_user: unknown | null = null;
  const rawUser = map[KEYS.USER];
  if (rawUser) {
    try {
      vendor_partner_user = JSON.parse(rawUser) as unknown;
    } catch {
      vendor_partner_user = null;
    }
  }

  let registered_patient: RegisteredPatientProfile | null = null;
  const rawPatient = map[KEYS.REGISTERED_PATIENT_PROFILE];
  if (rawPatient) {
    try {
      registered_patient = JSON.parse(rawPatient) as RegisteredPatientProfile;
    } catch {
      registered_patient = null;
    }
  }

  const registered_patient_auth = await hydrateRegisteredPatientAuthFromActiveSessionIfNeeded(
    map,
    vendor_partner_user,
  );

  const storedCenterRaw = map[KEYS.PRIMARY_CENTER_ID];
  let primary_center_id =
    storedCenterRaw != null && String(storedCenterRaw).trim()
      ? String(storedCenterRaw).trim()
      : null;
  if (!primary_center_id && vendor_partner_user && typeof vendor_partner_user === 'object') {
    const fromVendor = (vendor_partner_user as { primary_center_id?: unknown }).primary_center_id;
    if (fromVendor != null && String(fromVendor).trim()) {
      primary_center_id = String(fromVendor).trim();
    }
  }

  return {
    auth_token: map[KEYS.AUTH_TOKEN] ?? null,
    refresh_token: map[KEYS.REFRESH_TOKEN] ?? null,
    vendor_partner_user,
    user_id: map[KEYS.USER_ID] ?? null,
    lab_user_id: map[KEYS.LAB_USER_ID] ?? null,
    primary_center_id,
    registered_patient,
    registered_patient_auth,
    preventive_patient_id: map[KEYS.PREVENTIVE_PATIENT_ID] ?? null,
    lab_worker_access_token: map[KEYS.LAB_WORKER_ACCESS_TOKEN] ?? null,
    lab_worker_refresh_token: map[KEYS.LAB_WORKER_REFRESH_TOKEN] ?? null,
  };
};

/** Where to log: full dual tokens on Preventive Health, or lab-worker copy only on lab home. */
export type LogStoredSessionMode = 'preventiveHealth' | 'labWorkerHome';

/** Logs AsyncStorage session with clear labels for register-user vs lab-worker JWT copies. */
export const logStoredSessionToConsole = async (
  tag = '[StoredSession]',
  mode: LogStoredSessionMode = 'preventiveHealth',
): Promise<void> => {
  if (!__DEV__) {
    return;
  }
  const s = await getAllStoredSessionData();

  if (mode === 'labWorkerHome') {
    console.log(
      `${tag} ========== Lab worker (Health Soldier) JWT — stored copy for /lab/* (getLabWorkerAccessToken) ==========`,
    );
    console.log(
      `${tag} Primary auth_token may be the registered member; lab routes should use this pair when it differs.`,
    );
    console.log(`${tag} lab_worker_access_token:`, s.lab_worker_access_token ?? '— (not set)');
    console.log(`${tag} lab_worker_refresh_token:`, s.lab_worker_refresh_token ?? '— (not set)');
    return;
  }

  console.log(
    `${tag} ========== Registered user / member session (getAuthToken — preventive-health & member APIs) ==========`,
  );
  console.log(`${tag} auth_token:`, s.auth_token ?? '—');
  console.log(`${tag} refresh_token:`, s.refresh_token ?? '—');

  console.log(
    `${tag} ========== Lab worker (Health Soldier) JWT — stored copy (getLabWorkerAccessToken) ==========`,
  );
  console.log(
    `${tag} Same device after “Register New User”: primary keys often become the member; this copy keeps the lab worker pair.`,
  );
  console.log(`${tag} lab_worker_access_token:`, s.lab_worker_access_token ?? '— (not set)');
  console.log(`${tag} lab_worker_refresh_token:`, s.lab_worker_refresh_token ?? '— (not set)');

  console.log(`${tag} ========== Partner / vendor (primary login profile JSON) ==========`);
  console.log(`${tag} vendor_partner_user:`, JSON.stringify(s.vendor_partner_user, null, 2));
  console.log(`${tag} ========== Registered patient profile (Home → Register New User) ==========`);
  console.log(`${tag} registered_patient:`, JSON.stringify(s.registered_patient, null, 2));
  console.log(`${tag} registered_patient_auth (explicit patient token slot):`, JSON.stringify(s.registered_patient_auth, null, 2));
  console.log(`${tag} user_id:`, s.user_id);
  console.log(`${tag} lab_user_id:`, s.lab_user_id);
  console.log(`${tag} primary_center_id:`, s.primary_center_id);
  console.log(`${tag} preventive_patient_id:`, s.preventive_patient_id);
};

export const saveUserID = async (userID: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.USER_ID, userID);
};

export const getUserID = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.USER_ID);
};

export const saveAuthData = async (
  token: string,
  userID: string,
  refreshToken?: string,
): Promise<void> => {
  const pairs: [string, string][] = [
    [KEYS.AUTH_TOKEN, token],
    [KEYS.USER_ID, userID],
  ];
  if (refreshToken) {
    pairs.push([KEYS.REFRESH_TOKEN, refreshToken]);
  }
  await AsyncStorage.multiSet(pairs);
};

export const saveLabUserId = async (id: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.LAB_USER_ID, id);
};

export const getLabUserId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.LAB_USER_ID);
};

export const savePrimaryCenterId = async (id: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.PRIMARY_CENTER_ID, id);
};

export const getPrimaryCenterId = async (): Promise<string | null> => {
  const stored = await AsyncStorage.getItem(KEYS.PRIMARY_CENTER_ID);
  if (stored && String(stored).trim()) {
    return String(stored).trim();
  }
  const user = await getUser<{ primary_center_id?: string | number | null }>();
  const fromProfile = user?.primary_center_id;
  if (fromProfile != null && String(fromProfile).trim()) {
    const id = String(fromProfile).trim();
    await savePrimaryCenterId(id);
    return id;
  }
  return null;
};

export const clearAuthData = async (): Promise<void> => {
  // Lab worker session copies (see saveAuthTokens); must clear on logout.
  await AsyncStorage.multiRemove([
    KEYS.AUTH_TOKEN,
    KEYS.REFRESH_TOKEN,
    KEYS.LAB_WORKER_ACCESS_TOKEN,
    KEYS.LAB_WORKER_REFRESH_TOKEN,
    KEYS.USER,
    KEYS.REGISTERED_PATIENT_PROFILE,
    KEYS.REGISTERED_PATIENT_AUTH_TOKEN,
    KEYS.REGISTERED_PATIENT_REFRESH_TOKEN,
    KEYS.REGISTERED_PATIENT_APP_USER_ID,
    KEYS.USER_ID,
    KEYS.LAB_USER_ID,
    KEYS.PREVENTIVE_PATIENT_ID,
    KEYS.PREVENTIVE_PATIENT_OWNER_APP_USER_ID,
    KEYS.PREVENTIVE_CLIENT_BOOKED_SLOTS,
    KEYS.PRIMARY_CENTER_ID,
  ]);
  // Optional: keep KEYS like app language here if you add `LANGUAGE_KEY` — not used in this app today.
};
