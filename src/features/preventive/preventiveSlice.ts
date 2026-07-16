import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  deletePreventivePatient,
  getDevices,
  getPackages,
  getPreventivePatients,
  getScreenings,
  type PreventivePatientListItem,
} from '../../Screens/Home/PreventiveUser/PreventiveHealthAPI';

export type PreventiveState = {
  devices: Awaited<ReturnType<typeof getDevices>>;
  packages: Awaited<ReturnType<typeof getPackages>>;
  screenings: Awaited<ReturnType<typeof getScreenings>>;
  devicesLoading: boolean;
  packagesLoading: boolean;
  screeningsLoading: boolean;
  patients: {
    list: PreventivePatientListItem[];
    loading: boolean;
  };
  error: string | null;
};

const initialState: PreventiveState = {
  devices: [],
  packages: [],
  screenings: [],
  devicesLoading: false,
  packagesLoading: false,
  screeningsLoading: false,
  patients: {
    list: [],
    loading: false,
  },
  error: null,
};

export const fetchPreventiveDevices = createAsyncThunk(
  'preventive/fetchDevices',
  async (_, { rejectWithValue }) => {
    try {
      return await getDevices();
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load devices');
    }
  },
);

export const fetchPreventivePackages = createAsyncThunk(
  'preventive/fetchPackages',
  async (_, { rejectWithValue }) => {
    try {
      return await getPackages();
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load packages');
    }
  },
);

export const fetchPreventiveScreenings = createAsyncThunk(
  'preventive/fetchScreenings',
  async (_, { rejectWithValue }) => {
    try {
      return await getScreenings();
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load screenings');
    }
  },
);

export const fetchPatients = createAsyncThunk<
  PreventivePatientListItem[],
  { force?: boolean } | undefined,
  { state: { preventive: PreventiveState } }
>(
  'preventive/fetchPatients',
  async () => getPreventivePatients(),
  {
    condition: (arg, { getState }) => {
      const force = arg?.force;
      if (force) return true;
      const { list, loading } = getState().preventive.patients;
      return !(list.length > 0 || loading);
    },
  },
);

export const deletePatientAsync = createAsyncThunk<
  PreventivePatientListItem[],
  { patientId: string }
>('preventive/deletePatient', async ({ patientId }) => {
  await deletePreventivePatient(patientId);
  return getPreventivePatients();
});

const preventiveSlice = createSlice({
  name: 'preventive',
  initialState,
  reducers: {
    clearPreventive: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchPreventiveDevices.pending, state => {
        state.devicesLoading = true;
        state.error = null;
      })
      .addCase(fetchPreventiveDevices.fulfilled, (state, action) => {
        state.devicesLoading = false;
        state.devices = action.payload;
      })
      .addCase(fetchPreventiveDevices.rejected, (state, action) => {
        state.devicesLoading = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(fetchPreventivePackages.pending, state => {
        state.packagesLoading = true;
        state.error = null;
      })
      .addCase(fetchPreventivePackages.fulfilled, (state, action) => {
        state.packagesLoading = false;
        state.packages = action.payload;
      })
      .addCase(fetchPreventivePackages.rejected, (state, action) => {
        state.packagesLoading = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(fetchPreventiveScreenings.pending, state => {
        state.screeningsLoading = true;
        state.error = null;
      })
      .addCase(fetchPreventiveScreenings.fulfilled, (state, action) => {
        state.screeningsLoading = false;
        state.screenings = action.payload;
      })
      .addCase(fetchPreventiveScreenings.rejected, (state, action) => {
        state.screeningsLoading = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(fetchPatients.pending, state => {
        state.patients.loading = true;
        state.error = null;
      })
      .addCase(fetchPatients.fulfilled, (state, action) => {
        state.patients.loading = false;
        state.patients.list = action.payload;
      })
      .addCase(fetchPatients.rejected, (state, action) => {
        state.patients.loading = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(deletePatientAsync.pending, state => {
        state.patients.loading = true;
      })
      .addCase(deletePatientAsync.fulfilled, (state, action) => {
        state.patients.loading = false;
        state.patients.list = action.payload;
      })
      .addCase(deletePatientAsync.rejected, (state, action) => {
        state.patients.loading = false;
        state.error = (action.payload as string) ?? null;
      });
  },
});

export const { clearPreventive } = preventiveSlice.actions;
export default preventiveSlice.reducer;
