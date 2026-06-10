import axiosInstance, { BASE_URL, registerAxiosInstance, REGISTER_BASE_URL } from '../api/axiosInstance';
import { getLabUserId, getUserID } from '../Utils/storage';
import type { IdProofTypeApi, PickedFile } from './identityVerificationTypes';
export type { IdProofTypeApi, PickedFile } from './identityVerificationTypes';

export interface RegisterPayload {
  mobile: string;
  role: string;
  full_name: string;
  gender: string;
  age: number;
  email: string;
  service_scope?: string;
  center_id?: string;
}

export interface Center {
  id: string;
  name: string;
  city: string;
  district?: string;
  state?: string;
  pincode: string;
  latitude?: string;
  longitude?: string;
  open_time?: string;
  close_time?: string;
  created_at?: string;
}

export interface CentersResponse {
  success: boolean;
  message: string;
  data: Center[];
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  data: null;
}

/** POST /auth/otp/send — login OTP dispatch (and typical resend). */
export interface AuthOtpSendProvider {
  channel?: { sms?: string };
  description?: string;
  corelationId?: string | null;
  state?: string;
  transactionId?: string;
  statusCode?: number;
}

export interface AuthOtpSendResponse {
  success: boolean;
  message: string;
  data: {
    provider: AuthOtpSendProvider;
  };
}

export interface VerifyOtpPayload {
  mobile: string;
  otp: string;
}

export interface VerifiedUser {
  id: string;
  phone_number: string;
  full_name: string;
  email: string;
  role: string;
  gender: string;
  age: number;
  primary_center_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  provider: {
    sms: string;
    description: string;
    transactionId: string;
    statusCode: number;
  };
  user: VerifiedUser;
  token: string;
  refreshToken: string;
}

export const sendRegistrationOtp = async (
  payload: RegisterPayload,
): Promise<SendOtpResponse> => {
  // NOTE: registration OTP for partner app must use main API base (/api/v1).
  // `BASE_URL` already includes `/api/v1`, so keep the path API-relative here.
  const { data } = await axiosInstance.post<SendOtpResponse>('/auth/register/send-otp', payload);
  return data;
};

export const getCenters = async (): Promise<Center[]> => {
  const { data } = await axiosInstance.get<CentersResponse>('/centers');
  return Array.isArray(data?.data) ? data.data : [];
};

// for register new user in app
export const verifySmartpingOtp = async (payload: {
  mobile: string;
  otp: string;
}) => {
  const { data } = await axiosInstance.post(
    '/auth/loginWithSmartpingOtp',
    payload,
  );
  return data;
};

export const verifyRegistrationOtp = async (
  payload: VerifyOtpPayload,
): Promise<VerifyOtpResponse> => {
  const { data } = await axiosInstance.post<VerifyOtpResponse>(
    '/auth/register/verify-otp',
    payload,
  );
  return data;
};

export const resendRegistrationOtp = async (
  mobile: string,
): Promise<SendOtpResponse> => {
  const { data } = await axiosInstance.post<SendOtpResponse>(
    '/auth/register/resend-otp',
    { mobile },
  );
  return data;
};

/** POST /patients/send-otp — new patient registration (Health Soldier flow). */
export interface PatientSendOtpPayload {
  mobile: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
}

export const sendPatientRegistrationOtp = async (
  payload: PatientSendOtpPayload,
): Promise<SendOtpResponse> => {
  const { data } = await axiosInstance.post<SendOtpResponse>(
    '/patients/send-otp',
    payload,
  );
  return data;
};

export const resendPatientOtp = async (
  mobile: string,
): Promise<SendOtpResponse> => {
  const { data } = await axiosInstance.post<SendOtpResponse>(
    '/patients/resend-otp',
    { mobile },
  );
  return data;
};

/** POST /patients/verify-otp — align field names with your API if they differ. */
export interface PatientVerifyOtpResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: VerifiedUser;
}

export const verifyPatientOtp = async (
  payload: VerifyOtpPayload,
): Promise<PatientVerifyOtpResponse> => {
  const { data } = await axiosInstance.post<PatientVerifyOtpResponse>(
    '/patients/verify-otp',
    payload,
  );
  return data;
};

export const sendNewUserOtp = async (mobile: string): Promise<any> => {
  const { data } = await registerAxiosInstance.post('/register/send-otp', {
    mobile,
    receiveUpdates: true,
  });
  return data;
};

export const sendExistingUserOtpRegFlow = async (mobile: string): Promise<any> => {
  const { data } = await axiosInstance.post('/auth/otp/send', { mobile });
  return data;
};

export const verifyRegistrationOtpRegFlow = async (payload: {
  mobile: string;
  otp: string;
}): Promise<any> => {
  const { data } = await registerAxiosInstance.post('/register/verify-otp', payload);
  return data;
};

export const resendNewUserOtpRegFlow = async (mobile: string): Promise<any> => {
  const { data } = await registerAxiosInstance.post('/register/resend-otp', { mobile });
  return data;
};

