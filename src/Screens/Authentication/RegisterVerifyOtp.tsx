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
import { saveAuthData } from '../../Utils/storage';

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
        const res = await verifySmartpingOtp({ mobile, otp });
        const token = res?.token ?? res?.data?.token;
        const userID = res?.userID ?? res?.userId ?? res?.user_id ?? res?.data?.userID ?? res?.data?.userId ?? res?.data?.user_id ?? res?.user?.id;
        const refreshToken = res?.refreshToken ?? res?.data?.refreshToken;
        if (!token || !userID) {
          Alert.alert('Login Failed', 'Could not retrieve session. Please try again.');
          return;
        }
        await saveAuthData(token, String(userID), refreshToken);
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      } else {
        const res = await verifyRegistrationOtpRegFlow({ mobile, otp });
        const lab_user_id = res?.user?.id ?? '';
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDEDED" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.bottomCard}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit OTP sent to{'\n'}
              <Text style={styles.mobileText}>+91 {mobile}</Text>
            </Text>

            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
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
              autoFocus
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterVerifyOtp;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backBtn: {
    padding: 16,
  },
  backArrow: {
    fontSize: 24,
    color: '#222',
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
    width: 0,
    height: 0,
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
