import axios from 'axios';
import { PREVENTIVE_BASE_URL } from '../../api/apiConfig';

const PREVENTIVE_API_BASE = `${PREVENTIVE_BASE_URL.replace(/\/$/, '')}/api/v1`;

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
