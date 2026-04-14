import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';
import {
  BACKGROUND_IMAGE_API_ID,
  COMPLETED_TESTS,
  HOME_USER,
  HOME_VISIT_TESTS,
  UPCOMING_TESTS,
  WALLET_BACKGROUND_IMAGE_API_ID,
  WALLET_STATIC,
} from '../../Constants/homeMockData';
import { fetchBackgroundImageUrl } from '../../Services/backgroundImageService';
import { RootStackParamList } from '../../navigation/types';

const NEW_USER_CATEGORY_ICON = require('../../assets/icons/newuser.png');
const EXISTING_USER_CATEGORY_ICON = require('../../assets/icons/existinguser.png');

const noop = () => {};

const HomeProfileHeader: React.FC = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerBlue, { paddingTop: insets.top + SPACING.SM }]}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{HOME_USER.initials}</Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1}>
          {HOME_USER.name}
        </Text>
        <TouchableOpacity
          onPress={noop}
          style={styles.headerAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Reports"
        >
          <View style={styles.clipboardOuter}>
            <View style={styles.clipboardInner} />
            <Text style={styles.clipboardPlus}>+</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

type HomeHeroBannerProps = {
  imageUrl: string | null;
  loading: boolean;
};

const HomeHeroBanner: React.FC<HomeHeroBannerProps> = ({ imageUrl, loading }) => {
  if (loading) {
    return (
      <View style={[styles.hero, styles.heroLoading]}>
        <ActivityIndicator color={COLORS.PRIMARY} />
      </View>
    );
  }

  const onImage = Boolean(imageUrl);

  const content = (
    <View style={styles.heroInner}>
      <View style={styles.heroTextBlock}>
        <Text style={[styles.heroEyebrow, onImage && styles.heroEyebrowOnImage]}>
          Home Visits
        </Text>
        <Text style={[styles.heroTitle, onImage && styles.heroTitleOnImage]}>
          Track and complete patient visits from doorstep care
        </Text>
        <TouchableOpacity
          onPress={noop}
          style={[styles.heroButton, !onImage && styles.heroButtonOnPlain]}
          activeOpacity={0.85}
        >
          <Text style={styles.heroButtonLabel}>View Visits</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (imageUrl) {
    return (
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        {content}
      </ImageBackground>
    );
  }

  return <View style={[styles.hero, styles.heroFallback]}>{content}</View>;
};

type HomeRequestCategoriesProps = {
  onRegisterNewUser: () => void;
};

const HomeRequestCategories: React.FC<HomeRequestCategoriesProps> = ({
  onRegisterNewUser,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Request Categories</Text>
    <View style={styles.categoryRow}>
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={onRegisterNewUser}
        activeOpacity={0.85}
      >
        <Image
          source={NEW_USER_CATEGORY_ICON}
          style={styles.categoryIconImageNewUser}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.categoryLabel}>Register New User</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={noop}
        activeOpacity={0.85}
      >
        <Image
          source={EXISTING_USER_CATEGORY_ICON}
          style={styles.categoryIconImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.categoryLabel}>Existing User</Text>
      </TouchableOpacity>
    </View>
  </View>
);

type HomeWalletSectionProps = {
  walletImageUrl: string | null;
  walletImageLoading: boolean;
};

const HomeWalletSection: React.FC<HomeWalletSectionProps> = ({
  walletImageUrl,
  walletImageLoading,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>My Wallet</Text>
    <View style={styles.walletCard}>
      <View style={styles.walletTop}>
        <View style={styles.walletTopLeft}>
          <Text style={styles.walletAmount}>{WALLET_STATIC.balanceLabel}</Text>
          <Text style={styles.walletSub}>{WALLET_STATIC.availableBalance}</Text>
          <TouchableOpacity onPress={noop} style={styles.walletCta}>
            <Text style={styles.walletCtaText}>View details</Text>
          </TouchableOpacity>
        </View>
        <View
          style={styles.walletImageWrap}
          accessibilityLabel="Wallet"
          accessibilityRole="image"
        >
          {walletImageLoading ? (
            <ActivityIndicator color={COLORS.PRIMARY} />
          ) : walletImageUrl ? (
            <Image
              source={{ uri: walletImageUrl }}
              style={styles.walletImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.walletEmojiFallback}>💼</Text>
          )}
        </View>
      </View>
      <View style={styles.walletDividerH} />
      <View style={styles.walletStats}>
        <View style={styles.walletStatCol}>
          <Text style={styles.walletStatNum}>{WALLET_STATIC.registrations}</Text>
          <Text style={styles.walletStatLabel}>
            {WALLET_STATIC.registrationsLabel}
          </Text>
        </View>
        <View style={styles.walletStatV} />
        <View style={styles.walletStatCol}>
          <Text style={styles.walletStatNum}>{WALLET_STATIC.testsCompleted}</Text>
          <Text style={styles.walletStatLabel}>
            {WALLET_STATIC.testsCompletedLabel}
          </Text>
        </View>
      </View>
    </View>
  </View>
);

const LinkText: React.FC<{
  label: string;
  bold?: boolean;
  color?: string;
  onPress?: () => void;
}> = ({ label, bold, color, onPress }) => (
  <TouchableOpacity onPress={onPress ?? noop} hitSlop={8}>
    <Text
      style={[
        styles.linkText,
        bold && styles.linkTextBold,
        color ? { color } : null,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const MetaIconText: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.metaItem}>
    <Text style={styles.metaIcon}>{icon}</Text>
    <Text style={styles.metaText} numberOfLines={1}>
      {text}
    </Text>
  </View>
);

const UpcomingTestCard: React.FC<{
  patientName: string;
  patientId: string;
  testName: string;
  time: string;
  payment: string;
}> = ({ patientName, patientId, testName, time, payment }) => {
  const paid = payment === 'Paid';
  return (
    <View style={styles.listCard}>
      <View style={styles.cardTopRow}>
        <Text style={styles.patientLine}>
          <Text style={styles.patientName}>{patientName}</Text>
          <Text style={styles.patientId}> ({patientId})</Text>
        </Text>
        <View
          style={[styles.statusPill, paid ? styles.statusPillPaid : styles.statusPillDue]}
        >
          <Text style={paid ? styles.statusPillTextPaid : styles.statusPillTextDue}>
            {payment}
          </Text>
        </View>
      </View>
      <Text style={styles.testName}>{testName}</Text>
      <View style={styles.metaRow}>
        <MetaIconText icon="🕐" text={time} />
      </View>
      <View style={styles.cardDivider} />
      <View style={styles.cardActionsRow}>
        <LinkText label="See details" color={COLORS.PRIMARY} />
        {!paid ? (
          <LinkText label="Collect payment" bold color={COLORS.PRIMARY} />
        ) : null}
      </View>
    </View>
  );
};

const CompletedTestCard: React.FC<{
  patientName: string;
  patientId: string;
  testName: string;
  location: string;
}> = ({ patientName, patientId, testName, location }) => (
  <View style={styles.listCard}>
    <View style={styles.cardTopRow}>
      <Text style={styles.patientLine}>
        <Text style={styles.patientName}>{patientName}</Text>
        <Text style={styles.patientId}> ({patientId})</Text>
      </Text>
      <LinkText label="See details" color={COLORS.PRIMARY} />
    </View>
    <Text style={styles.testName}>{testName}</Text>
    <View style={styles.cardDivider} />
    <View style={styles.completedActions}>
      <View style={styles.completedLocationRow}>
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.completedLocationText}>{location}</Text>
      </View>
      <LinkText label="Report" color={COLORS.TEXT_SECONDARY} />
    </View>
  </View>
);

const HomeVisitTestCard: React.FC<{
  patientName: string;
  patientId: string;
  testName: string;
  location: string;
  time: string;
  payment: string;
}> = ({ patientName, patientId, testName, location, time, payment }) => (
  <View style={styles.listCard}>
    <View style={styles.cardTopRow}>
      <Text style={styles.patientLine}>
        <Text style={styles.patientName}>{patientName}</Text>
        <Text style={styles.patientId}> ({patientId})</Text>
      </Text>
      <LinkText label="See details" color={COLORS.PRIMARY} />
    </View>
    <Text style={styles.testName}>{testName}</Text>
    <View style={styles.cardDivider} />
    <View style={styles.homeVisitMetaRow}>
      <MetaIconText icon="📍" text={location} />
      <MetaIconText icon="🕐" text={time} />
      <MetaIconText icon="₹" text={payment} />
    </View>
    <TouchableOpacity style={styles.performBtn} onPress={noop} activeOpacity={0.85}>
      <Text style={styles.performBtnText}>Perform Test</Text>
    </TouchableOpacity>
  </View>
);

const SeeAllLink: React.FC = () => (
  <TouchableOpacity onPress={noop} style={styles.seeAllWrap}>
    <Text style={styles.seeAll}>See all →</Text>
  </TouchableOpacity>
);

type HomeNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeNav>();
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [walletImageUrl, setWalletImageUrl] = useState<string | null>(null);
  const [walletImageLoading, setWalletImageLoading] = useState(true);
  const [visitTab, setVisitTab] = useState<'home' | 'walkin'>('home');

  const loadHomeImages = useCallback(async () => {
    setHeroLoading(true);
    setWalletImageLoading(true);
    const [hero, wallet] = await Promise.all([
      fetchBackgroundImageUrl(BACKGROUND_IMAGE_API_ID),
      fetchBackgroundImageUrl(WALLET_BACKGROUND_IMAGE_API_ID),
    ]);
    setHeroUrl(hero);
    setWalletImageUrl(wallet);
    setHeroLoading(false);
    setWalletImageLoading(false);
  }, []);

  useEffect(() => {
    loadHomeImages();
  }, [loadHomeImages]);

  return (
    <View style={styles.root}>
      <HomeProfileHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeroBanner imageUrl={heroUrl} loading={heroLoading} />
        <HomeRequestCategories
          onRegisterNewUser={() => navigation.navigate('NewUserRegistration')}
        />
        <HomeWalletSection
          walletImageUrl={walletImageUrl}
          walletImageLoading={walletImageLoading}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Tests</Text>
          {UPCOMING_TESTS.map((item, index) => (
            <UpcomingTestCard
              key={`${item.patientId}-u-${index}`}
              patientName={item.patientName}
              patientId={item.patientId}
              testName={item.testName}
              time={item.time}
              payment={item.payment}
            />
          ))}
          <SeeAllLink />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s Completed Tests</Text>
          {COMPLETED_TESTS.map((item, index) => (
            <CompletedTestCard
              key={`${item.patientId}-c-${index}`}
              patientName={item.patientName}
              patientId={item.patientId}
              testName={item.testName}
              location={item.location}
            />
          ))}
          <SeeAllLink />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s Home Visit tests</Text>
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setVisitTab('home')}
              style={[
                styles.tabPill,
                visitTab === 'home' ? styles.tabPillActive : styles.tabPillIdle,
              ]}
            >
              <Text
                style={
                  visitTab === 'home' ? styles.tabTextActive : styles.tabTextIdle
                }
              >
                Home Visits
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setVisitTab('walkin')}
              style={[
                styles.tabPill,
                visitTab === 'walkin' ? styles.tabPillActive : styles.tabPillIdle,
              ]}
            >
              <Text
                style={
                  visitTab === 'walkin' ? styles.tabTextActive : styles.tabTextIdle
                }
              >
                Walk-In
              </Text>
            </TouchableOpacity>
          </View>
          {visitTab === 'home' &&
            HOME_VISIT_TESTS.map((item, index) => (
              <HomeVisitTestCard
                key={`${item.patientId}-hv-${index}`}
                patientName={item.patientName}
                patientId={item.patientId}
                testName={item.testName}
                location={item.location}
                time={item.time}
                payment={item.payment}
              />
            ))}
          {visitTab === 'walkin' && (
            <View style={styles.emptyWalkIn}>
              <Text style={styles.emptyWalkInText}>
                No walk-in appointments (static)
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const RADIUS_LG = 16;
const RADIUS_MD = 12;
const RADIUS_PILL = 22;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.MD,
    paddingBottom: SPACING.XL,
  },
  headerBlue: {
    backgroundColor: COLORS.PRIMARY,
    borderBottomLeftRadius: RADIUS_LG,
    borderBottomRightRadius: RADIUS_LG,
    paddingBottom: SPACING.MD,
    paddingHorizontal: SPACING.MD,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.SM,
  },
  avatarText: {
    color: COLORS.WHITE,
    fontWeight: '700',
    fontSize: FONT_SIZE.MD,
  },
  headerName: {
    flex: 1,
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
  },
  headerAction: {
    padding: SPACING.XS,
  },
  clipboardOuter: {
    width: 24,
    height: 28,
    borderWidth: 2,
    borderColor: COLORS.WHITE,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  clipboardInner: {
    width: 12,
    height: 2,
    backgroundColor: COLORS.WHITE,
    marginBottom: 2,
  },
  clipboardPlus: {
    position: 'absolute',
    top: -4,
    right: -6,
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  hero: {
    marginTop: SPACING.MD,
    minHeight: 168,
    borderRadius: RADIUS_LG,
    overflow: 'hidden',
  },
  heroImage: {
    borderRadius: RADIUS_LG,
  },
  heroLoading: {
    backgroundColor: COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallback: {
    backgroundColor: COLORS.BACKGROUND,
  },
  heroInner: {
    flex: 1,
    minHeight: 168,
    justifyContent: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    alignItems: 'flex-start',
  },
  heroTextBlock: {
    maxWidth: '90%',
  },
  heroEyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    marginBottom: SPACING.XS,
  },
  heroEyebrowOnImage: {
    color: COLORS.WHITE,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: SPACING.MD,
  },
  heroTitleOnImage: {
    color: COLORS.WHITE,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.LG,
    borderRadius: RADIUS_PILL,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroButtonOnPlain: {
    borderColor: COLORS.CARD_BORDER,
  },
  heroButtonLabel: {
    color: COLORS.WHITE,
    fontWeight: '600',
    fontSize: FONT_SIZE.MD,
  },
  section: {
    marginTop: SPACING.LG,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.MD,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    padding: SPACING.MD,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  categoryIconImage: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
  },
  categoryIconImageNewUser: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
  },
  categoryLabel: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    maxWidth: '85%',
  },
  walletCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    overflow: 'hidden',
  },
  walletTop: {
    flexDirection: 'row',
    padding: SPACING.MD,
    alignItems: 'flex-start',
  },
  walletTopLeft: {
    flex: 1,
  },
  walletAmount: {
    fontSize: FONT_SIZE.XXL,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  walletSub: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  walletCta: {
    alignSelf: 'flex-start',
    marginTop: SPACING.SM,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.LG,
    borderRadius: RADIUS_PILL,
  },
  walletCtaText: {
    color: COLORS.WHITE,
    fontWeight: '600',
    fontSize: FONT_SIZE.SM,
  },
  walletImageWrap: {
    width: 96,
    height: 80,
    marginLeft: SPACING.SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletImage: {
    width: 96,
    height: 80,
  },
  walletEmojiFallback: {
    fontSize: 40,
  },
  walletDividerH: {
    height: 1,
    backgroundColor: COLORS.CARD_BORDER,
  },
  walletStats: {
    flexDirection: 'row',
    paddingVertical: SPACING.MD,
  },
  walletStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  walletStatV: {
    width: 1,
    backgroundColor: COLORS.CARD_BORDER,
  },
  walletStatNum: {
    fontSize: FONT_SIZE.XL,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  walletStatLabel: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  listCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.SM,
  },
  patientLine: {
    flex: 1,
  },
  patientName: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  patientId: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_MUTED,
    fontWeight: '400',
  },
  statusPill: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
    borderRadius: RADIUS_PILL,
  },
  statusPillPaid: {
    backgroundColor: '#E8F5E9',
  },
  statusPillDue: {
    backgroundColor: '#FFF3E0',
  },
  statusPillTextPaid: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: '#2E7D32',
  },
  statusPillTextDue: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: '#E65100',
  },
  testName: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.XS,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.BORDER,
    marginVertical: SPACING.MD,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.MD,
    marginTop: SPACING.XS,
  },
  homeVisitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.MD,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  metaIcon: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  metaText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    flexShrink: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.MD,
  },
  performBtn: {
    marginTop: SPACING.MD,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS_MD,
    alignItems: 'center',
  },
  performBtnText: {
    color: COLORS.WHITE,
    fontWeight: '600',
    fontSize: FONT_SIZE.MD,
  },
  linkText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.PRIMARY,
  },
  linkTextBold: {
    fontWeight: '700',
  },
  completedLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationIcon: {
    fontSize: 14,
  },
  completedLocationText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.PRIMARY,
    fontWeight: '500',
  },
  completedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAllWrap: {
    alignSelf: 'flex-start',
    marginTop: SPACING.SM,
    marginBottom: SPACING.XS,
  },
  seeAll: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginBottom: SPACING.MD,
  },
  tabPill: {
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.LG,
    borderRadius: RADIUS_PILL,
    borderWidth: 1,
    backgroundColor: COLORS.WHITE,
  },
  tabPillActive: {
    borderColor: COLORS.PRIMARY,
  },
  tabPillIdle: {
    borderColor: COLORS.BORDER,
  },
  tabTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
    fontSize: FONT_SIZE.SM,
  },
  tabTextIdle: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.SM,
  },
  emptyWalkIn: {
    padding: SPACING.LG,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emptyWalkInText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.MD,
    textAlign: 'center',
  },
});
