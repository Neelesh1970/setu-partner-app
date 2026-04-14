import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PrimaryButton from '../../Components/Button/PrimaryButton';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';
import { RootStackParamList } from '../../navigation/types';
import {
  getBackgroundImageS3Url,
  LOGIN_SCREEN_ILLUSTRATION_IMAGE_ID,
  sendLoginOtp,
} from '../../Services/authService';

type LoginNavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const PHONE_LENGTH = 10;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginNavProp>();
  const [phoneDigits, setPhoneDigits] = useState('');
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = await getBackgroundImageS3Url(LOGIN_SCREEN_ILLUSTRATION_IMAGE_ID);
        if (mounted && url) {
          setHeroUrl(url);
        }
      } finally {
        if (mounted) {
          setHeroLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onChangePhone = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, PHONE_LENGTH);
    setPhoneDigits(digits);
  };

  const handleContinue = async () => {
    if (phoneDigits.length !== PHONE_LENGTH) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setSubmitting(true);
    try {
      await sendLoginOtp(phoneDigits);
      navigation.navigate('OtpVerification', { mobile: phoneDigits, authFlow: 'login' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not send OTP. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.WHITE} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>
            Login to manage patients, perform tests, and track your earnings
          </Text>

          <View style={styles.heroWrap}>
            {heroUrl ? (
              <Image source={{ uri: heroUrl }} style={styles.heroImage} resizeMode="contain" />
            ) : heroLoading ? (
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            ) : (
              <View style={styles.heroPlaceholder} />
            )}
          </View>

          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.prefix}>+91</Text>
            <View style={styles.prefixDivider} />
            <TextInput
              style={styles.phoneInput}
              value={phoneDigits}
              onChangeText={onChangePhone}
              placeholder="00000 00000"
              placeholderTextColor={COLORS.PLACEHOLDER}
              keyboardType="number-pad"
              maxLength={PHONE_LENGTH}
              textContentType="telephoneNumber"
              autoComplete="tel"
            />
          </View>

          <PrimaryButton
            title="Continue"
            onPress={handleContinue}
            loading={submitting}
            disabled={phoneDigits.length !== PHONE_LENGTH}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.XL,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.SM,
    marginBottom: SPACING.MD,
  },
  backArrow: {
    fontSize: 28,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '300',
  },
  title: {
    fontSize: FONT_SIZE.XXL,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  subtitle: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.LG,
    paddingHorizontal: SPACING.SM,
  },
  heroWrap: {
    minHeight: 220,
    maxHeight: 320,
    marginVertical: SPACING.MD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: 280,
  },
  heroPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#F0F2F8',
  },
  label: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
    marginTop: SPACING.SM,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: SPACING.LG,
  },
  prefix: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  prefixDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.BORDER,
    marginLeft: 12,
    marginRight: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: FONT_SIZE.LG,
    color: COLORS.TEXT_PRIMARY,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
});
