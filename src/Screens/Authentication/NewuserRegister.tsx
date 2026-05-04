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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { sendRegistrationOtp } from '../../Services/authService';

const PHONE_LENGTH = 10;

const NewuserRegister = () => {
  const navigation = useNavigation<any>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, PHONE_LENGTH);
    setPhone(digits);
  };

  const handleContinue = async () => {
    if (phone.length !== PHONE_LENGTH) {
      Alert.alert('Invalid Number', 'Please enter valid 10 digit number');
      return;
    }

    setLoading(true);

    try {
      await sendRegistrationOtp({
        mobile: phone,
        role: 'user',
        full_name: '',
        gender: '',
        age: 0,
        email: '',
      });

      navigation.navigate('RegisterOtp', { mobile: phone });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.bottomCard}>
          <Text style={styles.title}>Let’s get started</Text>
          <Text style={styles.subtitle}>Enter your number to proceed.</Text>

          <Text style={styles.label}>Phone Number</Text>

          <View style={styles.inputRow}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              style={styles.input}
              placeholder="00000 - 00000"
              placeholderTextColor="#000"
              keyboardType="number-pad"
              value={phone}
              onChangeText={handleChange}
              maxLength={PHONE_LENGTH}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default NewuserRegister;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  backBtn: {
    padding: 16,
  },
  backArrow: {
    fontSize: 24,
  },
  bottomCard: {
    marginTop: 'auto',
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    color: '#666',
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 50,
  },
  prefix: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  button: {
    marginTop: 30,
    backgroundColor: '#2F3DBD',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

