import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '../../api/axiosInstance';

export type PersonalInfo = {
  full_name?: string | null;
  location?: string | null;
  profile_image_url?: string | null;
};

export type WorkStats = {
  users_registered?: number;
  tests_completed?: number;
};

export type LabProfileData = {
  personal_info?: PersonalInfo;
  work_stats?: WorkStats;
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

export const fetchLabProfile = createAsyncThunk(
  'profile/fetchLabProfile',
  async (_, { rejectWithValue }) => {
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
  },
  extraReducers: builder => {
    builder
      .addCase(fetchLabProfile.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLabProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchLabProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Failed to load profile';
      });
  },
});

export const { clearProfile } = profileSlice.actions;
export default profileSlice.reducer;
