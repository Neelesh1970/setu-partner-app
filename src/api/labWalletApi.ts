import axiosInstance from './axiosInstance';

/** GET /lab/wallet/summary — shape may extend; `balance` or `wallet_balance` or nested earnings. */
export type LabWalletSummaryData = {
  balance?: number;
  wallet_balance?: number;
  currency?: string;
  earnings?: { wallet_balance?: number; currency?: string };
  [key: string]: unknown;
};

export type LabWalletSummaryResponse = {
  success?: boolean;
  message?: string;
  data?: LabWalletSummaryData;
};

export type LabWalletTransactionsPagination = {
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
};

export type LabWalletTransactionsData = {
  recent?: unknown[];
  this_month?: unknown[];
  last_month?: unknown[];
  older?: unknown[];
  pagination?: LabWalletTransactionsPagination;
};

export type LabWalletTransactionsResponse = {
  success?: boolean;
  message?: string;
  data?: LabWalletTransactionsData;
};

export function resolveWalletBalance(summary: LabWalletSummaryData | null | undefined): number | null {
  if (!summary) {
    return null;
  }
  if (typeof summary.balance === 'number' && !Number.isNaN(summary.balance)) {
    return summary.balance;
  }
  if (typeof summary.wallet_balance === 'number' && !Number.isNaN(summary.wallet_balance)) {
    return summary.wallet_balance;
  }
  const nested = summary.earnings;
  if (nested && typeof nested === 'object' && nested !== null) {
    const w = (nested as { wallet_balance?: number }).wallet_balance;
    if (typeof w === 'number' && !Number.isNaN(w)) {
      return w;
    }
  }
  return null;
}

export function resolveWalletCurrency(summary: LabWalletSummaryData | null | undefined): string | undefined {
  if (!summary) {
    return undefined;
  }
  if (typeof summary.currency === 'string' && summary.currency) {
    return summary.currency;
  }
  const nested = summary.earnings;
  if (nested && typeof nested === 'object' && nested !== null) {
    const c = (nested as { currency?: string }).currency;
    if (typeof c === 'string' && c) {
      return c;
    }
  }
  return undefined;
}

/** Merge API buckets into one list (page order: recent → this month → last month → older). */
export function flattenWalletTransactionBuckets(
  data: LabWalletTransactionsData | null | undefined,
): unknown[] {
  if (!data) {
    return [];
  }
  return [
    ...(data.recent ?? []),
    ...(data.this_month ?? []),
    ...(data.last_month ?? []),
    ...(data.older ?? []),
  ];
}

export async function getLabWalletSummary(): Promise<LabWalletSummaryData | null> {
  const res = await axiosInstance.get<LabWalletSummaryResponse>('lab/wallet/summary');
  return res.data?.data ?? null;
}

export async function getLabWalletTransactions(
  page = 1,
  limit = 20,
): Promise<LabWalletTransactionsData | null> {
  const res = await axiosInstance.get<LabWalletTransactionsResponse>('lab/wallet/transactions', {
    params: { page, limit },
  });
  return res.data?.data ?? null;
}
