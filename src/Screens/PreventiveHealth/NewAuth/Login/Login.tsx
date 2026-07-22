import React, { useCallback, useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import DynamicModal from '../../Components/DynamicModal';
import CustomPopup from '../../../../Components/ReusableComponents/CustomPopup';
import {
  sendPatientAuthOtp,
  sendPatientRegisterOtpAuth,
} from '../../../../features/PreventiveHealth/PreventiveAPI';
import type { RootStackParamList } from '../../../../navigation/types';

const BACKGROUND_IMAGE = require('../../../../assets/WelcomeBG.png');

const REFERENCE_SCREEN_WIDTH = 393;
const REFERENCE_CARD_WIDTH =
  REFERENCE_SCREEN_WIDTH - (32 * REFERENCE_SCREEN_WIDTH) / 350;
const TABLET_BREAKPOINT = 600;
const BUTTON_COLOR = '#1C39BB';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PreventiveAuthLogin'>;

type PopupConfig = {
  title: string;
  message: string;
  iconName: string;
  iconColor: string;
  onConfirm: () => void;
};

type ApiErrorShape = {
  response?: { data?: { message?: string } };
  message?: string;
};

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

const extractApiMessage = (error: ApiErrorShape): string | undefined =>
  error?.response?.data?.message || error?.message;

const isMobileAlreadyVerifiedMessage = (message?: string | null): boolean => {
  const normalized = String(message ?? '').trim().toLowerCase();
  return (
    normalized === 'mobile number is already verified' ||
    normalized.includes('already verified')
  );
};

const isMobileAlreadyRegisteredMessage = (message?: string | null): boolean => {
  const normalized = String(message ?? '').trim().toLowerCase();
  return (
    normalized === 'mobile number is already registered' ||
    normalized.includes('already registered')
  );
};

const navigateToVerifiedNameFlow = (
  navigation: Nav,
  mobile: string,
): void => {
  console.log('======================================');
  console.log('[PreventiveAuthLogin] FLOW DECISION');
  console.log('Branch: already verified user');
  console.log('Next Screen: TrialScreen');
  console.log('Next Step: First Name -> Last Name -> Login');
  console.log('Mobile:', mobile);
  console.log('======================================');

  navigation.navigate('TrialScreen', {
    mobile,
    flowType: 'login',
  });
};

const navigateToLoginOtpFlow = async (
  navigation: Nav,
  mobile: string,
): Promise<boolean> => {
  console.log('======================================');
  console.log('[PreventiveAuthLogin] FLOW DECISION');
  console.log('Branch: already registered user');
  console.log('Action: send login OTP');
  console.log('Mobile:', mobile);
  console.log('======================================');

  const loginOtpResponse = await sendPatientAuthOtp({ mobile });
  const loginOtpData = loginOtpResponse?.data;

  console.log('======================================');
  console.log('[PreventiveAuthLogin] LOGIN SEND OTP RESPONSE');
  console.log(JSON.stringify(loginOtpData, null, 2));
  console.log('Success:', loginOtpData?.success);
  console.log('Message:', loginOtpData?.message);
  console.log('Provider:', loginOtpData?.data?.provider);
  console.log('======================================');

  if (loginOtpData?.success) {
    console.log('======================================');
    console.log('[PreventiveAuthLogin] FLOW DECISION');
    console.log('Branch: existing registered user');
    console.log('Next Screen: LoginOTP');
    console.log('Next Step: OTP -> Login');
    console.log('Mobile:', mobile);
    console.log('======================================');

    navigation.navigate('LoginOTP', { mobile });
    return true;
  }

  return false;
};

const PreventiveAuthLogin: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [phoneDigits, setPhoneDigits] = useState('');
  const [showError, setShowError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupConfig, setPopupConfig] = useState<PopupConfig>({
    title: '',
    message: '',
    iconName: 'checkmark-circle',
    iconColor: BUTTON_COLOR,
    onConfirm: () => {},
  });

  const statusBarInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  const cardWidth =
    screenWidth >= TABLET_BREAKPOINT
      ? REFERENCE_CARD_WIDTH
      : screenWidth - scale(32);

  const cardHeight = verticalScale(250);
  const loginTabOverlap = verticalScale(16);
  const totalCardBlockHeight = cardHeight + loginTabOverlap;
  const availableHeight =
    screenHeight - statusBarInset - insets.bottom - verticalScale(16);
  const cardTopPadding =
    statusBarInset +
    verticalScale(30) +
    Math.max(
      verticalScale(72),
      (availableHeight - totalCardBlockHeight) * 0.42,
    );

  const closePopup = useCallback(() => {
    setPopupVisible(false);
  }, []);

  const showPopup = useCallback((config: PopupConfig) => {
    setPopupConfig(config);
    setPopupVisible(true);
  }, []);

  const handleContinue = useCallback(async () => {
    if (phoneDigits.length !== 10) {
      setShowError(true);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('======================================');
      console.log('[PreventiveAuthLogin] REGISTER SEND OTP REQUEST');
      console.log('Mobile:', phoneDigits);

      const registerOtpResponse = await sendPatientRegisterOtpAuth({
        mobile: phoneDigits,
      });
      const registerOtpData = registerOtpResponse?.data;

      console.log('[PreventiveAuthLogin] REGISTER SEND OTP RESPONSE');
      console.log(JSON.stringify(registerOtpData, null, 2));
      console.log('Success:', registerOtpData?.success);
      console.log('Message:', registerOtpData?.message);
      console.log('Provider:', registerOtpData?.data?.provider);
      console.log('======================================');

      if (isMobileAlreadyVerifiedMessage(registerOtpData?.message)) {
        navigateToVerifiedNameFlow(navigation, phoneDigits);
        return;
      }

      if (isMobileAlreadyRegisteredMessage(registerOtpData?.message)) {
        const loginOtpSent = await navigateToLoginOtpFlow(navigation, phoneDigits);
        if (!loginOtpSent) {
          showPopup({
            title: 'Login Failed',
            message:
              registerOtpData?.message ||
              'Unable to send OTP. Please try again.',
            iconName: 'alert-circle',
            iconColor: '#E53935',
            onConfirm: closePopup,
          });
        }
        return;
      }

      if (registerOtpData?.success) {
        console.log('======================================');
        console.log('[PreventiveAuthLogin] FLOW DECISION');
        console.log('Branch: new user');
        console.log('Next Screen: PreventiveAuthSignUpOTP');
        console.log('Next Step: OTP -> First Name -> Last Name -> Trial -> Login');
        console.log('Mobile:', phoneDigits);
        console.log('======================================');

        navigation.navigate('PreventiveAuthSignUpOTP', {
          mobile: phoneDigits,
          registrationData: { mobile: phoneDigits },
        });
        return;
      }

      showPopup({
        title: 'Login Failed',
        message:
          registerOtpData?.message || 'Unable to continue. Please try again.',
        iconName: 'alert-circle',
        iconColor: '#E53935',
        onConfirm: closePopup,
      });
    } catch (error) {
      const apiError = error as ApiErrorShape;
      const errorData = apiError?.response?.data;
      const errorMessage = extractApiMessage(apiError);

      console.log('======================================');
      console.log('[PreventiveAuthLogin] REGISTER SEND OTP ERROR');
      console.log('Error response:', JSON.stringify(errorData, null, 2));
      console.log('Error message:', apiError?.message);
      console.log('======================================');

      if (isMobileAlreadyVerifiedMessage(errorMessage)) {
        navigateToVerifiedNameFlow(navigation, phoneDigits);
        return;
      }

      if (isMobileAlreadyRegisteredMessage(errorMessage)) {
        try {
          const loginOtpSent = await navigateToLoginOtpFlow(navigation, phoneDigits);
          if (!loginOtpSent) {
            showPopup({
              title: 'Login Failed',
              message:
                errorMessage ||
                errorData?.message ||
                'Unable to send OTP. Please try again.',
              iconName: 'alert-circle',
              iconColor: '#E53935',
              onConfirm: closePopup,
            });
          }
        } catch (loginOtpError) {
          const loginApiError = loginOtpError as ApiErrorShape;
          const loginErrorMessage = extractApiMessage(loginApiError);

          console.log('======================================');
          console.log('[PreventiveAuthLogin] LOGIN SEND OTP ERROR');
          console.log(
            'Error response:',
            JSON.stringify(loginApiError?.response?.data, null, 2),
          );
          console.log('Error message:', loginApiError?.message);
          console.log('======================================');

          showPopup({
            title: 'Login Failed',
            message:
              loginErrorMessage ||
              'Unable to send OTP. Please try again.',
            iconName: 'alert-circle',
            iconColor: '#E53935',
            onConfirm: closePopup,
          });
        }
        return;
      }

      showPopup({
        title: 'Login Failed',
        message:
          errorMessage ||
          errorData?.message ||
          'Something went wrong. Please try again.',
        iconName: 'alert-circle',
        iconColor: '#E53935',
        onConfirm: closePopup,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [phoneDigits, isSubmitting, navigation, showPopup, closePopup]);

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      <ImageBackground
        source={BACKGROUND_IMAGE}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      <LinearGradient
        colors={[
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.30)',
          'rgba(0,0,0,0.60)',
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : statusBarInset}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: cardTopPadding,
              paddingBottom: insets.bottom + verticalScale(8),
            },
          ]}
        >
          <DynamicModal
            tabText="Login"
            title="Welcome Back"
            subtitle="Login to view your preventive health package, 28+ test details, reports, and wellness records."
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            buttonText={isSubmitting ? 'Please wait...' : 'Continue'}
            onButtonPress={handleContinue}
          >
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneWrap}>
              <Text style={styles.phoneCode}>+91</Text>
              <View style={styles.phoneDivider} />
              <TextInput
                value={phoneDigits}
                onChangeText={text => {
                  const value = onlyDigits(text);
                  setPhoneDigits(value);

                  if (showError) {
                    setShowError(false);
                  }
                }}
                placeholder="1234567890"
                placeholderTextColor="#B0B0B0"
                style={styles.phoneInput}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="done"
                editable={!isSubmitting}
              />
            </View>
            {showError ? (
              <Text style={styles.errorText}>
                Please enter 10 digit mobile number
              </Text>
            ) : null}
          </DynamicModal>
        </View>
      </KeyboardAvoidingView>

      <CustomPopup
        isVisible={popupVisible}
        onClose={closePopup}
        onConfirm={popupConfig.onConfirm}
        title={popupConfig.title}
        message={popupConfig.message}
        iconName={popupConfig.iconName}
        iconColor={popupConfig.iconColor}
        confirmText="OK"
        // cancelText={null}
        style={popupStyles.popupContainer}
        confirmStyle={popupStyles.popupConfirmButton}
      />
    </View>
  );
};

export default PreventiveAuthLogin;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8EEF5',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  label: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#000000',
    marginBottom: verticalScale(8),
  },
  phoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(10),
    height: verticalScale(42),
    paddingHorizontal: scale(10),
    marginBottom: verticalScale(14),
  },
  errorText: {
    color: '#E53935',
    fontSize: moderateScale(11),
    marginTop: verticalScale(-8),
    marginBottom: verticalScale(10),
    marginLeft: scale(2),
  },
  phoneCode: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#000000',
    paddingRight: scale(8),
  },
  phoneDivider: {
    width: StyleSheet.hairlineWidth,
    height: verticalScale(20),
    backgroundColor: '#D1D5DB',
    marginRight: scale(8),
  },
  phoneInput: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: '#000000',
    paddingVertical: 0,
  },
});

const popupStyles = StyleSheet.create({
  popupContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: moderateScale(20),
  },
  popupConfirmButton: {
    backgroundColor: BUTTON_COLOR,
    borderRadius: moderateScale(8),
  },
});
