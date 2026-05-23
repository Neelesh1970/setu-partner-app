import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import {
  verifySmartpingOtp,
  verifyRegistrationOtpRegFlow,
  resendExistingUserOtpRegFlow,
  resendNewUserOtpRegFlow,
} from '../../Services/authService';
import { saveRegisteredPatientAuthData, getLabUserId } from '../../Utils/storage';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RegisterVerifyOtp'>;
type Route = RouteProp<RootStackParamList, 'RegisterVerifyOtp'>;

const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 30;

const RegisterVerifyOtp: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { mobile, alreadyRegistered } = route.params;

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let isNavigating = false;

    const handleBack = () => {
      if (isNavigating) return true;
      isNavigating = true;
      navigation.replace("RegisterWithOtp");
      return true;
    };

    let backSub: any;
    if (Platform.OS === "android") {
      backSub = BackHandler.addEventListener("hardwareBackPress", handleBack);
    }

    return () => {
      backSub?.remove();
    };
  }, [navigation]);

  useEffect(() => {
    if (resendTimer <= 0) { return; }
    const id = setInterval(() => setResendTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const handleOtpChange = (text: string) => {
    setOtp(text.replace(/\D/g, '').slice(0, OTP_LENGTH));
  };

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      if (alreadyRegistered) {
        console.log('[RegisterVerifyOtp] alreadyRegistered=true — verifying existing patient OTP');
        const res = await verifySmartpingOtp({ mobile, otp });
        const token = res?.token ?? res?.data?.token;
        const userID = res?.userID ?? res?.userId ?? res?.user_id ?? res?.data?.userID ?? res?.data?.userId ?? res?.data?.user_id ?? res?.user?.id;
        const refreshToken = res?.refreshToken ?? res?.data?.refreshToken;
        console.log('[RegisterVerifyOtp] alreadyRegistered — token:', token ? 'present' : 'MISSING', '| userID:', userID);
        if (!token || !userID) {
          Alert.alert('Login Failed', 'Could not retrieve session. Please try again.');
          return;
        }
        // Save ONLY to patient-specific keys — do NOT touch lab worker's AUTH_TOKEN/REFRESH_TOKEN.
        await saveRegisteredPatientAuthData(token, String(userID), refreshToken);
        console.log('[RegisterVerifyOtp] alreadyRegistered — patient auth saved, navigating to PreventiveHealth');
        navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'PreventiveHealth' }] });
      } else {
        console.log('[RegisterVerifyOtp] New user OTP verified — reading stored lab_user_id');
        const res = await verifyRegistrationOtpRegFlow({ mobile, otp });
        // Use the lab worker's own stored ID (set during login/register OTP).
        // Do NOT use res?.user?.id here — that belongs to the new patient, not the lab worker.
        const lab_user_id = (await getLabUserId()) ?? '';
        console.log('[RegisterVerifyOtp] lab_user_id from storage:', lab_user_id || 'EMPTY — lab worker may not have logged in via OTP flow');
        navigation.navigate('RegisterName', { mobile, lab_user_id });
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resendLoading) { return; }
    setResendLoading(true);
    try {
      if (alreadyRegistered) {
        await resendExistingUserOtpRegFlow(mobile);
      } else {
        await resendNewUserOtpRegFlow(mobile);
      }
      setResendTimer(RESEND_TIMEOUT);
      setOtp('');
      Alert.alert('OTP Sent', 'A new OTP has been sent to your mobile number.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const otpBoxes = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] ?? '');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            showBack
            title=""
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>
      <SafeAreaView edges={['bottom']} style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.bottomCard}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit OTP sent to{'\n'}
              <Text style={styles.mobileText}>+91 {mobile}</Text>
            </Text>

            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                inputRef.current?.blur();
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 50);
              }}
              style={styles.otpRow}
            >
              {otpBoxes.map((digit, i) => (
                <View
                  key={i}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                >
                  <Text style={styles.otpDigit}>{digit}</Text>
                </View>
              ))}
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              value={otp}
              onChangeText={handleOtpChange}
              maxLength={OTP_LENGTH}
              // autoFocus
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendRow}>
              {resendTimer > 0 ? (
                <Text style={styles.resendTimer}>
                  Resend OTP in <Text style={styles.resendTimerBold}>{resendTimer}s</Text>
                </Text>
              ) : resendLoading ? (
                <ActivityIndicator size="small" color="#2F3DBD" />
              ) : (
                <TouchableOpacity onPress={handleResend}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default RegisterVerifyOtp;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  headerShell: {
    backgroundColor: '#1C39BB',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: '#1C39BB',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  bottomCard: {
    marginTop: 'auto',
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    color: '#666',
    fontSize: 14,
    lineHeight: 22,
  },
  mobileText: {
    fontWeight: '700',
    color: '#2F3DBD',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  otpBox: {
    width: 46,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  otpBoxFilled: {
    borderColor: '#2F3DBD',
    backgroundColor: '#EEF0FB',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  button: {
    marginTop: 28,
    backgroundColor: '#2F3DBD',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  resendRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendTimer: {
    color: '#888',
    fontSize: 13,
  },
  resendTimerBold: {
    fontWeight: '700',
    color: '#2F3DBD',
  },
  resendLink: {
    color: '#2F3DBD',
    fontWeight: '600',
    fontSize: 14,
  },
});
