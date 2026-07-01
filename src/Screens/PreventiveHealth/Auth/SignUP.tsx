import React, { useCallback, useRef, useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DobSpinnerPicker from './DobSpinnerPicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import GlassMorphism from '../../../Components/ReusableComponents/GlassMorphism';
import CustomPopup from '../../../Components/ReusableComponents/CustomPopup';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sendPatientRegisterOtp } from '../../../features/PreventiveHealth/PreventiveAPI';
import type { RootStackParamList } from '../../../navigation/types';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const BACKGROUND_IMAGE = require('../../../assets/WelcomeBG.png');

const REFERENCE_SCREEN_WIDTH = 393;
const REFERENCE_CARD_WIDTH =
  REFERENCE_SCREEN_WIDTH - (32 * REFERENCE_SCREEN_WIDTH) / 350;
const TABLET_BREAKPOINT = 600;
const GLASS_BLUR_AMOUNT = 22;
const GLASS_BACKGROUND_COLOR = 'rgba(255, 255, 255, 0.82)';
const BUTTON_COLOR = '#1C39BB';

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', icon: 'male' },
  { id: 'female', label: 'Female', icon: 'female' },
  { id: 'transgender', label: 'Transgender', icon: 'male-female' },
] as const;

type Nav = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

type FormErrors = {
  firstName?: string;
  surname?: string;
  gender?: string;
  phone?: string;
};

type PopupConfig = {
  title: string;
  message: string;
  iconName: string;
  iconColor: string;
  onConfirm: () => void;
};

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

const formatDob = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateAge = (dob: Date) => {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
};

