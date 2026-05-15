import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { sendNewUserOtp, sendExistingUserOtpRegFlow } from '../../Services/authService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RegisterWithOtp'>;

const PHONE_LENGTH = 10;

const RegisterWithOtp: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (text: string) => {
    setMobile(text.replace(/\D/g, '').slice(0, PHONE_LENGTH));
  };

  const handleContinue = async () => {
    if (mobile.length !== PHONE_LENGTH) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      await sendNewUserOtp(mobile);
      navigation.navigate('RegisterVerifyOtp', { mobile, alreadyRegistered: false });
    } catch (err: any) {
      if (err?.status === 409) {
        try {
          await sendExistingUserOtpRegFlow(mobile);
          navigation.navigate('RegisterVerifyOtp', { mobile, alreadyRegistered: true });
        } catch (loginErr: any) {
          Alert.alert('Error', loginErr?.message || 'Failed to send OTP. Please try again.');
        }
      } else {
        Alert.alert('Error', err?.message || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDEDED" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.bottomCard}>
            <Text style={styles.title}>Register New User</Text>
            <Text style={styles.subtitle}>Enter mobile number to get started.</Text>

            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.inputRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit number"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={mobile}
                onChangeText={handleChange}
                maxLength={PHONE_LENGTH}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterWithOtp;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backBtn: {
    padding: 16,
  },
  backArrow: {
    fontSize: 24,
    color: '#222',
  },
  bottomCard: {
    marginTop: 'auto',
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    color: '#666',
    fontSize: 14,
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
    color: '#333',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: '#fafafa',
  },
  prefix: {
    fontSize: 16,
    marginRight: 10,
    color: '#333',
    fontWeight: '500',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  button: {
    marginTop: 32,
    backgroundColor: '#2F3DBD',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
