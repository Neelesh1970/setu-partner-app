import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';
import { setSession } from '../store/authSlice';
import { RootStackParamList } from './types';
import WelcomeScreen from '../Screens/Auth/WelcomeScreen';
import LoginScreen from '../Screens/Auth/LoginScreen';
import RegisterScreen from '../Screens/Auth/RegisterScreen';
import OtpVerificationScreen from '../Screens/Auth/OtpVerificationScreen';
import IdentityVerificationScreen from '../Screens/Auth/IdentityVerificationScreen';
import VerificationPendingScreen from '../Screens/Auth/VerificationPendingScreen';
import HomeScreen from '../Screens/Home/HomeScreen';
import Profile from '../Screens/Home/PreventiveUser/Profile';
import MyWallet from '../Screens/Home/PreventiveUser/MyWallet';
import TransactionHistory from '../Screens/Home/PreventiveUser/TransactionHistory';
import NewUserRegistrationScreen from '../Screens/Home/NewUserRegistrationScreen';
import NewuserRegister from '../Screens/Authentication/NewuserRegister';
import TestHomeScreen from '../Screens/Test/TestHomeScreen';
import RegisterOtp from '../Screens/Authentication/RegisterOtp';
import UserDetailsScreen from '../Screens/Authentication/UserDetailsScreen';
import PremiumPrice from '../Screens/Authentication/PremiumPrice';
import RegisterLoginScreen from '../Screens/PreventiveHealth/NewAuth/Register_LoginScreen';
import PreventiveAuthLogin from '../Screens/PreventiveHealth/NewAuth/Login/Login';
import LoginOTP from '../Screens/PreventiveHealth/NewAuth/Login/LoginOTP';
import PreventiveAuthSignUp from '../Screens/PreventiveHealth/NewAuth/SignUp/SignUP';
import PreventiveAuthSignUpOTP from '../Screens/PreventiveHealth/NewAuth/SignUp/SignUpOTP';
import TrialScreen from '../Screens/PreventiveHealth/NewAuth/SignUp/TrialScreen';
import SignUP from '../Screens/PreventiveHealth/Auth/SignUP';
import SignUpOTP from '../Screens/PreventiveHealth/Auth/SignUpOTP';
import {
  LazyBloodPressure,
  LazyAshaDevice,
  LazyOxymeter,
  LazyPreventivePayment,
  LazyRemidioQRScanner,
  LazyReports,
  LazyScaleDevice,
  LazyTestActivity,
} from './lazyScreens';
import DashboardScreen from '../Screens/Authentication/DashboardScreen';
import PreventiveHealth from '../Screens/Home/PreventiveUser/PreventiveHealth';
import PreventiveHealthHeader from '../Screens/Home/PreventiveUser/PreventiveHealthHeader';
import HealthCheckupDevices from '../Screens/Home/PreventiveUser/HealthCheckupDevices';
import DeviceOverview from '../Screens/Home/PreventiveUser/DeviceOverview';
import HealthPackage from '../Screens/Home/PreventiveUser/HealthPackage';
import Screening from '../Screens/Home/PreventiveUser/Screening';
import HealthPackageOverview from '../Screens/Home/PreventiveUser/HealthPackageOverview';
import PreventiveCart from '../Screens/Home/PreventiveUser/PreventiveCart';
import PreventiveBookingDetail from '../Screens/Home/PreventiveUser/PreventiveBookingDetail';
import PreventiveCheckout from '../Screens/Home/PreventiveUser/PreventiveCheckout';
import PreventiveBookingSummary from '../Screens/Home/PreventiveUser/PreventiveBookingSummary';
import TestDetails from '../Screens/Home/PreventiveUser/TestDetails';
import CashPaymentReceive from '../Screens/Home/PreventiveUser/CashPaymentReceive';
import DeviceSelectScreen from '../Screens/Home/PreventiveUser/DeviceSelectScreen';
import GenvReportWaiting from '../Screens/Home/PreventiveUser/GenvReportWaiting';
import { COLORS } from '../Constants/theme';
import { getAuthToken, getUser, getUserID } from '../Utils/storage';
import { navigationRef } from './navigationRef';
import type { VerifiedUser } from '../Services/authService';
import {
  getIdentityVerificationStatus,
  isApprovedIdentityVerification,
  hasSubmittedIdentityVerification,
} from '../Services/authService';
import SplashScreen from '../Screens/Auth/SplashScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList>('Welcome');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const [token, userID] = await Promise.all([getAuthToken(), getUserID()]);
        const ok = Boolean(token && userID);
        if (ok) {
          const user = await getUser<VerifiedUser>();
          dispatch(
            setSession({
              isAuthenticated: true,
              userId: userID,
              user: user ?? null,
            }),
          );
          try {
            const verification = await getIdentityVerificationStatus();
            const record = verification?.data;
            if (isApprovedIdentityVerification(record)) {
              setInitialRouteName('Home');
            } else if (hasSubmittedIdentityVerification(record)) {
              setInitialRouteName('VerificationPending');
            } else if (record) {
              setInitialRouteName('IdentityVerification');
            } else {
              // No verification record: user is already authenticated (token exists),
              // so go to Home.
              setInitialRouteName('Home');
            }
          } catch {
            // Status check failed: token exists so user is authenticated — go to Home.
            setInitialRouteName('Home');
          }
        } else {
          dispatch(
            setSession({
              isAuthenticated: false,
              userId: null,
              user: null,
            }),
          );
          setInitialRouteName('Welcome');
        }
      } catch {
        setInitialRouteName('Welcome');
        dispatch(setSession({ isAuthenticated: false, userId: null, user: null }));
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [dispatch]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={initialRouteName}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
        <Stack.Screen name="IdentityVerification" component={IdentityVerificationScreen} />
        <Stack.Screen name="VerificationPending" component={VerificationPendingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={Profile} />
        <Stack.Screen name="MyWallet" component={MyWallet} />
        <Stack.Screen name="TransactionHistory" component={TransactionHistory} />
        <Stack.Screen name="NewUserRegistration" component={NewUserRegistrationScreen} />
        <Stack.Screen name="NewuserRegister" component={NewuserRegister} />
        <Stack.Screen name="TestHome" component={TestHomeScreen} />
        <Stack.Screen name="RegisterOtp" component={RegisterOtp} />
        <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
        <Stack.Screen name="PremiumPrice" component={PremiumPrice} />
        <Stack.Screen name="RegisterLoginScreen" component={RegisterLoginScreen} />
        <Stack.Screen name="PreventiveAuthLogin" component={PreventiveAuthLogin} />
        <Stack.Screen name="LoginOTP" component={LoginOTP} />
        <Stack.Screen name="PreventiveAuthSignUp" component={PreventiveAuthSignUp} />
        <Stack.Screen name="PreventiveAuthSignUpOTP" component={PreventiveAuthSignUpOTP} />
        <Stack.Screen name="TrialScreen" component={TrialScreen} />
        <Stack.Screen name="BenefitScreen" component={PreventiveHealth} />
        <Stack.Screen name="SignUp" component={SignUP} />
        <Stack.Screen name="SignUpOTP" component={SignUpOTP} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="PreventiveHealth" component={PreventiveHealth} />
        <Stack.Screen name="PreventiveHealthHeader" component={PreventiveHealthHeader} />
        <Stack.Screen name="HealthCheckupDevices" component={HealthCheckupDevices} />
        <Stack.Screen name="DeviceOverview" component={DeviceOverview} />
        <Stack.Screen name="HealthPackage" component={HealthPackage} />
        <Stack.Screen name="Screening" component={Screening} />
        <Stack.Screen name="HealthPackageOverview" component={HealthPackageOverview} />
        <Stack.Screen name="PreventiveCart" component={PreventiveCart} />
        <Stack.Screen name="PreventiveBookingDetail" component={PreventiveBookingDetail} />
        <Stack.Screen name="PreventiveCheckout" component={PreventiveCheckout} />
        <Stack.Screen name="PreventivePayment" component={LazyPreventivePayment} />
        <Stack.Screen name="PreventiveBookingSummary" component={PreventiveBookingSummary} />
        <Stack.Screen name="TestActivity" component={LazyTestActivity} />
        <Stack.Screen name="TestDetails" component={TestDetails} />
        <Stack.Screen name="Reports" component={LazyReports} />
        <Stack.Screen name="CashPaymentReceive" component={CashPaymentReceive} />
        <Stack.Screen
          name="Oxymeter"
          component={LazyOxymeter}
          options={{
            statusBarStyle: 'light',
            statusBarBackgroundColor: COLORS.PRIMARY,
          }}
        />
        <Stack.Screen name="ScaleDevice" component={LazyScaleDevice} />
        <Stack.Screen name="RemidioQRScanner" component={LazyRemidioQRScanner} />
        <Stack.Screen name="BloodPressure" component={LazyBloodPressure} />
        <Stack.Screen name="AshaDevice" component={LazyAshaDevice} />
        <Stack.Screen name="DeviceSelect" component={DeviceSelectScreen} />
        <Stack.Screen name="GenvReportWaiting" component={GenvReportWaiting} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
