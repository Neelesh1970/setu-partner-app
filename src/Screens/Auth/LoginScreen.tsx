import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';
import { RootStackParamList } from '../../navigation/types';
import axiosInstance from '../../api/axiosInstance';
import { sendLoginOtp } from '../../Services/authService';

type LoginNavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

type BackgroundImageItem = {
  id: number;
  title: string;
  s3_url?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
};

type BackgroundImagesResponse = {
  success?: boolean;
  data?: BackgroundImageItem[];
};

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
        const res = await axiosInstance.get<BackgroundImagesResponse>('background-images');
        const list = res.data?.data;
        if (!Array.isArray(list) || !mounted) {
          return;
        }
        const entry = list.find(
          item =>
            item.title === 'welcome' &&
            item.is_active !== false &&
            item.is_deleted !== true,
        );
        const url = entry?.s3_url?.trim();
        if (url && mounted) {
          setHeroUrl(url);
        }
      } catch {
        // keep empty hero / placeholder
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
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY} />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader title="Login" showBack={true} />
        </SafeAreaView>
      </View>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.scrollInner}>
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

              <View style={styles.bottomSpacer} />

              <View style={styles.formSection}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.phoneRow}>
                  <Text style={styles.prefix}>+91</Text>
                  <View style={styles.prefixDivider} />
                  <TextInput
                    style={styles.phoneInput}
                    value={phoneDigits}
                    onChangeText={onChangePhone}
                    placeholder="00000 - 00000"
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
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default LoginScreen;
const RADIUS_LG = 20;


const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  headerShell: {
    backgroundColor: COLORS.PRIMARY,
    borderBottomLeftRadius: RADIUS_LG,
    borderBottomRightRadius: RADIUS_LG,
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: COLORS.PRIMARY,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.LG,
    paddingTop: SPACING.MD,
  },
  scrollInner: {
    flexGrow: 1,
    width: '100%',
  },
  bottomSpacer: {
    flexGrow: 1,
    minHeight: 12,
  },
  formSection: {
    width: '100%',
    alignSelf: 'stretch',
    paddingBottom: SPACING.SM,
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
    minHeight: 248,
    maxHeight: 360,
    marginTop: SPACING.SM,
    marginBottom: SPACING.SM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: 312,
  },
  heroPlaceholder: {
    width: '100%',
    height: 228,
    borderRadius: 16,
    backgroundColor: '#F0F2F8',
  },
  label: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
    alignSelf: 'flex-start',
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
    alignSelf: 'stretch',
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
