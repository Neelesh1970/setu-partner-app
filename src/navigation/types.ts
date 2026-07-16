import type { RawDeviceItem, RawPackageItem } from '../Screens/Home/PreventiveUser/PreventiveHealthAPI';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  OtpVerification: {
    mobile: string;
    authFlow?: 'register' | 'login' | 'patientRegister';
  };
  IdentityVerification: undefined;
  VerificationPending: undefined;
  Home: undefined;
  Profile: undefined;
  MyWallet: undefined;
  TransactionHistory: undefined;
  NewUserRegistration: undefined;
  NewuserRegister: undefined;
  TestHome: undefined;
  RegisterLoginScreen: undefined;
  PreventiveAuthLogin: undefined;
  LoginOTP: { mobile: string };
  PreventiveAuthSignUp: undefined;
  PreventiveAuthSignUpOTP: {
    mobile: string;
    registrationData: { mobile: string };
  };
  TrialScreen: { mobile: string };
  BenefitScreen: undefined;
  SignUp: undefined;
  SignUpOTP: {
    mobile: string;
    registrationData: {
      mobile: string;
      name: string;
      last_name: string;
      gender: string;
      age: number;
      dob: string;
    };
  };
  RegisterOtp: { mobile: string };
  UserDetails: undefined;
  PremiumPrice: undefined;
  Dashboard: undefined;
  PreventiveHealth: undefined;
  PreventiveHealthHeader: undefined;
  HealthCheckupDevices: undefined;
  DeviceOverview: { deviceData: any };
  HealthPackage: undefined;
  Screening: undefined;
  HealthPackageOverview: { packageId: string };
  PreventiveCart: undefined;
  PreventiveBookingDetail: undefined;
  PreventiveCheckout: { bookingId?: string } | undefined;
  PreventivePayment: { bookingId: string; amountPayable?: number } | undefined;
  PreventiveBookingSummary: { bookingId: string } | undefined;
  TestActivity: {
    initialTab?: 'upcoming' | 'completed' | 'pending' | 'missed';
  };
  TestDetails: {
    patientId: string;
    filter: 'upcoming' | 'completed' | 'pending' | 'missed';
  };
  Reports: { bookingId?: string | null } | undefined;
  CashPaymentReceive: { bookingId: string; amount?: number | null };
  Oxymeter:
    | {
        /** Backend device id (uuid) used to map to supported integrations. */
        deviceId?: string | null;
        /** Backend device name / displayed name used for fallback error message. */
        deviceName?: string | null;
        /** Matching `booking_items.id` for this device — posted as `booking_item_id`. */
        bookingItemId?: string | null;
        /** Top-level booking id — used for PDF report generation after result is submitted. */
        bookingId?: string | null;
        /** True when opened from DeviceSelectScreen (multi-device booking). PDF is handled by DeviceSelect. */
        isMultiDevice?: boolean;
      }
    | undefined;
  ScaleDevice:
    | {
        deviceId?: string | null;
        bookingItemId?: string | null;
        bookingId?: string | null;
        /** True when opened from DeviceSelectScreen (multi-device booking). PDF is handled by DeviceSelect. */
        isMultiDevice?: boolean;
      }
    | undefined;
  RemidioQRScanner:
    | {
        /** Backend device id (uuid) used to map to supported integrations. */
        deviceId?: string | null;
        /** Backend device name / displayed name used for fallback error message. */
        deviceName?: string | null;
        /** Matching `booking_items.id` for this device — posted as `booking_item_id`. */
        bookingItemId?: string | null;
        /** Top-level booking id — used for PDF report generation after QR result is submitted. */
        bookingId?: string | null;
        /** True when opened from DeviceSelectScreen (multi-device booking). PDF is handled by DeviceSelect. */
        isMultiDevice?: boolean;
      }
    | undefined;
  BloodPressure:
    | {
        deviceId?: string | null;
        deviceName?: string | null;
        bookingItemId?: string | null;
        bookingId?: string | null;
        isMultiDevice?: boolean;
      }
    | undefined;
  DeviceSelect: {
    patientName?: string;
    bookingId: string | null;
    devices?: RawDeviceItem[];
    packages?: RawPackageItem[];
    /** Set by IOT screens after a successful save in multi-device flow.
     *  Only this field is passed on navigate-back — devices/packages are preserved via param merge. */
    completedBookingItemId?: string | null;
  };
  AshaDevice:
    | {
        deviceId?: string | null;
        bookingItemId?: string | null;
        bookingId?: string | null;
        isMultiDevice?: boolean;
      }
    | undefined;
  GenvReportWaiting: { bookingId?: string } | undefined;
};
