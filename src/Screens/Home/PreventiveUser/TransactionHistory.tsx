import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ms, vs, s } from 'react-native-size-matters';
import { RootStackParamList } from '../../../navigation/types';
import { COLORS } from '../../../Constants/theme';
import PreventiveHealthHeader from './PreventiveHealthHeader';
import {
  flattenWalletTransactionBuckets,
  getLabWalletTransactions,
  type LabWalletTransactionsData,
} from '../../../api/labWalletApi';

const PRIMARY = '#1C39BB';
const LABEL_GRAY = '#6B7280';
const BORDER = '#E5E7EB';
const DEBIT_RED = '#B91C1C';
const TRANSACTIONS_PER_PAGE = 10;

type TxRow = {
  title: string;
  subtitle: string;
  amount: string;
  positive: boolean;
};

type TxSection = {
  title: string;
  data: TxRow[];
};

type TransactionHistoryNav = NativeStackNavigationProp<RootStackParamList, 'TransactionHistory'>;

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

function txTimestamp(item: unknown): number {
  if (!item || typeof item !== 'object') {
    return 0;
  }
  const o = item as Record<string, unknown>;
  const raw = o.created_at ?? o.updated_at ?? o.date ?? o.timestamp;
  const t = typeof raw === 'string' || typeof raw === 'number' ? Date.parse(String(raw)) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

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

function sectionTitleFromTs(ts: number): string {
  if (!ts) {
    return 'Other';
  }
  const d = new Date(ts);
  const y = d.getFullYear();
  const cy = new Date().getFullYear();
  if (y === cy) {
    return new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(d);
  }
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(d);
}

function buildSections(txData: LabWalletTransactionsData | null): TxSection[] {
  const flat = flattenWalletTransactionBuckets(txData);
  const withTs = flat
    .map(item => {
      const row = mapTxItem(item);
      const ts = txTimestamp(item);
      return row ? { row, ts } : null;
    })
    .filter((x): x is { row: TxRow; ts: number } => x != null);

  withTs.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const sections: TxSection[] = [];
  for (const { row, ts } of withTs) {
    const title = sectionTitleFromTs(ts);
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(row);
    } else {
      sections.push({ title, data: [row] });
    }
  }
  return sections;
}

function resolveTotalPages(
  txData: LabWalletTransactionsData | null,
  limit: number,
): number {
  const pag = txData?.pagination;
  if (typeof pag?.total_pages === 'number' && pag.total_pages > 0) {
    return pag.total_pages;
  }
  if (typeof pag?.total === 'number' && pag.total > 0) {
    return Math.max(1, Math.ceil(pag.total / limit));
  }
  return 1;
}

function getVisiblePageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 4) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  let start = Math.max(1, currentPage - 1);
  if (start + 3 > totalPages) {
    start = totalPages - 3;
  }

  return [start, start + 1, start + 2, start + 3];
}

