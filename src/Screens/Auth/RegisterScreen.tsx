import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../../Components/ScreenHeader/ScreenHeader';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { sendRegistrationOtp } from '../../Services/authService';

type RegisterNavProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

const ROLE_OPTIONS = ['Health Soldier', 'Supervisor', 'Admin'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

interface RegisterForm {
  role: string;
  fullName: string;
  gender: string;
  age: string;
  phone: string;
  email: string;
}

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterNavProp>();

  const [form, setForm] = useState<RegisterForm>({
    role: '',
    fullName: '',
    gender: '',
    age: '',
    phone: '',
    email: '',
  });
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  const updateField = (field: keyof RegisterForm) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    const { role, fullName, gender, age, phone, email } = form;
    if (!role || !fullName || !gender || !age || !phone || !email) {
      Alert.alert('Incomplete Form', 'Please fill in all fields before continuing.');
      return false;
    }
    if (phone.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validate()) {return;}

    setLoading(true);
    try {
      await sendRegistrationOtp({
        mobile: form.phone,
        role: form.role,
        full_name: form.fullName,
        gender: form.gender,
        age: Number(form.age),
        email: form.email,
      });
      navigation.navigate('OtpVerification', { mobile: form.phone });
    } catch (error: any) {
      console.log('[RegisterScreen] handleContinue error:', error);
      Alert.alert('Error', error?.message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Create Your Account" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.description}>
          Join as a Health Soldier to register patients, manage tests, and earn
          incentives.
        </Text>

        {/* Role Dropdown */}
        <Text style={styles.label}>Select Your Role</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => setShowRoleDropdown(prev => !prev)}
          activeOpacity={0.7}
        >
          <Text style={form.role ? styles.inputText : styles.placeholderText}>
            {form.role || 'Select'}
          </Text>
          <Text style={styles.dropdownIcon}>{showRoleDropdown ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showRoleDropdown && (
          <View style={styles.dropdownMenu}>
            {ROLE_OPTIONS.map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dropdownOption,
                  form.role === option && styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  updateField('role')(option);
                  setShowRoleDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    form.role === option && styles.dropdownOptionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Full Name */}
        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={form.fullName}
            onChangeText={updateField('fullName')}
            placeholder="Enter full name"
            placeholderTextColor="#A0A0A0"
          />
        </View>

        {/* Gender */}
        <Text style={styles.label}>Select your gender</Text>
        <View style={styles.radioGroup}>
          {GENDER_OPTIONS.map(option => (
            <TouchableOpacity
              key={option}
              style={styles.radioButton}
              onPress={() => updateField('gender')(option)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioCircle,
                  form.gender === option && styles.radioCircleSelected,
                ]}
              >
                {form.gender === option && <View style={styles.radioInnerCircle} />}
              </View>
              <Text style={styles.radioText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Age */}
        <Text style={styles.label}>Age</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={form.age}
            onChangeText={updateField('age')}
            placeholder="Enter your age"
            placeholderTextColor="#A0A0A0"
            keyboardType="numeric"
            maxLength={3}
          />
        </View>

        {/* Phone Number */}
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.phoneInputRow}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>+91</Text>
          </View>
          <View style={[styles.inputContainer, styles.phoneInput]}>
            <TextInput
              style={styles.textInput}
              value={form.phone}
              onChangeText={updateField('phone')}
              placeholder="00000 - 00000"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* Email */}
        <Text style={styles.label}>E-mail</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={form.email}
            onChangeText={updateField('email')}
            placeholder="Enter your E-mail address"
            placeholderTextColor="#A0A0A0"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 25,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 15,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000',
  },
  inputText: {
    fontSize: 14,
    color: '#000',
    paddingVertical: 12,
  },
  placeholderText: {
    color: '#A0A0A0',
    paddingVertical: 12,
    fontSize: 14,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFF',
    marginTop: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownOptionSelected: {
    backgroundColor: '#EEF1FF',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#000',
  },
  dropdownOptionTextSelected: {
    color: '#1A49AB',
    fontWeight: '600',
  },
  radioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 25,
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioCircleSelected: {
    borderColor: '#1A49AB',
  },
  radioInnerCircle: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#1A49AB',
  },
  radioText: {
    fontSize: 14,
    color: '#000',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefixBox: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F0F0F0',
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  phoneInput: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#1A49AB',
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
