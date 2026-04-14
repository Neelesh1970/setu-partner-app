import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import ScreenHeader from '../../Components/ScreenHeader/ScreenHeader';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import {
  verifyRegistrationOtp,
  resendRegistrationOtp,
  verifyLoginOtp,
  resendLoginOtp,
} from '../../Services/authService';
import { saveAuthTokens, saveUser } from '../../Utils/storage';

type OtpNavProp = NativeStackNavigationProp<RootStackParamList, 'OtpVerification'>;
type OtpRouteProp = RouteProp<RootStackParamList, 'OtpVerification'>;

const OTP_LENGTH = 6;

const OtpVerificationScreen: React.FC = () => {
  const navigation = useNavigation<OtpNavProp>();
  const route = useRoute<OtpRouteProp>();
  const { mobile, authFlow = 'register' } = route.params;
  const isPatientRegister = authFlow === 'patientRegister';

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) {return;}

    const updated = [...otp];
    updated[index] = value;
    setOtp(updated);

    if (value && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length < OTP_LENGTH) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      if (isPatientRegister) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'TestHome' }],
        });
        return;
      }

      const response =
        authFlow === 'login'
          ? await verifyLoginOtp({ mobile, otp: otpCode })
          : await verifyRegistrationOtp({ mobile, otp: otpCode });
      console.log('[OtpVerificationScreen] verify-otp response:', response);

      await saveAuthTokens(response.token, response.refreshToken);
      await saveUser(response.user);

      if (authFlow === 'login') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        navigation.navigate('IdentityVerification');
      }
    } catch (error: any) {
      console.log('[OtpVerificationScreen] verify-otp error:', error);
      Alert.alert('Error', error?.message ?? 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (isPatientRegister) {
      Alert.alert(
        'Test flow',
        'No SMS is sent in this build. Enter any 6 digits and tap Verify to continue.',
      );
      return;
    }
    try {
      const response =
        authFlow === 'login'
          ? await resendLoginOtp(mobile)
          : await resendRegistrationOtp(mobile);
      console.log('[OtpVerificationScreen] resend-otp response:', response);
      Alert.alert('OTP Resent', response.message ?? `A new OTP has been sent to +91 ${mobile}`);
    } catch (error: any) {
      console.log('[OtpVerificationScreen] resend-otp error:', error);
      Alert.alert('Error', error?.message ?? 'Failed to resend OTP. Please try again.');
    }
  };

  const maskedMobile = `+91 XXXXXX${mobile.slice(-4)}`;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="OTP Verification" />

      <View style={styles.container}>
        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Enter OTP</Text>
          <Text style={styles.infoSubtitle}>
          Enter the code we just sent to your phone
          </Text>
          <Text style={styles.mobileText}>{maskedMobile}</Text>
        </View>

        {/* OTP Boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => { inputs.current[index] = ref; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={value => handleChange(value, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive the OTP? </Text>
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.resendLink}>Resend OTP</Text>
          </TouchableOpacity>
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default OtpVerificationScreen;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBackground: {
    backgroundColor: '#1A49AB',
    paddingBottom: 25,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backButton: {
    marginRight: 15,
  },
  backArrow: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 10,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  mobileText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A49AB',
    marginTop: 4,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#D9D9D9',
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1E1E',
    backgroundColor: '#FAFAFA',
  },
  otpBoxFilled: {
    borderColor: '#1A49AB',
    backgroundColor: '#EEF1FF',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  resendLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  resendLink: {
    fontSize: 14,
    color: '#1A49AB',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#1A49AB',
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
