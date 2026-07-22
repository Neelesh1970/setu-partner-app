import axiosInstance from './axiosInstance';

export type LabReportApiItem = {
  id: string;
  booking_id: string;
  report_url: string;
  s3_key?: string;
  uploaded_by_lab_user_id?: string;
  test_status?: string;
  created_at?: string;
  booking_date?: string;
  booking_status?: string;
  service_type?: string;
  center_id?: string;
  patient_id?: string;
  patient_name?: string;
  patient_phone?: string;
  gender?: string;
  age?: number;
  test_types?: string[];
};

/** GenVCare / cancer screening report row from `lab/genvcare/reports`. */
export type CancerLabReportApiItem = {
  event_id: number;
  hospital_mrn?: string | null;
  test_type?: string | null;
  file_name?: string | null;
  report_url?: string | null;
  is_test_finalized?: boolean;
  created_date?: string | null;
  booking_id?: string | null;
  booking_date?: string | null;
  service_type?: string | null;
  test_status?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  patient_uhid?: string | null;
  device_names?: string[] | null;
};

export type LabReportsPagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  filters?: Record<string, unknown>;
};

export type LabReportsResponse = {
  success: boolean;
  message?: string;
  data: LabReportApiItem[];
  pagination?: LabReportsPagination;
};

export type CancerLabReportsResponse = {
  success: boolean;
  message?: string;
  data: CancerLabReportApiItem[];
  pagination?: LabReportsPagination;
};

export type LabReportsQuery = {
  test_types?: string[]; // supports multiple values (comma-separated in request)
  range?: string; // e.g. last_30_days
  from_date?: string | null;
  to_date?: string | null;
  page?: number;
  limit?: number;
};

export type CancerLabReportsQuery = {
  /** GenVCare API `testType` code, e.g. ColposcopyFindings */
  testType?: string;
  /** 1=Today … 7=Custom Range */
  date_filter?: number;
  fromDate?: string | null;
  toDate?: string | null;
  page?: number;
  limit?: number;
};

function normalizeCsvParam(values: string[] | undefined): string | undefined {
  const cleaned = (values ?? [])
    .map(v => String(v).trim())
    .filter(Boolean);
  if (cleaned.length === 0) return undefined;
  return cleaned.join(',');
}

function buildLabReportsParams(query: LabReportsQuery): Record<string, unknown> {
  const params: Record<string, unknown> = {
    range: query.range,
    page: query.page,
    limit: query.limit,
  };

  const typesCsv = normalizeCsvParam(query.test_types);
  if (typesCsv) {
    params.test_types = typesCsv;
  }

  if (query.from_date) {
    params.from_date = query.from_date;
  }
  if (query.to_date) {
    params.to_date = query.to_date;
  }

  return params;
}

export async function getLabReports(query: LabReportsQuery): Promise<LabReportsResponse> {
  const res = await axiosInstance.get<LabReportsResponse>('lab/reports', {
    params: buildLabReportsParams(query),
  });
  return res.data;
}

/**
 * GenVCare / cancer screening reports — `GET lab/genvcare/reports`
 * Query: testType, date_filter, fromDate, toDate, page, limit
 */
export async function getCancerLabReports(
  query: CancerLabReportsQuery = {},
): Promise<CancerLabReportsResponse> {
  const params: Record<string, unknown> = {
    page: query.page,
    limit: query.limit,
  };

  if (query.testType) {
    params.testType = query.testType;
  }
  if (query.date_filter != null) {
    params.date_filter = query.date_filter;
  }
  if (query.fromDate) {
    params.fromDate = query.fromDate;
  }
  if (query.toDate) {
    params.toDate = query.toDate;
  }

  const res = await axiosInstance.get<CancerLabReportsResponse>('lab/genvcare/reports', {
    params,
  });
  return res.data;
}
