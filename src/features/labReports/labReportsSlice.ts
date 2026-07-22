import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  getLabReports,
  getCancerLabReports,
  type CancerLabReportsQuery,
  type CancerLabReportApiItem,
  type LabReportApiItem,
  type LabReportsQuery,
  type LabReportsResponse,
  type CancerLabReportsResponse,
} from '../../api/labReportsApi';
import { getLabPatients } from '../../Screens/Home/PreventiveUser/PreventiveHealthAPI';
import { isJsonEqual } from '../../Utils/cacheEquality';

export const REPORT_TAB_PREVENTIVE = 'preventive';
export const REPORT_TAB_CANCER = 'cancer';
export type LabReportsTab = typeof REPORT_TAB_PREVENTIVE | typeof REPORT_TAB_CANCER;

export type LabReportRow = {
  id: string;
  bookingId?: string | null;
  reportUrl?: string | null;
  name: string;
  patientId: string;
  dateLabel: string;
  reportType: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  amount?: string | null;
};

type ReportsBucket = {
  rows: LabReportRow[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  filterKey: string;
  lastFetched: number | null;
};

export type LabReportsState = {
  reportTab: LabReportsTab;
  preventive: ReportsBucket;
  cancer: ReportsBucket;
};

const LAB_REPORTS_TTL_MS = 30_000;

const emptyBucket = (): ReportsBucket => ({
  rows: [],
  loading: false,
  error: null,
  page: 1,
  totalPages: 1,
  filterKey: '',
  lastFetched: null,
});

const initialState: LabReportsState = {
  reportTab: REPORT_TAB_PREVENTIVE,
  preventive: emptyBucket(),
  cancer: emptyBucket(),
};

/** UI time-range labels → GenVCare `date_filter` codes. */
export const CANCER_DATE_FILTER_TO_API: Record<string, number> = {
  Today: 1,
  Yesterday: 2,
  'Last 7 Days': 3,
  'Last 30 Days': 4,
  'This Month': 5,
  'Last Month': 6,
  'Custom Range': 7,
};

/** UI test-type labels → GenVCare `test_type` codes. */
export const CANCER_TEST_TYPE_TO_API: Record<string, string> = {
  'Oral Scan': 'Autofluorescence',
  Breast: 'Thermography',
  Cervical: 'ColposcopyFindings',
  'Cervical Scan': 'ColposcopyFindings',
};

function formatDateLabel(isoLike: string | undefined | null): string {
  if (!isoLike) return '';
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolveTotalPages(
  res: { pagination?: LabReportsResponse['pagination'] } | null,
  limit: number,
): number {
  const pag = res?.pagination;
  if (typeof pag?.total_pages === 'number' && pag.total_pages > 0) {
    return pag.total_pages;
  }
  if (typeof pag?.total === 'number' && pag.total > 0) {
    return Math.max(1, Math.ceil(pag.total / limit));
  }
  return 1;
}

function isFresh(lastFetched: number | null, ttlMs = LAB_REPORTS_TTL_MS): boolean {
  if (lastFetched == null) return false;
  return Date.now() - lastFetched < ttlMs;
}

export function makePreventiveFilterKey(query: LabReportsQuery): string {
  return JSON.stringify({
    page: query.page ?? 1,
    limit: query.limit ?? 10,
    test_types: query.test_types ?? [],
    range: query.range ?? null,
    from_date: query.from_date ?? null,
    to_date: query.to_date ?? null,
  });
}

export function makeCancerFilterKey(query: CancerLabReportsQuery): string {
  return JSON.stringify({
    page: query.page ?? 1,
    limit: query.limit ?? 10,
    testType: query.testType ?? null,
    date_filter: query.date_filter ?? null,
    fromDate: query.fromDate ?? null,
    toDate: query.toDate ?? null,
  });
}

export function buildCancerQueryFromFilters(args: {
  appliedTests?: string[];
  appliedTimes?: string[];
  customFrom?: string;
  customTo?: string;
  page?: number;
  limit?: number;
}): CancerLabReportsQuery {
  const appliedTests = args.appliedTests ?? [];
  const appliedTimes = args.appliedTimes ?? [];
  const pickedTime = appliedTimes.length
    ? appliedTimes[appliedTimes.length - 1]
    : 'Last 30 Days';
  const date_filter = CANCER_DATE_FILTER_TO_API[pickedTime] ?? 4;

  let testType: string | undefined;
  if (appliedTests.length > 0) {
    const picked = appliedTests[appliedTests.length - 1];
    testType = CANCER_TEST_TYPE_TO_API[picked] ?? undefined;
  }

  const query: CancerLabReportsQuery = {
    page: args.page ?? 1,
    limit: args.limit ?? 10,
    date_filter,
    testType,
  };

  if (pickedTime === 'Custom Range') {
    const from = args.customFrom?.trim();
    const to = args.customTo?.trim();
    if (from) query.fromDate = from;
    if (to) query.toDate = to;
  }

  return query;
}

function mapPreventiveItem(
  r: LabReportApiItem,
  paymentByBookingId: Map<
    string,
    { paymentMethod: string | null; paymentStatus: string | null; amount: string | null }
  >,
): LabReportRow {
  const types = Array.isArray(r.test_types) ? r.test_types : [];
  const reportType = types.length ? types.join(', ') : 'Report';
  const dateLabel = formatDateLabel(r.booking_date ?? r.created_at) || '—';
  const patientId =
    (r.patient_phone && String(r.patient_phone)) ||
    (r.patient_id ? String(r.patient_id).slice(0, 10).toUpperCase() : '—');
  const bookingId = r.booking_id ?? null;
  const payment = bookingId ? (paymentByBookingId.get(String(bookingId).trim()) ?? null) : null;
  return {
    id: String(r.id ?? r.booking_id),
    bookingId,
    reportUrl: r.report_url ?? null,
    name: r.patient_name ?? '—',
    patientId,
    dateLabel,
    reportType,
    paymentMethod: payment?.paymentMethod ?? null,
    paymentStatus: payment?.paymentStatus ?? null,
    amount: payment?.amount ?? null,
  };
}

function mapCancerItem(r: CancerLabReportApiItem): LabReportRow {
  const devices = Array.isArray(r.device_names) ? r.device_names.filter(Boolean) : [];
  const reportType =
    devices.length > 0 ? devices.join(', ') : r.test_type?.trim() ? String(r.test_type) : 'Report';
  const dateLabel = formatDateLabel(r.booking_date ?? r.created_date) || '—';
  const patientId =
    (r.patient_phone && String(r.patient_phone)) ||
    (r.patient_uhid && String(r.patient_uhid)) ||
    (r.patient_id ? String(r.patient_id).slice(0, 10).toUpperCase() : '—');
  const bookingId = r.booking_id ? String(r.booking_id) : null;
  return {
    id: String(r.event_id ?? bookingId ?? r.hospital_mrn ?? 'cancer-report'),
    bookingId,
    reportUrl: r.report_url ?? null,
    name: r.patient_name ?? '—',
    patientId,
    dateLabel,
    reportType,
  };
}

export type FetchPreventiveReportsArg = LabReportsQuery & { force?: boolean };
export type FetchCancerReportsArg = CancerLabReportsQuery & { force?: boolean };

export const fetchPreventiveLabReports = createAsyncThunk(
  'labReports/fetchPreventive',
  async (arg: FetchPreventiveReportsArg, { rejectWithValue }) => {
    try {
      const { force: _force, ...query } = arg;
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const [res, completedPatients] = await Promise.all([
        getLabReports({ ...query, page, limit }),
        getLabPatients('completed').catch(() => []),
      ]);

      const paymentByBookingId = new Map(
        completedPatients
          .filter(p => p.booking_id)
          .map(p => [
            String(p.booking_id).trim(),
            {
              paymentMethod: p.payment_method ?? null,
              paymentStatus: p.payment_status ?? null,
              amount: p.amount ?? null,
            },
          ]),
      );

      const rows = (res.data ?? []).map(r => mapPreventiveItem(r, paymentByBookingId));
      return {
        rows,
        page,
        totalPages: resolveTotalPages(res, limit),
        filterKey: makePreventiveFilterKey({ ...query, page, limit }),
      };
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load reports');
    }
  },
  {
    condition: (arg, { getState }) => {
      if (arg?.force) return true;
      const state = getState() as { labReports: LabReportsState };
      const bucket = state.labReports.preventive;
      if (bucket.loading) return false;
      const { force: _f, ...query } = arg;
      const key = makePreventiveFilterKey({
        ...query,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
      });
      if (bucket.filterKey === key && isFresh(bucket.lastFetched)) {
        return false;
      }
      return true;
    },
  },
);

export const fetchCancerLabReports = createAsyncThunk(
  'labReports/fetchCancer',
  async (arg: FetchCancerReportsArg, { rejectWithValue }) => {
    try {
      const { force: _force, ...query } = arg;
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const res: CancerLabReportsResponse = await getCancerLabReports({ ...query, page, limit });
      const rows = (res.data ?? []).map(mapCancerItem);
      return {
        rows,
        page,
        totalPages: resolveTotalPages(res, limit),
        filterKey: makeCancerFilterKey({ ...query, page, limit }),
      };
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load cancer reports');
    }
  },
  {
    condition: (arg, { getState }) => {
      if (arg?.force) return true;
      const state = getState() as { labReports: LabReportsState };
      const bucket = state.labReports.cancer;
      if (bucket.loading) return false;
      const { force: _f, ...query } = arg;
      const key = makeCancerFilterKey({
        ...query,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
      });
      if (bucket.filterKey === key && isFresh(bucket.lastFetched)) {
        return false;
      }
      return true;
    },
  },
);

const labReportsSlice = createSlice({
  name: 'labReports',
  initialState,
  reducers: {
    setLabReportsTab(state, action: PayloadAction<LabReportsTab>) {
      state.reportTab = action.payload;
    },
    clearLabReports() {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchPreventiveLabReports.pending, state => {
        state.preventive.loading = true;
        state.preventive.error = null;
      })
      .addCase(fetchPreventiveLabReports.fulfilled, (state, action) => {
        state.preventive.loading = false;
        state.preventive.error = null;
        state.preventive.page = action.payload.page;
        state.preventive.totalPages = action.payload.totalPages;
        state.preventive.filterKey = action.payload.filterKey;
        state.preventive.lastFetched = Date.now();
        if (!isJsonEqual(state.preventive.rows, action.payload.rows)) {
          state.preventive.rows = action.payload.rows;
        }
      })
      .addCase(fetchPreventiveLabReports.rejected, (state, action) => {
        state.preventive.loading = false;
        state.preventive.error = (action.payload as string) ?? 'Failed to load reports';
        state.preventive.rows = [];
        state.preventive.totalPages = 1;
      })
      .addCase(fetchCancerLabReports.pending, state => {
        state.cancer.loading = true;
        state.cancer.error = null;
      })
      .addCase(fetchCancerLabReports.fulfilled, (state, action) => {
        state.cancer.loading = false;
        state.cancer.error = null;
        state.cancer.page = action.payload.page;
        state.cancer.totalPages = action.payload.totalPages;
        state.cancer.filterKey = action.payload.filterKey;
        state.cancer.lastFetched = Date.now();
        if (!isJsonEqual(state.cancer.rows, action.payload.rows)) {
          state.cancer.rows = action.payload.rows;
        }
      })
      .addCase(fetchCancerLabReports.rejected, (state, action) => {
        state.cancer.loading = false;
        state.cancer.error = (action.payload as string) ?? 'Failed to load cancer reports';
        state.cancer.rows = [];
        state.cancer.totalPages = 1;
      });
  },
});

export const { setLabReportsTab, clearLabReports } = labReportsSlice.actions;

export const selectLabReportsTab = (state: { labReports: LabReportsState }) =>
  state.labReports.reportTab;
export const selectPreventiveLabReports = (state: { labReports: LabReportsState }) =>
  state.labReports.preventive;
export const selectCancerLabReports = (state: { labReports: LabReportsState }) =>
  state.labReports.cancer;
export const selectActiveLabReports = (state: { labReports: LabReportsState }) =>
  state.labReports.reportTab === REPORT_TAB_CANCER
    ? state.labReports.cancer
    : state.labReports.preventive;

export default labReportsSlice.reducer;
