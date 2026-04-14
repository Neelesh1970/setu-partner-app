import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import WelcomeScreen from '../Screens/Auth/WelcomeScreen';
import LoginScreen from '../Screens/Auth/LoginScreen';
import RegisterScreen from '../Screens/Auth/RegisterScreen';
import OtpVerificationScreen from '../Screens/Auth/OtpVerificationScreen';
import IdentityVerificationScreen from '../Screens/Auth/IdentityVerificationScreen';
import HomeScreen from '../Screens/Home/HomeScreen';
import NewUserRegistrationScreen from '../Screens/Home/NewUserRegistrationScreen';
import TestHomeScreen from '../Screens/Test/TestHomeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
        <Stack.Screen name="IdentityVerification" component={IdentityVerificationScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="NewUserRegistration"
          component={NewUserRegistrationScreen}
        />
        <Stack.Screen name="TestHome" component={TestHomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
