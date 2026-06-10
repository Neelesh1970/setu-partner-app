// import axios from "axios";

// /* ================= TYPES ================= */

// export interface Device {
//   id: string;
//   device_name: string;
//   image_url?: string;
// }

// export interface PackageItem {
//   id: string;
//   package_name: string;
//   image_url?: string;
// }

// export interface Screening {
//   id: string;
//   title: string;
//   slug?: string;
// }

// /* ================= BASE URL ================= */

// export const PREVENTIVE_BASE_URL =
//   "https://brake-approach-trying-stores.trycloudflare.com";

// /* ================= API ================= */

// export const getPreventiveDevices = async (): Promise<Device[]> => {
//   const res = await axios.get(`${PREVENTIVE_BASE_URL}/api/v1/devices`);
//   return res?.data?.data || [];
// };

// export const getPreventivePackages = async (): Promise<PackageItem[]> => {
//   const res = await axios.get(`${PREVENTIVE_BASE_URL}/api/v1/packages`);
//   return res?.data?.data || [];
// };

// export const getPreventiveHealthConcernScreenings = async (): Promise<Screening[]> => {
//   const res = await axios.get(
//     `${PREVENTIVE_BASE_URL}/api/v1/health-concern-screenings`
//   );
//   return res?.data?.data || [];
// };

// export const getPreventiveCart = async ({
//   accessToken,
//   refreshToken,
// }: {
//   accessToken: string;
//   refreshToken: string;
// }) => {
//   const res = await axios.get(`${PREVENTIVE_BASE_URL}/api/v1/cart`, {
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       "x-refresh-token": refreshToken,
//     },
//   });

//   return res?.data?.data || null;
// };










import axios from "axios";
import { getRegisteredPatientAuthToken, getRegisteredPatientRefreshToken } from "../../../Utils/storage";
import { getPreventiveCartStore } from "../../../Utils/preventiveCartStore";
import axiosInstance from "../../../api/axiosInstance";
import { PREVENTIVE_BASE_URL } from "../../../api/apiConfig";

/* ================= BASE ================= */

export { PREVENTIVE_BASE_URL };

/* ================= AXIOS INSTANCE ================= */

const api = axios.create({
  baseURL: `${PREVENTIVE_BASE_URL}/api/v1`,
  timeout: 10000,
});

/* ================= TOKEN HANDLING ================= */

const getAuthHeaders = async () => {
  // Use the patient-specific token keys — these hold the newly registered
  // patient's session from RegisterPlans (saveRegisteredPatientAuthData).
  // The primary AUTH_TOKEN/REFRESH_TOKEN always stay as the lab worker's session
  // and must not be used here for patient-facing API calls.
  const [accessToken, refreshToken] = await Promise.all([
    getRegisteredPatientAuthToken(),
    getRegisteredPatientRefreshToken(),
  ]);

  if (__DEV__) {
    console.log('[PreventiveHealthAPI] getAuthHeaders — patient token present:', Boolean(accessToken));
  }
  return {
    Authorization: `Bearer ${accessToken ?? ""}`,
    "x-refresh-token": refreshToken ?? "",
  };
};

/* ================= API ================= */

export const getDevices = async () => {
  const res = await api.get("/devices");
  return res.data?.data || [];
};

export const getPackages = async () => {
  const res = await api.get("/packages");
  return res.data?.data || [];
};

export const getScreenings = async () => {
  const res = await api.get("/health-concern-screenings");
  return res.data?.data || [];
};

export const getCart = async () => {
  const headers = await getAuthHeaders();
  const res = await api.get("/cart", { headers });
  return res.data?.data || null;
};

export const getPatients = async (): Promise<
  Array<{
    id?: string;
    user_id?: string | number;
    full_name?: string;
    [key: string]: unknown;
  }>
> => {
  const headers = await getAuthHeaders();
  const res = await api.get("/patients", { headers });
  const data = res.data?.data;
  return Array.isArray(data) ? data : [];
};

/** Lab scope: `GET /lab/patients?filter=...` (Bearer + x-refresh-token via axiosInstance). */
export type LabPatientFilter =
  | "upcoming"
  | "completed"
  | "pending"
  | "missed";

/** A single device from `devices[]` or `packages[].included_tests[]` in the new API response. */
export type RawDeviceItem = {
  device_name: string;
  device_id: string;
  booking_item_id: string;
};

/** A package entry from `packages[]` in the new API response. */
export type RawPackageItem = {
  package_id: string;
  package_name: string;
  included_tests: RawDeviceItem[];
};

