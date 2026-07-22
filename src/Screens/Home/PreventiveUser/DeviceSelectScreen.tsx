import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { consumePendingCompletedBookingItemId } from '../../../Utils/multiDeviceSession';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ms, vs } from 'react-native-size-matters';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PreventiveHealthHeader from './PreventiveHealthHeader';
import { COLORS } from '../../../Constants/theme';
import type { RootStackParamList } from '../../../navigation/types';
import CustomPopup from '../Components/CustomPopup';
import { applyLabIotPerformTestNavigation } from '../../../Utils/labIotPerformTest';
import {
  runGenvcarePerformTestIfApplicable,
  isGenvcareScanDevice,
} from '../../../Utils/genvcarePerformTest';
import type { RawDeviceItem, RawPackageItem } from './PreventiveHealthAPI';
import axiosInstance from '../../../api/axiosInstance';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  hydrateDeviceSelectFromPayload,
  markDeviceCompleted,
} from '../../../features/deviceSelect/deviceSelectSlice';
import { selectCompletedBookingItemIds } from '../../../features/deviceSelect/selectors';
import { fetchBookingHospitalMrn } from '../../../features/booking/bookingSlice';
import { bookingDevicesIncludeGenvcareScan } from '../../../Utils/labPatientGenvcare';
import {
  getPackageDisplayTests,
  isPerformableLabDevice,
} from '../../../Utils/labPatientDevices';

const PRIMARY = COLORS.PRIMARY;
const PAGE_BG = '#F3F4F6';
const CARD_BORDER = '#E5E7EB';
const TEXT_DARK = '#111827';
const DONE_GREEN = '#16A34A';
const DONE_BG = '#DCFCE7';
const TEXT_MUTED = '#6B7280';

type DeviceSelectNav = NativeStackNavigationProp<RootStackParamList>;

