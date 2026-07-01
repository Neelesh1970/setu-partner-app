import { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance';

type BackgroundImageItem = {
  title?: string;
  s3_url?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
};

type BackgroundImagesResponse = {
  data?: BackgroundImageItem[];
};

/** Remote welcome/register background (no bundled WelcomeBG.png in partner app). */
export function useWelcomeBackgroundUri() {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get<BackgroundImagesResponse>('background-images');
        const list = res.data?.data;
        if (!Array.isArray(list) || cancelled) {
          return;
        }
        const entry = list.find(
          item =>
            item.title === 'registerscreen_image' &&
            item.is_active !== false &&
            item.is_deleted !== true,
        );
        const url = entry?.s3_url?.trim();
        if (url && !cancelled) {
          setUri(url);
        }
      } catch {
        // Solid fallback in screens
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return uri;
}
