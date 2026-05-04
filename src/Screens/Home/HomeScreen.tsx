import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Image,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';
import {
  BACKGROUND_IMAGE_API_ID,
  HOME_VISIT_TESTS,
  WALLET_BACKGROUND_IMAGE_API_ID,
  WALLET_STATIC,
} from '../../Constants/homeMockData';
import { fetchBackgroundImageUrl } from '../../Services/backgroundImageService';
import { RootStackParamList } from '../../navigation/types';
import { getAuthToken, getRefreshToken, getUser } from '../../Utils/storage';
import { pickBackendDeviceByTestName } from '../../Utils/pickBackendDeviceByTestName';
import axiosInstance from '../../api/axiosInstance';
import {
  getLabWalletSummary,
  resolveWalletBalance,
  resolveWalletCurrency,
  type LabWalletSummaryData,
} from '../../api/labWalletApi';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PreventiveHealthHeader from './PreventiveUser/PreventiveHealthHeader';
import {
  formatLocalYmd,
  formatLabSlotRange,
  getLabPatients,
  labPatientSlotBounds,
  labPatientLocationLabel,
  labPatientServiceYmd,
  labPatientTestLabel,
  selectUpcomingFromPending,
  type LabPatientRecord,
} from './PreventiveUser/PreventiveHealthAPI';
import CustomPopup from './Components/CustomPopup';

const NEW_USER_CATEGORY_ICON = require('../../assets/icons/newuser.png');
const EXISTING_USER_CATEGORY_ICON = require('../../assets/icons/existinguser.png');

const noop = () => {};

const HOME_LAB_SECTION_PREVIEW = 2;
const HOME_NO_TESTS_COPY = 'No tests Available . ';
const BACKEND_PULSE_OXIMETER_DEVICE_ID = '1b9b9ae7-74e5-4056-a0c2-754e7be8288e';
const BACKEND_PULSE_OXIMETER_DEVICE_NAME = 'Pulse Oxymeter';

type HomeUpcomingPreviewItem = {
  key: string;
  /** `LabPatientRecord.id` — required for `TestDetails` (same as TestActivity). */
  labPatientRowId: string;
  patientName: string;
  patientId: string;
  testName: string;
  deviceId?: string | null;
  deviceName?: string | null;
  time: string;
  payment: string;
  performDisabled: boolean;
};

type HomeCompletedPreviewItem = {
  key: string;
  labPatientRowId: string;
  patientName: string;
  patientId: string;
  testName: string;
  location: string;
};