const TransactionHistory: React.FC = () => {
  const navigation = useNavigation<TransactionHistoryNav>();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, vs(16));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<TxSection[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadTransactions = useCallback(
    async (page: number, opts?: { isRefresh?: boolean }) => {
      if (opts?.isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const txData = await getLabWalletTransactions(page, TRANSACTIONS_PER_PAGE);
        setSections(buildSections(txData));
        setCurrentPage(page);
        setTotalPages(resolveTotalPages(txData, TRANSACTIONS_PER_PAGE));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load transactions.');
        setSections([]);
        setTotalPages(1);
      } finally {
        if (opts?.isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadTransactions(1);
  }, [loadTransactions]);

  const goToPage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages || page === currentPage || loading) {
        return;
      }
      void loadTransactions(page);
    },
    [currentPage, loadTransactions, loading, totalPages],
  );

  const visiblePages = getVisiblePageNumbers(currentPage, totalPages);

  const sectionListData = useMemo(
    () => sections.map((section, sidx) => ({ section, key: `${section.title}-${sidx}` })),
    [sections],
  );

  const renderSection = useCallback(
    ({ item }: { item: { section: TxSection; key: string } }) => (
      <View style={styles.sectionBlock}>
        <View style={styles.monthHeader}>
          <View style={styles.monthLine} />
          <Text style={styles.monthText}>{item.section.title}</Text>
          <View style={styles.monthLine} />
        </View>
        <View style={styles.txCard}>
          {item.section.data.map((tx, index) => (
            <View key={`${tx.title}-${tx.subtitle}-${index}`}>
              {index > 0 ? <View style={styles.txDivider} /> : null}
              <View style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.txTitle} numberOfLines={2}>
                    {tx.title}
                  </Text>
                  <Text style={styles.txSub}>{tx.subtitle || '—'}</Text>
                </View>
                <Text
                  style={[styles.txAmount, tx.positive ? styles.txCredit : styles.txDebit]}
                >
                  {tx.amount}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    ),
    [],
  );

  const listFooter = useMemo(
    () =>
      totalPages > 1 ? (
        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[
              styles.paginationNavBtn,
              currentPage <= 1 && styles.paginationNavBtnDisabled,
            ]}
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <Text
              style={[
                styles.paginationNavText,
                currentPage <= 1 && styles.paginationNavTextDisabled,
              ]}
            >
              Prev
            </Text>
          </TouchableOpacity>

          {visiblePages.map(page => {
            const isActive = page === currentPage;
            return (
              <TouchableOpacity
                key={page}
                style={[
                  styles.paginationPageBtn,
                  isActive && styles.paginationPageBtnActive,
                ]}
                onPress={() => goToPage(page)}
                disabled={isActive || loading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Page ${page}`}
              >
                <Text
                  style={[
                    styles.paginationPageText,
                    isActive && styles.paginationPageTextActive,
                  ]}
                >
                  {page}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[
              styles.paginationNavBtn,
              currentPage >= totalPages && styles.paginationNavBtnDisabled,
            ]}
            onPress={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text
              style={[
                styles.paginationNavText,
                currentPage >= totalPages && styles.paginationNavTextDisabled,
              ]}
            >
              Next
            </Text>
          </TouchableOpacity>
        </View>
      ) : null,
    [totalPages, currentPage, loading, visiblePages, goToPage],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="Transaction History"
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={[styles.centered, styles.errorPad]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlashList
          data={sectionListData}
          renderItem={renderSection}
          keyExtractor={item => item.key}
          style={styles.scroll}
          contentContainerStyle={[
            styles.listContent,
            sections.length === 0 ? styles.listContentEmpty : null,
            { paddingBottom: bottomPad + vs(24) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTransactions(currentPage, { isRefresh: true })}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No transactions yet.</Text>
            </View>
          }
          ListFooterComponent={listFooter}
        />
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
  errorPad: {
    paddingHorizontal: ms(24),
  },
  errorText: {
    fontSize: s(15),
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: ms(16),
    paddingTop: vs(12),
    flexGrow: 1,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sectionBlock: {
    marginBottom: vs(4),
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(14),
    backgroundColor: COLORS.BACKGROUND,
  },
  monthLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  monthText: {
    marginHorizontal: ms(12),
    fontSize: s(12),
    fontWeight: '600',
    color: LABEL_GRAY,
  },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    marginBottom: vs(10),
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
    color: DEBIT_RED,
  },
  txDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: ms(16),
  },
  emptyWrap: {
    paddingVertical: vs(40),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: s(15),
    color: LABEL_GRAY,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    paddingTop: vs(16),
    paddingBottom: vs(8),
    flexWrap: 'wrap',
  },
  paginationNavBtn: {
    paddingVertical: vs(8),
    paddingHorizontal: ms(12),
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  paginationNavBtnDisabled: {
    opacity: 0.45,
  },
  paginationNavText: {
    fontSize: s(13),
    fontWeight: '600',
    color: PRIMARY,
  },
  paginationNavTextDisabled: {
    color: LABEL_GRAY,
  },
  paginationPageBtn: {
    minWidth: ms(36),
    height: ms(36),
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(8),
  },
  paginationPageBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  paginationPageText: {
    fontSize: s(14),
    fontWeight: '600',
    color: PRIMARY,
  },
  paginationPageTextActive: {
    color: '#FFFFFF',
  },
});

export default TransactionHistory;
