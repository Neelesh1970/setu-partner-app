import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../api/axiosInstance';
import { isJsonEqual } from '../../Utils/cacheEquality';

export type PersonalInfo = {
  id?: string;
  full_name?: string | null;
  location?: string | null;
  age?: number | null;
  gender?: string | null;
  email?: string | null;
  phone_number?: string | null;
  profile_image_url?: string | null;
  profile_image_s3_key?: string | null;
  role?: string | null;
  service_scope?: string | null;
};

export type WorkStats = {
  users_registered?: number;
  tests_completed?: number;
  walk_in_tests?: number;
  home_visits?: number;
};

export type Earnings = {
  total_amount?: number;
  currency?: string;
  current_month_amount?: number;
  wallet_balance?: number;
};

export type LabProfileData = {
  personal_info?: PersonalInfo;
  work_stats?: WorkStats;
  earnings?: Earnings;
};

type LabProfileResponse = {
  success?: boolean;
  message?: string;
  data?: LabProfileData;
};

export type ProfileState = {
  data: LabProfileData | null;
  loading: boolean;
  error: string | null;
};

const initialState: ProfileState = {
  data: null,
  loading: false,
  error: null,
};

type FetchLabProfileArg = { force?: boolean } | undefined;

export const fetchLabProfile = createAsyncThunk(
  'profile/fetchLabProfile',
  async (_arg: FetchLabProfileArg, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get<LabProfileResponse>('lab/profile');
      return res.data?.data ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load profile';
      return rejectWithValue(message);
    }
  },
);

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearProfile: () => initialState,
    setProfileData: (state, action: PayloadAction<LabProfileData | null>) => {
      state.data = action.payload;
      state.error = null;
    },
    mergeProfilePersonalInfo: (state, action: PayloadAction<PersonalInfo>) => {
      if (!state.data) {
        state.data = { personal_info: action.payload };
        return;
      }
      state.data = {
        ...state.data,
        personal_info: { ...state.data.personal_info, ...action.payload },
      };
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchLabProfile.pending, state => {
        if (!state.data) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchLabProfile.fulfilled, (state, action) => {
        state.loading = false;
        if (!isJsonEqual(state.data, action.payload)) {
          state.data = action.payload;
        }
      })
      .addCase(fetchLabProfile.rejected, (state, action) => {
        state.loading = false;
        if (!state.data) {
          state.error = (action.payload as string) ?? 'Failed to load profile';
        }
      });
  },
});

export const { clearProfile, setProfileData, mergeProfilePersonalInfo } = profileSlice.actions;
export default profileSlice.reducer;
