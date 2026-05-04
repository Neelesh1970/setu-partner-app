import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { VerifiedUser } from '../Services/authService';

/**
 * In-memory auth state (no redux-persist). Tokens are persisted only in AsyncStorage
 * and attached by axios interceptors; Redux holds the signed-in user for UI/flows.
 */
export type AuthState = {
  isAuthenticated: boolean;
  user: VerifiedUser | null;
  userId: string | null;
};

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  userId: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Set session after successful login or when hydrating from storage on cold start. */
    setSession: (
      state,
      action: PayloadAction<{
        user: VerifiedUser | null;
        userId: string | null;
        isAuthenticated: boolean;
      }>,
    ) => {
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user;
      state.userId = action.payload.userId;
    },
    clearSession: () => initialState,
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;
