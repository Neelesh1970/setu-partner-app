import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';
import { RootStackParamList } from '../../navigation/types';

type NewUserNav = NativeStackNavigationProp<RootStackParamList, 'NewUserRegistration'>;

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 5) {
    return d;
  }
  return `${d.slice(0, 5)} - ${d.slice(5)}`;
}

function daysInMonth(monthIndex: number, year: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 3;
const WHEEL_EDGE_PAD = Math.floor(WHEEL_VISIBLE_ROWS / 2) * WHEEL_ITEM_HEIGHT;
const WHEEL_PICKER_HEIGHT = WHEEL_VISIBLE_ROWS * WHEEL_ITEM_HEIGHT;

type WheelColumnProps = {
  labels: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
};

const WheelColumn: React.FC<WheelColumnProps> = ({
  labels,
  selectedIndex,
  onSelectIndex,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const lastIndexRef = useRef(-1);
  const draggingRef = useRef(false);

  const clampIndex = useCallback(
    (i: number) => Math.max(0, Math.min(labels.length - 1, i)),
    [labels.length],
  );

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    const y = clampIndex(index) * WHEEL_ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y, animated });
  }, [clampIndex]);

  useEffect(() => {
    if (draggingRef.current) {
      return;
    }
    if (lastIndexRef.current !== selectedIndex) {
      lastIndexRef.current = selectedIndex;
      scrollToIndex(selectedIndex, false);
    }
  }, [selectedIndex, scrollToIndex]);

  const commitOffset = useCallback(
    (offsetY: number) => {
      const raw = Math.round(offsetY / WHEEL_ITEM_HEIGHT);
      const index = clampIndex(raw);
      lastIndexRef.current = index;
      if (index !== selectedIndex) {
        onSelectIndex(index);
      }
      scrollToIndex(index, true);
    },
    [clampIndex, onSelectIndex, scrollToIndex, selectedIndex],
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.wheelColumn}
      contentContainerStyle={styles.wheelColumnContent}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_HEIGHT}
      snapToAlignment="start"
      decelerationRate="fast"
      nestedScrollEnabled
      onScrollBeginDrag={() => {
        draggingRef.current = true;
      }}
      onMomentumScrollEnd={e => {
        draggingRef.current = false;
        commitOffset(e.nativeEvent.contentOffset.y);
      }}
      onScrollEndDrag={e => {
        const v = e.nativeEvent.velocity?.y ?? 0;
        if (Math.abs(v) < 0.02) {
          draggingRef.current = false;
          commitOffset(e.nativeEvent.contentOffset.y);
        }
      }}
    >
      {labels.map((label, i) => (
        <View key={`${label}-${i}`} style={styles.wheelItem}>
          <Text
            style={
              i === selectedIndex ? styles.wheelItemTextSelected : styles.wheelItemTextMuted
            }
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

type WheelDatePickerProps = {
  value: Date;
  maximumDate: Date;
  onChange: (next: Date) => void;
};

const WheelDatePicker: React.FC<WheelDatePickerProps> = ({
  value,
  maximumDate,
  onChange,
}) => {
  const minYear = maximumDate.getFullYear() - 100;
  const maxYear = maximumDate.getFullYear();
  const latestCalendar = useMemo(
    () =>
      new Date(
        maximumDate.getFullYear(),
        maximumDate.getMonth(),
        maximumDate.getDate(),
      ),
    [maximumDate],
  );

  const clampDob = useCallback(
    (d: Date) => {
      const lo = new Date(minYear, 0, 1);
      if (d.getTime() < lo.getTime()) {
        return lo;
      }
      if (d.getTime() > latestCalendar.getTime()) {
        return latestCalendar;
      }
      return d;
    },
    [latestCalendar, minYear],
  );

  const emit = useCallback(
    (d: Date) => {
      onChange(clampDob(d));
    },
    [clampDob, onChange],
  );

  const year = value.getFullYear();
  const month = value.getMonth();
  const day = value.getDate();

  const yearLabels = useMemo(() => {
    const out: string[] = [];
    for (let y = minYear; y <= maxYear; y += 1) {
      out.push(String(y));
    }
    return out;
  }, [minYear, maxYear]);

  const monthLabels = useMemo(() => [...MONTH_SHORT], []);

  const maxDay = daysInMonth(month, year);
  const dayLabels = useMemo(() => {
    const out: string[] = [];
    for (let d = 1; d <= maxDay; d += 1) {
      out.push(String(d));
    }
    return out;
  }, [maxDay]);

  const yearIndex = Math.max(0, Math.min(yearLabels.length - 1, year - minYear));
  const monthIndex = month;
  const dayIndex = Math.max(0, Math.min(dayLabels.length - 1, day - 1));

  const setYearIndex = useCallback(
    (idx: number) => {
      const y = minYear + idx;
      const cap = daysInMonth(month, y);
      const d = Math.min(day, cap);
      emit(new Date(y, month, d));
    },
    [day, emit, minYear, month],
  );

  const setMonthIndex = useCallback(
    (idx: number) => {
      const cap = daysInMonth(idx, year);
      const d = Math.min(day, cap);
      emit(new Date(year, idx, d));
    },
    [day, emit, year],
  );

  const setDayIndex = useCallback(
    (idx: number) => {
      emit(new Date(year, month, idx + 1));
    },
    [emit, month, year],
  );

  return (
    <View style={styles.wheelPickerOuter}>
      <View style={styles.wheelHighlight} pointerEvents="none" />
      <View style={styles.wheelPickerRow}>
        <WheelColumn
          labels={monthLabels}
          selectedIndex={monthIndex}
          onSelectIndex={setMonthIndex}
        />
        <WheelColumn
          labels={dayLabels}
          selectedIndex={dayIndex}
          onSelectIndex={setDayIndex}
        />
        <WheelColumn
          labels={yearLabels}
          selectedIndex={yearIndex}
          onSelectIndex={setYearIndex}
        />
      </View>
    </View>
  );
};

const NewUserRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<NewUserNav>();
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [dob, setDob] = useState(() => new Date(2001, 1, 2));
  const [maximumDob] = useState(() => new Date());
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [phoneDigits, setPhoneDigits] = useState('');

  const phoneDisplay = useMemo(
    () => formatPhoneDisplay(phoneDigits),
    [phoneDigits],
  );

  const handleContinue = () => {
    const trimmedName = firstName.trim();
    const trimmedSurname = surname.trim();
    if (!trimmedName || !trimmedSurname) {
      Alert.alert('Missing name', 'Please enter your name and surname.');
      return;
    }
    if (!gender) {
      Alert.alert('Gender', 'Please select your gender.');
      return;
    }
    if (phoneDigits.length !== 10) {
      Alert.alert('Phone number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    navigation.navigate('OtpVerification', {
      mobile: phoneDigits,
      authFlow: 'patientRegister',
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY} />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader title="New user" showBack />
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>What is your name?</Text>
        <TextInput
          style={styles.field}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Name"
          placeholderTextColor={COLORS.PLACEHOLDER}
        />
        <TextInput
          style={styles.field}
          value={surname}
          onChangeText={setSurname}
          placeholder="Surname"
          placeholderTextColor={COLORS.PLACEHOLDER}
        />

        <Text style={[styles.sectionHeading, styles.sectionHeadingSpaced]}>
          Select your date of birth
        </Text>
        <View style={styles.pickerShell}>
          <WheelDatePicker
            value={dob}
            maximumDate={maximumDob}
            onChange={setDob}
          />
        </View>

        <Text style={[styles.sectionHeading, styles.sectionHeadingSpaced]}>
          Select your gender
        </Text>
        <TouchableOpacity
          style={[
            styles.genderRow,
            gender === 'male' && styles.genderRowSelected,
          ]}
          onPress={() => setGender('male')}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.radioOuter,
              gender === 'male' && styles.radioOuterActive,
            ]}
          >
            {gender === 'male' ? <View style={styles.radioInner} /> : null}
          </View>
          <Text style={styles.genderSymbol}>♂</Text>
          <Text style={styles.genderLabel}>Male</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.genderRow,
            gender === 'female' && styles.genderRowSelected,
          ]}
          onPress={() => setGender('female')}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.radioOuter,
              gender === 'female' && styles.radioOuterActive,
            ]}
          >
            {gender === 'female' ? <View style={styles.radioInner} /> : null}
          </View>
          <Text style={styles.genderSymbol}>♀</Text>
          <Text style={styles.genderLabel}>Female</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionHeading, styles.sectionHeadingSpaced]}>
          Phone Number
        </Text>
        <View style={styles.phoneRow}>
          <View style={styles.phonePrefix}>
            <Text style={styles.phonePrefixText}>+91</Text>
          </View>
          <View style={styles.phoneDivider} />
          <TextInput
            style={styles.phoneInput}
            value={phoneDisplay}
            onChangeText={t => setPhoneDigits(t.replace(/\D/g, '').slice(0, 10))}
            placeholder="00000 - 00000"
            placeholderTextColor={COLORS.PLACEHOLDER}
            keyboardType="phone-pad"
            maxLength={13}
          />
        </View>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinue}
          activeOpacity={0.88}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default NewUserRegistrationScreen;

