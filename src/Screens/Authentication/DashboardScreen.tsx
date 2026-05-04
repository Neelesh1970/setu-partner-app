import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { clearAuthData } from '../../Utils/storage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await clearAuthData();
      navigation.reset({ index: 0, routes: [{ name: 'RegisterWithOtp' }] });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2F3DBD" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity
          onPress={handleLogout}
          disabled={loggingOut}
          style={styles.logoutBtn}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.logoutText}>Logout</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.successTitle}>Registration Successful!</Text>
          <Text style={styles.successSubtitle}>
            The user has been successfully registered. You can now manage their account from this dashboard.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Registrations</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Tests Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>₹0</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.registerMoreBtn}
          onPress={() => navigation.navigate('RegisterWithOtp')}
          activeOpacity={0.85}
        >
          <Text style={styles.registerMoreText}>+ Register Another User</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FF',
  },
  header: {
    backgroundColor: '#2F3DBD',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    minWidth: 72,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  successIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2F3DBD',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  registerMoreBtn: {
    backgroundColor: '#2F3DBD',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  registerMoreText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
