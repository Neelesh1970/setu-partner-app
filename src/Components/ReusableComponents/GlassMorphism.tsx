import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageResizeMode,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';

const DEFAULT_BUTTON_COLOR = '#1C39BB';
const GLASS_BACKGROUND = 'rgba(255, 255, 255, 0.82)';
const GLASS_BORDER_RADIUS = 16;
const GLASS_BLUR_AMOUNT = 22;
const GLASS_SHADOW = {
  color: '#000000',
  offsetY: 4,
  radius: 30,
  opacity: 0.1,
};

interface IllustrationClipRegion {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface GlassMorphismProps {
  title?: string;
  subtitle?: string;
  illustrationSource?: ImageSourcePropType;
  illustrationStyle?: StyleProp<ImageStyle>;
  illustrationResizeMode?: ImageResizeMode;
  illustrationClipRegion?: IllustrationClipRegion;
  illustrationHeight?: number;
  primaryButtonText?: string;
  onPrimaryPress?: () => void;
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
  showOrDivider?: boolean;
  orText?: string;
  buttonColor?: string;
  buttonBorderRadius?: number;
  buttonHeight?: number;
  width?: number;
  height?: number;
  borderRadius?: number;
  blurAmount?: number;
  glassBackgroundColor?: string;
  blurType?: 'dark' | 'light' | 'xlight' | 'prominent' | 'regular' | 'extraDark';
  containerStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  topContentStyle?: StyleProp<ViewStyle>;
  buttonSectionStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  primaryButtonStyle?: StyleProp<ViewStyle>;
  secondaryButtonStyle?: StyleProp<ViewStyle>;
  primaryButtonTextStyle?: StyleProp<TextStyle>;
  secondaryButtonTextStyle?: StyleProp<TextStyle>;
  orTextStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

const GlassMorphism: React.FC<GlassMorphismProps> = ({
  title,
  subtitle,
  illustrationSource,
  illustrationStyle,
  illustrationResizeMode = 'contain',
  illustrationClipRegion,
  illustrationHeight,
  primaryButtonText,
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
  showOrDivider,
  orText = 'Or',
  buttonColor = DEFAULT_BUTTON_COLOR,
  buttonBorderRadius,
  buttonHeight,
  width,
  height,
  borderRadius = moderateScale(GLASS_BORDER_RADIUS),
  blurAmount = GLASS_BLUR_AMOUNT,
  glassBackgroundColor = GLASS_BACKGROUND,
  blurType = 'xlight',
  containerStyle,
  cardStyle,
  contentStyle,
  topContentStyle,
  buttonSectionStyle,
  titleStyle,
  subtitleStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  primaryButtonTextStyle,
  secondaryButtonTextStyle,
  orTextStyle,
  children,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const cardWidth = width ?? screenWidth - scale(32);
  const cardHeight =
    height ?? Math.min(screenHeight * 0.84, verticalScale(680));
  const resolvedButtonHeight = buttonHeight ?? verticalScale(42);
  const resolvedButtonRadius =
    buttonBorderRadius ?? resolvedButtonHeight / 2;
  const resolvedIllustrationHeight =
    illustrationHeight ?? cardHeight * 0.36;

  const hasSecondaryButton = Boolean(secondaryButtonText && onSecondaryPress);
  const shouldShowOrDivider =
    showOrDivider !== undefined ? showOrDivider : hasSecondaryButton;

  const renderIllustration = () => {
    if (!illustrationSource) {
      return null;
    }

    if (illustrationClipRegion) {
      const {
        x = 0,
        y = 0,
        width: regionWidth = 1,
        height: regionHeight = 1,
      } = illustrationClipRegion;
      const resolved = Image.resolveAssetSource(illustrationSource);
      const sourceWidth = resolved?.width ?? cardWidth;
      const sourceHeight = resolved?.height ?? cardHeight;
      const flatIllustrationStyle = StyleSheet.flatten(illustrationStyle);
      const displayHeight =
        flatIllustrationStyle?.height ?? resolvedIllustrationHeight;
      const cropHeight = sourceHeight * regionHeight;
      const scaleFactor = Number(displayHeight) / cropHeight;
      const imageWidth = sourceWidth * scaleFactor;
      const imageHeight = sourceHeight * scaleFactor;
      const offsetLeft = -(sourceWidth * x * scaleFactor);
      const offsetTop = -(sourceHeight * y * scaleFactor);

      return (
        <View
          style={[
            styles.illustrationClip,
            {
              height: displayHeight,
              width: '100%',
            },
            illustrationStyle,
          ]}
        >
          <Image
            source={illustrationSource}
            style={[
              styles.clippedIllustrationImage,
              {
                width: imageWidth,
                height: imageHeight,
                left: offsetLeft,
                top: offsetTop,
              },
            ]}
            resizeMode="cover"
          />
        </View>
      );
    }

    return (
      <Image
        source={illustrationSource}
        style={[
          styles.illustration,
          { height: resolvedIllustrationHeight },
          illustrationStyle,
        ]}
        resizeMode={illustrationResizeMode}
      />
    );
  };

  const renderDefaultContent = () => (
    <View style={[styles.content, contentStyle]}>
      <View style={[styles.topContent, topContentStyle]}>
        {renderIllustration()}

        {title ? <Text style={[styles.title, titleStyle]}>{title}</Text> : null}

        {subtitle ? (
          <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
        ) : null}
      </View>

      {(primaryButtonText || hasSecondaryButton) && (
        <View style={[styles.buttonSection, buttonSectionStyle]}>
          {primaryButtonText ? (
            <Pressable
              accessibilityRole="button"
              onPress={onPrimaryPress}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: buttonColor,
                  height: resolvedButtonHeight,
                  borderRadius: resolvedButtonRadius,
                },
                primaryButtonStyle,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.buttonText, primaryButtonTextStyle]}>
                {primaryButtonText}
              </Text>
            </Pressable>
          ) : null}

          {shouldShowOrDivider && hasSecondaryButton ? (
            <Text style={[styles.orText, orTextStyle]}>{orText}</Text>
          ) : null}

          {hasSecondaryButton ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSecondaryPress}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: buttonColor,
                  height: resolvedButtonHeight,
                  borderRadius: resolvedButtonRadius,
                },
                secondaryButtonStyle,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.buttonText, secondaryButtonTextStyle]}>
                {secondaryButtonText}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.wrapper,
        { width: cardWidth, height: cardHeight },
        containerStyle,
      ]}
    >
      <View
        style={[
          styles.shadowLayer,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius,
          },
          cardStyle,
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            style={[styles.blurLayer, { borderRadius }]}
            blurType={blurType}
            blurAmount={blurAmount}
            reducedTransparencyFallbackColor={glassBackgroundColor}
          />
        ) : null}

        <View
          style={[
            styles.glassOverlay,
            {
              borderRadius,
              backgroundColor: glassBackgroundColor,
            },
          ]}
        >
          {children ?? renderDefaultContent()}
        </View>
      </View>
    </View>
  );
};

