import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import GlassMorphism from '../../../Components/ReusableComponents/GlassMorphism';

const GLASS_BLUR_AMOUNT = 22;
const GLASS_BACKGROUND_COLOR = 'rgba(255, 255, 255, 0.82)';
const BUTTON_COLOR = '#1C39BB';

interface DynamicModalProps {
  tabText: string;
  title: string;
  subtitle: string;
  cardWidth: number;
  cardHeight?: number;
  buttonText?: string;
  onButtonPress?: () => void;
  buttonStyle?: ViewStyle;
  children: React.ReactNode;
}

const DynamicModal: React.FC<DynamicModalProps> = ({
  tabText,
  title,
  subtitle,
  cardWidth,
  cardHeight = verticalScale(250),
  buttonText,
  onButtonPress,
  buttonStyle,
  children,
}) => (
  <View style={[styles.cardWrapper, { width: cardWidth }]}>
    <View style={styles.loginTabBadge}>
      <Text style={styles.loginTabText}>{tabText}</Text>
    </View>

    <GlassMorphism
      width={cardWidth}
      height={cardHeight}
      borderRadius={moderateScale(30)}
      blurAmount={GLASS_BLUR_AMOUNT}
      blurType="xlight"
      glassBackgroundColor={GLASS_BACKGROUND_COLOR}
    >
      <View style={styles.loginContent}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {children}

        {buttonText ? (
          <Pressable
            accessibilityRole="button"
            onPress={onButtonPress}
            style={({ pressed }) => [
              styles.continueButton,
              buttonStyle,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.continueButtonText}>{buttonText}</Text>
          </Pressable>
        ) : null}
      </View>
    </GlassMorphism>
  </View>
);

const styles = StyleSheet.create({
  cardWrapper: {
    alignItems: 'center',
  },
  loginTabBadge: {
    zIndex: 2,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scale(36),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(24),
    marginBottom: -verticalScale(16),
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loginTabText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: BUTTON_COLOR,
    textAlign: 'center',
  },
  loginContent: {
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(12),
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    marginBottom: verticalScale(6),
  },
  subtitle: {
    fontSize: moderateScale(12),
    fontWeight: '400',
    color: '#4A4A4A',
    textAlign: 'left',
    lineHeight: moderateScale(17),
    marginBottom: verticalScale(20),
  },
  continueButton: {
    width: '100%',
    height: verticalScale(38),
    borderRadius: verticalScale(19),
    backgroundColor: BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(12),
  },
  buttonPressed: {
    opacity: 0.92,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(15),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: moderateScale(18),
  },
});

export default DynamicModal;
