import axiosInstance from './axiosInstance';

// ─── Pulse Oximeter ──────────────────────────────────────────────────────────

export type PostPulseOximeterResultArgs = {
  deviceId: string;
  bookingItemId: string;
  spo2: number;
  pulseRate: number;
};

export type PostPulseOximeterResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/pulse-oxymeter-results` with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 */
export async function postPulseOximeterResult(
  args: PostPulseOximeterResultArgs,
): Promise<PostPulseOximeterResultResponse> {
  const { deviceId, bookingItemId, spo2, pulseRate } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/pulse-oxymeter-results`;
  const body = {
    spo2,
    pulse_rate: pulseRate,
    booking_item_id: bookingItemId,
  };
  try {
    const res = await axiosInstance.post<PostPulseOximeterResultResponse>(path, body);
    return res.data ?? {};
  } catch (err) {
    throw err;
  }
}

// ─── BMI / Smart Scale ────────────────────────────────────────────────────────

export type PostBmiResultArgs = {
  deviceId: string;
  bookingItemId: string;
  height: number;
  weight: number;
  bmi: number;
};

export type PostBmiResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/bmi-results` with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 */
export async function postBmiResult(
  args: PostBmiResultArgs,
): Promise<PostBmiResultResponse> {
  const { deviceId, bookingItemId, height, weight, bmi } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/bmi-results`;
  const body = {
    height,
    weight,
    bmi,
    ph_booking_item_id: bookingItemId,
  };
  try {
    const res = await axiosInstance.post<PostBmiResultResponse>(path, body);
    return res.data ?? {};
  } catch (err) {
    throw err;
  }
}

// ─── Blood Pressure / NIBP ───────────────────────────────────────────────────

export type PostBloodPressureResultArgs = {
  deviceId: string;
  bookingItemId: string;
  systolic: number;
  diastolic: number;
  pulseRate: number;
};

export type PostBloodPressureResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/blood-pressure-results` with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 */
export async function postBloodPressureResult(
  args: PostBloodPressureResultArgs,
): Promise<PostBloodPressureResultResponse> {
  const { deviceId, bookingItemId, systolic, diastolic, pulseRate } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/blood-pressure-results`;
  const body = {
    systolic,
    diastolic,
    pulse_rate: pulseRate,
    booking_item_id: bookingItemId,
  };
  try {
    const res = await axiosInstance.post<PostBloodPressureResultResponse>(path, body);
    return res.data ?? {};
  } catch (err) {
    throw err;
  }
}

// ─── Remidio QR ──────────────────────────────────────────────────────────────

// ─── Types shared across device result functions ─────────────────────────────

/**
 * Generic Remidio QR `result` shape: keyed by reading label (e.g. `R1`, `L1`, `R-Avg`, `L-Avg`)
 * with `S`/`C`/`A` strings. We forward whatever the device emitted untouched, so this is
 * intentionally loose to accommodate per-reading shape variation across device firmwares.
 */
export type RemidioQrResultMap = Record<string, unknown>;

export type PostRemidioQrResultArgs = {
  /** Backend device id (auto refractometer uuid). */
  deviceId: string;
  /** Booking item id (from `LabPatientRecord.booking_item_ids`, index-aligned with device_ids). */
  bookingItemId: string;
  /** Exam id provided by the device QR. */
  examID: string;
  /** Full `result` object captured from the device QR (forwarded as-is). */
  result: RemidioQrResultMap;
};

export type PostRemidioQrResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/qr-results` with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 */
export async function postRemidioQrResult(
  args: PostRemidioQrResultArgs,
): Promise<PostRemidioQrResultResponse> {
  const { deviceId, bookingItemId, examID, result } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/qr-results`;
  const body = {
    booking_item_id: bookingItemId,
    examID,
    result,
  };
  try {
    const res = await axiosInstance.post<PostRemidioQrResultResponse>(path, body);
    return res.data ?? {};
  } catch (err) {
    throw err;
  }
}

