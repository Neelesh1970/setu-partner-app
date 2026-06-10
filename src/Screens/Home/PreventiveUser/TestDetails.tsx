import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  BackHandler,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ms, vs } from 'react-native-size-matters';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import PreventiveHealthHeader from './PreventiveHealthHeader';
import { COLORS } from '../../../Constants/theme';
import type { RootStackParamList } from '../../../navigation/types';
import {
  formatLabSlotTimeRangeIst,
  formatLabSlotYmdIst,
  formatLocalYmd,
  getLabPatients,
  labPatientSlotBounds,
  labPatientTestLabel,
  type LabPatientFilter,
  type LabPatientRecord,
  type RawDeviceItem,
} from './PreventiveHealthAPI';
import CustomPopup from '../Components/CustomPopup';
import { pickBackendDeviceByTestName } from '../../../Utils/pickBackendDeviceByTestName';
import { applyLabIotPerformTestNavigation } from '../../../Utils/labIotPerformTest';

const PRIMARY = COLORS.PRIMARY;
const CARD_BORDER = '#E5E7EB';
const LABEL_GRAY = '#6B7280';
const TEXT_DARK = '#111827';

/**
 * When true: Upcoming/Pending use slot-window rules for Continue (Missed stays always enabled).
 * When false: Continue is always clickable anytime (original behaviour).
 */
const ENABLE_CONTINUE_SLOT_WINDOW_CHECK = false;

