import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import PreventiveHealthHeader from '../Home/PreventiveUser/PreventiveHealthHeader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RegisterDob'>;
type Route = RouteProp<RootStackParamList, 'RegisterDob'>;

const RegisterDob: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { mobile, firstName, lastName, lab_user_id } = route.params;

  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const handleNext = () => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (!day || !month || !year) {
      Alert.alert('Required', 'Please fill in your complete date of birth.');
      return;
    }
    if (d < 1 || d > 31) {
      Alert.alert('Invalid', 'Day must be between 1 and 31.');
      return;
    }
    if (m < 1 || m > 12) {
      Alert.alert('Invalid', 'Month must be between 1 and 12.');
      return;
    }
    if (y < 1900 || y > new Date().getFullYear()) {
      Alert.alert('Invalid', 'Please enter a valid birth year.');
      return;
    }

    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const dob = `${y}-${mm}-${dd}`;

    navigation.navigate('RegisterGender', {
      mobile,
      firstName,
      lastName,
      dob,
      lab_user_id,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            showBack
            title=""
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.flex}>
      <View style={styles.topSection}>
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, styles.progressDotDone]} />
          <View style={[styles.progressLine, styles.progressLineDone]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressLine} />
          <View style={styles.progressDot} />
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={styles.scrollContent}
        style={styles.flex}
      >
        <View style={styles.bottomCard}>
          <Text style={styles.title}>Date of Birth</Text>
          <Text style={styles.subtitle}>Enter the user's date of birth.</Text>

          <View style={styles.dobRow}>
            <View style={styles.dobField}>
              <Text style={styles.label}>Day</Text>
              <TextInput
                style={styles.input}
                placeholder="DD"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={day}
                onChangeText={t => setDay(t.replace(/\D/g, '').slice(0, 2))}
                maxLength={2}
              />
            </View>
            <View style={styles.dobField}>
              <Text style={styles.label}>Month</Text>
              <TextInput
                style={styles.input}
                placeholder="MM"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={month}
                onChangeText={t => setMonth(t.replace(/\D/g, '').slice(0, 2))}
                maxLength={2}
              />
            </View>
            <View style={[styles.dobField, styles.yearField]}>
              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={year}
                onChangeText={t => setYear(t.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Next →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default RegisterDob;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  headerShell: {
    backgroundColor: '#1C39BB',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: '#1C39BB',
  },
  flex: {
    flex: 1,
  },
  topSection: {
    paddingBottom: 8,
    marginTop: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingHorizontal: 60,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  progressDotActive: {
    backgroundColor: '#2F3DBD',
  },
  progressDotDone: {
    backgroundColor: '#2F3DBD',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  progressLineDone: {
    backgroundColor: '#2F3DBD',
  },
  scrollContent: {
    flexGrow: 1,
  },
  bottomCard: {
    flex: 1,
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
  dobRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dobField: {
    flex: 1,
  },
  yearField: {
    flex: 1.4,
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
    color: '#333',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fafafa',
    textAlign: 'center',
  },
  button: {
    marginTop: 32,
    backgroundColor: '#2F3DBD',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
