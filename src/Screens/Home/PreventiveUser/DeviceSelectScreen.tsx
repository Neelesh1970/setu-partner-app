import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type { RawDeviceItem, RawPackageItem } from './PreventiveHealthAPI';
import axiosInstance from '../../../api/axiosInstance';

const PRIMARY = COLORS.PRIMARY;
const PAGE_BG = '#F3F4F6';
const CARD_BORDER = '#E5E7EB';
const TEXT_DARK = '#111827';
const DONE_GREEN = '#16A34A';
const DONE_BG = '#DCFCE7';

type DeviceSelectNav = NativeStackNavigationProp<RootStackParamList>;

function DeviceCard({
  device,
  isDone,
  onPerform,
}: {
  device: RawDeviceItem;
  isDone: boolean;
  onPerform: (d: RawDeviceItem) => void;
}) {
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
        <Text style={styles.deviceName} numberOfLines={2}>
          {device.device_name}
        </Text>
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

  const { bookingId, devices = [], packages = [] } = route.params;

  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // Collect all booking_item_ids across standalone devices and package tests
  const allDevices: RawDeviceItem[] = [
    ...devices,
    ...packages.flatMap((p: RawPackageItem) => p.included_tests ?? []),
  ];
  const totalCount = allDevices.length;
  const allDone = totalCount > 0 && completedIds.length >= totalCount;

  // Keep a stable ref to completedIds for use inside useFocusEffect without stale closure
  const completedIdsRef = useRef(completedIds);
  useEffect(() => { completedIdsRef.current = completedIds; }, [completedIds]);

  useFocusEffect(
    useCallback(() => {
      // Consume any pending completed booking_item_id left by an IOT screen via goBack().
      // This runs every time DeviceSelect comes into focus (including after a goBack()).
      const pending = consumePendingCompletedBookingItemId();
      if (pending && !completedIdsRef.current.includes(pending)) {
        setCompletedIds(prev => [...prev, pending]);
      }

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

  const handlePerform = useCallback(
    (device: RawDeviceItem) => {
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
      setPopupMessage(`No device available for ${device.device_name}`);
      setPopupVisible(true);
    },
    [navigation.navigate, bookingId],
  );

  const handleGeneratePdf = useCallback(async () => {
    if (!bookingId) return;
    setIsPdfLoading(true);
    try {
      await axiosInstance.post('reports/payload/pdf', { bookingId });
    } catch (err) {
      const e = err as { message?: string };
      console.warn('[DeviceSelect] PDF generation failed:', e?.message ?? err);
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
              onBackPress={() => navigation.goBack()}
            />
          </SafeAreaView>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {devices.length > 0 && (
            <View style={styles.group}>
              {devices.map((device, i) => (
                <DeviceCard
                  key={`dev-${device.device_id}-${i}`}
                  device={device}
                  isDone={completedIds.includes(device.booking_item_id)}
                  onPerform={handlePerform}
                />
              ))}
            </View>
          )}

          {packages.map((pkg: RawPackageItem, pIdx: number) => (
            <View key={`pkg-${pkg.package_id}-${pIdx}`} style={styles.group}>
              <Text style={styles.pkgLabel}>{pkg.package_name}</Text>
              {(pkg.included_tests ?? []).map((test: RawDeviceItem, tIdx: number) => (
                <DeviceCard
                  key={`test-${test.device_id}-${tIdx}`}
                  device={test}
                  isDone={completedIds.includes(test.booking_item_id)}
                  onPerform={handlePerform}
                />
              ))}
            </View>
          ))}

          {/* Bottom spacer so the PDF button doesn't overlap last card */}
          <View style={{ height: vs(8) }} />
        </ScrollView>

        {/* Generate PDF — sticky footer, enabled only when all devices are done */}
        <SafeAreaView edges={['bottom']} style={styles.pdfFooter}>
          <View style={styles.pdfProgressRow}>
            <Text style={styles.pdfProgressText}>
              {completedIds.length} / {totalCount} tests completed
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.pdfBtn, !allDone && styles.pdfBtnDisabled]}
            onPress={() => { void handleGeneratePdf(); }}
            disabled={!allDone || isPdfLoading}
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
                  color={allDone ? COLORS.WHITE : '#9CA3AF'}
                  style={{ marginRight: ms(8) }}
                />
                <Text style={[styles.pdfBtnText, !allDone && styles.pdfBtnTextDisabled]}>
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
        title="Device Unavailable"
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
  deviceName: {
    flex: 1,
    fontSize: ms(16),
    fontWeight: '700',
    color: TEXT_DARK,
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