type TestDetailsNav = NativeStackNavigationProp<RootStackParamList, 'TestDetails'>;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label} numberOfLines={3}>
        {label}
      </Text>
      <View style={styles.valueCell}>
        <Text style={styles.value} selectable={false}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function humanizeGender(g: string | null | undefined): string {
  const t = (g ?? '').trim();
  if (!t) return '—';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

const TestDetails: React.FC = () => {
  const navigation = useNavigation<TestDetailsNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'TestDetails'>>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const bottomPad = Math.max(insets.bottom, vs(16));
  const horizontalPad = Math.max(ms(12), Math.min(ms(20), windowWidth * 0.04));

  const { patientId, filter } = route.params;

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<LabPatientRecord | null>(null);

  const [deviceUnavailablePopupVisible, setDeviceUnavailablePopupVisible] =
    useState(false);
  const [deviceUnavailablePopupMessage, setDeviceUnavailablePopupMessage] =
    useState('');

  const closeDeviceUnavailablePopup = useCallback(() => {
    setDeviceUnavailablePopupVisible(false);
  }, []);


  const onContinue = useCallback(() => {
    if (!patient) return;

    const standaloneDevices = patient.devices ?? [];
    const packageDevices = (patient.packages ?? []).flatMap(pkg => pkg.included_tests ?? []);
    const allDevices: RawDeviceItem[] = [...standaloneDevices, ...packageDevices];

    if (allDevices.length > 1) {
      navigation.navigate('DeviceSelect', {
        patientName: (patient.full_name ?? '').trim() || '—',
        bookingId: patient.booking_id ?? null,
        devices: patient.devices ?? [],
        packages: patient.packages ?? [],
      });
      return;
    }

    // Single device: use structured item if available, otherwise fall back to flat arrays.
    const picked =
      allDevices.length === 1
        ? {
            deviceId: allDevices[0].device_id,
            deviceName: allDevices[0].device_name,
            bookingItemId: allDevices[0].booking_item_id,
          }
        : pickBackendDeviceByTestName({
            deviceIds: patient.device_ids ?? null,
            deviceNames: patient.device_names ?? null,
            bookingItemIds: patient.booking_item_ids ?? null,
            testName: labPatientTestLabel(patient),
          });

    if (
      applyLabIotPerformTestNavigation(
        navigation.navigate,
        picked.deviceId,
        picked.deviceName,
        picked.bookingItemId,
        patient?.booking_id ?? null,
      )
    ) {
      return;
    }

    const nameForMsg = picked.deviceName ?? labPatientTestLabel(patient);
    setDeviceUnavailablePopupMessage(`No device available for this ${nameForMsg}`);
    setDeviceUnavailablePopupVisible(true);
  }, [navigation, patient]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const tab = filter as LabPatientFilter;
        const list = await getLabPatients(tab);
        let found = list.find((p) => (p.id ?? '') === patientId) ?? null;

        // Upcoming list is derived from Pending in UI; keep details resilient without changing navigation params.
        if (!found && tab === 'upcoming') {
          const pendingList = await getLabPatients('pending');
          found = pendingList.find((p) => (p.id ?? '') === patientId) ?? null;
        }
        if (!cancelled) {
          setPatient(found);
        }
      } catch {
        if (!cancelled) {
          setPatient(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [patientId, filter]);

  const display = useMemo(() => {
    const p = patient;
    if (!p) {
      return {
        fullName: '—',
        age: '—',
        gender: '—',
        phone: '—',
        slotDateIst: '—',
        slotTimeIst: '—',
        packageLine: '—',
        deviceLine: '—',
        testLines: [] as string[],
      };
    }
    const pkg = (p.package_names ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
    const dev = (p.device_names ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
    const testLines = (p.package_included_tests ?? [])
      .map((s) => (s ?? '').trim())
      .filter(Boolean);
    return {
      fullName: (p.full_name ?? '').trim() || '—',
      age: p.age != null && !Number.isNaN(Number(p.age)) ? String(p.age) : '—',
      gender: humanizeGender(p.gender ?? undefined),
      phone: (p.phone ?? '').trim() || '—',
      slotDateIst: formatLabSlotYmdIst(p.slot_date),
      slotTimeIst: formatLabSlotTimeRangeIst(p.slot_date, p.slot_start_time, p.slot_end_time),
      packageLine: pkg.length ? pkg.join(', ') : '—',
      deviceLine: dev.length ? dev.join(', ') : '—',
      testLines,
    };
  }, [patient]);

  const tabFilter = filter as LabPatientFilter;
  const enforceSlotWindow =
    tabFilter === 'upcoming' || tabFilter === 'pending';

  const isTestCompleted = useMemo(
    () => (patient?.test_status ?? '').toLowerCase().trim() === 'completed',
    [patient],
  );

  const canContinueNow = useMemo(() => {
    if (!patient) return false;
    if (isTestCompleted) return false;

    if (!ENABLE_CONTINUE_SLOT_WINDOW_CHECK) return true;

    // Missed (and other tabs): Continue always available.
    if (!enforceSlotWindow) return true;

    // Upcoming & Pending: same rules as TestActivity Perform Test button.
    if (patient.can_perform_test === false) return false;

    const bounds = labPatientSlotBounds(patient);
    if (!bounds) return false;

    const now = new Date();
    if (formatLocalYmd(bounds.start) !== formatLocalYmd(now)) return false;

    return (
      now.getTime() >= bounds.start.getTime() &&
      now.getTime() < bounds.end.getTime()
    );
  }, [patient, enforceSlotWindow, isTestCompleted]);

  useFocusEffect(
    useCallback(() => {
      let isNavigating = false;
      const handleBack = () => {
        if (isNavigating) return true;
        isNavigating = true;
        navigation.goBack();
        return true;
      };
      let sub: { remove: () => void } | undefined;
      if (Platform.OS === 'android') {
        sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
      }
      return () => sub?.remove();
    }, [navigation]),
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <View style={styles.flex1}>
        <View style={styles.headerShell}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <PreventiveHealthHeader
              title="Test Details"
              onBackPress={() => navigation.goBack()}
            />
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={PRIMARY} size="large" />
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPad }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionTitle} numberOfLines={2} allowFontScaling>
                Patient Details
              </Text>
              <View style={styles.card}>
                <DetailRow label="Patient Name" value={display.fullName} />
                <DetailRow label="Age" value={display.age} />
                <DetailRow label="Gender" value={display.gender} />
                <DetailRow label="Contact Number" value={display.phone} />
              </View>

              <Text style={[styles.sectionTitle, styles.sectionAfterCard]} numberOfLines={2} allowFontScaling>
                Appointment
              </Text>
              <View style={styles.card}>
                <DetailRow label="Slot Date" value={display.slotDateIst} />
                <DetailRow label="Slot Time" value={display.slotTimeIst} />
              </View>

              <Text style={styles.sectionTitle} numberOfLines={2} allowFontScaling>
                Test Details
              </Text>
              <View style={[styles.card, styles.lastCard]}>
                <DetailRow label="Package Name" value={display.packageLine} />
                <DetailRow label="Device(s)" value={display.deviceLine} />
                <View style={styles.testBlock}>
                  <Text style={styles.testLabel} numberOfLines={2}>
                    Test:
                  </Text>
                  <View style={styles.testList}>
                    {display.testLines.length === 0 ? (
                      <Text style={[styles.testLine, styles.testLineLast]}>—</Text>
                    ) : (
                      display.testLines.map((line, i) => (
                        <Text
                          key={`${line}-${i}`}
                          style={[
                            styles.testLine,
                            i === display.testLines.length - 1 ? styles.testLineLast : null,
                          ]}
                        >
                          {line}
                        </Text>
                      ))
                    )}
                  </View>
                </View>
              </View>

              {/* <Text style={styles.sectionTitle}>Payment Info</Text>
              <View style={[styles.card, styles.lastCard]}>
                <DetailRow label="Amount" value="₹499" />
                <DetailRow label="Payment Method" value="Cash" />
              </View> */}
            </ScrollView>
          )}

          {!loading && !isTestCompleted ? (
            <View style={[styles.footer, { paddingBottom: bottomPad, paddingHorizontal: horizontalPad }]}>
              <TouchableOpacity
                style={[
                  styles.continueBtn,
                  !canContinueNow ? styles.continueBtnDisabled : null,
                ]}
                onPress={onContinue}
                activeOpacity={0.9}
                disabled={!canContinueNow}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.continueBtnText,
                    !canContinueNow ? styles.continueBtnTextDisabled : null,
                  ]}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      <CustomPopup
        isVisible={deviceUnavailablePopupVisible}
        onClose={closeDeviceUnavailablePopup}
        onConfirm={closeDeviceUnavailablePopup}
        title="Device Unavailable"
        message={deviceUnavailablePopupMessage}
        showIcon={false}
      />
    </>
  );
};

export default TestDetails;

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  headerShell: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: ms(20),
    borderBottomRightRadius: ms(20),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: vs(4) },
        shadowOpacity: 0.12,
        shadowRadius: ms(8),
      },
      android: {
        elevation: 6,
      },
    }),
  },
  headerSafe: {
    backgroundColor: PRIMARY,
  },
  body: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    paddingVertical: vs(48),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: vs(200),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: vs(20),
    paddingBottom: vs(20),
  },
  sectionAfterCard: {
    marginTop: vs(2),
  },
  sectionTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: vs(10),
    maxWidth: '100%',
  },
  card: {
    width: '100%' as const,
    maxWidth: '100%' as const,
    alignSelf: 'stretch' as const,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: ms(12),
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: ms(14),
    paddingVertical: ms(14),
    marginBottom: vs(20),
  },
  lastCard: {
    marginBottom: vs(4),
  },
  detailRow: {
    width: '100%' as const,
    flexDirection: 'row',
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between',
    gap: ms(10),
    paddingVertical: vs(7),
  },
  label: {
    flexBasis: '38%' as const,
    flexGrow: 0,
    paddingRight: ms(4),
    fontSize: ms(14),
    fontWeight: '400',
    color: LABEL_GRAY,
  },
  valueCell: {
    flex: 1,
    minWidth: 0,
  },
  value: {
    textAlign: 'right',
    fontSize: ms(14),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  testBlock: {
    width: '100%' as const,
    flexDirection: 'row',
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between',
    gap: ms(10),
    paddingVertical: vs(7),
  },
  testLabel: {
    flexBasis: '38%' as const,
    flexGrow: 0,
    paddingRight: ms(4),
    fontSize: ms(14),
    fontWeight: '400',
    color: LABEL_GRAY,
  },
  testList: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  testLine: {
    width: '100%' as const,
    fontSize: ms(14),
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'right',
    marginBottom: vs(6),
  },
  testLineLast: {
    marginBottom: 0,
  },
  footer: {
    paddingTop: vs(8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CARD_BORDER,
    backgroundColor: COLORS.WHITE,
  },
  continueBtn: {
    backgroundColor: PRIMARY,
    borderRadius: ms(28),
    paddingVertical: vs(16),
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueBtnText: {
    color: COLORS.WHITE,
    fontSize: ms(16),
    fontWeight: '700',
  },
  continueBtnTextDisabled: {
    color: '#F3F4F6',
  },

});
