import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store';

const selectWalletState = (state: RootState) => state.wallet;

export const selectWalletSummary = createSelector(
  selectWalletState,
  wallet => wallet.summary,
);

export const selectWalletSummaryLoading = createSelector(
  selectWalletState,
  wallet => wallet.summaryLoading,
);
