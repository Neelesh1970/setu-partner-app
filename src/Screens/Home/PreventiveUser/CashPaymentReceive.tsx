import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ms, s, vs } from 'react-native-size-matters';

import PreventiveHealthHeader from './PreventiveHealthHeader';
import { COLORS } from '../../../Constants/theme';
import type { RootStackParamList } from '../../../navigation/types';

/* ─────────────────────────── constants ─────────────────────────── */

const HEADER_BG = COLORS.PRIMARY;
const GREEN = '#16A34A';
const GREEN_LIGHT = '#DCFCE7';
const TEXT_PRIMARY = '#0F172A';
const TEXT_MUTED = '#64748B';
const BG = '#F8FAFC';

const formatRupee = (n: number | string | null | undefined): string => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '₹0.00';
  return `₹${num.toFixed(2)}`;
};

/* ─────────────────────────── component ─────────────────────────── */

type Props = NativeStackScreenProps<RootStackParamList, 'CashPaymentReceive'>;

export default function CashPaymentReceive({ navigation, route }: Props): React.JSX.Element {
  const { amount } = route.params;
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      const onBack = (): boolean => {
        navigation.goBack();
        return true;
      };
      let sub: { remove: () => void } | undefined;
      if (Platform.OS === 'android') {
        sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      }
      return () => sub?.remove();
    }, [navigation]),
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />

      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="Collect Cash"
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>

      <View style={styles.body}>
        <View style={styles.centerContent}>
          {/* Green checkmark */}
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={ms(64)} color={GREEN} />
          </View>

          <Text style={styles.successTitle}>Payment Collected!</Text>
          <Text style={styles.successSubtitle}>
            Cash payment has been successfully recorded.
          </Text>

          {/* Amount card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount Collected</Text>
            <Text style={styles.amountValue}>{formatRupee(amount)}</Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(
              insets.bottom + vs(8),
              Platform.OS === 'ios' ? vs(16) : vs(12),
            ),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.9}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─────────────────────────── styles ─────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  headerShell: {
    backgroundColor: HEADER_BG,
    borderBottomLeftRadius: ms(22),
    borderBottomRightRadius: ms(22),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: vs(4) },
        shadowOpacity: 0.12,
        shadowRadius: ms(8),
      },
      android: { elevation: 6 },
    }),
  },
  headerSafe: {
    backgroundColor: HEADER_BG,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ms(24),
  },
  centerContent: {
    alignItems: 'center',
  },
  /* Success */
  successCircle: {
    width: ms(120),
    height: ms(120),
    borderRadius: ms(60),
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(24),
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
        shadowOffset: { width: 0, height: vs(4) },
        shadowOpacity: 0.18,
        shadowRadius: ms(12),
      },
      android: { elevation: 4 },
    }),
  },
  successTitle: {
    fontSize: s(24),
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: vs(8),
  },
  successSubtitle: {
    fontSize: s(14),
    fontWeight: '500',
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: vs(32),
    lineHeight: s(22),
  },
  amountCard: {
    width: '100%',
    backgroundColor: COLORS.WHITE,
    borderRadius: ms(16),
    paddingVertical: vs(22),
    paddingHorizontal: ms(24),
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: vs(2) },
        shadowOpacity: 0.08,
        shadowRadius: ms(10),
      },
      android: { elevation: 3 },
    }),
  },
  amountLabel: {
    fontSize: s(13),
    fontWeight: '600',
    color: TEXT_MUTED,
    marginBottom: vs(6),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  amountValue: {
    fontSize: s(36),
    fontWeight: '900',
    color: GREEN,
  },

  /* Footer */
  footer: {
    backgroundColor: COLORS.WHITE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: ms(24),
    paddingTop: vs(12),
  },
  doneBtn: {
    backgroundColor: HEADER_BG,
    borderRadius: ms(12),
    paddingVertical: vs(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: COLORS.WHITE,
    fontSize: s(16),
    fontWeight: '800',
  },
});
