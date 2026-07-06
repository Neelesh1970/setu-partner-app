import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Image,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ms, vs, s } from 'react-native-size-matters';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../../../navigation/types';
import { COLORS } from '../../../Constants/theme';
import { WALLET_BACKGROUND_IMAGE_API_ID, WALLET_STATIC } from '../../../Constants/homeMockData';
import PreventiveHealthHeader from './PreventiveHealthHeader';
import {
  flattenWalletTransactionBuckets,
  getLabWalletTransactions,
  resolveWalletBalance,
  resolveWalletCurrency,
} from '../../../api/labWalletApi';
import { useBackgroundImageUrl } from '../../../hooks/useBackgroundImageUrl';
import { useWalletSummary } from '../../../hooks/useWalletSummary';
import { useLabProfile } from '../../../hooks/useLabProfile';

const PRIMARY = '#1C39BB';
const LABEL_GRAY = '#6B7280';
const BORDER = '#E5E7EB';

/** Per-unit rates (fixed); counts come from `lab/profile` → `work_stats`. */
const EARNINGS = {
  registration: { rate: 20, label: 'User Registration' },
  test: { rate: 50, label: 'Test Completion' },
};

type MyWalletNav = NativeStackNavigationProp<RootStackParamList, 'MyWallet'>;

const noop = () => {};

const displayStr = (v: string | number | null | undefined, fallback = '—') => {
  if (v === null || v === undefined || v === '') {
    return fallback;
  }
  return String(v);
};

const initialsFromName = (name: string | null | undefined): string => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return '?';
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatInr = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatMoneyDisplay = (amount: number | null, currency?: string) => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  const sym = !currency || currency === 'INR' ? '₹' : `${currency} `;
  return `${sym}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

function formatTxDate(raw: unknown): string {
  if (raw == null || raw === '') {
    return '';
  }
  const t = typeof raw === 'string' || typeof raw === 'number' ? Date.parse(String(raw)) : NaN;
  if (Number.isNaN(t)) {
    return '';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(t));
}

type TxRow = {
  title: string;
  subtitle: string;
  amount: string;
  positive: boolean;
};

function mapTxItem(item: unknown): TxRow | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const o = item as Record<string, unknown>;
  const title = String(
    o.title ??
      o.description ??
      o.narration ??
      o.remark ??
      o.transaction_type ??
      'Transaction',
  );
  const subtitle = formatTxDate(o.created_at ?? o.updated_at ?? o.date ?? o.timestamp);

  let amountNum = 0;
  if (typeof o.amount === 'number') {
    amountNum = o.amount;
  } else if (typeof o.amount === 'string') {
    amountNum = parseFloat(o.amount) || 0;
  }

  const typeStr = String(o.type ?? o.direction ?? '').toLowerCase();
  const isDebit =
    typeStr.includes('debit') ||
    typeStr.includes('withdraw') ||
    typeStr.includes('withdrawal') ||
    amountNum < 0;

  const signed = isDebit && amountNum > 0 ? -amountNum : amountNum;
  const positive = signed >= 0;
  const abs = Math.abs(signed);

  const currency = typeof o.currency === 'string' ? o.currency : 'INR';
  const sym = !currency || currency === 'INR' ? '₹' : `${currency} `;
  const sign = positive ? '+' : '-';
  const amount = `${sign}${sym}${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return { title, subtitle, amount, positive };
}

