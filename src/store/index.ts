import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import cartReducer from '../features/cart/cartSlice';
import walletReducer from '../features/wallet/walletSlice';
import bookingReducer from '../features/booking/bookingSlice';
import profileReducer from '../features/profile/profileSlice';
import preventiveReducer from '../features/preventive/preventiveSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    wallet: walletReducer,
    booking: bookingReducer,
    profile: profileReducer,
    preventive: preventiveReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
