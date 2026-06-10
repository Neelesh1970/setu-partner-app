/** Re-export auth slice from store (canonical location for backward-compatible imports). */
export {
  setSession,
  clearSession,
  type AuthState,
} from '../../store/authSlice';
export { default } from '../../store/authSlice';
