import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  BackHandler,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
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
import { Linking } from 'react-native';
import PreventiveHealthHeader from './PreventiveHealthHeader';
import { COLORS } from '../../../Constants/theme';
import type { RootStackParamList } from '../../../navigation/types';
import CustomPopup from '../Components/CustomPopup';
import ReportPdfViewer from '../../../Components/ReportPdfViewer/ReportPdfViewer';
import {
  formatLabSlotRange,
  formatLocalYmd,
  getLabPatients,
  labPatientLocationLabel,
  labPatientServiceYmd,
  labPatientSlotBounds,
  labPatientTestLabel,
  type LabPatientFilter,
  type LabPatientRecord,
  type RawDeviceItem,
} from './PreventiveHealthAPI';
import axiosInstance from '../../../api/axiosInstance';
import { pickBackendDeviceByTestName } from '../../../Utils/pickBackendDeviceByTestName';
import { applyLabIotPerformTestNavigation } from '../../../Utils/labIotPerformTest';
import {
  runGenvcarePerformTestIfApplicable,
  GENVCARE_REPORT_IN_PROGRESS_TITLE,
  GENVCARE_REPORT_IN_PROGRESS_MESSAGE,
} from '../../../Utils/genvcarePerformTest';
import { getPatientBookingDevices } from '../../../Utils/labPatientGenvcare';

const PRIMARY = COLORS.PRIMARY;
const PAGE_BG = '#F3F4F6';
const CARD_BORDER = '#E5E7EB';
const TEXT_MUTED = '#6B7280';
const TEXT_DARK = '#111827';
const REPORT_BG = '#0B1220';

const TABS: { id: LabPatientFilter; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
  { id: 'missed', label: 'Missed' },
];

const HOME_NO_TESTS_COPY = 'No tests Available . ';

type TestActivityNav = NativeStackNavigationProp<RootStackParamList>;

type ReportByBookingResponse = {
  success: boolean;
  message?: string;
  data?: {
    report_url?: string;
  };
};