const SignUP: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(new Date(2001, 1, 2));
  const [gender, setGender] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
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
  const scrollRef = useRef<KeyboardAwareScrollView | null>(null);

  const statusBarInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  const cardWidth =
    screenWidth >= TABLET_BREAKPOINT
      ? REFERENCE_CARD_WIDTH
      : screenWidth - scale(32);

  const cardHeight =
    screenHeight - statusBarInset - insets.bottom - verticalScale(16);

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

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent | null, selectedDate?: Date) => {
      if (selectedDate) {
        setDateOfBirth(selectedDate);
      }
    },
    [],
  );

  const closePopup = useCallback(() => {
    setPopupVisible(false);
  }, []);

  const showPopup = useCallback((config: PopupConfig) => {
    setPopupConfig(config);
    setPopupVisible(true);
  }, []);

  const scrollPhoneFieldIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd(true);
    });
  }, []);

  const handleContinue = useCallback(async () => {
    const nextErrors: FormErrors = {};

    if (!firstName.trim()) {
      nextErrors.firstName = 'Please enter your name';
    }
    if (!surname.trim()) {
      nextErrors.surname = 'Please enter your surname';
    }
    if (!gender) {
      nextErrors.gender = 'Please select your gender';
    }
    if (phoneDigits.length !== 10) {
      nextErrors.phone = 'Please enter 10 digit mobile number';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (isSubmitting) {
      return;
    }

    const registrationPayload = {
      mobile: phoneDigits,
      name: firstName.trim(),
      last_name: surname.trim(),
      gender,
      age: calculateAge(dateOfBirth),
      dob: formatDob(dateOfBirth),
    };

    setIsSubmitting(true);

    try {
      const response = await sendPatientRegisterOtp(registrationPayload);
      const data = response?.data;

      if (data?.success) {
        navigation.navigate('SignUpOTP', {
          mobile: phoneDigits,
          registrationData: registrationPayload,
        });
      } else {
        showPopup({
          title: 'Registration Failed',
          message: data?.message || 'Unable to send OTP. Please try again.',
          iconName: 'alert-circle',
          iconColor: '#E53935',
          onConfirm: closePopup,
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errorData = err?.response?.data;

      showPopup({
        title: 'Registration Failed',
        message:
          errorData?.message || err?.message || 'Something went wrong. Please try again.',
        iconName: 'alert-circle',
        iconColor: '#E53935',
        onConfirm: closePopup,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    firstName,
    surname,
    gender,
    phoneDigits,
    dateOfBirth,
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
        style={[styles.keyboardView, styles.contentLayer]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : statusBarInset}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: statusBarInset + verticalScale(8),
              paddingBottom: insets.bottom + verticalScale(8),
            },
          ]}
        >
          <View style={[styles.cardWrapper, { width: cardWidth }]}>
            <View style={styles.signUpTabBadge}>
              <Text style={styles.signUpTabText}>Sign up</Text>
            </View>

            <GlassMorphism
              width={cardWidth}
              height={cardHeight}
              borderRadius={moderateScale(30)}
              blurAmount={GLASS_BLUR_AMOUNT}
              blurType="xlight"
              glassBackgroundColor={GLASS_BACKGROUND_COLOR}
            >
              <KeyboardAwareScrollView
                innerRef={(ref: KeyboardAwareScrollView | null) => {
                  scrollRef.current = ref;
                }}
                style={styles.scrollView}
                contentContainerStyle={styles.signUpContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                enableOnAndroid
                enableAutomaticScroll
                keyboardOpeningTime={0}
                extraScrollHeight={verticalScale(56)}
                extraHeight={verticalScale(12)}
              >
                <Text style={styles.title}>
                  Register for Preventive Health Checkup
                </Text>
                <Text style={styles.subtitle}>
                  Create your account and book a preventive health package with
                  28 essential screening tests.
                </Text>

                <Text style={styles.sectionLabel}>What is your name?</Text>
                <TextInput
                  value={firstName}
                  onChangeText={text => {
                    setFirstName(text);
                    clearError('firstName');
                  }}
                  placeholder="Name"
                  placeholderTextColor="#B0B0B0"
                  style={[styles.input, styles.nameInput]}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.firstName ? (
                  <Text style={styles.errorText}>{errors.firstName}</Text>
                ) : null}

                <TextInput
                  value={surname}
                  onChangeText={text => {
                    setSurname(text);
                    clearError('surname');
                  }}
                  placeholder="Surname"
                  placeholderTextColor="#B0B0B0"
                  style={styles.input}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.surname ? (
                  <Text style={styles.errorText}>{errors.surname}</Text>
                ) : null}

                <Text style={styles.sectionLabel}>
                  Select your date of birth
                </Text>
                <View style={styles.datePickerWrap}>
                  <DobSpinnerPicker
                    value={dateOfBirth}
                    onChange={handleDateChange}
                    minimumDate={new Date(1920, 0, 1)}
                    maximumDate={new Date()}
                  />
                </View>

                <Text style={styles.sectionLabel}>Select your gender</Text>
                {GENDER_OPTIONS.map((option, index) => {
                  const isSelected = gender === option.id;

                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        setGender(option.id);
                        clearError('gender');
                      }}
                      style={({ pressed }) => [
                        styles.genderRow,
                        index === GENDER_OPTIONS.length - 1 && styles.genderRowLast,
                        pressed && styles.genderRowPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          isSelected && styles.radioOuterSelected,
                        ]}
                      >
                        {isSelected ? <View style={styles.radioInner} /> : null}
                      </View>
                      <Ionicons
                        name={option.icon}
                        size={moderateScale(16)}
                        color="#000000"
                        style={styles.genderIcon}
                      />
                      <Text style={styles.genderLabel}>{option.label}</Text>
                    </Pressable>
                  );
                })}
                {errors.gender ? (
                  <Text style={styles.errorText}>{errors.gender}</Text>
                ) : null}

                <Text style={styles.sectionLabel}>Phone Number</Text>
                <View style={styles.phoneWrap}>
                  <Text style={styles.phoneCode}>+91</Text>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    value={phoneDigits}
                    onChangeText={text => {
                      const value = onlyDigits(text);
                      setPhoneDigits(value);
                      clearError('phone');
                    }}
                    onFocus={scrollPhoneFieldIntoView}
                    placeholder="1234567890"
                    placeholderTextColor="#B0B0B0"
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    maxLength={10}
                    returnKeyType="done"
                  />
                </View>
                {errors.phone ? (
                  <Text style={styles.errorText}>{errors.phone}</Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={handleContinue}
                  disabled={isSubmitting}
                  style={({ pressed }) => [
                    styles.continueButton,
                    pressed && styles.buttonPressed,
                    isSubmitting && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.continueButtonText}>
                    {isSubmitting ? 'Please wait...' : 'Continue'}
                  </Text>
                </Pressable>
              </KeyboardAwareScrollView>
            </GlassMorphism>
          </View>
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
        cancelText={undefined}
        style={popupStyles.popupContainer}
        confirmStyle={popupStyles.popupConfirmButton}
      />
    </View>
  );
};

export default SignUP;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8EEF5',
  },
  keyboardView: {
    flex: 1,
  },
  contentLayer: {
    zIndex: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  cardWrapper: {
    alignItems: 'center',
  },
  signUpTabBadge: {
    zIndex: 2,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scale(36),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(24),
    marginBottom: -verticalScale(16),
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  signUpTabText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: BUTTON_COLOR,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  signUpContent: {
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(24),
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    marginBottom: verticalScale(6),
  },
  subtitle: {
    fontSize: moderateScale(12),
    fontWeight: '400',
    color: '#4A4A4A',
    textAlign: 'left',
    lineHeight: moderateScale(17),
    marginBottom: verticalScale(20),
  },
  sectionLabel: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#000000',
    marginBottom: verticalScale(8),
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(10),
    height: verticalScale(42),
    paddingHorizontal: scale(10),
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: '#000000',
    marginBottom: verticalScale(14),
  },
  nameInput: {
    marginBottom: verticalScale(8),
  },
  datePickerWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(10),
    marginBottom: verticalScale(14),
    overflow: 'hidden',
    height: verticalScale(150),
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(10),
    height: verticalScale(42),
    paddingHorizontal: scale(10),
    marginBottom: verticalScale(8),
  },
  genderRowLast: {
    marginBottom: verticalScale(14),
  },
  genderRowPressed: {
    opacity: 0.92,
  },
  radioOuter: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    borderWidth: 1.5,
    borderColor: '#B0B0B0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  radioOuterSelected: {
    borderColor: BUTTON_COLOR,
  },
  radioInner: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: BUTTON_COLOR,
  },
  genderIcon: {
    marginRight: scale(8),
  },
  genderLabel: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: '#4A4A4A',
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
  errorText: {
    color: '#E53935',
    fontSize: moderateScale(11),
    marginTop: verticalScale(-8),
    marginBottom: verticalScale(10),
    marginLeft: scale(2),
  },
  continueButton: {
    width: '100%',
    height: verticalScale(38),
    borderRadius: verticalScale(19),
    backgroundColor: BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(12),
    marginTop: verticalScale(4),
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(15),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: moderateScale(18),
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
