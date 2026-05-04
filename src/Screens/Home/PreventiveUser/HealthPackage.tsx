import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ms, s, vs } from "react-native-size-matters";
import PreventiveHealthHeader from "./PreventiveHealthHeader";
import AppSkeleton from "../Components/AppSkeleton";

import { getPackageById } from "./PreventiveHealthAPI";

const { width } = Dimensions.get("window");

const HEADER_HEIGHT = ms(60);

const COLORS = {
  headerBg: "#1C39BB",
  primaryBlue: "#1C39BB",
  cta: "#0451CF",
  textTitle: "#0F172A",
  textBody: "#64748B",
  border: "#E2E8F0",
};

const HPAD = ms(16);

export default function WomenHealth({ navigation, route }: any) {
  const categoryPackageId =
    route?.params?.categoryPackageId ||
    route?.params?.packageId ||
    route?.params?.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!categoryPackageId) {
      console.log("[HealthPackage] categoryPackageId is undefined — skipping API call");
      setLoading(false);
      return;
    }
    console.log("[HealthPackage] categoryPackageId:", categoryPackageId);
    try {
      const res = await getPackageById(categoryPackageId);
      console.log("[HealthPackage] API response:", res);
      setData(res);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const bannerText =
    data?.description || "Screening for essential health parameters.";

  const packages = useMemo(
    () =>
      (data?.recommended_packages || []).map((p: any) => ({
        id: p.id,
        title: p.package_name,
        description: p.overview,
        tests: p.tests_display_names || [],
        price: p.price,
      })),
    [data]
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />

      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title={data?.category_name || route?.params?.title || "Health Package"}
          onBackPress={() => navigation.goBack()}
        />
      </SafeAreaView>

      <SafeAreaView style={styles.bodySafe}>
        {loading ? <AppSkeleton variant="default" /> : <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* BANNER */}
          <View>
            <Image
              source={{ uri: data?.image_url }}
              style={styles.banner}
              resizeMode="cover"
            />
            <View style={[styles.bannerOverlay, { top: HEADER_HEIGHT - ms(30) }]}>
              <Text style={styles.bannerHeading}>
                {bannerText}
              </Text>
            </View>
          </View>

          {/* SECTION HEADING */}
          <Text style={styles.sectionHeading}>Recommended packages</Text>

          {/* PACKAGE CARDS */}
          <View style={{ paddingHorizontal: HPAD, paddingBottom: vs(32) }}>
            {packages.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={styles.pkgCard}
                onPress={() =>
                  navigation.navigate("HealthPackageOverview", {
                    title: item.title,
                    packageId: item.id,
                    categoryPackageId: categoryPackageId,
                  })
                }
              >
                <Text style={styles.pkgTitle}>{item.title}</Text>
                <Text style={styles.pkgDesc}>{item.description}</Text>

                <View style={styles.cardDivider} />

                <Text style={styles.testsLabel}>Tests included</Text>
                {(item.tests || []).map((test: string, idx: number) => (
                  <Text key={idx} style={styles.testLine}>
                    • {test}
                  </Text>
                ))}

                <View style={styles.cardFooter}>
                  <Text style={styles.price}>
                    ₹{item.price?.toLocaleString?.() ?? item.price}
                  </Text>
                  <View style={styles.bookPill}>
                    <Text style={styles.bookPillText}>Book</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  headerSafe: {
    backgroundColor: COLORS.headerBg,
    borderBottomLeftRadius: ms(18),
    borderBottomRightRadius: ms(18),
    overflow: "hidden",
    zIndex: 10,
    elevation: 10,
  },
  bodySafe: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  scrollContent: {
    paddingTop: 0,
  },

  /* BANNER */
  banner: {
    width: "100%",
    height: Math.min(width * 0.7, ms(380)),
    borderBottomLeftRadius: ms(22),
    borderBottomRightRadius: ms(22),
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  bannerOverlay: {
    position: "absolute",
    left: ms(16),
    right: ms(16),
    zIndex: 11,
  },
  bannerHeading: {
    fontSize: s(20),
    fontWeight: "700",
    color: "#0B1E5B",
    lineHeight: s(26),
    width: "58%",
  },

  /* SECTION */
  sectionHeading: {
    fontSize: s(16),
    fontWeight: "700",
    color: COLORS.textTitle,
    paddingHorizontal: HPAD,
    marginTop: vs(20),
    marginBottom: vs(12),
  },

  /* CARD */
  pkgCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  
    // 🔥 Shadow (important)
    elevation: 2,
  },
  pkgTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E3A8A",
    marginBottom: 6,
  },
  pkgDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#D1D5DB",   // slightly darker
    marginVertical: 10,
  },
  testsLabel: {
    fontSize: s(12),
    fontWeight: "600",
    color: COLORS.textTitle,
    marginBottom: vs(4),
  },
  testLine: {
    fontSize: s(12),
    color: COLORS.textBody,
    lineHeight: s(18),
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  price: {
    fontSize: s(16),
    fontWeight: "700",
    color: COLORS.primaryBlue,
  },
  bookPill: {
    backgroundColor: "#1C39BB",
    paddingHorizontal: 26,
    paddingVertical: 10,
    borderRadius: 8,        // 🔥 NOT pill
    minWidth: 90,
    alignItems: "center",
  },
  bookPillText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