function ActivityTabBar({
  activeTab,
  onChange,
}: {
  activeTab: LabPatientFilter;
  onChange: (id: LabPatientFilter) => void;
}) {
  return (
    <View style={styles.tabRow}>
      {TABS.map(tab => {
        const active = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[styles.tabPill, active ? styles.tabPillActive : styles.tabPillInactive]}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabLabel, active ? styles.tabLabelActive : styles.tabLabelInactive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CompletedTestCard({
  patientName,
  patientId,
  testName,
  location,
  onSeeDetails,
  onViewReport,
}: {
  patientName: string;
  patientId: string;
  testName: string;
  location: string;
  onSeeDetails: () => void;
  onViewReport: () => void;
}) {
  return (
    <View style={styles.completedCard}>
      <Text style={styles.completedNameRow} numberOfLines={2}>
        <Text style={styles.patientName}>{patientName}</Text>
        <Text style={styles.patientId}> ({patientId})</Text>
      </Text>
      <Text style={styles.completedTestTitle}>{testName}</Text>
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={ms(16)} color={PRIMARY} />
        <Text style={styles.locationText}>{location}</Text>
      </View>
      <View style={styles.completedHairline} />
      <View style={styles.completedActionsRow}>
        <TouchableOpacity onPress={onSeeDetails} hitSlop={8}>
          <Text style={styles.completedSeeDetails}>See details</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewReport} hitSlop={8}>
          <Text style={styles.viewReport}>View Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UpcomingStyleTestCard({
  patientName,
  patientId,
  testName,
  time,
  paymentStatus,
  paymentMethod,
  onSeeDetails,
  onPerformTest,
  performDisabled,
  hospitalMrn,
}: {
  patientName: string;
  patientId: string;
  testName: string;
  time: string;
  paymentStatus: string;
  paymentMethod: string;
  onSeeDetails: () => void;
  onPerformTest: () => void;
  performDisabled: boolean;
  hospitalMrn?: string | null;
}) {
  const isPaid = (paymentStatus || '').toLowerCase() === 'paid';
  const statusLabel = paymentStatus
    ? paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1).toLowerCase()
    : '—';
  const methodLabel = paymentMethod
    ? paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1).toLowerCase()
    : '';
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardNameRow} numberOfLines={2}>
          <Text style={styles.patientName}>{patientName}</Text>
          <Text style={styles.patientId}> ({patientId})</Text>
        </Text>
        <TouchableOpacity onPress={onSeeDetails} hitSlop={8}>
          <Text style={styles.seeDetailsUpcoming}>See details</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.testName}>{testName}</Text>
      {hospitalMrn ? <Text style={styles.mrnText}>MRN: {hospitalMrn}</Text> : null}
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <Ionicons name="time-outline" size={ms(16)} color={PRIMARY} />
          <Text style={styles.metaTimeText}>{time}</Text>
        </View>
        <View style={styles.metaRight}>
          <View style={[styles.rupeeBadge, !isPaid ? styles.rupeeBadgeDue : null]}>
            <Text style={styles.rupeeSymbol}>₹</Text>
          </View>
          <View style={styles.payStack}>
            <Text style={[styles.payLabel, !isPaid ? styles.payLabelDue : null]}>{statusLabel}</Text>
            {methodLabel ? (
              <View style={[styles.methodPill, !isPaid ? styles.methodPillDue : null]}>
                <Text style={[styles.methodPillText, !isPaid ? styles.methodPillTextDue : null]}>
                  {methodLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.performBtn, performDisabled ? styles.performBtnDisabled : null]}
        onPress={onPerformTest}
        activeOpacity={0.85}
        disabled={performDisabled}
      >
        <Text style={[styles.performBtnText, performDisabled ? styles.performBtnTextDisabled : null]}>
          Perform Test
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const TestActivity: React.FC = () => {
  const navigation = useNavigation<TestActivityNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'TestActivity'>>();
  const [activeTab, setActiveTab] = useState<LabPatientFilter>(() => {
    const t = route.params?.initialTab;
    if (t === 'upcoming' || t === 'completed' || t === 'pending' || t === 'missed') {
      return t;
    }
    return 'upcoming';
  });
  const [rawPatients, setRawPatients] = useState<LabPatientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportUrl, setReportUrl] = useState<string>('');
  const [reportBookingId, setReportBookingId] = useState<string>('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string>('');
  const [reportNonce, setReportNonce] = useState(0);
  const [viewerLoading, setViewerLoading] = useState(false);
  const openReportSeqRef = useRef(0);
  const [deviceUnavailablePopupVisible, setDeviceUnavailablePopupVisible] = useState(false);
  const [deviceUnavailablePopupMessage, setDeviceUnavailablePopupMessage] = useState('');
  const [genvcareVendorPopupVisible, setGenvcareVendorPopupVisible] = useState(false);

  const closeDeviceUnavailablePopup = useCallback(() => {
    setDeviceUnavailablePopupVisible(false);
  }, []);

  const closeGenvcareVendorPopup = useCallback(() => {
    setGenvcareVendorPopupVisible(false);
  }, []);


  const displayPatients = useMemo(() => {
    const todayYmd = formatLocalYmd(new Date());
  
    const getStatus = (p: LabPatientRecord) =>
      (p.test_status || '').toLowerCase();
  
    // ✅ UPCOMING
    if (activeTab === 'upcoming') {
      // API already supports `filter=upcoming` (used in HomeScreen), so render it directly.
      return rawPatients;
    }
  
    // ✅ COMPLETED
    if (activeTab === 'completed') {
      return rawPatients.filter(
        p =>
          getStatus(p) === 'completed' &&
          labPatientServiceYmd(p) === todayYmd
      );
    }
  
    // ✅ PENDING
    if (activeTab === 'pending') {
      return rawPatients.filter(
        p => getStatus(p) === 'pending'
      );
    }
  
    // ✅ MISSED
    if (activeTab === 'missed') {
      return rawPatients.filter(
        p => getStatus(p) === 'missed'
      );
    }
  
    return [];
  }, [activeTab, rawPatients]);

  useFocusEffect(
    useCallback(() => {
      const t = route.params?.initialTab;
      if (t === 'upcoming' || t === 'completed' || t === 'pending' || t === 'missed') {
        setActiveTab(t);
      }
    }, [route.params?.initialTab]),
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const list = await getLabPatients(activeTab);
        if (!cancelled) {
          setRawPatients(list);
        }
      } catch {
        if (!cancelled) {
          setRawPatients([]);
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
  }, [activeTab]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await getLabPatients(activeTab);
      setRawPatients(list);
    } catch {
      // silently retain existing data on refresh failure
    } finally {
      setRefreshing(false);
    }
  }, [activeTab]);

  const missedSections = useMemo(() => {
    if (activeTab === 'upcoming') {
      return [] as { ymd: string; items: LabPatientRecord[] }[];
    }
    const byYmd = new Map<string, LabPatientRecord[]>();
    for (const p of rawPatients) {
      const raw = labPatientServiceYmd(p);
      const key =
        raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
      if (!byYmd.has(key)) {
        byYmd.set(key, []);
      }
      byYmd.get(key)!.push(p);
    }
    const known = Array.from(byYmd.keys()).filter(k => k !== '');
    known.sort((a, b) => b.localeCompare(a));
    const out: { ymd: string; items: LabPatientRecord[] }[] = known.map(ymd => ({
      ymd,
      items: byYmd.get(ymd)!,
    }));
    if (byYmd.has('')) {
      out.push({ ymd: '', items: byYmd.get('')! });
    }
    return out;
  }, [activeTab, rawPatients]);

  const upcomingSections = useMemo(() => {
    if (activeTab !== 'missed') {
      return [] as { ymd: string; items: LabPatientRecord[] }[];
    }
    const byYmd = new Map<string, LabPatientRecord[]>();
    for (const p of rawPatients) {
      const raw = labPatientServiceYmd(p);
      const key =
        raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
      if (!byYmd.has(key)) {
        byYmd.set(key, []);
      }
      byYmd.get(key)!.push(p);
    }
    const known = Array.from(byYmd.keys()).filter(k => k !== '');
    known.sort((a, b) => b.localeCompare(a));
    const out: { ymd: string; items: LabPatientRecord[] }[] = known.map(ymd => ({
      ymd,
      items: byYmd.get(ymd)!,
    }));
    if (byYmd.has('')) {
      out.push({ ymd: '', items: byYmd.get('')! });
    }
    return out;
  }, [activeTab, rawPatients]);

  const resolveCardHospitalMrn = useCallback((p: LabPatientRecord): string | null | undefined => {
    const devices = getPatientBookingDevices(p);
    const isSingleDevice =
      devices.length === 1 ||
      (devices.length === 0 &&
        ((p.device_names?.length ?? 0) === 1 || (p.device_ids?.length ?? 0) === 1));
    if (!isSingleDevice) {
      return undefined;
    }
    const mrn = (p.hospital_mrn ?? '').trim();
    return mrn || null;
  }, []);

  const goTestDetails = useCallback(
    (p: LabPatientRecord) => {
      const id = (p.id ?? '').trim();
      if (!id) return;
      navigation.navigate('TestDetails', { patientId: id, filter: activeTab });
    },
    [navigation, activeTab],
  );

  const closeReport = useCallback(() => {
    openReportSeqRef.current += 1;
    setReportVisible(false);
    setReportUrl('');
    setReportBookingId('');
    setReportError('');
    setReportLoading(false);
    setViewerLoading(false);
  }, []);

  const openReportByBookingId = useCallback(async (bookingId: string | undefined | null) => {
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    const seq = ++openReportSeqRef.current;
    try {
      setReportError('');
      setReportLoading(true);
      setViewerLoading(true);
      setReportUrl('');
      setReportBookingId(id);
      // Force PDF viewer remount + bypass cache on re-open for same report.
      setReportNonce(n => n + 1);
      setReportVisible(true);
      // No leading `/` — axios merges with baseURL; a leading `/` drops `/api/v1` and returns 404.
      const path = `reports/by-booking/${id}`;
      const res = await axiosInstance.get<ReportByBookingResponse>(path);
      if (seq !== openReportSeqRef.current) return;

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Failed to load report');
      }
      const url = String(res.data?.data?.report_url ?? '').trim();
      if (!url) {
        throw new Error('Report URL not available');
      }
      setReportUrl(url);
    } catch (e) {
      if (seq !== openReportSeqRef.current) return;
      const msg = e instanceof Error ? e.message : 'Failed to load report';
      setReportError(msg);
    } finally {
      if (seq === openReportSeqRef.current) {
        setReportLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isNavigating = false;
      const handleBack = () => {
        if (isNavigating) return true;
        isNavigating = true;
        navigation.replace('Home');
        return true;
      };
      let sub: { remove: () => void } | undefined;
      if (Platform.OS === 'android') {
        sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
      }
      return () => sub?.remove();
    }, [navigation]),
  );

  const isCompletedTab = activeTab === 'completed';
  const listIsEmpty =
    !loading &&
    (activeTab === 'completed'
      ? displayPatients.length === 0
      : displayPatients.length === 0);

  const canPerformTestNow = useCallback(
    (p: LabPatientRecord) => {
      // Only explicitly blocked by backend should stop the action.
      if (p.can_perform_test === false) return false;

      const bounds = labPatientSlotBounds(p);
      if (!bounds) return false;

      const now = new Date();
      // Ensure we're evaluating against today's local date.
      if (formatLocalYmd(bounds.start) !== formatLocalYmd(now)) return false;

      return now.getTime() >= bounds.start.getTime() && now.getTime() < bounds.end.getTime();
    },
    [],
  );

  /**
   * Central perform-test handler.
   * - If the patient has >1 device (standalone + package tests combined) → show selection modal.
   * - If exactly 1 device → navigate directly.
   * - If no structured device data → fall back to the flat-array picker (backward compat).
   */
  const handlePerformTest = useCallback(
    (p: LabPatientRecord) => {
      const standaloneDevices = p.devices ?? [];
      const packageDevices = (p.packages ?? []).flatMap(pkg => pkg.included_tests ?? []);
      const allDevices: RawDeviceItem[] = [...standaloneDevices, ...packageDevices];

      if (allDevices.length > 1) {
        navigation.navigate('DeviceSelect', {
          patientName: (p.full_name ?? '').trim() || '—',
          bookingId: p.booking_id ?? null,
          devices: p.devices ?? [],
          packages: p.packages ?? [],
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
              deviceIds: p.device_ids ?? null,
              deviceNames: p.device_names ?? null,
              bookingItemIds: p.booking_item_ids ?? null,
              testName: labPatientTestLabel(p),
            });

      void (async () => {
        const genvcareResult = await runGenvcarePerformTestIfApplicable(
          navigation.navigate,
          {
            bookingId: p.booking_id,
            deviceId: picked.deviceId,
            deviceName: picked.deviceName,
            logContext: 'TestActivity Perform Test',
          },
        );
        if (genvcareResult.status === 'success') {
          return;
        }
        if (genvcareResult.status === 'vendor_server_error') {
          setGenvcareVendorPopupVisible(true);
          return;
        }

        if (
          applyLabIotPerformTestNavigation(
            navigation.navigate,
            picked.deviceId,
            picked.deviceName ?? labPatientTestLabel(p),
            picked.bookingItemId,
            p.booking_id ?? null,
          )
        ) {
          return;
        }

        const nameForMsg = picked.deviceName ?? labPatientTestLabel(p);
        setDeviceUnavailablePopupMessage(`No device available for this ${nameForMsg}`);
        setDeviceUnavailablePopupVisible(true);
      })();
    },
    [navigation.navigate],
  );

  type ActivityListItem =
    | { kind: 'completed'; patient: LabPatientRecord; key: string }
    | { kind: 'upcoming'; patient: LabPatientRecord; key: string }
    | { kind: 'missed'; section: { ymd: string; items: LabPatientRecord[] }; key: string };

  const activityListData = useMemo((): ActivityListItem[] => {
    if (loading || listIsEmpty) {
      return [];
    }
    if (isCompletedTab) {
      return displayPatients.map((p, index) => ({
        kind: 'completed' as const,
        patient: p,
        key: `${p.id ?? p.user_id ?? 'c'}-${index}`,
      }));
    }
    if (activeTab === 'missed') {
      return missedSections.map((section, sIdx) => ({
        kind: 'missed' as const,
        section,
        key: section.ymd || `unknown-${sIdx}`,
      }));
    }
    return displayPatients.map((p, index) => ({
      kind: 'upcoming' as const,
      patient: p,
      key: `${p.id ?? p.user_id ?? 'u'}-${index}`,
    }));
  }, [
    loading,
    listIsEmpty,
    isCompletedTab,
    activeTab,
    displayPatients,
    missedSections,
  ]);

  const renderActivityItem = useCallback(
    ({ item, index }: { item: ActivityListItem; index: number }) => {
      if (item.kind === 'completed') {
        const p = item.patient;
        return (
          <CompletedTestCard
            patientName={(p.full_name ?? '').trim() || '—'}
            patientId={String(p.user_id ?? p.id ?? '')}
            testName={labPatientTestLabel(p)}
            location={labPatientLocationLabel(p)}
            onSeeDetails={() => goTestDetails(p)}
            onViewReport={() => openReportByBookingId(p.booking_id)}
          />
        );
      }
      if (item.kind === 'missed') {
        const section = item.section;
        return (
          <View style={index > 0 ? styles.missedDateBlock : null}>
            <Text style={styles.missedDateLabel} numberOfLines={1}>
              {section.ymd || '—'}
            </Text>
            {section.items.map((p, pIndex) => (
              <UpcomingStyleTestCard
                key={`${p.id ?? p.user_id ?? 'm'}-${section.ymd}-${pIndex}`}
                patientName={(p.full_name ?? '').trim() || '—'}
                patientId={String(p.user_id ?? p.id ?? '')}
                testName={labPatientTestLabel(p)}
                time={formatLabSlotRange(p.slot_start_time, p.slot_end_time)}
                paymentStatus={p.payment_status ?? 'pending'}
                paymentMethod={p.payment_method ?? ''}
                onSeeDetails={() => goTestDetails(p)}
                onPerformTest={() => handlePerformTest(p)}
                performDisabled={false}
                hospitalMrn={resolveCardHospitalMrn(p)}
              />
            ))}
          </View>
        );
      }
      const p = item.patient;
      return (
        <UpcomingStyleTestCard
          patientName={(p.full_name ?? '').trim() || '—'}
          patientId={String(p.user_id ?? p.id ?? '')}
          testName={labPatientTestLabel(p)}
          time={formatLabSlotRange(p.slot_start_time, p.slot_end_time)}
          paymentStatus={p.payment_status ?? 'pending'}
          paymentMethod={p.payment_method ?? ''}
          onSeeDetails={() => goTestDetails(p)}
          onPerformTest={() => handlePerformTest(p)}
          performDisabled={!canPerformTestNow(p)}
          hospitalMrn={resolveCardHospitalMrn(p)}
        />
      );
    },
    [
      canPerformTestNow,
      goTestDetails,
      handlePerformTest,
      openReportByBookingId,
      resolveCardHospitalMrn,
    ],
  );

  const activityListEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PRIMARY} size="large" />
        </View>
      );
    }
    if (listIsEmpty) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{HOME_NO_TESTS_COPY}</Text>
        </View>
      );
    }
    return null;
  }, [loading, listIsEmpty]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <View style={styles.flex1}>
        <View style={styles.headerShell}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <PreventiveHealthHeader
              title="Test Activity"
              onBackPress={() => navigation.goBack()}
              rightSlot={
                <TouchableOpacity
                  onPress={() => navigation.navigate('Reports')}
                  style={{ padding: ms(6) }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Test Activity action"
                >
                  <Ionicons name="document-text-outline" size={ms(24)} color={COLORS.WHITE} />
                </TouchableOpacity>
              }
            />
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <ActivityTabBar activeTab={activeTab} onChange={setActiveTab} />

          <FlashList
            data={activityListData}
            renderItem={renderActivityItem}
            keyExtractor={item => item.key}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onPullRefresh}
                colors={[COLORS.PRIMARY]}
                tintColor={COLORS.PRIMARY}
              />
            }
            ListEmptyComponent={activityListEmpty}
          />
        </View>
      </View>

      <Modal
        visible={reportVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeReport}
      >
        <View style={styles.reportWrap}>
          <SafeAreaView edges={['top']} style={styles.reportSafeTop}>
            <View style={styles.reportTopBar}>
              <TouchableOpacity onPress={closeReport} hitSlop={10} accessibilityRole="button">
                <Ionicons name="close" size={ms(26)} color={COLORS.WHITE} />
              </TouchableOpacity>
              <Text style={styles.reportTitle} numberOfLines={1}>
                Report
              </Text>
              <View style={styles.reportTopRightSpacer} />
            </View>
          </SafeAreaView>

          {reportLoading ? (
            <View style={styles.reportCenter}>
              <ActivityIndicator color={COLORS.WHITE} size="large" />
              <Text style={styles.reportHint}>Loading report…</Text>
            </View>
          ) : reportError ? (
            <View style={styles.reportCenter}>
              <Text style={styles.reportErrorTitle}>Unable to open report</Text>
              <Text style={styles.reportErrorMsg}>{reportError}</Text>
              <Pressable style={styles.reportRetryBtn} onPress={closeReport}>
                <Text style={styles.reportRetryText}>Close</Text>
              </Pressable>
            </View>
          ) : reportUrl ? (
            <ReportPdfViewer
              reportUrl={reportUrl}
              reportBookingId={reportBookingId}
              reportNonce={reportNonce}
              viewerLoading={viewerLoading}
              showOpeningHint={false}
              onViewerLoadingChange={setViewerLoading}
              onViewerError={() =>
                setReportError('Something went wrong while opening the report.')
              }
              onOpenInBrowser={() => {
                Linking.openURL(reportUrl).catch(() => {
                  /* noop */
                });
              }}
              onClose={closeReport}
              styles={{
                reportViewerShell: styles.reportViewerShell,
                viewerLoadingOverlay: styles.viewerLoadingOverlay,
                reportCenter: styles.reportCenter,
                reportHint: styles.reportHint,
                reportErrorTitle: styles.reportErrorTitle,
                reportErrorMsg: styles.reportErrorMsg,
                reportRetryBtn: styles.reportRetryBtn,
                reportRetryText: styles.reportRetryText,
              }}
            />
          ) : (
            <View style={styles.reportCenter}>
              <Text style={styles.reportErrorMsg}>Report URL not available.</Text>
              <Pressable style={styles.reportRetryBtn} onPress={closeReport}>
                <Text style={styles.reportRetryText}>Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
      <CustomPopup
        isVisible={deviceUnavailablePopupVisible}
        onClose={closeDeviceUnavailablePopup}
        onConfirm={closeDeviceUnavailablePopup}
        title="Device Unavailable"
        message={deviceUnavailablePopupMessage}
        showIcon={false}
      />
      <CustomPopup
        isVisible={genvcareVendorPopupVisible}
        onClose={closeGenvcareVendorPopup}
        onConfirm={closeGenvcareVendorPopup}
        title={GENVCARE_REPORT_IN_PROGRESS_TITLE}
        message={GENVCARE_REPORT_IN_PROGRESS_MESSAGE}
        iconName="alert-circle-outline"
        showIcon
      />
    </>
  );
};

