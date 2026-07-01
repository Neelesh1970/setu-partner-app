import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ms, vs } from 'react-native-size-matters';
import { useNavigation } from '@react-navigation/native';

import PreventiveHealthHeader from './PreventiveHealthHeader';
import { COLORS } from '../../../Constants/theme';
import type { RootStackParamList } from '../../../navigation/types';

const PRIMARY = COLORS.PRIMARY;
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';

type GenvReportWaitingNav = NativeStackNavigationProp<
  RootStackParamList,
  'GenvReportWaiting'
>;

const GenvReportWaiting: React.FC = () => {
  const navigation = useNavigation<GenvReportWaitingNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'GenvReportWaiting'>>();
  const bookingId = route.params?.bookingId ?? '';

  useFocusEffect(
    useCallback(() => {
      console.log('[GenvReportWaiting] Screen focused — bookingId:', bookingId || '(none)');
      console.log('[GenvReportWaiting] Waiting for report generation…');

      let isNavigating = false;
      const handleBack = () => {
        if (isNavigating) return true;
        isNavigating = true;
        navigation.goBack();
        return true;
      };
      let sub: { remove: () => void } | undefined;
      if (Platform.OS === 'android') {
        sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
      }
      return () => sub?.remove();
    }, [bookingId, navigation]),
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <View style={styles.flex1}>
        <View style={styles.headerShell}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <PreventiveHealthHeader
              title="Report"
              onBackPress={() => navigation.goBack()}
            />
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <View style={styles.reportIconWrap}>
            <Ionicons name="document-text-outline" size={ms(56)} color={PRIMARY} />
          </View>
          <Text style={styles.title}>Wait for report generate</Text>
          <Text style={styles.subtitle}>
            Your scan is being processed. Please wait while the report is generated.
          </Text>
        </View>
      </View>
    </>
  );
};

export default GenvReportWaiting;

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  headerShell: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: ms(20),
    borderBottomRightRadius: ms(20),
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: PRIMARY,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(24),
  },
  reportIconWrap: {
    width: ms(96),
    height: ms(96),
    borderRadius: ms(48),
    backgroundColor: PRIMARY + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(24),
  },
  title: {
    fontSize: ms(18),
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: vs(10),
  },
  subtitle: {
    fontSize: ms(14),
    fontWeight: '400',
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: ms(22),
  },
});
