import axiosInstance from '../api/axiosInstance';

type BackgroundImageApiEnvelope = {
  success: boolean;
  data?: {
    s3_url: string;
  };
};

export async function fetchBackgroundImageUrl(
  id: number,
): Promise<string | null> {
  try {
    const response = await axiosInstance.get<BackgroundImageApiEnvelope>(
      `background-images/${id}`,
    );
    const url = response.data?.data?.s3_url;
    return typeof url === 'string' && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}
