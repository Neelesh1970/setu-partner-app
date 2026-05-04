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
import RegisterWithOtp from '../Screens/Authentication/RegisterWithOtp';
import RegisterVerifyOtp from '../Screens/Authentication/RegisterVerifyOtp';
import RegisterName from '../Screens/Authentication/RegisterName';
import RegisterDob from '../Screens/Authentication/RegisterDob';
import RegisterGender from '../Screens/Authentication/RegisterGender';
import RegisterPlans from '../Screens/Authentication/RegisterPlans';
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
import PreventivePayment from '../Screens/Home/PreventiveUser/PreventivePayment';
import PreventiveBookingSummary from '../Screens/Home/PreventiveUser/PreventiveBookingSummary';
import TestActivity from '../Screens/Home/PreventiveUser/TestActivity';
import TestDetails from '../Screens/Home/PreventiveUser/TestDetails';
import Reports from '../Screens/Home/PreventiveUser/Reports';
import Oxymeter from '../Screens/IOT/Oxymeter';
import { ScaleDeviceScreen } from '../Screens/IOT/ScaleDevice';
import { getAuthToken, getUser, getUserID } from '../Utils/storage';
import { navigationRef } from './navigationRef';
import type { VerifiedUser } from '../Services/authService';
import SplashScreen from '../Screens/Auth/SplashScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
        } else {
          dispatch(
            setSession({
              isAuthenticated: false,
              userId: null,
              user: null,
            }),
          );
        }
        setIsAuthenticated(ok);
      } catch {
        setIsAuthenticated(false);
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
        initialRouteName={isAuthenticated ? 'Home' : 'Welcome'}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
        <Stack.Screen name="IdentityVerification" component={IdentityVerificationScreen} />
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
        <Stack.Screen name="RegisterWithOtp" component={RegisterWithOtp} />
        <Stack.Screen name="RegisterVerifyOtp" component={RegisterVerifyOtp} />
        <Stack.Screen name="RegisterName" component={RegisterName} />
        <Stack.Screen name="RegisterDob" component={RegisterDob} />
        <Stack.Screen name="RegisterGender" component={RegisterGender} />
        <Stack.Screen name="RegisterPlans" component={RegisterPlans} />
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
        <Stack.Screen name="PreventivePayment" component={PreventivePayment} />
        <Stack.Screen name="PreventiveBookingSummary" component={PreventiveBookingSummary} />
        <Stack.Screen name="TestActivity" component={TestActivity} />
        <Stack.Screen name="TestDetails" component={TestDetails} />
        <Stack.Screen name="Reports" component={Reports} />
        <Stack.Screen name="Oxymeter" component={Oxymeter} />
        <Stack.Screen name="ScaleDevice" component={ScaleDeviceScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