export type LabPatientRecord = {
  id?: string;
  user_id?: string | number | null;
  booking_id?: string | null;
  full_name?: string | null;
  gender?: string | null;
  age?: number | null;
  phone?: string | null;
  service_type?: string | null;
  slot_start_time?: string | null;
  slot_end_time?: string | null;
  slot_date?: string | null;
  booking_date?: string | null;
  scheduled_at?: string | null;
  test_status?: string | null;
  can_perform_test?: boolean | null;
  /** Reason the test cannot be performed yet (from backend `perform_block_reason`). */
  perform_block_reason?: string | null;
  package_names?: string[] | null;
  device_names?: string[] | null;
  /**
   * Backend device ids corresponding index-wise to `device_names`.
   * Populated by flattening `devices[]` + `packages[].included_tests[]`.
   */
  device_ids?: string[] | null;
  /**
   * Booking-line ids (`booking_items.id`) corresponding index-wise to `device_ids`.
   * Used as the `booking_item_id` payload when posting device-side results.
   */
  booking_item_ids?: string[] | null;
  package_included_tests?: string[] | null;
  payment_status?: string | null;
  payment_method?: string | null;
  /** Booking amount (e.g. "353.00") — used to display on the Collect Cash button. */
  amount?: string | null;
  /** Structured standalone devices from new API response. Used for multi-device selection. */
  devices?: RawDeviceItem[] | null;
  /** Structured packages (each with included_tests) from new API response. */
  packages?: RawPackageItem[] | null;
};
  
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as `YYYY-MM-DD` (for comparing with API slot/booking dates). */
export const formatLocalYmd = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function parseTimeParts(t: string | null | undefined): [number, number, number] {
  const s = (t ?? "").trim();
  if (!s) return [0, 0, 0];
  const [hs, ms, ss] = s.split(":");
  const h = Number(hs);
  const m = Number(ms);
  const sec = Number(ss);
  if (Number.isNaN(h)) return [0, 0, 0];
  return [h, Number.isNaN(m) ? 0 : m, Number.isNaN(sec) ? 0 : sec];
}

/** YYYY-MM-DD from an API datetime string, in local date parts when parsable. */
function ymdFromScheduledAt(
  scheduledAt: string | null | undefined,
): string | null {
  const s = (scheduledAt ?? "").trim();
  if (!s) return null;
  const datePart = s.split(/[\sT]/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return formatLocalYmd(d);
}

/**
 * Inclusive service calendar date (matches lab slot or booking) for the patient row.
 */
export function labPatientServiceYmd(p: LabPatientRecord): string | null {
  const s = (p.slot_date || p.booking_date || "").trim();
  if (s) return s;
  return ymdFromScheduledAt(p.scheduled_at);
}

/** `YYYY-MM-DD HH:mm:ss` (API) → local `Date` (avoids `Date` string TZ ambiguity). */
function parseLocalApiDateTime(iso: string | null | undefined): Date | null {
  const s = (iso ?? "").trim();
  if (!s) return null;
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/,
  );
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
}

/**
 * Start/end in local time for ordering and "still in this slot" checks.
 */
export function labPatientSlotBounds(p: LabPatientRecord): {
  start: Date;
  end: Date;
} | null {
  const ymd = labPatientServiceYmd(p);
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  const [sh, sm, ss] = parseTimeParts(p.slot_start_time);
  const [eh, em, es] = parseTimeParts(p.slot_end_time);
  let start = new Date(y, m - 1, d, sh, sm, ss);
  let end = new Date(y, m - 1, d, eh, em, es);
  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 30 * 60 * 1000);
  }
  const fromSched = parseLocalApiDateTime(p.scheduled_at);
  if (fromSched) {
    start = fromSched;
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 30 * 60 * 1000);
    }
  }
  return { start, end };
}

const UPCOMING_MAX = 5;

/**
 * Upcoming = next few pending visits for **today (local)**, ordered by time, max `limit`
 * (default 5). Drops slots that have already ended (they stay on Pending / other tabs from API).
 */
