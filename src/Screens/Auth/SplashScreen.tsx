import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Initial gate while we read AsyncStorage and decide between app vs auth flow.
 * Style matches the existing `AppNavigator` cold-start placeholder (no new branding).
 */
const SplashScreen: React.FC = () => {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color="#2F3DBD" />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default SplashScreen;