export default TestActivity;

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
  body: {
    flex: 1,
    paddingTop: vs(12),
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: ms(14),
    gap: ms(8),
    marginBottom: vs(12),
    justifyContent: 'center',
  },
  tabPill: {
    paddingVertical: ms(8),
    paddingHorizontal: ms(14),
    borderRadius: ms(22),
    borderWidth: StyleSheet.hairlineWidth * 2,
    minWidth: ms(72),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  tabPillInactive: {
    backgroundColor: COLORS.WHITE,
    borderColor: CARD_BORDER,
  },
  tabLabel: {
    fontSize: ms(13),
    fontWeight: '600',
  },
  tabLabelActive: {
    color: COLORS.WHITE,
  },
  tabLabelInactive: {
    color: TEXT_MUTED,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ms(16),
    paddingBottom: vs(28),
    flexGrow: 1,
  },
  loadingWrap: {
    paddingVertical: vs(48),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: vs(200),
  },
  completedCard: {
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
  completedNameRow: {
    fontSize: ms(15),
  },
  completedTestTitle: {
    marginTop: vs(8),
    fontSize: ms(14),
    color: TEXT_DARK,
    fontWeight: '400',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    marginTop: vs(10),
  },
  locationText: {
    flex: 1,
    fontSize: ms(14),
    color: PRIMARY,
    fontWeight: '500',
  },
  completedHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CARD_BORDER,
    marginTop: vs(14),
    marginBottom: vs(10),
  },
  completedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedSeeDetails: {
    fontSize: ms(12),
    fontWeight: '400',
    color: TEXT_MUTED,
  },
  viewReport: {
    fontSize: ms(12),
    fontWeight: '700',
    color: PRIMARY,
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ms(8),
  },
  cardNameRow: {
    flex: 1,
    minWidth: 0,
  },
  patientName: {
    fontSize: ms(15),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  patientId: {
    fontSize: ms(12),
    fontWeight: '400',
    color: TEXT_MUTED,
  },
  seeDetailsUpcoming: {
    fontSize: ms(13),
    fontWeight: '600',
    color: PRIMARY,
  },
  testName: {
    marginTop: vs(6),
    fontSize: ms(14),
    color: TEXT_DARK,
    fontWeight: '400',
  },
  mrnText: {
    marginTop: vs(4),
    fontSize: ms(13),
    fontWeight: '700',
    color: PRIMARY,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(10),
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    flexShrink: 1,
  },
  metaTimeText: {
    fontSize: ms(14),
    color: TEXT_DARK,
    fontWeight: '400',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ms(6),
  },
  payStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: ms(3),
  },
  rupeeBadge: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupeeBadgeDue: {
    backgroundColor: '#E65100',
  },
  rupeeSymbol: {
    color: COLORS.WHITE,
    fontSize: ms(11),
    fontWeight: '700',
    marginTop: -ms(1),
  },
  payLabel: {
    fontSize: ms(14),
    color: TEXT_DARK,
    fontWeight: '400',
  },
  payLabelDue: {
    color: '#E65100',
    fontWeight: '600',
  },
  methodPill: {
    paddingHorizontal: ms(7),
    paddingVertical: ms(2),
    borderRadius: ms(10),
    backgroundColor: PRIMARY + '18',
  },
  methodPillDue: {
    backgroundColor: '#E6510018',
  },
  methodPillText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: PRIMARY,
  },
  methodPillTextDue: {
    color: '#E65100',
  },
  performBtn: {
    marginTop: vs(14),
    backgroundColor: PRIMARY,
    borderRadius: ms(22),
    paddingVertical: vs(14),
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  performBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  performBtnText: {
    color: COLORS.WHITE,
    fontSize: ms(14),
    fontWeight: '700',
  },
  performBtnTextDisabled: {
    color: '#F3F4F6',
  },
  emptyWrap: {
    flex: 1,
    minHeight: vs(220),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(48),
  },
  emptyText: {
    fontSize: ms(14),
    color: TEXT_MUTED,
    fontWeight: '400',
    textAlign: 'center',
  },
  missedDateBlock: {
    marginTop: vs(12),
  },
  missedDateLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: vs(10),
  },

  reportWrap: {
    flex: 1,
    backgroundColor: REPORT_BG,
  },
  reportSafeTop: {
    backgroundColor: PRIMARY,
  },
  reportTopBar: {
    backgroundColor: PRIMARY,
    paddingHorizontal: ms(14),
    paddingVertical: vs(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ms(10),
  },
  reportTitle: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.WHITE,
    fontSize: ms(16),
    fontWeight: '700',
  },
  reportTopRightSpacer: {
    width: ms(26),
    height: ms(26),
  },
  reportCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(18),
  },
  reportHint: {
    marginTop: vs(10),
    fontSize: ms(13),
    color: '#CBD5E1',
    fontWeight: '500',
  },
  reportErrorTitle: {
    fontSize: ms(16),
    color: COLORS.WHITE,
    fontWeight: '700',
    textAlign: 'center',
  },
  reportErrorMsg: {
    marginTop: vs(8),
    fontSize: ms(13),
    color: '#CBD5E1',
    fontWeight: '500',
    textAlign: 'center',
  },
  reportRetryBtn: {
    marginTop: vs(16),
    backgroundColor: PRIMARY,
    borderRadius: ms(22),
    paddingHorizontal: ms(18),
    paddingVertical: vs(10),
  },
  reportRetryText: {
    color: COLORS.WHITE,
    fontSize: ms(14),
    fontWeight: '700',
  },
  reportViewerShell: {
    flex: 1,
    backgroundColor: REPORT_BG,
  },
  viewerLoadingOverlay: {
    position: 'absolute',
    right: ms(12),
    top: vs(12),
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

});