// ─── ASHA Health Screening Kit ────────────────────────────────────────────────

export type AshaBloodPressureResult = {
  systolic: number;
  diastolic: number;
  map: number;
  pulse_rate: number;
};

export type AshaPulseOximeterResult = {
  spo2: number;
  pulse_rate: number;
  perfusion_index?: number;
};

export type AshaThermometerResult = {
  temperature: number;
  unit: 'F' | 'C';
};

export type AshaGlucometerResult = {
  blood_glucose: number;
  test_type: string;
  unit: string;
};

export type AshaStethoscopeResult = {
  audio_base64: string;
  format: string;
  audio_mime?: string;
  byte_count: number;
  sample_count: number;
  sample_rate?: number;
  beat_count: number;
  samples?: number[];
  status?: string;
};

export type AshaResultData = {
  blood_pressure?: AshaBloodPressureResult;
  pulse_oximeter?: AshaPulseOximeterResult;
  thermometer?: AshaThermometerResult;
  glucometer?: AshaGlucometerResult;
  stethoscope?: AshaStethoscopeResult;
};

/** RN multipart file part (uri / name / type) — not a web Blob. */
export type AshaMultipartFile = {
  uri: string;
  name: string;
  type: string;
};

export type PostAshaResultArgs = {
  deviceId: string;
  bookingItemId: string;
  /** Vitals-only payload (BP / SpO2 / thermometer / glucometer). Serialized as JSON string. */
  resultData: AshaResultData;
  /** Optional PNG of the captured full ECG waveform. */
  ecgImage?: AshaMultipartFile | null;
  /** Optional heartbeat / stethoscope audio file (existing WAV). */
  heartbeatAudio?: AshaMultipartFile | null;
};

export type PostAshaResultResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

/**
 * POST `devices/:deviceId/asha-results` as multipart/form-data with the lab worker session
 * (Bearer + x-refresh-token automatically attached by `axiosInstance`).
 *
 * Fields: `booking_item_id`, `result_data` (JSON string), optional `ecg_image`, optional `heartbeat_audio`.
 */
export async function postAshaResult(
  args: PostAshaResultArgs,
): Promise<PostAshaResultResponse> {
  const { deviceId, bookingItemId, resultData, ecgImage, heartbeatAudio } = args;
  const path = `devices/${encodeURIComponent(deviceId)}/asha-results`;
  const resultDataJson = JSON.stringify(resultData);

  const formData = new FormData();
  formData.append('booking_item_id', bookingItemId);
  formData.append('result_data', resultDataJson);

  if (ecgImage?.uri) {
    formData.append('ecg_image', {
      uri: ecgImage.uri,
      name: ecgImage.name,
      type: ecgImage.type,
    } as unknown as Blob);
  }

  if (heartbeatAudio?.uri) {
    formData.append('heartbeat_audio', {
      uri: heartbeatAudio.uri,
      name: heartbeatAudio.name,
      type: heartbeatAudio.type,
    } as unknown as Blob);
  }

  console.log('Booking Item:', bookingItemId);
  console.log('Result Data:', JSON.stringify(resultData, null, 2));
  console.log('ECG File:', ecgImage ?? null);
  console.log('Heartbeat Audio:', heartbeatAudio ?? null);
  console.log('FormData fields:', {
    booking_item_id: Boolean(bookingItemId),
    result_data: Boolean(resultDataJson),
    ecg_image: Boolean(ecgImage?.uri),
    heartbeat_audio: Boolean(heartbeatAudio?.uri),
  });
  console.log('Sending multipart request...');

  try {
    const res = await axiosInstance.post<PostAshaResultResponse>(path, formData);
    console.log('ASHA upload success:', res.data);
    return res.data ?? {};
  } catch (err) {
    const error = err as { response?: { data?: unknown }; message?: string };
    console.log('ASHA upload failed:', error.response?.data || error);
    throw err;
  }
}
