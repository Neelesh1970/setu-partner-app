import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchBackgroundImageUrl } from '../../Services/backgroundImageService';

export type BackgroundImageState = {
  urlsById: Record<number, string>;
  loadingIds: Record<number, boolean>;
};

const initialState: BackgroundImageState = {
  urlsById: {},
  loadingIds: {},
};

export const fetchBackgroundImage = createAsyncThunk(
  'backgroundImage/fetch',
  async (imageId: number) => {
    const url = await fetchBackgroundImageUrl(imageId);
    return { imageId, url };
  },
);

const backgroundImageSlice = createSlice({
  name: 'backgroundImage',
  initialState,
  reducers: {
    clearBackgroundImages: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchBackgroundImage.pending, (state, action) => {
        const imageId = action.meta.arg;
        if (!state.urlsById[imageId]) {
          state.loadingIds[imageId] = true;
        }
      })
      .addCase(fetchBackgroundImage.fulfilled, (state, action) => {
        const { imageId, url } = action.payload;
        state.loadingIds[imageId] = false;
        if (url && state.urlsById[imageId] !== url) {
          state.urlsById[imageId] = url;
        }
      })
      .addCase(fetchBackgroundImage.rejected, (state, action) => {
        const imageId = action.meta.arg;
        state.loadingIds[imageId] = false;
      });
  },
});

export const { clearBackgroundImages } = backgroundImageSlice.actions;
export default backgroundImageSlice.reducer;
