import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Center, getCenters, sendRegistrationOtp } from '../../Services/authService';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';

type RegisterNavProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

const ROLE_OPTIONS = ['Health Soldier', 'Supervisor', 'Admin'];
const SERVICE_TYPE_OPTIONS = ['Home', 'clinic'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

interface RegisterForm {
  role: string;
  serviceType: string;
  fullName: string;
  gender: string;
  age: string;
  phone: string;
  email: string;
  centerId: string;
}

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterNavProp>();

  const [form, setForm] = useState<RegisterForm>({
    role: '',
    serviceType: '',
    fullName: '',
    gender: '',
    age: '',
    phone: '',
    email: '',
    centerId: '',
  });
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showServiceTypeDropdown, setShowServiceTypeDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [showCenterDropdown, setShowCenterDropdown] = useState(false);
  const [centersLoading, setCentersLoading] = useState(false);

  useEffect(() => {
    const fetchCenters = async () => {
      setCentersLoading(true);
      try {
        const centerList = await getCenters();
        setCenters(centerList);
      } catch (error) {
        console.log('[RegisterScreen] centers fetch error:', error);
        Alert.alert('Error', 'Unable to load clinic list. Please try again.');
      } finally {
        setCentersLoading(false);
      }
    };
    fetchCenters();
  }, []);

  const updateField = (field: keyof RegisterForm) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    const { role, serviceType, fullName, gender, age, phone, email, centerId } = form;
    if (!role || !serviceType || !fullName || !gender || !age || !phone || !email || !centerId) {
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
      const serviceScope =
        // Backend contract accepts only `home` or `center` for registration `service_scope`.
        (() => {
          const normalized = form.serviceType.trim().toLowerCase();
          if (normalized === 'home') return 'home';
          // UI uses `clinic`, but API expects `center`.
          if (normalized.includes('clinic') || normalized === 'center') return 'center';
          return 'center';
        })();

      const payload = {
        mobile: form.phone,
        role: form.role,
        full_name: form.fullName,
        gender: form.gender,
        age: Number(form.age),
        email: form.email,
        service_scope: serviceScope,
        center_id: form.centerId,
      };

      console.log('[RegisterScreen] send-otp payload:', JSON.stringify(payload, null, 2));
      const resp = await sendRegistrationOtp(payload);
      console.log('[RegisterScreen] send-otp success:', JSON.stringify(resp, null, 2));
      navigation.navigate('OtpVerification', { mobile: form.phone });
    } catch (error: any) {
      console.log('[RegisterScreen] handleContinue error:', error);
      Alert.alert('Error', error?.message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />
      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader title="Create Your Account" />
      </SafeAreaView>

      <SafeAreaView style={styles.bodySafe}>
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

        {/* Service Type Dropdown */}
        <Text style={styles.label}>Service-type</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => setShowServiceTypeDropdown(prev => !prev)}
          activeOpacity={0.7}
        >
          <Text style={form.serviceType ? styles.inputText : styles.placeholderText}>
            {form.serviceType || 'Select'}
          </Text>
          <Text style={styles.dropdownIcon}>
            {showServiceTypeDropdown ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {showServiceTypeDropdown && (
          <View style={styles.dropdownMenu}>
            {SERVICE_TYPE_OPTIONS.map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dropdownOption,
                  form.serviceType === option && styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  updateField('serviceType')(option);
                  setShowServiceTypeDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    form.serviceType === option && styles.dropdownOptionTextSelected,
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

        {/* Select Clinic */}
        <Text style={styles.label}>Select Clinic</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => setShowCenterDropdown(prev => !prev)}
          activeOpacity={0.7}
          disabled={centersLoading}
        >
          <Text style={form.centerId ? styles.inputText : styles.placeholderText}>
            {centersLoading
              ? 'Loading clinics...'
              : form.centerId
                ? (() => {
                    const selectedCenter = centers.find(item => item.id === form.centerId);
                    if (!selectedCenter) {
                      return 'Select clinic';
                    }
                    return `${selectedCenter.name}, ${selectedCenter.city}, ${selectedCenter.pincode}`;
                  })()
                : 'Select clinic'}
          </Text>
          <Text style={styles.dropdownIcon}>{showCenterDropdown ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showCenterDropdown && !centersLoading && (
          <View style={[styles.dropdownMenu, styles.centerDropdownMenu]}>
            <ScrollView nestedScrollEnabled style={styles.centerDropdownScroll}>
              {centers.map(center => (
                <TouchableOpacity
                  key={center.id}
                  style={[
                    styles.dropdownOption,
                    form.centerId === center.id && styles.dropdownOptionSelected,
                  ]}
                  onPress={() => {
                    updateField('centerId')(center.id);
                    setShowCenterDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      form.centerId === center.id && styles.dropdownOptionTextSelected,
                    ]}
                  >
                    {`${center.name}, ${center.city}, ${center.pincode}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

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
      </SafeAreaView>
    </>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  headerSafe: {
    backgroundColor: '#2563EB',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  bodySafe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 14,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  textInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14,
    color: '#000',
  },
  inputText: {
    fontSize: 14,
    color: '#000',
    paddingVertical: 13,
  },
  placeholderText: {
    color: '#A0A0A0',
    paddingVertical: 13,
    fontSize: 14,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 8,
    backgroundColor: '#FFF',
    marginTop: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  centerDropdownMenu: {
    maxHeight: 220,
  },
  centerDropdownScroll: {
    maxHeight: 220,
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
    marginTop: 2,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 8,
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
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  prefixBox: {
    borderRightWidth: 1,
    borderRightColor: '#D9D9D9',
    paddingHorizontal: 12,
    paddingVertical: 13,
    backgroundColor: '#FAFAFA',
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
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