function DeviceCard({
  device,
  isDone,
  onPerform,
  hospitalMrn,
}: {
  device: RawDeviceItem;
  isDone: boolean;
  onPerform: (d: RawDeviceItem) => void;
  hospitalMrn?: string | null;
}) {
  const showMrn =
    !!hospitalMrn &&
    isGenvcareScanDevice(device.device_id, device.device_name);

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      <View style={styles.cardTopRow}>
        <View style={[styles.deviceIconWrap, isDone && styles.deviceIconWrapDone]}>
          {isDone ? (
            <Ionicons name="checkmark-circle" size={ms(18)} color={DONE_GREEN} />
          ) : (
            <Ionicons name="hardware-chip-outline" size={ms(18)} color={PRIMARY} />
          )}
        </View>
        <View style={styles.deviceTitleCol}>
          <Text style={styles.deviceName} numberOfLines={2}>
            {device.device_name}
          </Text>
          {showMrn ? (
            <Text style={styles.mrnText}>MRN: {hospitalMrn}</Text>
          ) : null}
        </View>
        {isDone && (
          <View style={styles.doneBadge}>
            <Text style={styles.doneBadgeText}>Saved</Text>
          </View>
        )}
      </View>
      <View style={styles.hairline} />
      {isDone ? (
        <View style={styles.doneBtn}>
          <Ionicons name="checkmark" size={ms(16)} color={DONE_GREEN} style={{ marginRight: ms(6) }} />
          <Text style={styles.doneBtnText}>Done</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.performBtn}
          onPress={() => onPerform(device)}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.performBtnText}>Perform Test</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const DeviceSelectScreen: React.FC = () => {
  const navigation = useNavigation<DeviceSelectNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'DeviceSelect'>>();
  const dispatch = useAppDispatch();

  const { bookingId, devices = [], packages = [] } = route.params;

  const completedIds = useAppSelector(state =>
    selectCompletedBookingItemIds(state, bookingId),
  );
  const hospitalMrn = useAppSelector(state => {
    const bid = (bookingId ?? '').trim();
    if (!bid) {
      return undefined;
    }
    return state.booking.hospitalMrnByBookingId[bid];
  });
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState('Device Unavailable');
  const [popupMessage, setPopupMessage] = useState('');
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const displayPackages = useMemo(
    () =>
      packages.map(pkg => ({
        ...pkg,
        included_tests: getPackageDisplayTests(pkg, devices),
      })),
    [packages, devices],
  );

  /** Standalone devices only; package tests render under their package heading. */
  const displayStandaloneDevices = useMemo(
    () => (packages.length > 0 ? [] : devices),
    [packages.length, devices],
  );

  const allDevices: RawDeviceItem[] = useMemo(
    () => [
      ...displayStandaloneDevices,
      ...displayPackages.flatMap(p => p.included_tests ?? []),
    ],
    [displayStandaloneDevices, displayPackages],
  );

  const performableDevices = useMemo(
    () => allDevices.filter(isPerformableLabDevice),
    [allDevices],
  );

  const totalCount = performableDevices.length;
  const completedPerformableCount = performableDevices.filter(
    device =>
      device.booking_item_id != null &&
      completedIds.includes(device.booking_item_id),
  ).length;
  const canGeneratePdf = completedPerformableCount > 0;

  const hasGenvcareScan = useMemo(
    () => bookingDevicesIncludeGenvcareScan(allDevices),
    [allDevices],
  );

  useEffect(() => {
    if (bookingId && hasGenvcareScan) {
      void dispatch(fetchBookingHospitalMrn(bookingId));
    }
  }, [bookingId, dispatch, hasGenvcareScan]);

  const fetchHospitalMrnIfNeeded = useCallback(() => {
    if (bookingId && hasGenvcareScan) {
      void dispatch(fetchBookingHospitalMrn(bookingId));
    }
  }, [bookingId, dispatch, hasGenvcareScan]);

  const navigateToTestActivity = useCallback(() => {
    navigation.replace('TestActivity', { initialTab: 'upcoming' });
  }, [navigation]);

  const syncCompletionState = useCallback(() => {
    const pending = consumePendingCompletedBookingItemId();
    if (pending && bookingId) {
      dispatch(markDeviceCompleted({ bookingId, bookingItemId: pending }));
    }
    if (bookingId && allDevices.length > 0) {
      void dispatch(hydrateDeviceSelectFromPayload({ bookingId, devices: allDevices }))
        .unwrap()
        .then(result => {
          console.log('[DeviceSelect] Report payload hydration', {
            bookingId,
            completedFromPayload: result.bookingItemIds,
          });
        })
        .catch(error => {
          console.warn('[DeviceSelect] Report payload hydration failed', {
            bookingId,
            error,
          });
        });
    }
  }, [allDevices, bookingId, dispatch]);

  useFocusEffect(
    useCallback(() => {
      syncCompletionState();
      fetchHospitalMrnIfNeeded();

      let isNavigating = false;
      const handleBack = () => {
        if (isNavigating) return true;
        isNavigating = true;
        navigateToTestActivity();
        return true;
      };
      let sub: { remove: () => void } | undefined;
      if (Platform.OS === 'android') {
        sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
      }
      return () => sub?.remove();
    }, [navigateToTestActivity, syncCompletionState, fetchHospitalMrnIfNeeded]),
  );

  const handlePerform = useCallback(
    (device: RawDeviceItem) => {
      void (async () => {
        if (!isPerformableLabDevice(device)) {
          setPopupTitle('Device Unavailable');
          setPopupMessage(`No device available for ${device.device_name}`);
          setPopupVisible(true);
          return;
        }

        const genvcareResult = await runGenvcarePerformTestIfApplicable(
          navigation.navigate,
          {
            bookingId,
            deviceId: device.device_id,
            deviceName: device.device_name,
            logContext: 'DeviceSelect Perform Test',
            onSuccess: () => {
              if (bookingId && device.booking_item_id) {
                dispatch(
                  markDeviceCompleted({
                    bookingId,
                    bookingItemId: device.booking_item_id,
                  }),
                );
              }
            },
          },
        );
        if (genvcareResult.status === 'success') {
          return;
        }
        if (genvcareResult.status === 'vendor_server_error') {
          setPopupTitle(genvcareResult.title);
          setPopupMessage(genvcareResult.message);
          setPopupVisible(true);
          return;
        }

        if (
          applyLabIotPerformTestNavigation(
            navigation.navigate,
            device.device_id,
            device.device_name,
            device.booking_item_id,
            bookingId,
            true, // isMultiDevice — IOT screen will skip Generate PDF and navigate back here
          )
        ) {
          return;
        }
        setPopupTitle('Device Unavailable');
        setPopupMessage(`No device available for ${device.device_name}`);
        setPopupVisible(true);
      })();
    },
    [bookingId, dispatch, navigation.navigate],
  );

  const handleGeneratePdf = useCallback(async () => {
    if (!bookingId) return;
    setIsPdfLoading(true);
    try {
      const pdfBody = { bookingId };
      await axiosInstance.post('reports/payload/pdf', pdfBody);
    } catch {
      /* noop */
    } finally {
      setIsPdfLoading(false);
    }
    navigation.navigate('Reports', { bookingId });
  }, [bookingId, navigation]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <View style={styles.flex1}>
        <View style={styles.headerShell}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <PreventiveHealthHeader
              title="Select Test"
              onBackPress={navigateToTestActivity}
            />
          </SafeAreaView>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {displayStandaloneDevices.length > 0 && (
            <View style={styles.group}>
              {displayStandaloneDevices.map((device, i) => (
                <DeviceCard
                  key={`dev-${device.device_id}-${i}`}
                  device={device}
                  isDone={
                    device.booking_item_id != null &&
                    completedIds.includes(device.booking_item_id)
                  }
                  onPerform={handlePerform}
                  hospitalMrn={hospitalMrn}
                />
              ))}
            </View>
          )}

          {displayPackages.map((pkg: RawPackageItem, pIdx: number) => (
            <View key={`pkg-${pkg.package_id}-${pIdx}`} style={styles.group}>
              <Text style={styles.pkgLabel}>{pkg.package_name}</Text>
              {(pkg.included_tests ?? []).map((test: RawDeviceItem, tIdx: number) => (
                <DeviceCard
                  key={`test-${test.device_id}-${tIdx}`}
                  device={test}
                  isDone={
                    test.booking_item_id != null &&
                    completedIds.includes(test.booking_item_id)
                  }
                  onPerform={handlePerform}
                  hospitalMrn={hospitalMrn}
                />
              ))}
            </View>
          ))}

          {/* Bottom spacer so the PDF button doesn't overlap last card */}
          <View style={{ height: vs(8) }} />
        </ScrollView>

        {/* Generate PDF — enabled once at least one performable test is done */}
        <SafeAreaView edges={['bottom']} style={styles.pdfFooter}>
          <View style={styles.pdfProgressRow}>
            <Text style={styles.pdfProgressText}>
              {completedPerformableCount} / {totalCount} tests completed
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.pdfBtn, !canGeneratePdf && styles.pdfBtnDisabled]}
            onPress={() => { void handleGeneratePdf(); }}
            disabled={!canGeneratePdf || isPdfLoading}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            {isPdfLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="document-text-outline"
                  size={ms(18)}
                  color={canGeneratePdf ? COLORS.WHITE : '#9CA3AF'}
                  style={{ marginRight: ms(8) }}
                />
                <Text style={[styles.pdfBtnText, !canGeneratePdf && styles.pdfBtnTextDisabled]}>
                  Generate PDF
                </Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <CustomPopup
        isVisible={popupVisible}
        onClose={() => setPopupVisible(false)}
        onConfirm={() => setPopupVisible(false)}
        title={popupTitle}
        message={popupMessage}
        showIcon={false}
      />
    </>
  );
};

