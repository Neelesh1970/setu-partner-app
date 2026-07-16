import axios from 'axios';
import { PREVENTIVE_BASE_URL } from '../../api/apiConfig';
import { registerAxiosInstance } from '../../api/axiosInstance';

const PREVENTIVE_API_BASE = `${PREVENTIVE_BASE_URL.replace(/\/$/, '')}/api/v1`;

/** REGISTER_BASE_URL — POST /otp/send */
export interface PatientAuthOtpSendPayload {
  mobile: string;
  appHash?: string;
}

export interface PatientAuthOtpProvider {
  transactionId?: number;
  state?: string;
  statusCode?: number;
  description?: string;
  pdu?: number;
}

export interface PatientAuthOtpSendResponse {
  success: boolean;
  message: string;
  data?: {
    provider?: PatientAuthOtpProvider;
  };
}

/** REGISTER_BASE_URL — POST /loginWithSmartpingOtp */
export interface PatientAuthLoginData {
  hasError?: boolean;
  message?: string;
  token?: string;
  refreshToken?: string;
  apiKey?: string | null;
  user_id?: number;
  uhid?: string;
  username?: string | null;
  first_name?: string;
  last_name?: string;
  patients?: unknown[];
}

export interface PatientAuthLoginResponse {
  success: boolean;
  message: string;
  data?: PatientAuthLoginData;
}

export const sendPatientAuthOtp = (payload: PatientAuthOtpSendPayload) =>
  registerAxiosInstance.post<PatientAuthOtpSendResponse>('/otp/send', {
    mobile: payload.mobile,
    appHash: payload.appHash ?? '',
  });

export const verifyPatientAuthOtp = (payload: { mobile: string; otp: string }) =>
  registerAxiosInstance.post<PatientAuthLoginResponse>('/loginWithSmartpingOtp', payload);

/** REGISTER_BASE_URL — POST /register/send-otp */
export interface PatientRegisterAuthOtpPayload {
  mobile: string;
  receiveUpdates?: boolean;
  appHash?: string;
}

export interface PatientRegisterAuthOtpResponse {
  success: boolean;
  message: string;
  data?: {
    provider?: PatientAuthOtpProvider;
  };
}

/** REGISTER_BASE_URL — POST /register/verify-otp */
export interface PatientRegisterVerifyUser {
  phone_number?: string;
  user_id?: number | string;
  id?: string;
}

export interface PatientRegisterVerifyResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: PatientRegisterVerifyUser;
  errors?: { provider?: { description?: string } };
  data?: {
    token?: string;
    refreshToken?: string;
    user?: PatientRegisterVerifyUser;
  };
}

export const sendPatientRegisterOtpAuth = (payload: PatientRegisterAuthOtpPayload) =>
  registerAxiosInstance.post<PatientRegisterAuthOtpResponse>('/register/send-otp', {
    mobile: payload.mobile,
    receiveUpdates: payload.receiveUpdates ?? false,
    appHash: payload.appHash ?? '',
  });

export const verifyPatientRegisterOtpAuth = (payload: { mobile: string; otp: string }) =>
  registerAxiosInstance.post<PatientRegisterVerifyResponse>('/register/verify-otp', payload);

/** REGISTER_BASE_URL — POST /register/autopay-5/confirm-trial-no-payment */
export interface RegisterPatientTrialPayload {
  phoneNumber: string;
  firstName: string;
  lastName: string;
}

export interface RegisterPatientTrialResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: PatientRegisterVerifyUser;
  data?: {
    token?: string;
    refreshToken?: string;
    user?: PatientRegisterVerifyUser;
  };
}

export const registerPatientTrial = (payload: RegisterPatientTrialPayload) =>
  registerAxiosInstance.post<RegisterPatientTrialResponse>(
    '/register/autopay-5/confirm-trial-no-payment',
    payload,
  );

/** PREVENTIVE_BASE_URL — legacy patient-auth register (unchanged). */
export interface PatientRegisterOtpPayload {
  mobile: string;
  name: string;
  last_name: string;
  gender: string;
  age: number;
  dob: string;
  email?: string;
}

export const sendPatientRegisterOtp = (payload: PatientRegisterOtpPayload) =>
  axios.post(`${PREVENTIVE_API_BASE}/patient-auth/register/send-otp`, payload);

export const verifyPatientRegisterOtp = (payload: { mobile: string; otp: string }) =>
  axios.post(`${PREVENTIVE_API_BASE}/patient-auth/register/verify-otp`, payload);
