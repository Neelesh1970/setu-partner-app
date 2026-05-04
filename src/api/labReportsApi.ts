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

export type LabReportsQuery = {
  test_types?: string[]; // supports multiple values (comma-separated in request)
  range?: string; // e.g. last_30_days
  from_date?: string | null;
  to_date?: string | null;
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

export async function getLabReports(query: LabReportsQuery): Promise<LabReportsResponse> {
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

  const res = await axiosInstance.get<LabReportsResponse>('lab/reports', { params });
  return res.data;
}

