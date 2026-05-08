import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  BackHandler,
  Modal,
  Dimensions,
  Pressable,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ms, vs } from 'react-native-size-matters';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { BlurView } from '@react-native-community/blur';

import PreventiveHealthHeader from './PreventiveHealthHeader';
import { COLORS } from '../../../Constants/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { getLabReports } from '../../../api/labReportsApi';
import axiosInstance from '../../../api/axiosInstance';
import { getLabPatients, type LabPatientFilter } from './PreventiveHealthAPI';

const PRIMARY = COLORS.PRIMARY;
const TEXT_MUTED = '#6B7280';
const TEXT_DARK = '#111827';
const DIVIDER = '#E5E7EB';
const CHIP_BORDER = '#D1D5DB';
const SIDEBAR_INACTIVE_BG = '#F3F4F6';
const MODAL_RADIUS = ms(20);

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_MAX_H = Math.min(SCREEN_H * 0.82, SCREEN_H - vs(40));

const TEST_TYPE_OPTIONS = [
  'enadi',
  'Spirometer',
  'ECG',
  'BMI',
  'NIBP',
  'Pulse Oxymeter',
  'Tempreture',
  'Glucometer',
  'HB Meter',
  'Stress Quantification',
  'Oral Scan',
  'Cervical Scan',
  'Auto Refractometer',
];

const TIME_RANGE_OPTIONS = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 30 Days',
  'This Month',
  'Last Month',
  'Custom Range',
];

type ReportRow = {
  id: string;
  bookingId?: string | null;
  name: string;
  patientId: string;
  dateLabel: string;
  reportType: string;
};

type ReportByBookingResponse = {
  success: boolean;
  message?: string;
  data?: {
    report_url?: string;
  };
};

type ReportsNav = NativeStackNavigationProp<RootStackParamList, 'Reports'>;
type SidebarTab = 'testType' | 'timeRange';