const RADIUS_FIELD = 10;
const RADIUS_PILL = 28;
const RADIUS_LG = 16;

const styles = StyleSheet.create({
  root: {
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.LG,
    paddingBottom: SPACING.XL,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  sectionHeadingSpaced: {
    marginTop: SPACING.LG,
  },
  field: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS_FIELD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 14,
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
    backgroundColor: COLORS.WHITE,
  },
  pickerShell: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS_FIELD,
    overflow: 'hidden',
    backgroundColor: COLORS.WHITE,
    height: WHEEL_PICKER_HEIGHT,
  },
  wheelPickerOuter: {
    flex: 1,
    position: 'relative',
  },
  wheelPickerRow: {
    flex: 1,
    flexDirection: 'row',
  },
  wheelColumn: {
    flex: 1,
    height: WHEEL_PICKER_HEIGHT,
  },
  wheelColumnContent: {
    paddingVertical: WHEEL_EDGE_PAD,
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemTextSelected: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  wheelItemTextMuted: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '500',
    color: COLORS.TEXT_MUTED,
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_EDGE_PAD,
    height: WHEEL_ITEM_HEIGHT,
    backgroundColor: '#E8ECF5',
    borderRadius: 6,
    marginHorizontal: SPACING.XS,
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS_FIELD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    marginBottom: SPACING.SM,
    backgroundColor: COLORS.WHITE,
  },
  genderRowSelected: {
    borderColor: COLORS.CARD_SELECTED_BORDER,
    backgroundColor: COLORS.CARD_SELECTED_BG,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.SM,
  },
  radioOuterActive: {
    borderColor: COLORS.PRIMARY,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.PRIMARY,
  },
  genderSymbol: {
    fontSize: 18,
    color: COLORS.TEXT_PRIMARY,
    marginRight: SPACING.SM,
    fontWeight: '600',
  },
  genderLabel: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS_FIELD,
    overflow: 'hidden',
    backgroundColor: COLORS.WHITE,
  },
  phonePrefix: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: 14,
  },
  phonePrefixText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  phoneDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.BORDER,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 14,
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
  },
  continueBtn: {
    marginTop: SPACING.XL,
    backgroundColor: '#1A49AB',
    borderRadius: RADIUS_PILL,
    paddingVertical: SPACING.MD,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  continueBtnText: {
    color: COLORS.WHITE,
    fontWeight: '700',
    fontSize: FONT_SIZE.LG,
  },
});
