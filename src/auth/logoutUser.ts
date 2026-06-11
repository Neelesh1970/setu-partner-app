import { CommonActions } from '@react-navigation/native';
import { clearSession } from '../store/authSlice';
import { store } from '../store';
import { clearAuthData } from '../Utils/storage';
import { navigationRef } from '../navigation/navigationRef';
import { clearBackgroundImages } from '../features/backgroundImage/backgroundImageSlice';
import { clearWallet } from '../features/wallet/walletSlice';
import { clearProfile } from '../features/profile/profileSlice';

let logoutInFlight: Promise<void> | null = null;

/**
 * Clears persisted session, Redux auth slice, and resets stack to the welcome / login flow.
 * Use after refresh failure, explicit logout, or any forced sign-out. Idempotent and serialized.
 */
export function logoutUser(): Promise<void> {
  if (logoutInFlight) {
    return logoutInFlight;
  }
  logoutInFlight = (async () => {
    try {
      await clearAuthData();
    } catch {
      // best-effort clear
    }
    store.dispatch(clearSession());
    store.dispatch(clearBackgroundImages());
    store.dispatch(clearWallet());
    store.dispatch(clearProfile());
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        }),
      );
    }
  })().finally(() => {
    logoutInFlight = null;
  });
  return logoutInFlight;
}