const MyWallet: React.FC = () => {
  const navigation = useNavigation<MyWalletNav>();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, vs(16));

  const {
    url: walletImageUrl,
    loading: walletImageLoading,
    revalidate: revalidateWalletImage,
  } = useBackgroundImageUrl(WALLET_BACKGROUND_IMAGE_API_ID);
  const { summary, loading: summaryLoading, revalidate: revalidateWallet } = useWalletSummary();
  const { data: profile, loading: profileLoading, revalidate: revalidateProfile } =
    useLabProfile();

  const [refreshing, setRefreshing] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactions, setTransactions] = useState<TxRow[]>([]);

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const txData = await getLabWalletTransactions(1, 10);
      const flat = flattenWalletTransactionBuckets(txData);
      const rows: TxRow[] = [];
      for (const item of flat) {
        const row = mapTxItem(item);
        if (row) {
          rows.push(row);
        }
      }
      setTransactions(rows.slice(0, 10));
    } catch {
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  const loadWalletData = useCallback(
    async (opts?: { isPullRefresh?: boolean }) => {
      const pull = opts?.isPullRefresh ?? false;
      if (pull) {
        setRefreshing(true);
      }
      try {
        await Promise.all([
          revalidateProfile(),
          revalidateWallet(),
          revalidateWalletImage(),
          loadTransactions(),
        ]);
      } finally {
        if (pull) {
          setRefreshing(false);
        }
      }
    },
    [revalidateProfile, revalidateWallet, revalidateWalletImage, loadTransactions],
  );

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const hasCachedCoreData = summary !== null && profile !== null;
  const loading =
    !hasCachedCoreData && (summaryLoading || profileLoading || transactionsLoading);

  const personal = profile?.personal_info;
  const work = profile?.work_stats;

  const regCount =
    typeof work?.users_registered === 'number' && !Number.isNaN(work.users_registered)
      ? work.users_registered
      : 0;
  const testCount =
    typeof work?.tests_completed === 'number' && !Number.isNaN(work.tests_completed)
      ? work.tests_completed
      : 0;

  const regTotal = EARNINGS.registration.rate * regCount;
  const testTotal = EARNINGS.test.rate * testCount;

  const profileName = displayStr(personal?.full_name ?? undefined, '—');
  const profileLocation =
    personal?.location != null && personal.location !== '' ? personal.location : '—';
  const profileInitials = initialsFromName(personal?.full_name ?? undefined);
  const avatarUrl = personal?.profile_image_url?.trim() || null;

  const balanceNum = resolveWalletBalance(summary);
  const balanceCurrency = resolveWalletCurrency(summary);
  const balanceAmountText = formatMoneyDisplay(balanceNum, balanceCurrency);

  const registrationsCount = displayStr(work?.users_registered ?? undefined, '0');
  const testsCompletedCount = displayStr(work?.tests_completed ?? undefined, '0');

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: true,
      ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true } : {}),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = (): boolean => {
        handleBack();
        return true;
      };
      let sub: { remove: () => void } | undefined;
      if (Platform.OS === 'android') {
        sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      }
      return () => sub?.remove();
    }, [handleBack]),
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="My wallet"
            onBackPress={handleBack}
          />
        </SafeAreaView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + vs(24) }]}
          showsVerticalScrollIndicator={false}
          bounces={Platform.OS === 'ios'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void loadWalletData({ isPullRefresh: true });
              }}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
        >
          <View style={styles.profileRow}>
            <View style={styles.avatarSmall}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarSmallImage} />
              ) : (
                <Text style={styles.avatarSmallText}>{profileInitials}</Text>
              )}
            </View>
            <View style={styles.profileTextCol}>
              <Text style={styles.profileName}>{profileName}</Text>
              {/* <Text style={styles.profileLocation}>{profileLocation}</Text> */}
            </View>
          </View>

          <View style={styles.balanceCard}>
            <View style={styles.balanceLeft}>
              <Text style={styles.balanceAmount}>{balanceAmountText}</Text>
              <Text style={styles.balanceSub}>{WALLET_STATIC.availableBalance}</Text>
              <TouchableOpacity
                style={styles.withdrawBtn}
                onPress={noop}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Withdraw"
              >
                <Text style={styles.withdrawBtnText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.balanceIconWrap} accessibilityRole="image" accessibilityLabel="Wallet">
              {walletImageLoading ? (
                <ActivityIndicator color={PRIMARY} />
              ) : walletImageUrl ? (
                <Image
                  source={{ uri: walletImageUrl }}
                  style={styles.balanceWalletImage}
                  resizeMode="contain"
                  fadeDuration={0}
                />
              ) : (
                <MaterialCommunityIcons name="wallet" size={ms(56)} color={PRIMARY} />
              )}
            </View>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statsHalf}>
              <Text style={styles.statsNum}>{registrationsCount}</Text>
              <Text style={styles.statsLabel}>{WALLET_STATIC.registrationsLabel}</Text>
            </View>
            <View style={styles.statsV} />
            <View style={styles.statsHalf}>
              <Text style={styles.statsNum}>{testsCompletedCount}</Text>
              <Text style={styles.statsLabel}>{WALLET_STATIC.testsCompletedLabel}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownFormula}>
                  {formatInr(EARNINGS.registration.rate)} × {regCount}
                </Text>
                <Text style={styles.breakdownCaption}>{EARNINGS.registration.label}</Text>
              </View>
              <Text style={styles.breakdownRight}>{formatInr(regTotal)}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownFormula}>
                  {formatInr(EARNINGS.test.rate)} × {testCount}
                </Text>
                <Text style={styles.breakdownCaption}>{EARNINGS.test.label}</Text>
              </View>
              <Text style={styles.breakdownRight}>{formatInr(testTotal)}</Text>
            </View>
          </View>

          <View style={styles.txHeaderRow}>
            <Text style={styles.txHeaderTitle}>Transaction History</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('TransactionHistory')}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.seeAll}>See all &gt;</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.txCard}>
            {transactions.map((row, index) => (
              <View key={`${row.title}-${row.subtitle}-${index}`}>
                {index > 0 ? <View style={styles.txDivider} /> : null}
                <View style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txTitle}>{row.title}</Text>
                    <Text style={styles.txSub}>{row.subtitle}</Text>
                  </View>
                  <Text style={[styles.txAmount, row.positive ? styles.txCredit : styles.txDebit]}>
                    {row.amount}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  headerShell: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: ms(16),
    borderBottomRightRadius: ms(16),
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: PRIMARY,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ms(16),
    paddingTop: vs(20),
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(20),
    gap: ms(14),
  },
  avatarSmall: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarSmallImage: {
    width: '100%',
    height: '100%',
  },
  avatarSmallText: {
    fontSize: s(16),
    fontWeight: '700',
    color: '#6B7280',
  },
  profileTextCol: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: s(17),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  profileLocation: {
    marginTop: vs(4),
    fontSize: s(14),
    color: LABEL_GRAY,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: vs(16),
    paddingHorizontal: ms(16),
    marginBottom: vs(14),
    gap: ms(12),
  },
  balanceLeft: {
    flex: 1,
    minWidth: 0,
  },
  balanceAmount: {
    fontSize: s(24),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  balanceSub: {
    marginTop: vs(4),
    fontSize: s(13),
    color: LABEL_GRAY,
  },
  withdrawBtn: {
    marginTop: vs(12),
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    paddingVertical: vs(10),
    paddingHorizontal: ms(20),
    borderRadius: ms(10),
  },
  withdrawBtnText: {
    fontSize: s(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceIconWrap: {
    width: ms(96),
    minHeight: ms(80),
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceWalletImage: {
    width: ms(96),
    height: ms(80),
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: vs(20),
    overflow: 'hidden',
  },
  statsHalf: {
    flex: 1,
    paddingVertical: vs(18),
    paddingHorizontal: ms(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsV: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginVertical: vs(14),
  },
  statsNum: {
    fontSize: s(22),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  statsLabel: {
    marginTop: vs(6),
    fontSize: s(13),
    color: LABEL_GRAY,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: s(16),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: vs(10),
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: vs(20),
    paddingVertical: vs(4),
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(14),
    paddingHorizontal: ms(16),
    gap: ms(12),
  },
  breakdownLeft: {
    flex: 1,
    minWidth: 0,
  },
  breakdownFormula: {
    fontSize: s(15),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  breakdownCaption: {
    marginTop: vs(4),
    fontSize: s(13),
    color: LABEL_GRAY,
  },
  breakdownRight: {
    fontSize: s(16),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: ms(16),
  },
  txHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(10),
    gap: ms(8),
  },
  txHeaderTitle: {
    flex: 1,
    fontSize: s(16),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  seeAll: {
    fontSize: s(14),
    fontWeight: '600',
    color: PRIMARY,
  },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: vs(14),
    paddingHorizontal: ms(16),
    gap: ms(12),
  },
  txLeft: {
    flex: 1,
    minWidth: 0,
  },
  txTitle: {
    fontSize: s(14),
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  txSub: {
    marginTop: vs(4),
    fontSize: s(13),
    color: LABEL_GRAY,
  },
  txAmount: {
    fontSize: s(15),
    fontWeight: '700',
  },
  txCredit: {
    color: PRIMARY,
  },
  txDebit: {
    color: PRIMARY,
  },
  txDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: ms(16),
  },
});

export default MyWallet;