export const resendExistingUserOtpRegFlow = async (mobile: string): Promise<any> => {
  const { data } = await axiosInstance.post('/auth/otp/resend', { mobile });
  return data;
};

export const sendLoginOtp = async (mobile: string): Promise<AuthOtpSendResponse> => {
  const { data } = await axiosInstance.post<AuthOtpSendResponse>('/auth/otp/send', {
    mobile,
  });
  return data;
};

/**
 * POST /api/v1/auth/otp/verify — normalizes token fields whether the API returns them
 * at the top level or under `data` (and refresh_token vs refreshToken).
 */
function parseLoginVerifyOtpResponse(raw: unknown): VerifyOtpResponse {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('verify-otp: invalid response body');
  }
  const r = raw as Record<string, unknown>;
  const inner = r.data != null && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : null;

  const token =
    typeof r.token === 'string'
      ? r.token
      : inner && typeof inner.token === 'string'
        ? inner.token
        : '';
  const refreshToken =
    typeof r.refreshToken === 'string'
      ? r.refreshToken
      : typeof r.refresh_token === 'string'
        ? r.refresh_token
        : inner && typeof inner.refreshToken === 'string'
          ? inner.refreshToken
          : inner && typeof inner.refresh_token === 'string'
            ? inner.refresh_token
            : '';

  const userRaw =
    (r.user != null && typeof r.user === 'object' ? r.user : null) ??
    (inner?.user != null && typeof inner.user === 'object' ? inner.user : null);

  const providerRaw =
    (r.provider != null && typeof r.provider === 'object' ? r.provider : null) ??
    (inner?.provider != null && typeof inner.provider === 'object' ? inner.provider : null);

  const defaultProvider: VerifyOtpResponse['provider'] = {
    sms: '',
    description: '',
    transactionId: '',
    statusCode: 0,
  };

  return {
    success: typeof r.success === 'boolean' ? r.success : true,
    message: typeof r.message === 'string' ? r.message : '',
    provider: (providerRaw as VerifyOtpResponse['provider']) ?? defaultProvider,
    user: userRaw as VerifiedUser,
    token,
    refreshToken,
  };
}

export const verifyLoginOtp = async (
  payload: VerifyOtpPayload,
): Promise<VerifyOtpResponse> => {
  const { data } = await axiosInstance.post<unknown>('/auth/otp/verify', payload);
  const parsed = parseLoginVerifyOtpResponse(data);
  return parsed;
};

export const resendLoginOtp = async (mobile: string): Promise<AuthOtpSendResponse> => {
  const { data } = await axiosInstance.post<AuthOtpSendResponse>('/auth/otp/send', {
    mobile,
  });
  return data;
};

export const resendExistingUserOtp = async (mobile: string): Promise<any> => {
  const { data } = await axiosInstance.post('/auth/otp/resend', { mobile });
  return data;
};

export interface CreateOrderPayload {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  keyId?: string;
  order?: {
    id: string;
    amount: number;
    currency?: string;
    [key: string]: any;
  };
}

// export const createRegistrationOrder = async (
//   payload: CreateOrderPayload,
// ): Promise<CreateOrderResponse> => {
//   const { data } = await registerAxiosInstance.post<CreateOrderResponse>(
//     '/register/create-order',
//     payload,
//   );
//   return data;
// };


export const createRegistrationOrder = async (payload: CreateOrderPayload) => {
  try {
    const { data } = await registerAxiosInstance.post(
      '/register/create-order',
      payload,
    );

    return data;
  } catch (error: any) {
    throw error;
  }
};

export interface ConfirmRegistrationPayload {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dob: string;
  gender: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  lab_user_id?: string;
}

export interface ConfirmRegistrationResponse {
  success: boolean;
  message: string;
  data?: {
    hasError: boolean;
    response?: {
      token?: string;
      refreshToken?: string;
      user?: {
        user_id: number | string;
        [key: string]: any;
      };
      [key: string]: any;
    };
  };
}

export const confirmRegistration = async (
  payload: ConfirmRegistrationPayload,
): Promise<ConfirmRegistrationResponse> => {
  const { data } = await registerAxiosInstance.post<ConfirmRegistrationResponse>(
    '/register/confirm',
    payload,
  );
  return data;
};

export interface AutopayInitPayload {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dob: string;
  gender: string;
}

export interface AutopayInitResponse {
  success: boolean;
  message: string;
  checkoutPayload?: {
    subscriptionId: string;
    customerId: string;
    keyId: string;
    [key: string]: any;
  };
}

export const initAutopay5 = async (
  payload: AutopayInitPayload,
): Promise<AutopayInitResponse> => {
  const { data } = await registerAxiosInstance.post<AutopayInitResponse>(
    '/register/autopay-5/init',
    payload,
  );
  return data;
};