export default GlassMorphism;

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
  },
  shadowLayer: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: GLASS_SHADOW.color,
        shadowOffset: { width: 0, height: GLASS_SHADOW.offsetY },
        shadowOpacity: GLASS_SHADOW.opacity,
        shadowRadius: GLASS_SHADOW.radius,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(28),
  },
  topContent: {
    alignItems: 'center',
    width: '100%',
  },
  illustration: {
    width: '100%',
    alignSelf: 'center',
    marginBottom: verticalScale(1),
  },
  illustrationClip: {
    width: '100%',
    overflow: 'hidden',
    marginBottom: verticalScale(4),
    alignSelf: 'center',
  },
  clippedIllustrationImage: {
    position: 'absolute',
  },
  title: {
    fontSize: moderateScale(26),
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: verticalScale(12),
    paddingHorizontal: scale(4),
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: '400',
    color: '#4A4A4A',
    textAlign: 'center',
    lineHeight: moderateScale(18),
    paddingHorizontal: scale(4),
    marginBottom: verticalScale(4),
  },
  buttonSection: {
    width: '100%',
    marginTop: 'auto',
    paddingTop: verticalScale(16),
  },
  button: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(15),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: moderateScale(18),
  },
  orText: {
    color: '#B0B0B0',
    fontSize: moderateScale(13),
    fontWeight: '400',
    textAlign: 'center',
    marginVertical: verticalScale(4),
  },
});
