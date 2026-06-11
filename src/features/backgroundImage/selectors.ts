import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store';

const selectBackgroundImageState = (state: RootState) => state.backgroundImage;

export const selectBackgroundImageUrl = createSelector(
  [selectBackgroundImageState, (_state: RootState, imageId: number) => imageId],
  (bg, imageId) => bg.urlsById[imageId] ?? null,
);

export const selectBackgroundImageLoading = createSelector(
  [selectBackgroundImageState, (_state: RootState, imageId: number) => imageId],
  (bg, imageId) => {
    if (bg.urlsById[imageId]) {
      return false;
    }
    // Cold start: no cache and fetch not yet finished.
    return bg.loadingIds[imageId] !== false;
  },
);
