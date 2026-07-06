import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  getReportPayload,
  type RawDeviceItem,
} from '../../Screens/Home/PreventiveUser/PreventiveHealthAPI';
import { deriveCompletedBookingItemIds } from '../../Utils/reportPayloadCompletion';

export type DeviceSelectState = {
  /** bookingId → completed booking_item_ids for multi-device test flow */
  completedByBookingId: Record<string, string[]>;
  hydratingBookingId: string | null;
};

const initialState: DeviceSelectState = {
  completedByBookingId: {},
  hydratingBookingId: null,
};

function mergeBookingItemIds(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

export const hydrateDeviceSelectFromPayload = createAsyncThunk(
  'deviceSelect/hydrateFromPayload',
  async (
    { bookingId, devices }: { bookingId: string; devices: RawDeviceItem[] },
    { rejectWithValue },
  ) => {
    try {
      const payload = await getReportPayload(bookingId);
      return {
        bookingId,
        bookingItemIds: deriveCompletedBookingItemIds(devices, payload),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load report payload';
      return rejectWithValue(message);
    }
  },
);

const deviceSelectSlice = createSlice({
  name: 'deviceSelect',
  initialState,
  reducers: {
    markDeviceCompleted: (
      state,
      action: PayloadAction<{ bookingId: string; bookingItemId: string }>,
    ) => {
      const { bookingId, bookingItemId } = action.payload;
      if (!bookingId || !bookingItemId) {
        return;
      }
      const existing = state.completedByBookingId[bookingId] ?? [];
      if (!existing.includes(bookingItemId)) {
        state.completedByBookingId[bookingId] = [...existing, bookingItemId];
      }
    },
    clearDeviceSelectForBooking: (state, action: PayloadAction<string>) => {
      delete state.completedByBookingId[action.payload];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(hydrateDeviceSelectFromPayload.pending, (state, action) => {
        state.hydratingBookingId = action.meta.arg.bookingId;
      })
      .addCase(hydrateDeviceSelectFromPayload.fulfilled, (state, action) => {
        state.hydratingBookingId = null;
        const { bookingId, bookingItemIds } = action.payload;
        const existing = state.completedByBookingId[bookingId] ?? [];
        state.completedByBookingId[bookingId] = mergeBookingItemIds(
          existing,
          bookingItemIds,
        );
      })
      .addCase(hydrateDeviceSelectFromPayload.rejected, state => {
        state.hydratingBookingId = null;
      });
  },
});

export const { markDeviceCompleted, clearDeviceSelectForBooking } =
  deviceSelectSlice.actions;

export default deviceSelectSlice.reducer;
