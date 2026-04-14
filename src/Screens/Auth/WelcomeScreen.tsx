import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PrimaryButton from '../../Components/Button/PrimaryButton';
import { COLORS } from '../../Constants/theme';
import { RootStackParamList } from '../../navigation/types';

type WelcomeNavProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeNavProp>();

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleSignup = () => {
    navigation.navigate('Register');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            Get started to manage patients, perform tests, and earn incentives
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <PrimaryButton title="Login" onPress={handleLogin} />
          <PrimaryButton title="Sign Up" onPress={handleSignup} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  inner: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  textContainer: {
    marginTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 30,
  },
});