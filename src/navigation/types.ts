export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  OtpVerification: {
    mobile: string;
    authFlow?: 'register' | 'login' | 'patientRegister';
  };
  IdentityVerification: undefined;
  Home: undefined;
  NewUserRegistration: undefined;
  TestHome: undefined;
};