export default DeviceSelectScreen;

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: PAGE_BG,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ms(16),
    paddingTop: vs(16),
    paddingBottom: vs(12),
  },
  group: {
    marginBottom: vs(8),
  },
  pkgLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: vs(10),
  },
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: ms(16),
    marginBottom: vs(12),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardDone: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    marginBottom: vs(14),
  },
  deviceIconWrap: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: PRIMARY + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconWrapDone: {
    backgroundColor: DONE_BG,
  },
  deviceTitleCol: {
    flex: 1,
  },
  deviceName: {
    fontSize: ms(16),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  mrnText: {
    marginTop: vs(4),
    fontSize: ms(13),
    fontWeight: '700',
    color: PRIMARY,
  },
  doneBadge: {
    backgroundColor: DONE_BG,
    borderRadius: ms(10),
    paddingHorizontal: ms(8),
    paddingVertical: vs(2),
  },
  doneBadgeText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: DONE_GREEN,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CARD_BORDER,
    marginBottom: vs(14),
  },
  performBtn: {
    backgroundColor: PRIMARY,
    borderRadius: ms(22),
    paddingVertical: vs(12),
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  performBtnText: {
    color: COLORS.WHITE,
    fontSize: ms(14),
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DONE_BG,
    borderRadius: ms(22),
    paddingVertical: vs(12),
    width: '100%',
  },
  doneBtnText: {
    color: DONE_GREEN,
    fontSize: ms(14),
    fontWeight: '700',
  },
  pdfFooter: {
    backgroundColor: COLORS.WHITE,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
    paddingHorizontal: ms(16),
    paddingTop: vs(12),
    paddingBottom: vs(8),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  pdfProgressRow: {
    alignItems: 'center',
    marginBottom: vs(10),
  },
  pdfProgressText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#6B7280',
  },
  pdfBtn: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    borderRadius: ms(22),
    paddingVertical: vs(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  pdfBtnText: {
    color: COLORS.WHITE,
    fontSize: ms(15),
    fontWeight: '700',
  },
  pdfBtnTextDisabled: {
    color: '#9CA3AF',
  },
});
