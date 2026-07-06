import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getLabPatients,
  getLabBookingById,
  type LabPatientFilter,
  type LabPatientRecord,
} from '../../Screens/Home/PreventiveUser/PreventiveHealthAPI';

export type BookingState = {
  upcoming: LabPatientRecord[];
  completed: LabPatientRecord[];
  missed: LabPatientRecord[];
  loading: boolean;
  error: string | null;
  activeFilter: LabPatientFilter;
  /** bookingId → hospital MRN (each booking cached separately; null = none on server). */
  hospitalMrnByBookingId: Record<string, string | null>;
};

const initialState: BookingState = {
  upcoming: [],
  completed: [],
  missed: [],
  loading: false,
  error: null,
  activeFilter: 'upcoming',
  hospitalMrnByBookingId: {},
};

export const fetchBookings = createAsyncThunk(
  'booking/fetch',
  async (filter: LabPatientFilter, { rejectWithValue }) => {
    try {
      const data = await getLabPatients(filter);
      return { filter, data: data ?? [] };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load bookings';
      return rejectWithValue(message);
    }
  },
);

export const fetchBookingHospitalMrn = createAsyncThunk(
  'booking/fetchHospitalMrn',
  async (bookingId: string, { rejectWithValue }) => {
    const bid = bookingId.trim();
    if (!bid) {
      return rejectWithValue('Missing booking id');
    }
    try {
      const hospitalMrn = await getLabBookingById(bid);
      return { bookingId: bid, hospitalMrn };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load booking MRN';
      return rejectWithValue(message);
    }
  },
  {
    condition: (bookingId, { getState }) => {
      const bid = bookingId.trim();
      if (!bid) {
        return false;
      }
      const state = getState() as { booking: BookingState };
      const cached = state.booking.hospitalMrnByBookingId[bid];
      // Skip only when a non-empty MRN is already cached for this booking.
      return !(typeof cached === 'string' && cached.length > 0);
    },
  },
);

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    clearBookings: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchBookings.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.activeFilter = action.payload.filter;
        if (action.payload.filter === 'upcoming') {
          state.upcoming = action.payload.data;
        } else if (action.payload.filter === 'completed') {
          state.completed = action.payload.data;
        } else if (action.payload.filter === 'missed') {
          state.missed = action.payload.data;
        }
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Failed to load bookings';
      })
      .addCase(fetchBookingHospitalMrn.fulfilled, (state, action) => {
        const { bookingId, hospitalMrn } = action.payload;
        state.hospitalMrnByBookingId[bookingId] = hospitalMrn;
      });
  },
});

export const { clearBookings } = bookingSlice.actions;
export default bookingSlice.reducer;
