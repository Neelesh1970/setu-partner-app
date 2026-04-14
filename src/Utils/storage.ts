import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
} as const;

export const saveAuthTokens = async (token: string, refreshToken: string): Promise<void> => {
  await AsyncStorage.multiSet([
    [KEYS.AUTH_TOKEN, token],
    [KEYS.REFRESH_TOKEN, refreshToken],
  ]);
};

export const getAuthToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.AUTH_TOKEN);
};

export const getRefreshToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
};

export const saveUser = async (user: object): Promise<void> => {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
};

export const getUser = async <T>(): Promise<T | null> => {
  const raw = await AsyncStorage.getItem(KEYS.USER);
  return raw ? (JSON.parse(raw) as T) : null;
};

export const clearAuthData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([KEYS.AUTH_TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER]);
};
