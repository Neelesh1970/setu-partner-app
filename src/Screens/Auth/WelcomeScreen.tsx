import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PrimaryButton from '../../Components/Button/PrimaryButton';
import { COLORS } from '../../Constants/theme';
import { RootStackParamList } from '../../navigation/types';
import axiosInstance from '../../api/axiosInstance';

type WelcomeNavProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

type BackgroundImageItem = {
  id: number;
  title: string;
  s3_url?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
};

type BackgroundImagesResponse = {
  success?: boolean;
  data?: BackgroundImageItem[];
};

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeNavProp>();
  const [welcomeBgUrl, setWelcomeBgUrl] = useState<string | null>(null);

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
          setWelcomeBgUrl(url);
        }
      } catch {
        // Keep default solid background; no toast per existing screen behavior
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = () => {
    navigation.navigate('Login');
    // navigation.navigate('TestActivity');
  };

  const handleSignup = () => {
    navigation.navigate('Register');
  };

  const inner = (
    <View style={styles.inner}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, welcomeBgUrl && styles.titleOnImage]}>
          Welcome
        </Text>
        <Text style={[styles.subtitle, welcomeBgUrl && styles.subtitleOnImage]}>
          Get started to manage patients, perform tests, and earn incentives
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <PrimaryButton title="Login" onPress={handleLogin} />
        <PrimaryButton title="Sign Up" onPress={handleSignup} />
      </View>
    </View>
  );

  if (welcomeBgUrl) {
    return (
      <ImageBackground
        source={{ uri: welcomeBgUrl }}
        style={styles.bgRoot}
        imageStyle={styles.bgImage}
        resizeMode="cover"
        onError={() => setWelcomeBgUrl(null)}
      >
        <SafeAreaView style={styles.safeOnImage}>{inner}</SafeAreaView>
      </ImageBackground>
    );
  }

  return <SafeAreaView style={styles.container}>{inner}</SafeAreaView>;
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  bgRoot: {
    flex: 1,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  safeOnImage: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  inner: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  textContainer: {
    marginTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 10,
    textAlign: 'center',
  },
  titleOnImage: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    textAlign: 'center',
  },
  subtitleOnImage: {
    color: 'rgba(255,255,255,0.92)',
  },
  buttonContainer: {
    marginBottom: 30,
  },
});
