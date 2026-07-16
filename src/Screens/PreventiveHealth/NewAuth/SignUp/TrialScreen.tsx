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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import DynamicModal from '../../Components/DynamicModal';
import CustomPopup from '../../../../Components/ReusableComponents/CustomPopup';
import { registerPatientTrial } from '../../../../features/PreventiveHealth/PreventiveAPI';
import {
  logStoredSessionToConsole,
  saveRegisteredPatientAuthData,
  storeItem,
} from '../../../../Utils/storage';
import { getUserIdFromJwt } from '../../../../Utils/jwt';
import type { RootStackParamList } from '../../../../navigation/types';

const BACKGROUND_IMAGE = require('../../../../assets/WelcomeBG.png');

const REFERENCE_SCREEN_WIDTH = 393;
const REFERENCE_CARD_WIDTH =
  REFERENCE_SCREEN_WIDTH - (32 * REFERENCE_SCREEN_WIDTH) / 350;
const TABLET_BREAKPOINT = 600;
const BUTTON_COLOR = '#1C39BB';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TrialScreen'>;
type TrialRoute = RouteProp<RootStackParamList, 'TrialScreen'>;

type PopupConfig = {
  title: string;
  message: string;
  iconName: string;
  iconColor: string;
  onConfirm: () => void;
};

type FormErrors = {
  firstName?: string;
  lastName?: string;
  mobile?: string;
};

type ApiErrorShape = {
  response?: { data?: { message?: string } };
  message?: string;
};

const TrialScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<TrialRoute>();
  const mobile = route?.params?.mobile || '';

  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
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

  const cardHeight = Math.min(
    verticalScale(340),
    screenHeight - statusBarInset - insets.bottom - verticalScale(110),
  );
  const loginTabOverlap = verticalScale(16);
  const totalCardBlockHeight = cardHeight + loginTabOverlap;
  const availableHeight =
    screenHeight - statusBarInset - insets.bottom - verticalScale(16);
  const cardTopPadding =
    statusBarInset +
    verticalScale(30) +
    Math.max(
      verticalScale(48),
      (availableHeight - totalCardBlockHeight) * 0.42,
    );

  const clearError = useCallback((field: keyof FormErrors) => {
    setErrors(prev => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const closePopup = useCallback(() => {
    setPopupVisible(false);
  }, []);

  const showPopup = useCallback((config: PopupConfig) => {
    setPopupConfig(config);
    setPopupVisible(true);
  }, []);

  const handleContinue = useCallback(async () => {
    const nextErrors: FormErrors = {};

    if (!firstName.trim()) {
      nextErrors.firstName = 'Please enter your first name';
    }
    if (!lastName.trim()) {
      nextErrors.lastName = 'Please enter your last name';
    }
    if (!mobile) {
      nextErrors.mobile = 'Mobile number is missing';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('======================================');
      console.log('[PreventiveAuthSignUp] TRIAL CONFIRM REQUEST');
      console.log('Phone:', mobile);
      console.log('First Name:', firstName.trim());
      console.log('Last Name:', lastName.trim());

      const response = await registerPatientTrial({
        phoneNumber: mobile,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      const data = response?.data;

      console.log('[PreventiveAuthSignUp] TRIAL CONFIRM RESPONSE');
      console.log(JSON.stringify(data, null, 2));
      console.log('Access Token:', data?.token ?? data?.data?.token);
      console.log('Refresh Token:', data?.refreshToken ?? data?.data?.refreshToken);
      console.log('======================================');

      if (data?.success) {
        const accessToken = data?.token ?? data?.data?.token;
        const refreshToken = data?.refreshToken ?? data?.data?.refreshToken;
        const user = data?.user ?? data?.data?.user;

        if (accessToken && refreshToken) {
          const userId =
            user?.user_id ??
            user?.id ??
            (accessToken ? getUserIdFromJwt(accessToken) : null);

          if (userId) {
            await saveRegisteredPatientAuthData(
              accessToken,
              String(userId),
              refreshToken,
            );
            console.log('[PreventiveAuthSignUp] TRIAL TOKENS SAVED');
            console.log('Stored user_id:', userId);
          }
        }

        if (user?.phone_number) {
          await storeItem('phone_number', String(user.phone_number));
        }

        void logStoredSessionToConsole('[PreventiveAuthSignUp]', 'preventiveHealth');
        navigation.navigate('BenefitScreen');
      } else {
        showPopup({
          title: 'Registration Failed',
          message:
            data?.message || 'Unable to complete registration. Please try again.',
          iconName: 'alert-circle',
          iconColor: '#E53935',
          onConfirm: closePopup,
        });
      }
    } catch (error) {
      const apiError = error as ApiErrorShape;
      const errorData = apiError?.response?.data;

      console.log('======================================');
      console.log('[PreventiveAuthSignUp] TRIAL CONFIRM ERROR');
      console.log('Error response:', JSON.stringify(errorData, null, 2));
      console.log('======================================');

      showPopup({
        title: 'Registration Failed',
        message:
          errorData?.message || 'Something went wrong. Please try again.',
        iconName: 'alert-circle',
        iconColor: '#E53935',
        onConfirm: closePopup,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    firstName,
    lastName,
    mobile,
    isSubmitting,
    navigation,
    showPopup,
    closePopup,
  ]);

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
            tabText="Sign up"
            title="Tell us about you"
            subtitle="A few details to set up your free trial."
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            buttonText={isSubmitting ? 'Please wait...' : 'Continue'}
            onButtonPress={handleContinue}
          >
            <Text style={styles.label}>First Name</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={firstName}
                onChangeText={text => {
                  setFirstName(text);
                  clearError('firstName');
                }}
                placeholder="First name"
                placeholderTextColor="#B0B0B0"
                style={styles.input}
                autoCapitalize="words"
                returnKeyType="next"
                editable={!isSubmitting}
              />
            </View>
            {errors.firstName ? (
              <Text style={styles.errorText}>{errors.firstName}</Text>
            ) : null}

            <Text style={styles.label}>Last Name</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={lastName}
                onChangeText={text => {
                  setLastName(text);
                  clearError('lastName');
                }}
                placeholder="Last name"
                placeholderTextColor="#B0B0B0"
                style={styles.input}
                autoCapitalize="words"
                returnKeyType="done"
                editable={!isSubmitting}
              />
            </View>
            {errors.lastName ? (
              <Text style={styles.errorText}>{errors.lastName}</Text>
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
        style={popupStyles.popupContainer}
        confirmStyle={popupStyles.popupConfirmButton}
      />
    </View>
  );
};

export default TrialScreen;

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
    marginBottom: verticalScale(6),
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(10),
    height: verticalScale(42),
    paddingHorizontal: scale(10),
    marginBottom: verticalScale(12),
  },
  input: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: '#000000',
    paddingVertical: 0,
  },
  errorText: {
    color: '#E53935',
    fontSize: moderateScale(11),
    marginTop: verticalScale(-6),
    marginBottom: verticalScale(8),
    marginLeft: scale(2),
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
