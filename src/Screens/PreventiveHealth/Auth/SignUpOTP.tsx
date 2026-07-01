import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  Keyboard,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import DynamicModal from '../Components/DynamicModal';
import CustomPopup from '../../../Components/ReusableComponents/CustomPopup';
import LinearGradient from 'react-native-linear-gradient';
import {
  sendPatientRegisterOtp,
  verifyPatientRegisterOtp,
} from '../../../features/PreventiveHealth/PreventiveAPI';
import {
  getLabUserId,
  savePreventivePatientId,
  saveRegisteredPatientAuthData,
  saveRegisteredPatientProfile,
  storeItem,
} from '../../../Utils/storage';
import { getUserIdFromJwt } from '../../../Utils/jwt';
import type { RootStackParamList } from '../../../navigation/types';

const BACKGROUND_IMAGE = require('../../../assets/WelcomeBG.png');

const REFERENCE_SCREEN_WIDTH = 393;
const REFERENCE_CARD_WIDTH =
  REFERENCE_SCREEN_WIDTH - (32 * REFERENCE_SCREEN_WIDTH) / 350;
const TABLET_BREAKPOINT = 600;
const BUTTON_COLOR = '#1C39BB';
const OTP_LENGTH = 6;

type Nav = NativeStackNavigationProp<RootStackParamList, 'SignUpOTP'>;
type OtpRoute = RouteProp<RootStackParamList, 'SignUpOTP'>;

type PopupConfig = {
  title: string;
  message: string;
  iconName: string;
  iconColor: string;
  compact?: boolean;
  onConfirm: () => void;
};

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, OTP_LENGTH);

