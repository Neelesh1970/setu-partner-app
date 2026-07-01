import React, { Suspense } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { COLORS } from '../Constants/theme';

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});

const fallback = (
  <View style={styles.fallback}>
    <ActivityIndicator size="large" color={COLORS.PRIMARY} />
  </View>
);

function lazyScreen<P extends object>(
  factory: () => Promise<{ default: React.ComponentType<P> }>,
): React.FC<P> {
  const Lazy = React.lazy(factory);
  const Wrapped: React.FC<P> = props => (
    <Suspense fallback={fallback}>
      <Lazy {...props} />
    </Suspense>
  );
  return Wrapped;
}

export const LazyTestActivity = lazyScreen(() =>
  import('../Screens/Home/PreventiveUser/TestActivity'),
);
export const LazyReports = lazyScreen(() => import('../Screens/Home/PreventiveUser/Reports'));
export const LazyPreventivePayment = lazyScreen(() =>
  import('../Screens/Home/PreventiveUser/PreventivePayment'),
);
export const LazyOxymeter = lazyScreen(() => import('../Screens/IOT/Oxymeter'));
export const LazyScaleDevice = lazyScreen(() => import('../Screens/IOT/ScaleDevice'));
export const LazyBloodPressure = lazyScreen(() => import('../Screens/IOT/BloodPressure'));
export const LazyRemidioQRScanner = lazyScreen(() => import('../Screens/IOT/RemidioQRScanner'));
export const LazyAshaDevice = lazyScreen(() => import('../Screens/IOT/AshaDevice'));
