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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RegisterName'>;
type Route = RouteProp<RootStackParamList, 'RegisterName'>;

const RegisterName: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { mobile, lab_user_id } = route.params;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleNext = () => {
    if (!firstName.trim()) {
      Alert.alert('Required', 'Please enter your first name.');
      return;
    }
    if (!lastName.trim()) {
      Alert.alert('Required', 'Please enter your last name.');
      return;
    }
    navigation.navigate('RegisterDob', {
      mobile,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      lab_user_id,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDEDED" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.progressRow}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressLine} />
          <View style={styles.progressDot} />
          <View style={styles.progressLine} />
          <View style={styles.progressDot} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.bottomCard}>
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>Enter the user's full name to continue.</Text>

            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter first name"
              placeholderTextColor="#aaa"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.labelSpacing]}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter last name"
              placeholderTextColor="#aaa"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              returnKeyType="done"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterName;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  flex: {
    flex: 1,
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
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bottomCard: {
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
  labelSpacing: {
    marginTop: 16,
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
