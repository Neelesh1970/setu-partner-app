import { useCallback } from 'react';

const TRANSLATIONS: Record<string, string> = {
  'preventiveHealth.selectPatient.headerTitle': 'Select Patient',
  'preventiveHealth.selectPatient.heading': 'Who is this booking for?',
  'preventiveHealth.selectPatient.ctaContinue': 'Continue',
  'preventiveHealth.selectPatient.popupRemoveTitle': 'Remove patient?',
  'preventiveHealth.selectPatient.popupCancel': 'Cancel',
  'preventiveHealth.selectPatient.popupConfirm': 'Remove',
  'preventiveHealth.patientDetails.headerTitle': 'Patient Details',
  'preventiveHealth.patientDetails.labelFullName': 'Full Name',
  'preventiveHealth.patientDetails.placeholderFullName': 'Enter full name',
  'preventiveHealth.patientDetails.labelGender': 'Gender',
  'preventiveHealth.patientDetails.genderMale': 'Male',
  'preventiveHealth.patientDetails.genderFemale': 'Female',
  'preventiveHealth.patientDetails.genderTransgender': 'Transgender',
  'preventiveHealth.patientDetails.labelAge': 'Age',
  'preventiveHealth.patientDetails.placeholderAge': 'Enter age',
  'preventiveHealth.patientDetails.labelPhone': 'Phone Number',
  'preventiveHealth.patientDetails.phoneCountryCode': '+91',
  'preventiveHealth.patientDetails.placeholderPhone': 'Enter phone number',
  'preventiveHealth.patientDetails.labelEmail': 'Email (optional)',
  'preventiveHealth.patientDetails.placeholderEmail': 'Enter email address',
  'preventiveHealth.patientDetails.ctaContinue': 'Continue',
  'preventiveHealth.patientDetails.errors.fullNameRequired': 'Full name is required',
  'preventiveHealth.patientDetails.errors.genderRequired': 'Please select gender',
  'preventiveHealth.patientDetails.errors.ageRequired': 'Age is required',
  'preventiveHealth.patientDetails.errors.ageRange': 'Age must be between 1 and 100',
  'preventiveHealth.patientDetails.errors.phoneInvalid': 'Enter a valid 10-digit phone number',
  'preventiveHealth.patientDetails.errors.emailInvalid': 'Enter a valid email address',
};

export function useTranslation() {
  const t = useCallback((key: string) => TRANSLATIONS[key] ?? key, []);
  return { t };
}
