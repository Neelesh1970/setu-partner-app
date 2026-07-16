import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  Keyboard,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ms, s, vs } from 'react-native-size-matters';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import PreventiveHealthHeader from './PreventiveHealthHeader';
import CommonFormHandler from '../../../Components/ReusableComponents/CommonFormHandler';
import { getToken, getRefreshToken, getRegisteredPatientAuthToken, getRegisteredPatientRefreshToken } from '../../../Utils/storage';
import { createPreventivePatient } from './PreventiveHealthAPI';
import { useTranslation } from '../../../Utils/useTranslation';
import { fetchPatients, selectCartItems } from '../../../features/PreventiveHealth';
import type { RootStackParamList } from '../../../navigation/types';
import type { AppDispatch } from '../../../store';
import type { CartItem } from '../../../features/cart/cartSlice';

const FEMALE_ONLY_DEVICE_IDS = new Set([
  '82d13697-8709-4ad0-b457-fa959fa316ae',
  '8ea18073-af8c-4152-8c68-e191715b95f3',
]);

const STORAGE_KEYS = {
  patientId: 'preventive_patient_id_v1',
  mobile: 'preventive_user_mobile_v1',
};

const COLORS = {
  headerBg: '#1C39BB',
  bg: '#FFFFFF',
  textPrimary: '#0F172A',
  textMuted: '#94A3B8',
  divider: '#E2E8F0',
  cta: '#2563EB',
  ctaText: '#FFFFFF',
  border: '#E5E7EB',
  placeholder: '#9CA3AF',
  error: '#EF4444',
};

const HPAD = ms(16);

const onlyDigits = (v: string): string => String(v || '').replace(/\D+/g, '');

const formatPhone = (digits: string): string => onlyDigits(digits).slice(0, 10);

const isValidEmail = (email: string): boolean => {
  const v = String(email || '').trim();
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
};

type Props = NativeStackScreenProps<RootStackParamList, 'PatientDetail'>;

type TouchedFields = {
  fullName: boolean;
  gender: boolean;
  age: boolean;
  phone: boolean;
  email: boolean;
};

