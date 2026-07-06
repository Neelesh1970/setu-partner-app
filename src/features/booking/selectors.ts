import type { RootState } from '../../store';

/** Cached hospital MRN for a booking (null = fetched but absent). */
export const selectHospitalMrn =
  (bookingId: string | null | undefined) =>
  (state: RootState): string | null | undefined => {
    const bid = (bookingId ?? '').trim();
    if (!bid) {
      return undefined;
    }
    return state.booking.hospitalMrnByBookingId[bid];
  };

export const selectHospitalMrnByBookingId = (state: RootState) =>
  state.booking.hospitalMrnByBookingId;
