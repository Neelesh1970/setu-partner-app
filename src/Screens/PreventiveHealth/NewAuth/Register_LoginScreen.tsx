import React, { useCallback } from 'react';
import {
  ImageBackground,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import GlassMorphism from '../../../Components/ReusableComponents/GlassMorphism';
import type { RootStackParamList } from '../../../navigation/types';

const BACKGROUND_IMAGE = require('../../../assets/WelcomeBG.png');
const ILLUSTRATION_IMAGE = require('../../../assets/Illustration.png');

const TITLE = 'Preventive Care Made Simple';
const SUBTITLE =
  'Take charge of your wellness with preventive health packages that include 28 essential screening tests. Monitor your health, detect risks early, and keep your reports safely in one place.';

const ILLUSTRATION_ASPECT_RATIO = 503 / 490;
const ILLUSTRATION_WIDTH_RATIO = 1.12;
const ILLUSTRATION_HEIGHT_RATIO = ILLUSTRATION_ASPECT_RATIO * 1.42;
const REFERENCE_SCREEN_WIDTH = 393;
const DESIGN_INNER_CARD_WIDTH = 270;
const REFERENCE_INNER_CARD_WIDTH =
  REFERENCE_SCREEN_WIDTH -
  (32 * REFERENCE_SCREEN_WIDTH) / 350 -
  (48 * REFERENCE_SCREEN_WIDTH) / 350;
const REFERENCE_CARD_WIDTH =
  REFERENCE_SCREEN_WIDTH - (32 * REFERENCE_SCREEN_WIDTH) / 350;
const REFERENCE_CARD_HEIGHT = REFERENCE_CARD_WIDTH * 2.09;
const TABLET_BREAKPOINT = 600;
const REFERENCE_ILLUSTRATION_WIDTH =
  REFERENCE_INNER_CARD_WIDTH * ILLUSTRATION_WIDTH_RATIO;
const REFERENCE_ILLUSTRATION_HEIGHT =
  REFERENCE_INNER_CARD_WIDTH * ILLUSTRATION_HEIGHT_RATIO;
const DESIGN_ILLUSTRATION_TOP_OFFSET =
  DESIGN_INNER_CARD_WIDTH * ILLUSTRATION_ASPECT_RATIO * 0.17;
const DESIGN_TITLE_OVERLAP =
  DESIGN_INNER_CARD_WIDTH * ILLUSTRATION_HEIGHT_RATIO * 0.1;
const SHORT_SCREEN_HEIGHT_BASELINE = 680;
const MIN_ILLUSTRATION_SCALE = 0.9;
const GLASS_BLUR_AMOUNT = 22;
const GLASS_BACKGROUND_COLOR = 'rgba(255, 255, 255, 0.82)';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RegisterLoginScreen'>;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const referenceScale = (size: number): number =>
  size * (REFERENCE_SCREEN_WIDTH / 350);

const RegisterLoginScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const statusBarInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  const cardWidth =
    screenWidth >= TABLET_BREAKPOINT
      ? REFERENCE_CARD_WIDTH
      : screenWidth - scale(32);
  const availableCardHeight =
    screenHeight - statusBarInset - insets.bottom - verticalScale(20);
  const cardHeight =
    screenWidth >= TABLET_BREAKPOINT
      ? Math.min(availableCardHeight, REFERENCE_CARD_HEIGHT)
      : availableCardHeight;
  const innerCardWidth =
    screenWidth >= TABLET_BREAKPOINT
      ? REFERENCE_INNER_CARD_WIDTH
      : cardWidth - scale(48);

  const shortScreenFactor = Math.max(
    Math.min(1, screenHeight / SHORT_SCREEN_HEIGHT_BASELINE),
    MIN_ILLUSTRATION_SCALE,
  );
  const maxIllustrationWidth =
    REFERENCE_ILLUSTRATION_WIDTH * shortScreenFactor;
  const maxIllustrationHeight =
    REFERENCE_ILLUSTRATION_HEIGHT * shortScreenFactor;
  const minIllustrationWidth =
    REFERENCE_ILLUSTRATION_WIDTH * MIN_ILLUSTRATION_SCALE;
  const minIllustrationHeight =
    REFERENCE_ILLUSTRATION_HEIGHT * MIN_ILLUSTRATION_SCALE;

  const illustrationWidth = clamp(
    innerCardWidth * ILLUSTRATION_WIDTH_RATIO,
    minIllustrationWidth,
    maxIllustrationWidth,
  );
  const illustrationHeight = clamp(
    innerCardWidth * ILLUSTRATION_HEIGHT_RATIO,
    minIllustrationHeight,
    maxIllustrationHeight,
  );

  const illustrationTopOffset = Math.min(
    scale(DESIGN_ILLUSTRATION_TOP_OFFSET),
    referenceScale(DESIGN_ILLUSTRATION_TOP_OFFSET),
  );
  const titleOverlap = Math.min(
    scale(DESIGN_TITLE_OVERLAP),
    referenceScale(DESIGN_TITLE_OVERLAP),
  );

  const illustrationMarginTop = verticalScale(25) - illustrationTopOffset;
  const titleMarginTop = -(verticalScale(14) + titleOverlap);
  const illustrationMarginBottom = -verticalScale(6);

  const handleNavigateToLogin = useCallback(() => {
    // Previous lab-worker login flow (BASE_URL /auth/otp/*):
    // navigation.navigate('Login');
    navigation.navigate('PreventiveAuthLogin');
  }, [navigation]);

  const handleNavigateToSignUp = useCallback(() => {
    // Previous full registration form (PreventiveHealth/Auth/SignUP):
    // navigation.navigate('SignUp');
    navigation.navigate('PreventiveAuthSignUp');
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <ImageBackground
        source={BACKGROUND_IMAGE}
        style={styles.background}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.55)',
            'rgba(0,0,0,0.30)',
            'rgba(0,0,0,0.60)',
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.content,
            {
              paddingTop: statusBarInset + verticalScale(8),
              paddingBottom: insets.bottom + verticalScale(8),
            },
          ]}
        >
          <GlassMorphism
            width={cardWidth}
            height={cardHeight}
            blurAmount={GLASS_BLUR_AMOUNT}
            blurType="xlight"
            glassBackgroundColor={GLASS_BACKGROUND_COLOR}
            title={TITLE}
            subtitle={SUBTITLE}
            illustrationSource={ILLUSTRATION_IMAGE}
            illustrationResizeMode="contain"
            illustrationHeight={illustrationHeight}
            illustrationStyle={[
              styles.illustration,
              {
                width: illustrationWidth,
                marginTop: illustrationMarginTop,
                marginBottom: illustrationMarginBottom,
              },
            ]}
            titleStyle={[styles.title, { marginTop: titleMarginTop }]}
            contentStyle={styles.cardContent}
            buttonSectionStyle={styles.buttonSection}
            buttonHeight={verticalScale(38)}
            primaryButtonStyle={styles.actionButton}
            secondaryButtonStyle={styles.actionButton}
            primaryButtonText="Log In"
            secondaryButtonText="Sign Up"
            onPrimaryPress={handleNavigateToLogin}
            onSecondaryPress={handleNavigateToSignUp}
            subtitleStyle={styles.subtitle}
          />
        </View>
      </ImageBackground>
    </View>
  );
};

export default RegisterLoginScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8EEF5',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  subtitle: {
    paddingHorizontal: scale(8),
    fontSize: moderateScale(12),
    lineHeight: moderateScale(16),
    marginBottom: verticalScale(30),
  } as TextStyle,
  cardContent: {
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(20),
  } as ViewStyle,
  buttonSection: {
    marginTop: verticalScale(40),
    paddingTop: verticalScale(6),
  } as ViewStyle,
  actionButton: {
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(12),
  } as ViewStyle,
  illustration: {
    alignSelf: 'center',
  } as ImageStyle,
  title: {
    marginBottom: verticalScale(8),
  } as TextStyle,
});
