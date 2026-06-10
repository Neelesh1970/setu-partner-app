import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getLabWalletSummary,
  getLabWalletTransactions,
  type LabWalletSummaryData,
  type LabWalletTransactionsData,
} from '../../api/labWalletApi';

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

export const fetchWalletSummary = createAsyncThunk(
  'wallet/fetchSummary',
  async (_, { rejectWithValue }) => {
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
  },
  extraReducers: builder => {
    builder
      .addCase(fetchWalletSummary.pending, state => {
        state.summaryLoading = true;
        state.summaryError = null;
      })
      .addCase(fetchWalletSummary.fulfilled, (state, action) => {
        state.summaryLoading = false;
        state.summary = action.payload;
      })
      .addCase(fetchWalletSummary.rejected, (state, action) => {
        state.summaryLoading = false;
        state.summaryError = (action.payload as string) ?? 'Failed to load wallet summary';
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

export const { clearWallet } = walletSlice.actions;
export default walletSlice.reducer;