export default function PatientDetail({ navigation, route }: Props) {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const cartItems = useSelector(selectCartItems);
  const insets = useSafeAreaInsets();
  const { screening, fromScreen } = route?.params || {};

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [email, setEmail] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const fullNameRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = (ref: React.RefObject<TextInput | null>) => {
    setTimeout(() => {
      if (!ref?.current || !scrollRef?.current) return;

      ref.current.measureLayout(
        scrollRef.current as unknown as number,
        (_x: number, y: number) => {
          scrollRef.current?.scrollTo({ y, animated: true });
        },
        () => {},
      );
    }, 100);
  };

  const navigateBack = useCallback(() => {
    if (fromScreen === 'Screening') {
      navigation.navigate('PreventiveHealth');
    } else if (fromScreen === 'SelectPatient') {
      navigation.navigate('SelectPatient');
    } else {
      navigation.navigate('PreventiveCart');
    }
  }, [fromScreen, navigation]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigateBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigateBack]),
  );

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const requiresFemaleGender = useMemo(() => {
    return cartItems.some((it: CartItem) => {
      if (it?.item_type !== 'device') return false;
      const deviceId = String(it?.item_id ?? it?.item?.id ?? '');
      return deviceId && FEMALE_ONLY_DEVICE_IDS.has(deviceId);
    });
  }, [cartItems]);

  const femaleGenderLabel = t('preventiveHealth.patientDetails.genderFemale');

  useEffect(() => {
    (async () => {
      try {
        const savedMobile = await AsyncStorage.getItem(STORAGE_KEYS.mobile);
        if (savedMobile) {
          setPhoneDigits(onlyDigits(savedMobile));
        }
      } catch (e) {
        console.log('[PreventiveFlow] Failed to load saved mobile', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (requiresFemaleGender) {
      setGender(femaleGenderLabel);
    }
  }, [requiresFemaleGender, femaleGenderLabel]);

  const [touched, setTouched] = useState<TouchedFields>({
    fullName: false,
    gender: false,
    age: false,
    phone: false,
    email: false,
  });

  const fullNameError =
    touched.fullName && !String(fullName).trim()
      ? t('preventiveHealth.patientDetails.errors.fullNameRequired')
      : '';
  const genderError =
    touched.gender && !gender ? t('preventiveHealth.patientDetails.errors.genderRequired') : '';
  const ageNum = Number(age);
  const ageError = touched.age
    ? !age
      ? t('preventiveHealth.patientDetails.errors.ageRequired')
      : ageNum < 1 || ageNum > 100
        ? t('preventiveHealth.patientDetails.errors.ageRange')
        : ''
    : '';
  const phoneError =
    touched.phone && onlyDigits(phoneDigits).length !== 10
      ? t('preventiveHealth.patientDetails.errors.phoneInvalid')
      : '';
  const emailError =
    touched.email && !isValidEmail(email)
      ? t('preventiveHealth.patientDetails.errors.emailInvalid')
      : '';

  const genderItems = useMemo(
    () => [
      {
        id: 'g1',
        name: t('preventiveHealth.patientDetails.genderMale'),
        disabled: requiresFemaleGender,
      },
      {
        id: 'g2',
        name: t('preventiveHealth.patientDetails.genderFemale'),
        disabled: false,
      },
      {
        id: 'g3',
        name: t('preventiveHealth.patientDetails.genderTransgender'),
        disabled: requiresFemaleGender,
      },
    ],
    [t, requiresFemaleGender],
  );

  const genderToApiValue = useCallback(
    (label: string): string => {
      const male = t('preventiveHealth.patientDetails.genderMale');
      const female = t('preventiveHealth.patientDetails.genderFemale');
      const transgender = t('preventiveHealth.patientDetails.genderTransgender');
      if (label === male) return 'male';
      if (label === female) return 'female';
      if (label === transgender) return 'transgender';
      return String(label).trim().toLowerCase();
    },
    [t],
  );

  const onContinue = async () => {
    const nextTouched: TouchedFields = {
      fullName: true,
      gender: true,
      age: true,
      phone: true,
      email: true,
    };
    setTouched(nextTouched);

    const parsedAge = Number(age);
    const trimmedEmail = String(email || '').trim();
    const isValid =
      Boolean(String(fullName).trim()) &&
      Boolean(gender) &&
      Boolean(age) &&
      parsedAge >= 1 &&
      parsedAge <= 100 &&
      onlyDigits(phoneDigits).length === 10 &&
      isValidEmail(trimmedEmail);

    if (!isValid) return;
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const accessToken =
        (await getRegisteredPatientAuthToken()) ?? (await getToken());
      const refreshToken =
        (await getRegisteredPatientRefreshToken()) ?? (await getRefreshToken());

      const createPayload = {
        full_name: String(fullName).trim(),
        phone: formatPhone(phoneDigits),
        gender: genderToApiValue(gender),
        age: parsedAge,
        email: trimmedEmail || undefined,
      };
      console.log('[PreventiveFlow] PatientDetail POST /patients request', createPayload);

      const res = await createPreventivePatient({
        accessToken,
        refreshToken,
        ...createPayload,
      });
      console.log('[PreventiveFlow] PatientDetail POST /patients response', res?.data);

      const createdId =
        res?.data?.data?.id ||
        res?.data?.data?.patient?.id ||
        res?.data?.patient?.id ||
        null;

      if (createdId) {
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.patientId, String(createdId));
        } catch {
          // ignore storage errors
        }
      }

      const refreshed = await dispatch(fetchPatients({ force: true })).unwrap();
      console.log('[PreventiveFlow] PatientDetail Continue success', {
        createdId,
        patientsCount: refreshed?.length ?? 0,
        fromScreen,
        screening,
      });

      navigation.navigate('PreventiveBookingDetail', {
        fromScreen,
        screening,
      });
    } catch (e) {
      console.log('[PreventiveFlow] PatientDetail Continue failed', e);
      // stay on screen on API failure
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <SafeAreaView style={styles.headerSafe} edges={['top', 'left', 'right']}>
        <PreventiveHealthHeader
          title={t('preventiveHealth.patientDetails.headerTitle')}
          onBackPress={navigateBack}
        />
      </SafeAreaView>

      <View style={styles.bodySafe}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              flexGrow: 1,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight * 0.8 : insets.bottom + vs(4),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          <Text style={styles.label}>
            {t('preventiveHealth.patientDetails.labelFullName')}
          </Text>
          <TextInput
            ref={fullNameRef}
            value={fullName}
            onChangeText={setFullName}
            onFocus={() => scrollToInput(fullNameRef)}
            placeholder={t('preventiveHealth.patientDetails.placeholderFullName')}
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => ageRef.current?.focus()}
          />
          {!!fullNameError && <Text style={styles.error}>{fullNameError}</Text>}

          <Text style={[styles.label, styles.mt]}>
            {t('preventiveHealth.patientDetails.labelGender')}
          </Text>
          <CommonFormHandler
            type="radio"
            value={gender}
            onChange={setGender}
            data={genderItems}
            keyField="id"
            valueField="name"
            activeColor={COLORS.cta}
            radioGroupStyle={styles.radioGroup}
            radioContainerStyle={styles.radioRow}
            radioOuterCircleStyle={styles.radioOuter}
            radioInnerCircleStyle={styles.radioInner}
            radioLabelStyle={styles.radioLabel}
          />
          {!!genderError && <Text style={styles.error}>{genderError}</Text>}

          <Text style={[styles.label, styles.ageMt]}>
            {t('preventiveHealth.patientDetails.labelAge')}
          </Text>
          <TextInput
            ref={ageRef}
            onFocus={() => scrollToInput(ageRef)}
            value={age}
            onChangeText={(text) => {
              const digits = text.replace(/\D+/g, '').slice(0, 3);
              if (digits === '') {
                setAge('');
                return;
              }
              const num = Number(digits);
              setAge(num > 100 ? '100' : digits);
            }}
            placeholder={t('preventiveHealth.patientDetails.placeholderAge')}
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            keyboardType="numeric"
            inputMode="numeric"
            importantForAutofill="no"
            maxLength={3}
            onBlur={() => setTouched((p) => ({ ...p, age: true }))}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
          {!!ageError && <Text style={styles.error}>{ageError}</Text>}

          <Text style={[styles.label, styles.mt]}>
            {t('preventiveHealth.patientDetails.labelPhone')}
          </Text>
          <View style={[styles.phoneWrap, styles.phoneWrapDisabled]}>
            <Text style={styles.phoneCode}>
              {t('preventiveHealth.patientDetails.phoneCountryCode')}
            </Text>
            <View style={styles.phoneDivider} />
            <TextInput
              ref={phoneRef}
              onFocus={() => scrollToInput(phoneRef)}
              value={formatPhone(phoneDigits)}
              onChangeText={(text) => setPhoneDigits(onlyDigits(text))}
              placeholder={t('preventiveHealth.patientDetails.placeholderPhone')}
              placeholderTextColor={COLORS.placeholder}
              style={styles.phoneInput}
              keyboardType="phone-pad"
              maxLength={10}
              onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              editable={false}
            />
          </View>
          {!!phoneError && <Text style={styles.error}>{phoneError}</Text>}

          <Text style={[styles.label, styles.mt]}>
            {t('preventiveHealth.patientDetails.labelEmail')}
          </Text>
          <TextInput
            ref={emailRef}
            onFocus={() => scrollToInput(emailRef)}
            value={email}
            onChangeText={setEmail}
            placeholder={t('preventiveHealth.patientDetails.placeholderEmail')}
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            onBlur={() => setTouched((p) => ({ ...p, email: true }))}
            returnKeyType="done"
          />
          {!!emailError && <Text style={styles.error}>{emailError}</Text>}
        </ScrollView>

        <SafeAreaView edges={['bottom', 'left', 'right']}>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueBtn, isSubmitting && styles.continueBtnDisabled]}
              activeOpacity={0.9}
              onPress={onContinue}
              disabled={isSubmitting}
            >
              <Text style={styles.continueText}>
                {t('preventiveHealth.patientDetails.ctaContinue')}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  headerSafe: {
    backgroundColor: COLORS.headerBg,
    borderBottomLeftRadius: ms(18),
    borderBottomRightRadius: ms(18),
    overflow: 'hidden',
  },
  bodySafe: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: {
    paddingHorizontal: HPAD,
    paddingTop: vs(18),
  },
  label: {
    fontSize: s(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: vs(8),
  },
  mt: { marginTop: vs(18) },
  ageMt: {
    marginTop: vs(5),
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: ms(10),
    paddingHorizontal: ms(14),
    paddingVertical: Platform.OS === 'ios' ? vs(12) : vs(10),
    fontSize: s(14),
    color: COLORS.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  error: {
    marginTop: vs(6),
    fontSize: s(12),
    color: COLORS.error,
    fontWeight: '600',
  },
  radioGroup: { marginBottom: 0 },
  radioRow: {
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    marginBottom: vs(10),
    paddingVertical: vs(14),
    paddingHorizontal: ms(14),
  },
  radioOuter: {
    width: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    borderWidth: 2,
  },
  radioInner: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
  },
  radioLabel: {
    fontSize: s(14),
    fontWeight: '600',
  },
  phoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: ms(10),
    backgroundColor: '#FFFFFF',
    paddingHorizontal: ms(12),
  },
  phoneWrapDisabled: {
    backgroundColor: '#F3F4F6',
  },
  phoneCode: {
    fontSize: s(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? vs(12) : vs(10),
  },
  phoneDivider: {
    width: StyleSheet.hairlineWidth,
    height: '60%',
    backgroundColor: COLORS.divider,
    marginHorizontal: ms(10),
  },
  phoneInput: {
    flex: 1,
    fontSize: s(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? vs(12) : vs(10),
  },
  footer: {
    paddingHorizontal: HPAD,
    paddingTop: vs(12),
    paddingBottom: vs(8),
    backgroundColor: COLORS.bg,
  },
  continueBtn: {
    backgroundColor: COLORS.cta,
    borderRadius: ms(24),
    paddingVertical: vs(14),
    alignItems: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueText: {
    color: COLORS.ctaText,
    fontSize: s(16),
    fontWeight: '800',
  },
});
