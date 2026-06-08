import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZE, SPACING } from '../../../Constants/theme';
import PreventiveHealthHeader from '../PreventiveUser/PreventiveHealthHeader';

export interface DeviceEntryScreenProps {
  headerTitle: string;
  image: ImageSourcePropType;
  title: string;
  description: string;
  buttonText: string;
  onBackPress: () => void;
  onButtonPress: () => void;
}

const DeviceEntryScreen: React.FC<DeviceEntryScreenProps> = ({
  headerTitle,
  image,
  title,
  description,
  buttonText,
  onBackPress,
  onButtonPress,
}) => {
  const { width, height } = useWindowDimensions();
  const sidePad = Math.min(24, Math.max(16, width * 0.04));
  const compact = height < 640;

  return (
    <View style={styles.root}>
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title={headerTitle}
            showBack
            onBackPress={onBackPress}
          />
        </SafeAreaView>
      </View>

      <View style={[styles.imageWrap, { paddingHorizontal: sidePad }]}>
        <Image
          source={image}
          style={styles.heroImage}
          resizeMode="contain"
        />
      </View>

      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomCard,
          { marginHorizontal: sidePad },
          compact && styles.bottomCardCompact,
        ]}
      >
        <Text
          style={[styles.cardTitle, compact && styles.cardTitleCompact]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.cardDescription,
            compact && styles.cardDescriptionCompact,
          ]}
          numberOfLines={compact ? 4 : undefined}
        >
          {description}
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={onButtonPress}
          activeOpacity={0.88}
        >
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

export default DeviceEntryScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.WHITE,
  },
  headerShell: {
    backgroundColor: COLORS.PRIMARY,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerSafe: {
    backgroundColor: COLORS.PRIMARY,
  },
  imageWrap: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: SPACING.SM,
  },
  heroImage: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 0.85,
  },
  bottomCard: {
    flexShrink: 0,
    marginHorizontal: SPACING.MD,
    marginBottom: SPACING.SM,
    marginTop: SPACING.XS,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.MD,
    paddingBottom: SPACING.MD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  bottomCardCompact: {
    paddingTop: SPACING.SM,
    paddingBottom: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    marginBottom: SPACING.XS,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardTitleCompact: {
    fontSize: FONT_SIZE.LG,
    marginBottom: SPACING.XS,
  },
  cardDescription: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.MD,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.MD,
  },
  cardDescriptionCompact: {
    fontSize: FONT_SIZE.SM,
    lineHeight: 18,
    marginBottom: SPACING.SM,
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.WHITE,
    fontSize: 17,
    fontWeight: '700',
  },
});
