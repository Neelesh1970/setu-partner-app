import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store';

const selectProfileState = (state: RootState) => state.profile;

export const selectLabProfileData = createSelector(
  selectProfileState,
  profile => profile.data,
);

export const selectLabProfileLoading = createSelector(
  selectProfileState,
  profile => profile.loading,
);

export const selectLabProfileError = createSelector(
  selectProfileState,
  profile => profile.error,
);
