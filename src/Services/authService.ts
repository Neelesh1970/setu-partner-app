import axiosInstance, { BASE_URL } from '../api/axiosInstance';
import type { IdProofTypeApi, PickedFile } from './identityVerificationTypes';

export type { IdProofTypeApi, PickedFile } from './identityVerificationTypes';

export interface RegisterPayload {
  mobile: string;
  role: string;
  full_name: string;
  gender: string;
  age: number;
  email: string;
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
  const { data } = await axiosInstance.post<SendOtpResponse>(
    '/auth/register/send-otp',
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

export const sendLoginOtp = async (mobile: string): Promise<AuthOtpSendResponse> => {
  const { data } = await axiosInstance.post<AuthOtpSendResponse>('/auth/otp/send', {
    mobile,
  });
  return data;
};

export const verifyLoginOtp = async (
  payload: VerifyOtpPayload,
): Promise<VerifyOtpResponse> => {
  const { data } = await axiosInstance.post<VerifyOtpResponse>(
    '/auth/otp/verify',
    payload,
  );
  return data;
};

export const resendLoginOtp = async (mobile: string): Promise<AuthOtpSendResponse> => {
  const { data } = await axiosInstance.post<AuthOtpSendResponse>('/auth/otp/send', {
    mobile,
  });
  return data;
};

export interface IdentityVerificationPayload {
  id_proof_type: IdProofTypeApi;
  id_number: string;
  document: PickedFile;
}

export type IdentityVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string;

export interface IdentityVerificationRecord {
  id: string;
  user_id: string;
  id_proof_type: string;
  id_number: string;
  document_url: string;
  verification_status: IdentityVerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface IdentityVerificationResponse {
  success: boolean;
  message: string;
  data?: IdentityVerificationRecord;
}

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

  console.log('[identity-verification] POST multipart/form-data', {
    url: `${BASE_URL}/identity-verification`,
    id_proof_type: payload.id_proof_type,
    id_number: payload.id_number,
    document: {
      name: payload.document.name,
      type: payload.document.type,
      uri: payload.document.uri,
    },
  });

  const { data } = await axiosInstance.post<IdentityVerificationResponse>(
    '/identity-verification',
    formData,
    { timeout: 120_000 },
  );
  return data;
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
