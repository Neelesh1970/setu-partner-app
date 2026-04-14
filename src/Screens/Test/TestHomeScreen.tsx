import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Placeholder for the test home flow (after new-user registration + OTP).
 * Replace with your UI when ready.
 */
const TestHomeScreen: React.FC = () => {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Test Home</Text>
      <Text style={styles.subtitle}>Navigation is wired; design can go here.</Text>
    </View>
  );
};

export default TestHomeScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1E1E',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
});
