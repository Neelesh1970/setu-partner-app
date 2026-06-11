import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  getLabWalletSummary,
  getLabWalletTransactions,
  type LabWalletSummaryData,
  type LabWalletTransactionsData,
} from '../../api/labWalletApi';
import { isJsonEqual } from '../../Utils/cacheEquality';

export type WalletState = {
  summary: LabWalletSummaryData | null;
  transactions: LabWalletTransactionsData | null;
  summaryLoading: boolean;
  transactionsLoading: boolean;
  summaryError: string | null;
  transactionsError: string | null;
};

const initialState: WalletState = {
  summary: null,
  transactions: null,
  summaryLoading: false,
  transactionsLoading: false,
  summaryError: null,
  transactionsError: null,
};

type FetchWalletSummaryArg = { force?: boolean } | undefined;

export const fetchWalletSummary = createAsyncThunk(
  'wallet/fetchSummary',
  async (_arg: FetchWalletSummaryArg, { rejectWithValue }) => {
    try {
      return await getLabWalletSummary();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load wallet summary';
      return rejectWithValue(message);
    }
  },
);

export const fetchWalletTransactions = createAsyncThunk(
  'wallet/fetchTransactions',
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}, { rejectWithValue }) => {
    try {
      return await getLabWalletTransactions(page, limit);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load transactions';
      return rejectWithValue(message);
    }
  },
);

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    clearWallet: () => initialState,
    setWalletSummary: (state, action: PayloadAction<LabWalletSummaryData | null>) => {
      state.summary = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchWalletSummary.pending, state => {
        if (!state.summary) {
          state.summaryLoading = true;
        }
        state.summaryError = null;
      })
      .addCase(fetchWalletSummary.fulfilled, (state, action) => {
        state.summaryLoading = false;
        if (!isJsonEqual(state.summary, action.payload)) {
          state.summary = action.payload;
        }
      })
      .addCase(fetchWalletSummary.rejected, (state, action) => {
        state.summaryLoading = false;
        if (!state.summary) {
          state.summaryError = (action.payload as string) ?? 'Failed to load wallet summary';
        }
      })
      .addCase(fetchWalletTransactions.pending, state => {
        state.transactionsLoading = true;
        state.transactionsError = null;
      })
      .addCase(fetchWalletTransactions.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchWalletTransactions.rejected, (state, action) => {
        state.transactionsLoading = false;
        state.transactionsError = (action.payload as string) ?? 'Failed to load transactions';
      });
  },
});

export const { clearWallet, setWalletSummary } = walletSlice.actions;
export default walletSlice.reducer;