export function selectUpcomingFromPending(
  patients: LabPatientRecord[],
  options?: { now?: Date; limit?: number },
): LabPatientRecord[] {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 5;

  return patients
    .map(p => {
      const bounds = labPatientSlotBounds(p);
      return bounds ? { p, start: bounds.start, end: bounds.end } : null;
    })
    .filter(
      (item): item is { p: LabPatientRecord; start: Date; end: Date } =>
        item !== null
    )
    .filter(item => {
      const todayYmd = formatLocalYmd(now);
      const itemYmd = formatLocalYmd(item.start);
      // Upcoming tab requirement: show only today's slots that haven't ended yet.
      if (itemYmd !== todayYmd) return false;
      return item.end.getTime() > now.getTime();
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, limit)
    .map(item => item.p);
}

const IST_TZ = "Asia/Kolkata";

const padHms = (t: string): string => {
  const p = t.trim();
  if (!p) return "00:00:00";
  const parts = p.split(":");
  if (parts.length === 1) return `${parts[0].padStart(2, "0")}:00:00`;
  if (parts.length === 2) return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`;
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${(parts[2] ?? "0").padStart(2, "0")}`;
};

/**
 * `slot_date` (YYYY-MM-DD) shown in en-IN; calendar day matches IST for lab slots.
 */
export const formatLabSlotYmdIst = (ymd: string | null | undefined): string => {
  const s = (ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
  const [y, mo, d] = s.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return "—";
  const local = new Date(y, mo - 1, d);
  return local.toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * Start/end on `ymd` interpreted in IST (API values are lab local time in IST).
 */
export const formatLabSlotTimeRangeIst = (
  ymd: string | null | undefined,
  start?: string | null,
  end?: string | null,
): string => {
  const dStr = (ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return "—";
  const s0 = (start ?? "").trim();
  if (!s0) return "—";
  const tStart = padHms(s0);
  const endTrim = (end ?? "").trim();
  const tEnd = endTrim ? padHms(endTrim) : null;
  const d1 = new Date(`${dStr}T${tStart}+05:30`);
  if (Number.isNaN(d1.getTime())) return "—";
  const fmt = (dd: Date) =>
    dd.toLocaleTimeString("en-IN", {
      timeZone: IST_TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  if (!tEnd) return fmt(d1);
  const d2 = new Date(`${dStr}T${tEnd}+05:30`);
  if (Number.isNaN(d2.getTime())) return fmt(d1);
  return `${fmt(d1)} – ${fmt(d2)}`;
};

export const formatLabSlotRange = (
  start?: string | null,
  end?: string | null,
): string => {
  const toAmPm = (t: string) => {
    const [hs, ms] = t.split(":");
    const h = Number(hs);
    const m = Number(ms ?? 0);
    if (Number.isNaN(h)) return t;
    const d = new Date();
    d.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
    return d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };
  const s = start?.trim();
  if (!s) return "—";
  const e = end?.trim();
  if (!e) return toAmPm(s);
  return `${toAmPm(s)} – ${toAmPm(e)}`;
};

export const labPatientTestLabel = (p: LabPatientRecord): string => {
  const fromPkg = p.package_names?.find((n) => Boolean(n?.trim()));
  if (fromPkg) return fromPkg;
  const fromDev = p.device_names?.find((n) => Boolean(n?.trim()));
  if (fromDev) return fromDev;
  return "—";
};

export const labPatientLocationLabel = (p: LabPatientRecord): string => {
  const t = (p.service_type ?? "").toLowerCase();
  if (t === "home" || t === "doorstep") return "At Patient's Home";
  return "At Centre";
};

/** Raw patient shape returned by the new API (before transformation into LabPatientRecord). */
type RawApiPatient = {
  id?: string;
  user_id?: string | number | null;
  booking_id?: string | null;
  full_name?: string | null;
  gender?: string | null;
  age?: number | null;
  phone?: string | null;
  service_type?: string | null;
  slot_start_time?: string | null;
  slot_end_time?: string | null;
  slot_date?: string | null;
  booking_date?: string | null;
  scheduled_at?: string | null;
  can_perform_test?: boolean | null;
  perform_block_reason?: string | null;
  test_status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  amount?: string | null;
  /** Standalone (non-package) devices assigned to this booking. */
  devices?: RawDeviceItem[];
  /** Package assignments, each with their included device tests. */
  packages?: RawPackageItem[];
};

type LabPatientsApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    patients?: RawApiPatient[];
    service_scope?: string;
    primary_center_id?: string;
    filter?: string;
  };
};

export const getLabPatients = async (
  filter: LabPatientFilter,
): Promise<LabPatientRecord[]> => {
  const res = await axiosInstance.get<LabPatientsApiResponse>("lab/patients", {
    params: { filter },
  });
  const list = res.data?.data?.patients;
  if (!Array.isArray(list)) return [];

  return list.map((raw): LabPatientRecord => {
    const standaloneDevices = raw.devices ?? [];
    const pkgs = raw.packages ?? [];
    // Flatten all devices (standalone + from packages) into parallel arrays for backward compat.
    const packageDevices = pkgs.flatMap(pkg => pkg.included_tests ?? []);
    const allDevices = [...standaloneDevices, ...packageDevices];

    const device_names = allDevices.map(d => d.device_name).filter(Boolean);
    const device_ids = allDevices.map(d => d.device_id).filter(Boolean);
    const booking_item_ids = allDevices.map(d => d.booking_item_id).filter(Boolean);
    const package_names = pkgs.map(pkg => pkg.package_name).filter(Boolean);

    return {
      id: raw.id,
      user_id: raw.user_id,
      booking_id: raw.booking_id,
      full_name: raw.full_name,
      gender: raw.gender,
      age: raw.age,
      phone: raw.phone,
      service_type: raw.service_type,
      slot_start_time: raw.slot_start_time,
      slot_end_time: raw.slot_end_time,
      slot_date: raw.slot_date,
      booking_date: raw.booking_date,
      scheduled_at: raw.scheduled_at,
      test_status: raw.test_status,
      can_perform_test: raw.can_perform_test,
      perform_block_reason: raw.perform_block_reason,
      payment_status: raw.payment_status,
      payment_method: raw.payment_method,
      amount: raw.amount ?? null,
      device_names: device_names.length > 0 ? device_names : null,
      device_ids: device_ids.length > 0 ? device_ids : null,
      booking_item_ids: booking_item_ids.length > 0 ? booking_item_ids : null,
      package_names: package_names.length > 0 ? package_names : null,
      // Preserve the structured raw data for multi-device selection in TestActivity.
      devices: raw.devices ?? [],
      packages: raw.packages ?? [],
    };
  });
};

export type CollectCashApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/** POST lab/bookings/:bookingId/collect-cash — records cash collection by lab worker. */
export const collectCashPayment = async (
  bookingId: string,
): Promise<CollectCashApiResponse> => {
  const res = await axiosInstance.patch<CollectCashApiResponse>(
    `lab/bookings/${encodeURIComponent(bookingId)}/collect-cash`,
    {},
  );
  return res.data;
};

export const addToCart = async (deviceId: string | number) => {
  const headers = await getAuthHeaders();

  return api.post(
    "/cart/add-bulk",
    {
      items: [
        {
          item_type: "device",
          item_id: deviceId,
          quantity: 1,
        },
      ],
    },
    { headers }
  );
};

export const getPackageById = async (id: string) => {
  const res = await api.get(`/packages/${id}`);
  return res.data?.data || null;
};

// export const getScreenings = async () => {
//   const res = await api.get("/health-concern-screenings");
//   return res.data?.data || [];
// };

export const syncCart = async () => {
  const res = await getCart();
  const store = getPreventiveCartStore();
  if (res?.items) {
    store.setItems(res.items);
  }
  return res;
};

export const addPackageToCart = async (packageId: string) => {
  const headers = await getAuthHeaders();

  return api.post(
    "/cart/add-bulk",
    {
      items: [
        {
          item_type: "health_package",
          item_id: packageId,
          quantity: 1,
        },
      ],
    },
    { headers }
  );
};

export const removeFromCart = async ({
  item_type,
  item_id,
}: {
  item_type: string;
  item_id: string;
}) => {
  const headers = await getAuthHeaders();

  return api.post(
    "/cart/remove",
    {
      item_type,
      item_id,
    },
    { headers }
  );
};

export const getSlots = async ({
  centerId,
  date,
}: {
  centerId: string;
  date: string;
}) => {
  const headers = await getAuthHeaders();
  const res = await api.get("/slots", {
    headers,
    params: {
      center_id: centerId,
      date,
      _ts: Date.now(),
    },
  });
  return res.data?.data ?? res.data ?? null;
};

/** POST body matches PreventiveBookingDetail bookingPayload. */
export const createPreventiveBooking = async (
  body: Record<string, unknown>,
): Promise<{
  success?: boolean;
  data?: {
    booking?: { id?: string; slot_id?: string };
    booking_id?: string;
  };
  message?: string;
}> => {
  const headers = await getAuthHeaders();
  const res = await api.post("/bookings", body, { headers });
  return res.data;
};

export const getBookingCheckout = async (bookingId: string) => {
  const headers = await getAuthHeaders();
  const res = await api.get(`/bookings/${encodeURIComponent(bookingId)}/checkout`, {
    headers,
  });
  return res.data as {
    success?: boolean;
    message?: string;
    data?: {
      booking_id?: string;
      payment_status?: string;
      bill_details?: {
        package_price?: number;
        device_usage_fee?: number;
        technician_fee?: number;
        consumables_charge?: number;
        report_generation_fee?: number;
        amount_payable?: number;
      };
    };
  };
};

/** POST `/auth/logout` with empty JSON body; sends Bearer access + `x-refresh-token`. */
export const postAuthLogout = async () => {
  const headers = await getAuthHeaders();
  const res = await api.post("/auth/logout", {}, { headers });
  return res.data;
};