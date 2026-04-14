import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface ScreenHeaderProps {
  title: string;
  onBackPress?: () => void;
  /** Rounds the bottom edge of the blue header (e.g. patient registration flows). */
  bottomRounded?: boolean;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBackPress,
  bottomRounded,
}) => {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1A49AB" />
      <View
        style={[
          styles.headerBackground,
          bottomRounded && styles.headerBackgroundRoundedBottom,
        ]}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerNav}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
};

export default ScreenHeader;

const styles = StyleSheet.create({
  headerBackground: {
    backgroundColor: '#1A49AB',
    paddingBottom: 25,
  },
  headerBackgroundRoundedBottom: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backButton: {
    marginRight: 15,
  },
  backArrow: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