const formatHomeWalletMoney = (amount: number | null, currency?: string) => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  const sym = !currency || currency === 'INR' ? '₹' : `${currency} `;
  return `${sym}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

type HomeHeroBannerProps = {
  imageUrl: string | null;
  loading: boolean;
};

const HomeHeroBanner: React.FC<HomeHeroBannerProps> = ({ imageUrl, loading }) => {
  if (loading) {
    return (
      <View style={[styles.hero, styles.heroLoading]}>
        <ActivityIndicator color={COLORS.PRIMARY} />
      </View>
    );
  }

  const onImage = Boolean(imageUrl);

  const content = (
    <View style={styles.heroInner}>
      <View style={styles.heroTextBlock}>
        <Text style={[styles.heroEyebrow, onImage && styles.heroEyebrowOnImage]}>
          Home Visits
        </Text>
        <Text style={[styles.heroTitle, onImage && styles.heroTitleOnImage]}>
          Track and complete patient visits from doorstep care
        </Text>
        <TouchableOpacity
          onPress={noop}
          style={[styles.heroButton, !onImage && styles.heroButtonOnPlain]}
          activeOpacity={0.85}
        >
          <Text style={styles.heroButtonLabel}>View Visits</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (imageUrl) {
    return (
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        {content}
      </ImageBackground>
    );
  }

  return <View style={[styles.hero, styles.heroFallback]}>{content}</View>;
};

type HomeRequestCategoriesProps = {
  onRegisterNewUser: () => void;
  onUpcomingVisitsAndTests: () => void;
};

const HomeRequestCategories: React.FC<HomeRequestCategoriesProps> = ({
  onRegisterNewUser,
  onUpcomingVisitsAndTests,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Request Categories</Text>
    <View style={styles.categoryRow}>
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={onRegisterNewUser}
        activeOpacity={0.85}
      >
        <Image
          source={NEW_USER_CATEGORY_ICON}
          style={styles.categoryIconImageNewUser}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.categoryLabel}>Register New User</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={onUpcomingVisitsAndTests}
        activeOpacity={0.85}
      >
        <Image
          source={EXISTING_USER_CATEGORY_ICON}
          style={styles.categoryIconImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.categoryLabel}>Upcoming Visits & Tests</Text>
      </TouchableOpacity>
    </View>
  </View>
);

type LabProfileWorkStats = {
  users_registered?: number;
  tests_completed?: number;
};

type LabProfilePersonalInfo = {
  full_name?: string | null;
  profile_image_url?: string | null;
};

type LabProfileApiResponse = {
  success?: boolean;
  data?: {
    personal_info?: LabProfilePersonalInfo;
    work_stats?: LabProfileWorkStats;
  };
};

const initialsFromName = (name: string | null | undefined): string => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

type HomeWalletSectionProps = {
  walletImageUrl: string | null;
  walletImageLoading: boolean;
  onViewDetails: () => void;
  balanceAmountText: string;
  walletMetricsLoading: boolean;
  registrationsCount: string;
  testsCompletedCount: string;
};

const HomeWalletSection: React.FC<HomeWalletSectionProps> = ({
  walletImageUrl,
  walletImageLoading,
  onViewDetails,
  balanceAmountText,
  walletMetricsLoading,
  registrationsCount,
  testsCompletedCount,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>My Wallet</Text>
    <View style={styles.walletCard}>
      <View style={styles.walletTop}>
        <View style={styles.walletTopLeft}>
          {walletMetricsLoading ? (
            <View style={styles.walletAmountLoader}>
              <ActivityIndicator color={COLORS.PRIMARY} />
            </View>
          ) : (
            <Text style={styles.walletAmount}>{balanceAmountText}</Text>
          )}
          <Text style={styles.walletSub}>{WALLET_STATIC.availableBalance}</Text>
          <TouchableOpacity onPress={onViewDetails} style={styles.walletCta}>
            <Text style={styles.walletCtaText}>View details</Text>
          </TouchableOpacity>
        </View>
        <View
          style={styles.walletImageWrap}
          accessibilityLabel="Wallet"
          accessibilityRole="image"
        >
          {walletImageLoading ? (
            <ActivityIndicator color={COLORS.PRIMARY} />
          ) : walletImageUrl ? (
            <Image
              source={{ uri: walletImageUrl }}
              style={styles.walletImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.walletEmojiFallback}>💼</Text>
          )}
        </View>
      </View>
      <View style={styles.walletDividerH} />
      <View style={styles.walletStats}>
        <View style={styles.walletStatCol}>
          <Text style={styles.walletStatNum}>{registrationsCount}</Text>
          <Text style={styles.walletStatLabel}>
            {WALLET_STATIC.registrationsLabel}
          </Text>
        </View>
        <View style={styles.walletStatV} />
        <View style={styles.walletStatCol}>
          <Text style={styles.walletStatNum}>{testsCompletedCount}</Text>
          <Text style={styles.walletStatLabel}>
            {WALLET_STATIC.testsCompletedLabel}
          </Text>
        </View>
      </View>
    </View>
  </View>
);

const LinkText: React.FC<{
  label: string;
  bold?: boolean;
  color?: string;
  onPress?: () => void;
}> = ({ label, bold, color, onPress }) => (
  <TouchableOpacity onPress={onPress ?? noop} hitSlop={8}>
    <Text
      style={[
        styles.linkText,
        bold && styles.linkTextBold,
        color ? { color } : null,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const MetaIconText: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.metaItem}>
    <Text style={styles.metaIcon}>{icon}</Text>
    <Text style={styles.metaText} numberOfLines={1}>
      {text}
    </Text>
  </View>
);

const UpcomingTestCard: React.FC<{
  patientName: string;
  patientId: string;
  testName: string;
  time: string;
  payment: string;
  onSeeDetails: () => void;
  onPerformTest: () => void;
  performDisabled: boolean;
}> = ({
  patientName,
  patientId,
  testName,
  time,
  payment,
  onSeeDetails,
  onPerformTest,
  performDisabled,
}) => {
  const paid = payment === 'Paid';
  return (
    <View style={styles.listCard}>
      <View style={styles.cardTopRow}>
        <Text style={styles.patientLine} numberOfLines={2}>
          <Text style={styles.patientName}>{patientName}</Text>
          <Text style={styles.patientId}> ({patientId})</Text>
        </Text>
        <LinkText label="See details" color={COLORS.PRIMARY} onPress={onSeeDetails} />
      </View>
      <Text style={styles.testName}>{testName}</Text>
      <View style={styles.upcomingMetaRow}>
        <View style={styles.upcomingTimeRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.PRIMARY} />
          <Text style={styles.upcomingTimeText}>{time}</Text>
        </View>
        <View style={styles.upcomingPayRow}>
          <View
            style={[
              styles.rupeeBadge,
              !paid ? styles.rupeeBadgeDue : null,
            ]}
          >
            <Text style={styles.rupeeBadgeText}>₹</Text>
          </View>
          <Text
            style={[
              styles.upcomingPayText,
              !paid ? styles.upcomingPayTextDue : null,
            ]}
          >
            {payment}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.upcomingPerformBtn,
          performDisabled ? styles.upcomingPerformBtnDisabled : null,
        ]}
        onPress={onPerformTest}
        activeOpacity={0.85}
        disabled={performDisabled}
      >
        <Text
          style={[
            styles.upcomingPerformBtnText,
            performDisabled ? styles.upcomingPerformBtnTextDisabled : null,
          ]}
        >
          Perform Test
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const CompletedTestCard: React.FC<{
  patientName: string;
  patientId: string;
  testName: string;
  location: string;
  onSeeDetails: () => void;
  onViewReport: () => void;
}> = ({ patientName, patientId, testName, location, onSeeDetails, onViewReport }) => (
  <View style={styles.listCard}>
    <View style={styles.completedHeaderRow}>
      <Text style={styles.patientLine} numberOfLines={2}>
        <Text style={styles.patientName}>{patientName}</Text>
        <Text style={styles.patientId}> ({patientId})</Text>
      </Text>
    </View>
    <Text style={styles.testName}>{testName}</Text>
    <View style={styles.completedLocationRow}>
      <Ionicons name="location-outline" size={16} color={COLORS.PRIMARY} />
      <Text style={styles.completedLocationText}>{location}</Text>
    </View>
    <View style={styles.completedDivider} />
    <View style={styles.completedFooterActions}>
      <TouchableOpacity onPress={onSeeDetails} hitSlop={8}>
        <Text style={styles.completedSeeDetailsText}>See details</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onViewReport} hitSlop={8}>
        <Text style={styles.completedViewReportText}>View Report</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const HomeVisitTestCard: React.FC<{
  patientName: string;
  patientId: string;
  testName: string;
  location: string;
  time: string;
  payment: string;
}> = ({ patientName, patientId, testName, location, time, payment }) => (
  <View style={styles.listCard}>
    <View style={styles.cardTopRow}>
      <Text style={styles.patientLine}>
        <Text style={styles.patientName}>{patientName}</Text>
        <Text style={styles.patientId}> ({patientId})</Text>
      </Text>
      <LinkText label="See details" color={COLORS.PRIMARY} />
    </View>
    <Text style={styles.testName}>{testName}</Text>
    <View style={styles.cardDivider} />
    <View style={styles.homeVisitMetaRow}>
      <MetaIconText icon="📍" text={location} />
      <MetaIconText icon="🕐" text={time} />
      <MetaIconText icon="₹" text={payment} />
    </View>
    <TouchableOpacity style={styles.performBtn} onPress={noop} activeOpacity={0.85}>
      <Text style={styles.performBtnText}>Perform Test</Text>
    </TouchableOpacity>
  </View>
);

const SeeAllLink: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.seeAllWrap} activeOpacity={0.85}>
    <Text style={styles.seeAll}>See all →</Text>
  </TouchableOpacity>
);

type HomeNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeNav>();
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [walletImageUrl, setWalletImageUrl] = useState<string | null>(null);
  const [walletImageLoading, setWalletImageLoading] = useState(true);
  const [walletSummary, setWalletSummary] = useState<LabWalletSummaryData | null>(null);
  const [walletWorkStats, setWalletWorkStats] = useState<LabProfileWorkStats | null>(null);
  const [walletMetricsLoading, setWalletMetricsLoading] = useState(true);
  const [labProfileName, setLabProfileName] = useState('');
  const [labProfileImageUrl, setLabProfileImageUrl] = useState<string | null>(null);
  const [visitTab, setVisitTab] = useState<'home' | 'walkin'>('home');
  const [refreshing, setRefreshing] = useState(false);
  const [homePatientsLoading, setHomePatientsLoading] = useState(true);
  const [homeUpcomingRaw, setHomeUpcomingRaw] = useState<LabPatientRecord[]>([]);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [homeUpcomingPreview, setHomeUpcomingPreview] = useState<
    HomeUpcomingPreviewItem[]
  >([]);
  const [homeCompletedPreview, setHomeCompletedPreview] = useState<
    HomeCompletedPreviewItem[]
  >([]);

  const [deviceUnavailablePopupVisible, setDeviceUnavailablePopupVisible] =
    useState(false);
  const [deviceUnavailablePopupMessage, setDeviceUnavailablePopupMessage] =
    useState('');

  const isPulseOximeterSupported = useCallback(
    (deviceId?: string | null, deviceName?: string | null) => {
      const normalizedName = (deviceName ?? '').trim().toLowerCase();
      return (
        deviceId === BACKEND_PULSE_OXIMETER_DEVICE_ID ||
        normalizedName === BACKEND_PULSE_OXIMETER_DEVICE_NAME.toLowerCase()
      );
    },
    [],
  );

  const closeDeviceUnavailablePopup = useCallback(() => {
    setDeviceUnavailablePopupVisible(false);
  }, []);

  const loadWalletMetrics = useCallback(async (opts?: { skipSectionLoading?: boolean }) => {
    const showSectionLoading = !opts?.skipSectionLoading;
    if (showSectionLoading) {
      setWalletMetricsLoading(true);
    }
    try {
      const [summary, profileRes] = await Promise.all([
        getLabWalletSummary(),
        axiosInstance.get<LabProfileApiResponse>('lab/profile'),
      ]);
      setWalletSummary(summary);
      const personal = profileRes.data?.data?.personal_info;
      setWalletWorkStats(profileRes.data?.data?.work_stats ?? null);
      setLabProfileName(personal?.full_name?.trim() ?? '');
      setLabProfileImageUrl(personal?.profile_image_url?.trim() ?? null);
    } catch {
      setWalletSummary(null);
      setWalletWorkStats(null);
      setLabProfileName('');
      setLabProfileImageUrl(null);
    } finally {
      if (showSectionLoading) {
        setWalletMetricsLoading(false);
      }
    }
  }, []);

  const loadHomeImages = useCallback(async (opts?: { skipSectionLoading?: boolean }) => {
    const showSectionLoading = !opts?.skipSectionLoading;
    if (showSectionLoading) {
      setHeroLoading(true);
      setWalletImageLoading(true);
    }
    try {
      const [hero, wallet] = await Promise.all([
        fetchBackgroundImageUrl(BACKGROUND_IMAGE_API_ID),
        fetchBackgroundImageUrl(WALLET_BACKGROUND_IMAGE_API_ID),
      ]);
      setHeroUrl(hero);
      setWalletImageUrl(wallet);
    } finally {
      if (showSectionLoading) {
        setHeroLoading(false);
        setWalletImageLoading(false);
      }
    }
  }, []);

  const loadHomePatientPreviews = useCallback(
    async (opts?: { skipSectionLoading?: boolean }) => {
      const showSectionLoading = !opts?.skipSectionLoading;
      if (showSectionLoading) {
        setHomePatientsLoading(true);
      }
      try {
        const [upcoming, completed] = await Promise.all([
          getLabPatients('upcoming'),
          getLabPatients('completed'),
        ]);
        const now = new Date();
        const todayYmd = formatLocalYmd(now);
        setHomeUpcomingRaw(upcoming);

        const canPerformTestNow = (p: LabPatientRecord) => {
          // Backend explicit blocks should always disable action.
          if (p.can_perform_test === false) return false;

          const bounds = labPatientSlotBounds(p);
          if (!bounds) return false;

          // Ensure slot window check happens against today's local date.
          if (formatLocalYmd(bounds.start) !== formatLocalYmd(now)) return false;

          return now.getTime() >= bounds.start.getTime() && now.getTime() < bounds.end.getTime();
        };

        const upcomingPreview = selectUpcomingFromPending(upcoming, {
          now,
          limit: HOME_LAB_SECTION_PREVIEW,
        }).map((p, index) => ({
          key: `${p.id ?? p.user_id ?? 'up'}-${p.slot_start_time ?? ''}-${index}`,
          labPatientRowId: String(p.id ?? '').trim(),
          patientName: (p.full_name ?? '').trim() || '—',
          patientId: String(p.user_id ?? p.id ?? ''),
          testName: labPatientTestLabel(p),
          ...pickBackendDeviceByTestName({
            deviceIds: p.device_ids ?? null,
            deviceNames: p.device_names ?? null,
            testName: labPatientTestLabel(p),
          }),
          time: formatLabSlotRange(p.slot_start_time, p.slot_end_time),
          payment: 'Paid',
          performDisabled: !canPerformTestNow(p),
        }));

        const completedToday = completed.filter(
          p =>
            (p.test_status || '').toLowerCase() === 'completed' &&
            labPatientServiceYmd(p) === todayYmd,
        );
        setHomeUpcomingPreview(upcomingPreview);
        setHomeCompletedPreview(
          completedToday.slice(0, HOME_LAB_SECTION_PREVIEW).map((p, i) => ({
            key: `${p.id ?? p.user_id ?? 'done'}-c-${i}`,
            labPatientRowId: String(p.id ?? '').trim(),
            patientName: (p.full_name ?? '').trim() || '—',
            patientId: String(p.user_id ?? p.id ?? ''),
            testName: labPatientTestLabel(p),
            location: labPatientLocationLabel(p),
          })),
        );
      } catch {
        setHomeUpcomingPreview([]);
        setHomeUpcomingRaw([]);
        setHomeCompletedPreview([]);
      } finally {
        if (showSectionLoading) {
          setHomePatientsLoading(false);
        }
      }
    },
    [],
  );

  // Keep upcoming slots + "Perform Test" enable/disable in sync with the clock.
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (homeUpcomingRaw.length === 0) return;

    const now = nowTick;
    const canPerformTestNow = (p: LabPatientRecord) => {
      if (p.can_perform_test === false) return false;
      const bounds = labPatientSlotBounds(p);
      if (!bounds) return false;
      if (formatLocalYmd(bounds.start) !== formatLocalYmd(now)) return false;
      return now.getTime() >= bounds.start.getTime() && now.getTime() < bounds.end.getTime();
    };

    const upcomingPreview = selectUpcomingFromPending(homeUpcomingRaw, {
      now,
      limit: HOME_LAB_SECTION_PREVIEW,
    }).map((p, index) => ({
      key: `${p.id ?? p.user_id ?? 'up'}-${p.slot_start_time ?? ''}-${index}`,
      labPatientRowId: String(p.id ?? '').trim(),
      patientName: (p.full_name ?? '').trim() || '—',
      patientId: String(p.user_id ?? p.id ?? ''),
      testName: labPatientTestLabel(p),
      ...pickBackendDeviceByTestName({
        deviceIds: p.device_ids ?? null,
        deviceNames: p.device_names ?? null,
        testName: labPatientTestLabel(p),
      }),
      time: formatLabSlotRange(p.slot_start_time, p.slot_end_time),
      payment: 'Paid',
      performDisabled: !canPerformTestNow(p),
    }));

    setHomeUpcomingPreview(upcomingPreview);
  }, [homeUpcomingRaw, nowTick]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadHomeImages({ skipSectionLoading: true }),
        loadWalletMetrics({ skipSectionLoading: true }),
        loadHomePatientPreviews({ skipSectionLoading: true }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadHomeImages, loadWalletMetrics, loadHomePatientPreviews]);

  useEffect(() => {
    loadHomeImages();
  }, [loadHomeImages]);

  useEffect(() => {
    loadWalletMetrics();
  }, [loadWalletMetrics]);

  useEffect(() => {
    loadHomePatientPreviews();
  }, [loadHomePatientPreviews]);

  useEffect(() => {
    const logLabworkerSessionOnHome = async () => {
      const [token, refreshToken, user] = await Promise.all([
        getAuthToken(),
        getRefreshToken(),
        getUser(),
      ]);
      console.log(
        'Labworker information',
        JSON.stringify(
          {
            success: true,
            message: 'Session from AsyncStorage (Home screen visible)',
            provider: null,
            user,
            token,
            refreshToken,
          },
          null,
          2,
        ),
      );
    };
    logLabworkerSessionOnHome();
  }, []);

  const balanceAmountText = formatHomeWalletMoney(
    resolveWalletBalance(walletSummary),
    resolveWalletCurrency(walletSummary),
  );
  const registrationsCount = String(
    walletWorkStats != null && typeof walletWorkStats.users_registered === 'number'
      ? walletWorkStats.users_registered
      : 0,
  );
  const testsCompletedCount = String(
    walletWorkStats != null && typeof walletWorkStats.tests_completed === 'number'
      ? walletWorkStats.tests_completed
      : 0,
  );

  const goTestDetails = useCallback(
    (labPatientRowId: string, filter: 'upcoming' | 'completed') => {
      const id = labPatientRowId.trim();
      if (!id) return;
      navigation.navigate('TestDetails', { patientId: id, filter });
    },
    [navigation],
  );

  /*
   * Original (working) logic: always navigate without device context.
   * Kept here (commented) to preserve reference.
   */
  // const goPerformTest = useCallback(() => {
  //   navigation.navigate('Oxymeter');
  // }, [navigation]);

  const goPerformTestWithDevice = useCallback(
    (deviceId?: string | null, deviceName?: string | null) => {
      navigation.navigate('Oxymeter', { deviceId: deviceId ?? null, deviceName: deviceName ?? null });
    },
    [navigation],
  );

  const goReports = useCallback(() => {
    navigation.navigate('Reports');
  }, [navigation]);

  const goScaleDevice = useCallback(() => {
    navigation.navigate('ScaleDevice');
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY} />
      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          showBack={false}
          title={labProfileName}
          avatarInitials={initialsFromName(labProfileName)}
          avatarImageUrl={labProfileImageUrl}
          onAvatarPress={() => navigation.navigate('Profile')}
          rightSlot={
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={goScaleDevice}
                style={styles.headerAction}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Power Max scale"
              >
                <Ionicons name="fitness-outline" size={24} color={COLORS.WHITE} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={goReports}
                style={styles.headerAction}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Reports"
              >
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={COLORS.WHITE}
                />
              </TouchableOpacity>
            </View>
          }
        />
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            colors={[COLORS.PRIMARY]}
            tintColor={COLORS.PRIMARY}
          />
        }
      >
        <HomeHeroBanner imageUrl={heroUrl} loading={heroLoading} />
        <HomeRequestCategories
          onRegisterNewUser={() => navigation.navigate('RegisterWithOtp')}
          onUpcomingVisitsAndTests={() =>
            navigation.navigate('TestActivity', { initialTab: 'upcoming' })
          }
        />
        <HomeWalletSection
          walletImageUrl={walletImageUrl}
          walletImageLoading={walletImageLoading}
          onViewDetails={() => navigation.navigate('MyWallet')}
          balanceAmountText={balanceAmountText}
          walletMetricsLoading={walletMetricsLoading}
          registrationsCount={registrationsCount}
          testsCompletedCount={testsCompletedCount}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's upcoming tests</Text>
          {homePatientsLoading ? (
            <View style={styles.homePatientsLoadingWrap}>
              <ActivityIndicator color={COLORS.PRIMARY} />
            </View>
          ) : homeUpcomingPreview.length === 0 ? (
            <Text style={styles.homeSectionEmptyText}>{HOME_NO_TESTS_COPY}</Text>
          ) : (
            homeUpcomingPreview.map(item => (
              <UpcomingTestCard
                key={item.key}
                patientName={item.patientName}
                patientId={item.patientId}
                testName={item.testName}
                time={item.time}
                payment={item.payment}
                onSeeDetails={() => goTestDetails(item.labPatientRowId, 'upcoming')}
                onPerformTest={() => {
                  if (isPulseOximeterSupported(item.deviceId, item.deviceName)) {
                    goPerformTestWithDevice(item.deviceId, item.deviceName);
                    return;
                  }
                  const nameForMsg = item.deviceName ?? item.testName;
                  setDeviceUnavailablePopupMessage(
                    `No device available for this ${nameForMsg}`,
                  );
                  setDeviceUnavailablePopupVisible(true);
                }}
                performDisabled={item.performDisabled}
              />
            ))
          )}
          <SeeAllLink
            onPress={() =>
              navigation.navigate('TestActivity', { initialTab: 'upcoming' })
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Completed Tests</Text>
          {homePatientsLoading ? (
            <View style={styles.homePatientsLoadingWrap}>
              <ActivityIndicator color={COLORS.PRIMARY} />
            </View>
          ) : homeCompletedPreview.length === 0 ? (
            <Text style={styles.homeSectionEmptyText}>{HOME_NO_TESTS_COPY}</Text>
          ) : (
            homeCompletedPreview.map(item => (
              <CompletedTestCard
                key={item.key}
                patientName={item.patientName}
                patientId={item.patientId}
                testName={item.testName}
                location={item.location}
                onSeeDetails={() => goTestDetails(item.labPatientRowId, 'completed')}
                onViewReport={goReports}
              />
            ))
          )}
          <SeeAllLink
            onPress={() =>
              navigation.navigate('TestActivity', { initialTab: 'completed' })
            }
          />
        </View>

        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s Home Visit tests</Text>
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setVisitTab('home')}
              style={[
                styles.tabPill,
                visitTab === 'home' ? styles.tabPillActive : styles.tabPillIdle,
              ]}
            >
              <Text
                style={
                  visitTab === 'home' ? styles.tabTextActive : styles.tabTextIdle
                }
              >
                Home Visits
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setVisitTab('walkin')}
              style={[
                styles.tabPill,
                visitTab === 'walkin' ? styles.tabPillActive : styles.tabPillIdle,
              ]}
            >
              <Text
                style={
                  visitTab === 'walkin' ? styles.tabTextActive : styles.tabTextIdle
                }
              >
                Walk-In
              </Text>
            </TouchableOpacity>
          </View>
          {visitTab === 'home' &&
            HOME_VISIT_TESTS.map((item, index) => (
              <HomeVisitTestCard
                key={`${item.patientId}-hv-${index}`}
                patientName={item.patientName}
                patientId={item.patientId}
                testName={item.testName}
                location={item.location}
                time={item.time}
                payment={item.payment}
              />
            ))}
          {visitTab === 'walkin' && (
            <View style={styles.emptyWalkIn}>
              <Text style={styles.emptyWalkInText}>
                No walk-in appointments (static)
              </Text>
            </View>
          )}
        </View> */}
      </ScrollView>

      <CustomPopup
        isVisible={deviceUnavailablePopupVisible}
        onClose={closeDeviceUnavailablePopup}
        onConfirm={closeDeviceUnavailablePopup}
        title="Device Unavailable"
        message={deviceUnavailablePopupMessage}
        showIcon={false}
      />
    </View>
  );
};

export default HomeScreen;

const RADIUS_LG = 16;
const RADIUS_MD = 12;
const RADIUS_PILL = 22;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.MD,
    paddingBottom: SPACING.XL,
  },
  headerSafe: {
    backgroundColor: COLORS.PRIMARY,
    borderBottomLeftRadius: RADIUS_LG,
    borderBottomRightRadius: RADIUS_LG,
    overflow: 'hidden',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  headerAction: {
    padding: SPACING.XS,
  },
  hero: {
    marginTop: SPACING.MD,
    minHeight: 168,
    borderRadius: RADIUS_LG,
    overflow: 'hidden',
  },
  heroImage: {
    borderRadius: RADIUS_LG,
  },
  heroLoading: {
    backgroundColor: COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallback: {
    backgroundColor: COLORS.BACKGROUND,
  },
  heroInner: {
    flex: 1,
    minHeight: 168,
    justifyContent: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    alignItems: 'flex-start',
  },
  heroTextBlock: {
    maxWidth: '90%',
  },
  heroEyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    marginBottom: SPACING.XS,
  },
  heroEyebrowOnImage: {
    color: COLORS.WHITE,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: SPACING.MD,
  },
  heroTitleOnImage: {
    color: COLORS.WHITE,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.LG,
    borderRadius: RADIUS_PILL,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroButtonOnPlain: {
    borderColor: COLORS.CARD_BORDER,
  },
  heroButtonLabel: {
    color: COLORS.WHITE,
    fontWeight: '600',
    fontSize: FONT_SIZE.MD,
  },
  section: {
    marginTop: SPACING.LG,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.MD,
  },
  homePatientsLoadingWrap: {
    paddingVertical: SPACING.LG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeSectionEmptyText: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.SM,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    padding: SPACING.MD,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  categoryIconImage: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
  },
  categoryIconImageNewUser: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
  },
  categoryLabel: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    maxWidth: '85%',
  },
  walletCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    overflow: 'hidden',
  },
  walletTop: {
    flexDirection: 'row',
    padding: SPACING.MD,
    alignItems: 'flex-start',
  },
  walletTopLeft: {
    flex: 1,
  },
  walletAmount: {
    fontSize: FONT_SIZE.XXL,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  walletAmountLoader: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  walletSub: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  walletCta: {
    alignSelf: 'flex-start',
    marginTop: SPACING.SM,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.LG,
    borderRadius: RADIUS_PILL,
  },
  walletCtaText: {
    color: COLORS.WHITE,
    fontWeight: '600',
    fontSize: FONT_SIZE.SM,
  },
  walletImageWrap: {
    width: 96,
    height: 80,
    marginLeft: SPACING.SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletImage: {
    width: 96,
    height: 80,
  },
  walletEmojiFallback: {
    fontSize: 40,
  },
  walletDividerH: {
    height: 1,
    backgroundColor: COLORS.CARD_BORDER,
  },
  walletStats: {
    flexDirection: 'row',
    paddingVertical: SPACING.MD,
  },
  walletStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  walletStatV: {
    width: 1,
    backgroundColor: COLORS.CARD_BORDER,
  },
  walletStatNum: {
    fontSize: FONT_SIZE.XL,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  walletStatLabel: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  listCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    padding: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.SM,
  },
  completedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patientLine: {
    flex: 1,
  },
  patientName: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  patientId: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_MUTED,
    fontWeight: '400',
  },
  testName: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.XS,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.BORDER,
    marginVertical: SPACING.MD,
  },
  upcomingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.SM,
  },
  upcomingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  upcomingTimeText: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '400',
  },
  upcomingPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rupeeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupeeBadgeDue: {
    backgroundColor: '#E65100',
  },
  rupeeBadgeText: {
    color: COLORS.WHITE,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -1,
  },
  upcomingPayText: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '400',
  },
  upcomingPayTextDue: {
    color: '#E65100',
    fontWeight: '600',
  },
  upcomingPerformBtn: {
    marginTop: SPACING.MD,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: RADIUS_PILL,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  upcomingPerformBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  upcomingPerformBtnText: {
    color: COLORS.WHITE,
    fontWeight: '700',
    fontSize: FONT_SIZE.MD,
  },
  upcomingPerformBtnTextDisabled: {
    color: '#F3F4F6',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.MD,
    marginTop: SPACING.XS,
  },
  homeVisitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.MD,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  metaIcon: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  metaText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    flexShrink: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.MD,
  },
  performBtn: {
    marginTop: SPACING.MD,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS_MD,
    alignItems: 'center',
  },
  performBtnText: {
    color: COLORS.WHITE,
    fontWeight: '600',
    fontSize: FONT_SIZE.MD,
  },
  linkText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.PRIMARY,
  },
  linkTextBold: {
    fontWeight: '700',
  },
  completedLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.SM,
  },
  completedLocationText: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.PRIMARY,
    fontWeight: '500',
    flex: 1,
  },
  completedDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.BORDER,
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  completedFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedSeeDetailsText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_MUTED,
    fontWeight: '400',
  },
  completedViewReportText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.PRIMARY,
    fontWeight: '700',
  },
  seeAllWrap: {
    alignSelf: 'center',
    marginTop: SPACING.SM,
    paddingVertical: SPACING.XS,
  },
  seeAll: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginBottom: SPACING.MD,
  },
  tabPill: {
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.LG,
    borderRadius: RADIUS_PILL,
    borderWidth: 1,
    backgroundColor: COLORS.WHITE,
  },
  tabPillActive: {
    borderColor: COLORS.PRIMARY,
  },
  tabPillIdle: {
    borderColor: COLORS.BORDER,
  },
  tabTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
    fontSize: FONT_SIZE.SM,
  },
  tabTextIdle: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.SM,
  },
  emptyWalkIn: {
    padding: SPACING.LG,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emptyWalkInText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.MD,
    textAlign: 'center',
  },
});