type ChipItem = { key: string; label: string };

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} filter`}
      >
        <Ionicons name="close" size={ms(16)} color={TEXT_MUTED} />
      </TouchableOpacity>
    </View>
  );
}

function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.checkRow}
      onPress={onToggle}
      activeOpacity={0.85}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? <Ionicons name="checkmark" size={ms(14)} color={PRIMARY} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReportListItem({
  item,
  isLast,
  onSeeDetails,
  onView,
  onDownload,
}: {
  item: ReportRow;
  isLast: boolean;
  onSeeDetails: () => void;
  onView: () => void;
  onDownload: () => void;
}) {
  return (
    <View style={[styles.listItem, !isLast && styles.listItemBorder]}>
      <View style={styles.listItemMain}>
        <View style={styles.listTextCol}>
          <Text style={styles.nameLine} numberOfLines={2}>
            {item.name} <Text style={styles.idParen}>({item.patientId})</Text>
          </Text>
          <Text style={styles.metaLine} numberOfLines={2}>
            {item.dateLabel} • {item.reportType}
          </Text>
          <TouchableOpacity onPress={onSeeDetails} hitSlop={6}>
            <Text style={styles.seeDetails}>See details</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionBtns}>
          <TouchableOpacity
            style={styles.iconSquare}
            onPress={onView}
            accessibilityRole="button"
            accessibilityLabel="View report"
          >
            <Ionicons name="eye-outline" size={ms(22)} color={PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconSquare}
            onPress={onDownload}
            accessibilityRole="button"
            accessibilityLabel="Download report"
          >
            <Ionicons name="download-outline" size={ms(22)} color={PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function toggleInList(list: string[], label: string): string[] {
  if (list.includes(label)) {
    return list.filter((x) => x !== label);
  }
  return [...list, label];
}

function toRangeParam(appliedTimes: string[]): { range?: string; from_date?: string | null; to_date?: string | null } {
  // Keep behavior stable: if multiple are selected, prefer the latest chosen one (last item).
  const picked = appliedTimes.length ? appliedTimes[appliedTimes.length - 1] : '';
  switch (picked) {
    case 'Today':
      return { range: 'today' };
    case 'Yesterday':
      return { range: 'yesterday' };
    case 'Last 7 Days':
      return { range: 'last_7_days' };
    case 'Last 30 Days':
      return { range: 'last_30_days' };
    case 'This Month':
      return { range: 'this_month' };
    case 'Last Month':
      return { range: 'last_month' };
    case 'Custom Range':
      return { range: 'custom' };
    default:
      return {};
  }
}

function formatDateLabel(isoLike: string | undefined): string {
  if (!isoLike) return '';
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const Reports: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const insets = useSafeAreaInsets();

  const WebView = useMemo(() => {
    try {
      // Important: don't require at module scope, or RN will crash if the native module
      // hasn't been rebuilt/linked yet (common after adding dependency).
      return require('react-native-webview').default as React.ComponentType<any>;
    } catch (e) {
      console.log('[report] WebView module not available:', e);
      return null;
    }
  }, []);

  const [appliedTests, setAppliedTests] = useState<string[]>([]);
  const [appliedTimes, setAppliedTimes] = useState<string[]>([]);
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [reportVisible, setReportVisible] = useState(false);
  const [reportUrl, setReportUrl] = useState<string>('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string>('');
  const [reportNonce, setReportNonce] = useState(0);
  const [viewerLoading, setViewerLoading] = useState(false);

  const [filterVisible, setFilterVisible] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('testType');
  const [draftTests, setDraftTests] = useState<string[]>([]);
  const [draftTimes, setDraftTimes] = useState<string[]>([]);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const requestSeq = useRef(0);

  const chips: ChipItem[] = useMemo(() => {
    const testItems = appliedTests.map((label) => ({ key: `t:${label}`, label }));
    const timeItems = appliedTimes.map((label) => ({ key: `r:${label}`, label }));
    return [...testItems, ...timeItems];
  }, [appliedTests, appliedTimes]);

  const openFilter = useCallback(() => {
    setDraftTests([...appliedTests]);
    setDraftTimes([...appliedTimes]);
    setSidebarTab('testType');
    setFilterVisible(true);
  }, [appliedTests, appliedTimes]);

  const closeFilter = useCallback(() => {
    setFilterVisible(false);
  }, []);

  const clearDraftAll = useCallback(() => {
    setDraftTests([]);
    setDraftTimes([]);
    setCustomFrom('');
    setCustomTo('');
  }, []);

  const applyFilters = useCallback(() => {
    setAppliedTests([...draftTests]);
    setAppliedTimes([...draftTimes]);
    setFilterVisible(false);
  }, [draftTests, draftTimes]);

  const removeChipByKey = useCallback(
    (key: string) => {
      if (key.startsWith('t:')) {
        const label = key.slice(2);
        setAppliedTests((prev) => prev.filter((x) => x !== label));
      } else if (key.startsWith('r:')) {
        const label = key.slice(2);
        setAppliedTimes((prev) => prev.filter((x) => x !== label));
      }
    },
    []
  );

  const showCustomRange = draftTimes.includes('Custom Range');

  const fetchReports = useCallback(
    async (page = 1, limit = 20) => {
      const seq = ++requestSeq.current;
      setIsLoading(true);
      try {
        const rangePayload = toRangeParam(appliedTimes);
        const res = await getLabReports({
          test_types: appliedTests,
          range: rangePayload.range ?? 'last_30_days',
          from_date:
            rangePayload.range === 'custom' ? (customFrom?.trim() ? customFrom.trim() : null) : null,
          to_date:
            rangePayload.range === 'custom' ? (customTo?.trim() ? customTo.trim() : null) : null,
          page,
          limit,
        });
        if (seq !== requestSeq.current) return;

        const mapped: ReportRow[] = (res.data ?? []).map((r) => {
          const types = Array.isArray(r.test_types) ? r.test_types : [];
          const reportType = types.length ? types.join(', ') : 'Report';
          const dateLabel = formatDateLabel(r.booking_date ?? r.created_at) || '—';
          const patientId =
            (r.patient_phone && String(r.patient_phone)) ||
            (r.patient_id ? String(r.patient_id).slice(0, 10).toUpperCase() : '—');
          return {
            id: r.id ?? r.booking_id,
            bookingId: r.booking_id ?? null,
            name: r.patient_name ?? '—',
            patientId,
            dateLabel,
            reportType,
          };
        });
        setRows(mapped);
      } catch (e) {
        if (seq !== requestSeq.current) return;
        setRows([]);
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false);
        }
      }
    },
    [appliedTests, appliedTimes, customFrom, customTo],
  );

  const closeReport = useCallback(() => {
    setReportVisible(false);
    setReportUrl('');
    setReportError('');
    setReportLoading(false);
    setViewerLoading(false);
  }, []);

  const openReportByBookingId = useCallback(async (bookingId: string | undefined | null) => {
    const id = String(bookingId ?? '').trim();
    if (!id) return;
    try {
      setReportError('');
      setReportLoading(true);
      setViewerLoading(true);
      setReportUrl('');

      // Force WebView remount + bypass cache on re-open for same report.
      setReportNonce((n) => n + 1);
      setReportVisible(true);

      const path = `/reports/by-booking/${id}`;
      console.log('[report] booking_id:', id);
      console.log('[report] GET', path);
      const res = await axiosInstance.get<ReportByBookingResponse>(path);
      console.log('[report] status:', res.status);
      console.log('[report] body:', res.data);

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Failed to load report');
      }

      const url = String(res.data?.data?.report_url ?? '').trim();
      if (!url) {
        throw new Error('Report URL not available');
      }

      console.log('[report] report_url:', url);
      setReportUrl(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load report';
      setReportError(msg);
    } finally {
      setReportLoading(false);
    }
  }, []);

  const goToTestDetailsByBookingId = useCallback(
    async (bookingId: string | undefined | null) => {
      const id = String(bookingId ?? '').trim();
      if (!id) return;

      const filtersToTry: LabPatientFilter[] = ['completed', 'pending', 'missed', 'upcoming'];
      try {
        for (const filter of filtersToTry) {
          const list = await getLabPatients(filter);
          const found = list.find((p) => String(p.booking_id ?? '').trim() === id);
          const patientId = String(found?.id ?? '').trim();
          if (patientId) {
            navigation.navigate('TestDetails', { patientId, filter });
            return;
          }
        }
        console.log('[reports] no patient found for booking_id:', id);
      } catch (e) {
        console.log('[reports] failed to resolve TestDetails by booking_id:', id, e);
      }
    },
    [navigation],
  );

  useFocusEffect(
    useCallback(() => {
      let isNavigating = false;
      const handleBack = () => {
        if (reportVisible) {
          closeReport();
          return true;
        }
        if (filterVisible) {
          setFilterVisible(false);
          return true;
        }
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
    }, [navigation, filterVisible, reportVisible, closeReport])
  );

  useFocusEffect(
    useCallback(() => {
      fetchReports(1, 20);
      return undefined;
    }, [fetchReports]),
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <View style={styles.flex1}>
        <View style={styles.headerShell}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <PreventiveHealthHeader title="Reports" onBackPress={() => navigation.goBack()} />
          </SafeAreaView>
        </View>

        <View style={styles.filterRow}>
          <ScrollView
            style={styles.chipScrollWrap}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {chips.map((c) => (
              <FilterChip key={c.key} label={c.label} onRemove={() => removeChipByKey(c.key)} />
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={openFilter}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open filters"
          >
            <Ionicons name="options-outline" size={ms(26)} color={TEXT_DARK} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {(rows ?? []).map((item, index, arr) => (
            <ReportListItem
              key={item.id}
              item={item}
              isLast={index === arr.length - 1}
              onSeeDetails={() => {
                void goToTestDetailsByBookingId(item.bookingId ?? item.id);
              }}
              onView={() => {
                if (!item.bookingId) {
                  console.log('[report] bookingId missing for row:', item.id);
                  return;
                }
                openReportByBookingId(item.bookingId);
              }}
              onDownload={() => {}}
            />
          ))}
          {!isLoading && (rows ?? []).length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <Text style={styles.emptyStateText}>No reports Available</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closeFilter}
      >
        <View style={styles.modalRoot}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={Platform.OS === 'ios' ? 10 : 12}
            reducedTransparencyFallbackColor="rgba(30, 30, 35, 0.72)"
            {...Platform.select({
              android: { blurRadius: 4, overlayColor: 'transparent' },
              default: {},
            })}
          />
          <View style={styles.modalDim} pointerEvents="none" />
          <Pressable style={styles.modalDismissArea} onPress={closeFilter} accessibilityLabel="Dismiss filters" />
          <View
            style={[
              styles.sheetOuter,
              {
                maxHeight: SHEET_MAX_H,
                paddingBottom: Math.max(insets.bottom, vs(8)),
              },
            ]}
          >
            <View style={styles.sheetHandleArea}>
              <View style={styles.sheetGrab} />
            </View>

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <View style={styles.sheetHeaderRight}>
                <TouchableOpacity
                  style={styles.closeCircle}
                  onPress={closeFilter}
                  accessibilityRole="button"
                  accessibilityLabel="Close filters"
                >
                  <Ionicons name="close" size={ms(22)} color={TEXT_DARK} />
                </TouchableOpacity>
                <TouchableOpacity onPress={clearDraftAll} hitSlop={6}>
                  <Text style={styles.clearAllText}>Clear all filters</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sheetBody}>
              <View style={styles.sidebar}>
                <TouchableOpacity
                  style={[styles.sideItem, sidebarTab === 'testType' && styles.sideItemActive]}
                  onPress={() => setSidebarTab('testType')}
                  activeOpacity={0.9}
                >
                  {sidebarTab === 'testType' ? <View style={styles.sideAccent} /> : null}
                  <Text
                    style={[styles.sideLabel, sidebarTab === 'testType' && styles.sideLabelActive]}
                    numberOfLines={2}
                  >
                    Test Type
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sideItem, sidebarTab === 'timeRange' && styles.sideItemActive]}
                  onPress={() => setSidebarTab('timeRange')}
                  activeOpacity={0.9}
                >
                  {sidebarTab === 'timeRange' ? <View style={styles.sideAccent} /> : null}
                  <Text
                    style={[styles.sideLabel, sidebarTab === 'timeRange' && styles.sideLabelActive]}
                    numberOfLines={3}
                  >
                    Select Time Range
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sheetDividerV} />

              <ScrollView
                style={styles.optionsScroll}
                contentContainerStyle={styles.optionsScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {sidebarTab === 'testType' ? (
                  TEST_TYPE_OPTIONS.map((opt) => (
                    <CheckboxRow
                      key={opt}
                      label={opt}
                      checked={draftTests.includes(opt)}
                      onToggle={() => setDraftTests((p) => toggleInList(p, opt))}
                    />
                  ))
                ) : (
                  <>
                    {TIME_RANGE_OPTIONS.map((opt) => (
                      <CheckboxRow
                        key={opt}
                        label={opt}
                        checked={draftTimes.includes(opt)}
                        onToggle={() => setDraftTimes((p) => toggleInList(p, opt))}
                      />
                    ))}
                    {showCustomRange ? (
                      <View style={styles.dateRow}>
                        <View style={styles.dateField}>
                          <Ionicons name="calendar-outline" size={ms(18)} color={TEXT_MUTED} style={styles.dateIcon} />
                          <TextInput
                            style={styles.dateInput}
                            placeholder="From date"
                            placeholderTextColor={TEXT_MUTED}
                            value={customFrom}
                            onChangeText={setCustomFrom}
                          />
                        </View>
                        <View style={styles.dateField}>
                          <Ionicons name="calendar-outline" size={ms(18)} color={TEXT_MUTED} style={styles.dateIcon} />
                          <TextInput
                            style={styles.dateInput}
                            placeholder="To date"
                            placeholderTextColor={TEXT_MUTED}
                            value={customTo}
                            onChangeText={setCustomTo}
                          />
                        </View>
                      </View>
                    ) : null}
                  </>
                )}
              </ScrollView>
            </View>

            <View style={styles.sheetFooter}>
              {/* <View style={styles.resultBlock}>
                <Text style={styles.resultCount}>{isLoading ? '…' : String((rows ?? []).length)}</Text>
                <Text style={styles.resultSub}>Test Found</Text>
              </View> */}
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilters} activeOpacity={0.9}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            WebView ? (
              <View style={styles.reportViewerShell}>
                <WebView
                  key={`report-${reportNonce}`}
                  source={{
                    uri:
                      Platform.OS === 'android'
                        ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
                            reportUrl,
                          )}&_=${reportNonce}`
                        : `${reportUrl}${reportUrl.includes('?') ? '&' : '?'}_=${reportNonce}`,
                  }}
                  originWhitelist={['*']}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                  incognito
                  cacheEnabled={false}
                  onLoadStart={() => setViewerLoading(true)}
                  onLoadEnd={() => setViewerLoading(false)}
                  onError={(e: any) => {
                    console.log('[report] WebView error:', e?.nativeEvent);
                    setViewerLoading(false);
                    setReportError('Something went wrong while opening the report.');
                  }}
                  renderLoading={() => (
                    <View style={styles.reportCenter}>
                      <ActivityIndicator color={COLORS.WHITE} size="large" />
                      <Text style={styles.reportHint}>Opening…</Text>
                    </View>
                  )}
                />
                {viewerLoading ? (
                  <View style={styles.viewerLoadingOverlay} pointerEvents="none">
                    <ActivityIndicator color={COLORS.WHITE} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.reportCenter}>
                <Text style={styles.reportErrorTitle}>Unable to open report</Text>
                <Text style={styles.reportErrorMsg}>
                  WebView native module is missing. Please rebuild the app, or open the report in the browser.
                </Text>
                <Pressable
                  style={styles.reportRetryBtn}
                  onPress={() => {
                    console.log('[report] opening in browser:', reportUrl);
                    Linking.openURL(reportUrl).catch(err =>
                      console.log('[report] openURL failed:', err),
                    );
                  }}
                >
                  <Text style={styles.reportRetryText}>Open in browser</Text>
                </Pressable>
                <Pressable style={styles.reportRetryBtn} onPress={closeReport}>
                  <Text style={styles.reportRetryText}>Close</Text>
                </Pressable>
              </View>
            )
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
    </>
  );
};

