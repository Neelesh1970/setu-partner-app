import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Platform,
  BackHandler,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ms, s, vs } from "react-native-size-matters";
import { useFocusEffect } from "@react-navigation/native";

import PreventiveHealthHeader from "./PreventiveHealthHeader";
import { getScreenings } from "./PreventiveHealthAPI";

const COLORS = {
  headerBg: "#1C39BB",
  bg: "#FFFFFF",
  textTitle: "#0F172A",
  textBody: "#64748B",
  divider: "#E2E8F0",
  chipBg: "#DBEAFE",
  chipText: "#1E40AF",
  cta: "#0451CF",
  ctaText: "#FFFFFF",
};

const HPAD = ms(16);

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletBlock}>
      {items.map((line, idx) => (
        <View key={`${idx}-${line}`} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

const Screening = ({ navigation, route }: any) => {
  const [refreshing, setRefreshing] = useState(false);

  const screening = route?.params?.screening || {};

  const detail = useMemo(() => {
    return {
      title: screening?.title || "Screening",
      overviewTitle: screening?.overview_title || "Overview",
      overview: screening?.overview || "",
      testsTitle: screening?.tests_included_title || "Tests Included",
      testsIncluded: Array.isArray(screening?.tests_included)
        ? screening.tests_included
        : [],
      whyTitle:
        screening?.why_important_title || "Why This Test is Important",
      whyIntro: screening?.why_important_subtitle || "",
      whyPoints: Array.isArray(screening?.why_important_points)
        ? screening.why_important_points
        : [],
      prepTitle:
        screening?.preparation_title || "Preparation Before the Test",
      prepPoints: Array.isArray(screening?.preparation_points)
        ? screening.preparation_points
        : [],
      ctaText: screening?.cta_button_text || "Book",
    };
  }, [screening]);

  /* ================= BACK ================= */

  useFocusEffect(
    useCallback(() => {
      let isNavigating = false;

      const handleBack = () => {
        if (isNavigating) return true;
        isNavigating = true;
        navigation.goBack();
        return true;
      };

      let backSub: any;
      if (Platform.OS === "android") {
        backSub = BackHandler.addEventListener(
          "hardwareBackPress",
          handleBack
        );
      }

      return () => backSub?.remove();
    }, [navigation])
  );

  /* ================= REFRESH ================= */

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      const list = await getScreenings();

      const found = list.find(
        (x: any) =>
          (screening?.id && x?.id === screening.id) ||
          (screening?.slug && x?.slug === screening.slug)
      );

      if (found) {
        navigation.setParams({
          screening: { ...screening, ...found },
        });
      }
    } catch (e) {
      console.log("Screening refresh error", e);
    } finally {
      setRefreshing(false);
    }
  }, [navigation, screening]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title={detail.title}
          onBackPress={() => navigation.goBack()}
        />
      </SafeAreaView>

      <View style={styles.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.body}>
            {/* OVERVIEW */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.accentBar} />
              <Text style={styles.sectionTitle}>
                {detail.overviewTitle}
              </Text>
            </View>
            <Text style={styles.bodyText}>{detail.overview}</Text>

            <View style={styles.divider} />

            {/* TESTS */}
            <Text style={styles.sectionTitlePlain}>
              {detail.testsTitle}
            </Text>

            <View style={styles.chipWrap}>
              {detail.testsIncluded.map((label: string) => (
                <View key={label} style={styles.chip}>
                  <Text style={styles.chipText}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            {/* WHY */}
            <Text style={styles.sectionTitlePlain}>
              {detail.whyTitle}
            </Text>

            {!!detail.whyIntro && (
              <Text style={[styles.bodyText, styles.paragraphBelowTitle]}>
                {detail.whyIntro}
              </Text>
            )}

            <BulletList items={detail.whyPoints} />

            <View style={styles.divider} />

            {/* PREP */}
            <Text style={styles.sectionTitlePlain}>
              {detail.prepTitle}
            </Text>

            <BulletList items={detail.prepPoints} />
          </View>
        </ScrollView>

        {/* FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.bookBtn}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("PatientDetail")}
          >
            <Text style={styles.bookBtnText}>{detail.ctaText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

export default Screening;

const styles = StyleSheet.create({
  headerSafe: {
    backgroundColor: COLORS.headerBg,
    borderBottomLeftRadius: ms(18),
    borderBottomRightRadius: ms(18),
    overflow: "hidden",
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingBottom: vs(120),
  },
  body: {
    paddingHorizontal: HPAD,
    paddingTop: vs(18),
  },
  accentBar: {
    width: ms(4),
    height: ms(22),
    borderRadius: ms(2),
    backgroundColor: COLORS.headerBg,
    marginRight: ms(10),
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: vs(10),
  },
  sectionTitle: {
    fontSize: s(17),
    fontWeight: "700",
    color: COLORS.textTitle,
  },
  sectionTitlePlain: {
    fontSize: s(17),
    fontWeight: "700",
    color: COLORS.textTitle,
    marginBottom: vs(10),
  },
  bodyText: {
    fontSize: s(14),
    lineHeight: s(21),
    color: COLORS.textBody,
  },
  paragraphBelowTitle: {
    marginBottom: vs(10),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginVertical: vs(16),
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -ms(4),
  },
  chip: {
    backgroundColor: "#EBEEFF",
    paddingVertical: vs(8),
    paddingHorizontal: ms(14),
    borderRadius: ms(24),
    marginHorizontal: ms(4),
    marginBottom: vs(8),
  },
  chipText: {
    color: COLORS.chipText,
    fontSize: s(12),
    fontWeight: "600",
  },
  bulletBlock: {
    marginTop: vs(2),
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: vs(8),
  },
  bulletDot: {
    width: ms(5),
    height: ms(5),
    borderRadius: ms(2.5),
    backgroundColor: COLORS.textTitle,
    marginTop: ms(7),
    marginRight: ms(10),
  },
  bulletText: {
    flex: 1,
    fontSize: s(14),
    lineHeight: s(21),
    color: COLORS.textBody,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: HPAD,
    paddingTop: vs(10),
    paddingBottom: vs(16),
    backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  bookBtn: {
    backgroundColor: COLORS.cta,
    borderRadius: ms(28),
    paddingVertical: vs(14),
    alignItems: "center",
  },
  bookBtnText: {
    color: COLORS.ctaText,
    fontSize: s(16),
    fontWeight: "700",
  },
});