export interface AutopayConfirmPayload {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dob: string;
  gender: string;
  customerId: string;
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_order_id?: string;
  lab_user_id?: string;
}

export interface AutopayConfirmResponse {
  success: boolean;
  state?: string;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: {
    user_id: number | string;
    [key: string]: any;
  };
  subscription?: { [key: string]: any };
  details?: { [key: string]: any };
}

export const confirmAutopay5 = async (
  payload: AutopayConfirmPayload,
): Promise<AutopayConfirmResponse> => {
  const { data } = await registerAxiosInstance.post<AutopayConfirmResponse>(
    '/register/autopay-5/confirm',
    payload,
  );
  return data;
};

export interface IdentityVerificationPayload {
  id_proof_type: IdProofTypeApi;
  id_number: string;
  document: PickedFile;
  technician_certificate?: PickedFile;
}

export type IdentityVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string;

export interface IdentityVerificationRecord {
  id: string;
  user_id: string;
  id_proof_type: string;
  id_number: string;
  document_url: string;
  technician_certificate_url?: string;
  verification_status: IdentityVerificationStatus;
  submitted?: boolean;
  is_approved?: boolean;
  created_at: string;
  updated_at: string;
}

export interface IdentityVerificationResponse {
  success: boolean;
  message: string;
  data?: IdentityVerificationRecord;
}

export const isApprovedIdentityVerification = (
  record: IdentityVerificationRecord | undefined | null,
): boolean => {
  if (!record) {
    return false;
  }
  const status = String(record.verification_status ?? '').toUpperCase();
  return status === 'APPROVED' || record.is_approved === true;
};

/** True when KYC documents were uploaded and await admin review (not a register stub). */
export const hasSubmittedIdentityVerification = (
  record: IdentityVerificationRecord | undefined | null,
): boolean => {
  if (!record) {
    return false;
  }
  if (record.submitted === true) {
    return true;
  }
  return Boolean(record.document_url?.trim());
};

const IDENTITY_VERIFICATION_ENDPOINTS = ['/identity-verification', '/lab/identity-verification'] as const;

/**
 * POST /identity-verification
 * - Body (multipart): id_proof_type, id_number, document
 * - Headers: Authorization Bearer <access>, x-refresh-token <refresh>
 */
export const submitIdentityVerification = async (
  payload: IdentityVerificationPayload,
): Promise<IdentityVerificationResponse> => {
  const formData = new FormData();

  formData.append('id_proof_type', payload.id_proof_type);
  formData.append('id_number', payload.id_number);
  formData.append('document', {
    uri: payload.document.uri,
    name: payload.document.name,
    type: payload.document.type,
  } as any);
  if (payload.technician_certificate) {
    formData.append('technician_certificate', {
      uri: payload.technician_certificate.uri,
      name: payload.technician_certificate.name,
      type: payload.technician_certificate.type,
    } as any);
  }

  const { data } = await axiosInstance.post<IdentityVerificationResponse>(
    '/identity-verification',
    formData,
    { timeout: 120_000 },
  );
  return data;
};

/** GET /identity-verification — current lab worker KYC/identity status. */
export const getIdentityVerificationStatus = async (): Promise<IdentityVerificationResponse> => {
  let lastError: unknown = null;
  for (const endpoint of IDENTITY_VERIFICATION_ENDPOINTS) {
    try {
      const { data } = await axiosInstance.get<IdentityVerificationResponse>(endpoint);
      const payload = data as IdentityVerificationResponse & {
        data?: IdentityVerificationRecord | IdentityVerificationRecord[];
      };
      if (Array.isArray(payload.data)) {
        const [labUserId, userId] = await Promise.all([getLabUserId(), getUserID()]);
        const currentUserId = labUserId ?? userId ?? null;
        const matched =
          (currentUserId
            ? payload.data.find(record => String(record?.user_id ?? '') === String(currentUserId))
            : undefined) ?? payload.data[0];
        return {
          ...payload,
          data: matched,
        };
      }
      return payload;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to fetch identity verification status');
};

/** CMS asset id for the identity verification “in progress” modal illustration. */
export const IDENTITY_VERIFICATION_MODAL_IMAGE_ID = 5;

/** CMS asset id for the login screen hero illustration (`title`: loginscreen). */
export const LOGIN_SCREEN_ILLUSTRATION_IMAGE_ID = 7;

export interface BackgroundImageRecord {
  id: number;
  title: string;
  description: string | null;
  s3_key: string;
  s3_url: string;
  mime_type: string;
  file_size: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackgroundImageResponse {
  success: boolean;
  message: string;
  data: BackgroundImageRecord;
}

/** GET /background-images/:id — returns presigned `s3_url` for the modal artwork. */
export const getBackgroundImageS3Url = async (imageId: number): Promise<string | null> => {
  const { data } = await axiosInstance.get<BackgroundImageResponse>(
    `/background-images/${imageId}`,
  );
  return data.success && data.data?.s3_url ? data.data.s3_url : null;
};