export default Reports;

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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: ms(12),
    paddingRight: ms(8),
    paddingVertical: vs(12),
    backgroundColor: COLORS.WHITE,
    gap: ms(8),
    minHeight: vs(52),
  },
  chipScrollWrap: {
    flex: 1,
    minWidth: 0,
  },
  chipScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingRight: ms(4),
    gap: ms(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    paddingVertical: ms(8),
    paddingLeft: ms(12),
    paddingRight: ms(8),
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    backgroundColor: COLORS.WHITE,
    gap: ms(4),
  },
  chipText: {
    fontSize: ms(13),
    fontWeight: '500',
    color: TEXT_DARK,
  },
  filterIconBtn: {
    padding: ms(6),
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: vs(24),
  },
  emptyStateWrap: {
    flex: 1,
    minHeight: vs(420),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
  },
  emptyStateText: {
    fontSize: ms(14),
    fontWeight: '500',
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  listItem: {
    paddingHorizontal: ms(16),
    paddingVertical: vs(14),
  },
  listItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  listItemMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: ms(12),
  },
  listTextCol: {
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    fontSize: ms(15),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  idParen: {
    fontWeight: '700',
    color: TEXT_DARK,
  },
  metaLine: {
    marginTop: vs(4),
    fontSize: ms(13),
    fontWeight: '400',
    color: TEXT_MUTED,
  },
  seeDetails: {
    marginTop: vs(8),
    fontSize: ms(14),
    fontWeight: '600',
    color: PRIMARY,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    flexShrink: 0,
    paddingTop: vs(2),
  },
  iconSquare: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: DIVIDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  modalRoot: {
    flex: 1,
  },
  modalDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  modalDismissArea: {
    flex: 1,
  },
  sheetOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: MODAL_RADIUS,
    borderTopRightRadius: MODAL_RADIUS,
    overflow: 'hidden',
    width: '100%',
    maxHeight: SHEET_MAX_H,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  sheetHandleArea: {
    alignItems: 'center',
    paddingTop: vs(8),
    paddingBottom: vs(4),
  },
  sheetGrab: {
    width: ms(36),
    height: vs(4),
    borderRadius: ms(2),
    backgroundColor: DIVIDER,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: ms(16),
    paddingBottom: vs(8),
  },
  sheetTitle: {
    fontSize: ms(18),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  sheetHeaderRight: {
    alignItems: 'flex-end',
    gap: vs(6),
  },
  closeCircle: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAllText: {
    fontSize: ms(12),
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  sheetBody: {
    flexDirection: 'row',
    minHeight: ms(240),
    maxHeight: SCREEN_H * 0.46,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  sidebar: {
    width: ms(132),
    flexShrink: 0,
    backgroundColor: SIDEBAR_INACTIVE_BG,
  },
  sideItem: {
    paddingVertical: vs(14),
    paddingHorizontal: ms(10),
    paddingLeft: ms(12),
    backgroundColor: SIDEBAR_INACTIVE_BG,
    position: 'relative',
    minHeight: vs(56),
    justifyContent: 'center',
  },
  sideItemActive: {
    backgroundColor: COLORS.WHITE,
  },
  sideAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: ms(4),
    backgroundColor: PRIMARY,
    borderTopRightRadius: ms(2),
    borderBottomRightRadius: ms(2),
  },
  sideLabel: {
    fontSize: ms(13),
    fontWeight: '600',
    color: TEXT_MUTED,
    marginLeft: ms(4),
  },
  sideLabelActive: {
    color: TEXT_DARK,
  },
  sheetDividerV: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
  },
  optionsScroll: {
    flex: 1,
    minWidth: 0,
  },
  optionsScrollContent: {
    paddingHorizontal: ms(14),
    paddingVertical: vs(10),
    paddingBottom: vs(16),
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(10),
    gap: ms(10),
  },
  checkBox: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(4),
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  checkBoxOn: {
    borderColor: PRIMARY,
    backgroundColor: 'rgba(28, 57, 187, 0.06)',
  },
  checkLabel: {
    flex: 1,
    fontSize: ms(14),
    color: TEXT_DARK,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    gap: ms(8),
    marginTop: vs(8),
    flexWrap: 'wrap',
  },
  dateField: {
    flex: 1,
    minWidth: ms(120),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    borderRadius: ms(10),
    paddingHorizontal: ms(10),
    paddingVertical: vs(10),
    backgroundColor: COLORS.WHITE,
    gap: ms(8),
  },
  dateIcon: {
    flexShrink: 0,
  },
  dateInput: {
    flex: 1,
    fontSize: ms(14),
    color: TEXT_DARK,
    padding: 0,
    minWidth: 0,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingTop: vs(12),
    paddingBottom: vs(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
    gap: ms(12),
  },
  resultBlock: {
    flexShrink: 0,
  },
  resultCount: {
    fontSize: ms(20),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  resultSub: {
    fontSize: ms(12),
    color: TEXT_MUTED,
    marginTop: vs(2),
  },
  applyBtn: {
    flex: 1,
    minWidth: ms(140),
    backgroundColor: PRIMARY,
    borderRadius: ms(28),
    paddingVertical: vs(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: COLORS.WHITE,
    fontSize: ms(16),
    fontWeight: '700',
  },

  reportWrap: {
    flex: 1,
    backgroundColor: '#0B1220',
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
    backgroundColor: '#0B1220',
    paddingHorizontal: ms(10),
    paddingVertical: vs(10),
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
