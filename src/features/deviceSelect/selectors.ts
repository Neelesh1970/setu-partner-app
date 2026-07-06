import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store';

const EMPTY_COMPLETED_IDS: string[] = [];

const selectCompletedByBookingId = (state: RootState) =>
  state.deviceSelect.completedByBookingId;

export const selectCompletedBookingItemIds = createSelector(
  [
    selectCompletedByBookingId,
    (_state: RootState, bookingId: string | null | undefined) => bookingId,
  ],
  (completedByBookingId, bookingId) => {
    if (!bookingId) {
      return EMPTY_COMPLETED_IDS;
    }
    return completedByBookingId[bookingId] ?? EMPTY_COMPLETED_IDS;
  },
);
