import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { saveRegisteredPatientProfile } from '../../Utils/storage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RegisterGender'>;
type Route = RouteProp<RootStackParamList, 'RegisterGender'>;

type Gender = 'male' | 'female';

const RegisterGender: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { mobile, firstName, lastName, dob, lab_user_id } = route.params;

  const [gender, setGender] = useState<Gender | null>(null);

  const handleNext = async () => {
    if (!gender) {
      Alert.alert('Required', 'Please select a gender.');
      return;
    }
    await saveRegisteredPatientProfile({
      mobile,
      firstName,
      lastName,
      dob,
      gender,
      lab_user_id,
    });
    navigation.navigate('RegisterPlans', {
      mobile,
      firstName,
      lastName,
      dob,
      gender,
      lab_user_id,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDEDED" />

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <View style={styles.progressRow}>
        <View style={[styles.progressDot, styles.progressDotDone]} />
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={[styles.progressDot, styles.progressDotDone]} />
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={[styles.progressDot, styles.progressDotActive]} />
      </View>

      <View style={styles.bottomCard}>
        <Text style={styles.title}>Select Gender</Text>
        <Text style={styles.subtitle}>Choose the user's gender to continue.</Text>

        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              gender === 'male' && styles.optionCardSelected,
            ]}
            onPress={() => setGender('male')}
            activeOpacity={0.85}
          >
            <Text style={styles.optionEmoji}>👨</Text>
            <Text
              style={[
                styles.optionLabel,
                gender === 'male' && styles.optionLabelSelected,
              ]}
            >
              Male
            </Text>
            {gender === 'male' && <View style={styles.checkDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              gender === 'female' && styles.optionCardSelected,
            ]}
            onPress={() => setGender('female')}
            activeOpacity={0.85}
          >
            <Text style={styles.optionEmoji}>👩</Text>
            <Text
              style={[
                styles.optionLabel,
                gender === 'female' && styles.optionLabelSelected,
              ]}
            >
              Female
            </Text>
            {gender === 'female' && <View style={styles.checkDot} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, !gender && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!gender}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default RegisterGender;

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
    color: '#222',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    marginBottom: 28,
    color: '#666',
    fontSize: 14,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    position: 'relative',
  },
  optionCardSelected: {
    borderColor: '#2F3DBD',
    backgroundColor: '#EEF0FB',
  },
  optionEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
  },
  optionLabelSelected: {
    color: '#2F3DBD',
  },
  checkDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2F3DBD',
  },
  button: {
    marginTop: 28,
    backgroundColor: '#2F3DBD',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
