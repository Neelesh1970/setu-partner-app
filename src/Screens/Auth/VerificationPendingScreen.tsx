import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';
import { RootStackParamList } from '../../navigation/types';
import {
  getIdentityVerificationStatus,
  getBackgroundImageS3Url,
  IDENTITY_VERIFICATION_MODAL_IMAGE_ID,
} from '../../Services/authService';

type VerificationPendingNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'VerificationPending'
>;

const VerificationPendingScreen: React.FC = () => {
  const navigation = useNavigation<VerificationPendingNavProp>();

  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null);
  const [illustrationLoading, setIllustrationLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);

  const loadIllustration = useCallback(async () => {
    if (illustrationUrl) {return;}
    setIllustrationLoading(true);
    try {
      const url = await getBackgroundImageS3Url(IDENTITY_VERIFICATION_MODAL_IMAGE_ID);
      if (url) {setIllustrationUrl(url);}
    } catch {
      // Illustration is optional; card copy is sufficient.
    } finally {
      setIllustrationLoading(false);
    }
  }, [illustrationUrl]);

  useEffect(() => {
    void loadIllustration();
  }, [loadIllustration]);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const statusRes = await getIdentityVerificationStatus();
      const status = String(statusRes?.data?.verification_status ?? '').toUpperCase();
      if (status === 'APPROVED' || statusRes?.data?.is_approved === true) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
      // If still PENDING or any other status, stay on this screen.
    } catch (e) {
      console.log('[VerificationPendingScreen] status-check error:', e);
    } finally {
      setChecking(false);
    }
  }, [navigation]);

  const onPullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await checkStatus();
    } finally {
      setRefreshing(false);
    }
  }, [checkStatus]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader title="Verification Pending" />
        </SafeAreaView>
      </View>

      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullToRefresh}
              colors={['#1A49AB']}
              tintColor="#1A49AB"
            />
          }
        >
          <View style={styles.card}>
            <View style={styles.imageWrapper}>
              {illustrationUrl ? (
                <Image
                  source={{ uri: illustrationUrl }}
                  style={styles.illustration}
                  resizeMode="contain"
                />
              ) : illustrationLoading ? (
                <ActivityIndicator color="#1A49AB" size="large" />
              ) : (
                <View style={styles.imagePlaceholder} />
              )}
            </View>

            <Text style={styles.title}>Verification in Progress</Text>
            <Text style={styles.subtitle}>
              Your profile is under review. You will be notified within 24–48 hours after
              verification.
            </Text>

            <TouchableOpacity
              style={[styles.refreshButton, checking && styles.refreshButtonDisabled]}
              onPress={checkStatus}
              disabled={checking}
              activeOpacity={0.8}
            >
              {checking ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.refreshButtonText}>Refresh</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  headerShell: {
    backgroundColor: '#1C39BB',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: '#1C39BB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  imageWrapper: {
    width: '100%',
    minHeight: 168,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  illustration: {
    width: 200,
    height: 168,
  },
  imagePlaceholder: {
    width: 200,
    height: 168,
    backgroundColor: '#F3F5F9',
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#1A49AB',
    borderRadius: 999,
    paddingHorizontal: 40,
    paddingVertical: 14,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default VerificationPendingScreen;
