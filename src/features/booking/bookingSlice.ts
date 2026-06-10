import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getLabPatients,
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
};

const initialState: BookingState = {
  upcoming: [],
  completed: [],
  missed: [],
  loading: false,
  error: null,
  activeFilter: 'upcoming',
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
      });
  },
});

export const { clearBookings } = bookingSlice.actions;
export default bookingSlice.reducer;
