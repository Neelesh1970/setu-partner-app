import { useCallback, useEffect } from 'react';
import { fetchBackgroundImage } from '../features/backgroundImage/backgroundImageSlice';
import {
  selectBackgroundImageLoading,
  selectBackgroundImageUrl,
} from '../features/backgroundImage/selectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';

/**
 * Cache-first background image URL by CMS id.
 * Shows cached URL instantly; silently revalidates on mount.
 */
export function useBackgroundImageUrl(imageId: number) {
  const dispatch = useAppDispatch();
  const url = useAppSelector(state => selectBackgroundImageUrl(state, imageId));
  const loading = useAppSelector(state => selectBackgroundImageLoading(state, imageId));

  const revalidate = useCallback(() => {
    return dispatch(fetchBackgroundImage(imageId));
  }, [dispatch, imageId]);

  useEffect(() => {
    dispatch(fetchBackgroundImage(imageId));
  }, [dispatch, imageId]);

  return { url, loading, revalidate };
}