const SignUpOTP: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<OtpRoute>();
  const mobile = route?.params?.mobile || '';
  const registrationData = route?.params?.registrationData || null;

  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [otpDigits, setOtpDigits] = useState('');
  const [showError, setShowError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupConfig, setPopupConfig] = useState<PopupConfig>({
    title: '',
    message: '',
    iconName: 'checkmark-circle',
    iconColor: BUTTON_COLOR,
    onConfirm: () => {},
  });
  const inputRef = useRef<TextInput>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardShift = useRef(new Animated.Value(0)).current;

  const statusBarInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  const cardWidth =
    screenWidth >= TABLET_BREAKPOINT
      ? REFERENCE_CARD_WIDTH
      : screenWidth - scale(32);

  const innerContentWidth = cardWidth - scale(24) * 2;
  const otpGap = scale(6);
  const otpBoxWidth =
    (innerContentWidth - otpGap * (OTP_LENGTH - 1)) / OTP_LENGTH;
  const otpBoxHeight = verticalScale(42);

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

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { height: number }; duration?: number }) => {
      const keyboardHeight = e.endCoordinates.height;
      const cardBottom = cardTopPadding + cardHeight;
      const visibleBottom = screenHeight - keyboardHeight;
      const overlap = cardBottom - visibleBottom + verticalScale(16);
      const shiftAmount = overlap > 0 ? -overlap : 0;

      Animated.timing(cardShift, {
        toValue: shiftAmount,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: true,
      }).start();
    };

    const onHide = (e: { duration?: number }) => {
      Animated.timing(cardShift, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: true,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [cardTopPadding, cardHeight, screenHeight, cardShift]);

  useFocusEffect(
    useCallback(() => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }

      focusTimerRef.current = setTimeout(() => {
        inputRef.current?.focus();
      }, 350);

      return () => {
        if (focusTimerRef.current) {
          clearTimeout(focusTimerRef.current);
        }
        Keyboard.dismiss();
      };
    }, []),
  );

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const closePopup = useCallback(() => {
    setPopupVisible(false);
  }, []);

  const showPopup = useCallback((config: PopupConfig) => {
    setPopupConfig(config);
    setPopupVisible(true);
  }, []);

  const handleVerify = useCallback(async () => {
    if (otpDigits.length !== OTP_LENGTH) {
      setShowError(true);
      return;
    }

    if (!mobile) {
      showPopup({
        title: 'Error',
        message: 'Mobile number is missing. Please go back and try again.',
        iconName: 'alert-circle',
        iconColor: '#E53935',
        onConfirm: closePopup,
      });
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await verifyPatientRegisterOtp({
        mobile,
        otp: otpDigits,
      });
      const data = response?.data;

      if (data?.success) {
        console.log('[SignUpOTP] verify-otp raw:', JSON.stringify(data, null, 2));

        const accessToken = data?.token as string | undefined;
        const refreshToken = data?.refreshToken as string | undefined;

        const userId =
          data?.user?.user_id ??
          data?.user?.id ??
          (accessToken ? getUserIdFromJwt(accessToken) : null);

        if (accessToken && userId) {
          await saveRegisteredPatientAuthData(
            accessToken,
            String(userId),
            refreshToken,
          );
        }

        const patientFromResponse = (data as { patient?: { id?: string } })?.patient;
        const patientRowId =
          patientFromResponse?.id ??
          (data as { default_patient_id?: string })?.default_patient_id ??
          (data as { patient_id?: string })?.patient_id ??
          (data?.data as { patient_id?: string; patient?: { id?: string } } | undefined)
            ?.patient_id ??
          (data?.data as { patient?: { id?: string } } | undefined)?.patient?.id ??
          (data?.user as { patient_id?: string } | undefined)?.patient_id;
        const userRecordId = (data?.user as { id?: string } | undefined)?.id;

        console.log('[SignUpOTP] patient.id (for device test booking):', patientRowId ?? '(not found)');
        console.log(
          '[SignUpOTP] default_patient_id:',
          (data as { default_patient_id?: string })?.default_patient_id ?? '(not set)',
        );
        console.log('[SignUpOTP] user.id (auth account):', userRecordId ?? userId ?? '(not set)');

        if (patientRowId && String(patientRowId).trim()) {
          await savePreventivePatientId(String(patientRowId).trim(), userId);
          console.log(
            '[SignUpOTP] saved preventive_patient_id for booking:',
            String(patientRowId).trim(),
          );
        } else if (
          userRecordId &&
          userId &&
          String(userRecordId).trim() !== String(userId).trim()
        ) {
          await savePreventivePatientId(String(userRecordId).trim(), userId);
          console.log(
            '[SignUpOTP] saved preventive_patient_id (fallback user record):',
            String(userRecordId).trim(),
          );
        } else {
          console.warn(
            '[SignUpOTP] no patient.id in register response — device test booking may fail',
          );
        }

        if (data?.user?.phone_number) {
          await storeItem('phone_number', String(data.user.phone_number));
        }

        const labUserId = (await getLabUserId()) ?? '';

        if (registrationData) {
          await saveRegisteredPatientProfile({
            mobile: registrationData.mobile,
            firstName: registrationData.name,
            lastName: registrationData.last_name,
            dob: registrationData.dob,
            gender: registrationData.gender,
            lab_user_id: labUserId,
          });
        }

        console.log(
          '[SignUpOTP] Registration complete — registered by lab user id:',
          labUserId || '(not set)',
        );

        navigation.reset({
          index: 1,
          routes: [{ name: 'Home' }, { name: 'PreventiveHealth' }],
        });
      } else {
        const errorMessage =
          data?.message ||
          data?.errors?.provider?.description ||
          'Please enter correct pin';

        showPopup({
          title: 'Verification Failed',
          message: errorMessage,
          iconName: 'alert-circle',
          iconColor: '#E53935',
          onConfirm: closePopup,
        });
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string; errors?: { provider?: { description?: string } } } };
        message?: string;
      };
      const errorData = err?.response?.data;

      const errorMessage =
        errorData?.message ||
        errorData?.errors?.provider?.description ||
        err?.message ||
        'Something went wrong. Please try again.';

      showPopup({
        title: 'Verification Failed',
        message: errorMessage,
        iconName: 'alert-circle',
        iconColor: '#E53935',
        onConfirm: closePopup,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    otpDigits,
    mobile,
    isSubmitting,
    navigation,
    registrationData,
    showPopup,
    closePopup,
  ]);

  const handleOtpChange = useCallback((text: string) => {
    const value = onlyDigits(text);
    setOtpDigits(value);
    setShowError(false);
  }, []);

  const handleResendOtp = useCallback(async () => {
    if (!mobile || !registrationData) {
      showPopup({
        title: 'Error',
        message: 'Registration details are missing. Please go back and try again.',
        iconName: 'alert-circle',
        iconColor: '#E53935',
        onConfirm: closePopup,
      });
      return;
    }

    if (isResending) {
      return;
    }

    Keyboard.dismiss();
    inputRef.current?.blur();
    setIsResending(true);

    try {
      const response = await sendPatientRegisterOtp(registrationData);
      const data = response?.data;

      if (data?.success) {
        setOtpDigits('');
        showPopup({
          title: 'OTP Sent',
          message: data?.message || 'OTP has been sent successfully.',
          iconName: 'checkmark-circle',
          iconColor: BUTTON_COLOR,
          compact: true,
          onConfirm: closePopup,
        });
      } else {
        showPopup({
          title: 'Resend Failed',
          message: data?.message || 'Unable to resend OTP. Please try again.',
          iconName: 'alert-circle',
          iconColor: '#E53935',
          onConfirm: closePopup,
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errorData = err?.response?.data;

      showPopup({
        title: 'Resend Failed',
        message:
          errorData?.message || err?.message || 'Unable to resend OTP. Please try again.',
        iconName: 'alert-circle',
        iconColor: '#E53935',
        onConfirm: closePopup,
      });
    } finally {
      setIsResending(false);
    }
  }, [mobile, registrationData, isResending, showPopup, closePopup]);

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

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: cardTopPadding,
            paddingBottom: insets.bottom + verticalScale(8),
            transform: [{ translateY: cardShift }],
          },
        ]}
      >
        <DynamicModal
          tabText="Sign up"
          title="Enter otp"
          subtitle="Enter the code we just sent to your phone."
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          buttonText={isSubmitting ? 'Please wait...' : 'Verify'}
          onButtonPress={handleVerify}
          buttonStyle={styles.continueButton}
        >
          <Pressable
            style={[styles.otpRow, { gap: otpGap }]}
            onPress={focusInput}
          >
            {Array.from({ length: OTP_LENGTH }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  { width: otpBoxWidth, height: otpBoxHeight },
                ]}
              >
                <Text style={styles.otpDigit}>
                  {otpDigits[index] || ''}
                </Text>
              </View>
            ))}

            <TextInput
              ref={inputRef}
              value={otpDigits}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              returnKeyType="done"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              style={styles.hiddenInput}
              caretHidden
              showSoftInputOnFocus
              editable={!isSubmitting}
            />
          </Pressable>

          {showError && (
            <Text style={styles.errorText}>
              Please enter the 6 digit OTP
            </Text>
          )}

          <Text style={styles.resendText}>
            Didn't receive the code?{' '}
            <Text
              style={[
                styles.resendLink,
                isResending && styles.resendLinkDisabled,
              ]}
              onPress={isResending ? undefined : handleResendOtp}
            >
              {isResending ? 'Sending...' : 'Resend OTP'}
            </Text>
          </Text>
        </DynamicModal>
      </Animated.View>

      <CustomPopup
        isVisible={popupVisible}
        onClose={closePopup}
        onConfirm={popupConfig.onConfirm}
        title={popupConfig.title}
        message={popupConfig.message}
        iconName={popupConfig.iconName}
        iconColor={popupConfig.iconColor}
        confirmText="OK"
        cancelText={undefined}
        compact={!!popupConfig.compact}
        style={popupStyles.popupContainer}
        confirmStyle={popupStyles.popupConfirmButton}
      />
    </View>
  );
};

export default SignUpOTP;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8EEF5',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    zIndex: 2,
  },
  otpRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: verticalScale(14),
    position: 'relative',
  },
  otpBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: '#000000',
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
  },
  resendText: {
    fontSize: moderateScale(11),
    fontWeight: '400',
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: verticalScale(16),
  },
  resendLink: {
    fontWeight: '700',
    color: BUTTON_COLOR,
  },
  resendLinkDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#E53935',
    fontSize: moderateScale(11),
    marginTop: verticalScale(-8),
    marginBottom: verticalScale(10),
    marginLeft: scale(2),
    textAlign: 'center',
  },
  continueButton: {
    marginTop: verticalScale(6),
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
