import { useCallback, useEffect } from 'react';
import { fetchWalletSummary } from '../features/wallet/walletSlice';
import { selectWalletSummary, selectWalletSummaryLoading } from '../features/wallet/selectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';

/**
 * Cache-first wallet summary shared across Home and MyWallet.
 */
export function useWalletSummary() {
  const dispatch = useAppDispatch();
  const summary = useAppSelector(selectWalletSummary);
  const loading = useAppSelector(selectWalletSummaryLoading);

  const revalidate = useCallback(() => {
    return dispatch(fetchWalletSummary({ force: true }));
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchWalletSummary());
  }, [dispatch]);

  return { summary, loading, revalidate };
}
