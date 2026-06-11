import { useCallback, useEffect } from 'react';
import { fetchLabProfile } from '../features/profile/profileSlice';
import {
  selectLabProfileData,
  selectLabProfileError,
  selectLabProfileLoading,
} from '../features/profile/selectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';

/**
 * Cache-first lab profile shared across Home, Profile, and MyWallet.
 */
export function useLabProfile() {
  const dispatch = useAppDispatch();
  const data = useAppSelector(selectLabProfileData);
  const loading = useAppSelector(selectLabProfileLoading);
  const error = useAppSelector(selectLabProfileError);

  const revalidate = useCallback(() => {
    return dispatch(fetchLabProfile({ force: true }));
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchLabProfile());
  }, [dispatch]);

  return { data, loading, error, revalidate };
}
