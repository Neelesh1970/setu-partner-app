import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ms, s, vs } from "react-native-size-matters";
import { useFocusEffect } from "@react-navigation/native";

import PreventiveHealthHeader from "./PreventiveHealthHeader";
import AppSkeleton from "../Components/AppSkeleton";
import CustomPopup from "../Components/CustomPopup";
import { getPreventiveCartStore } from "../../../Utils/preventiveCartStore";
import {
  addPackageToCart,
  getPackageById,
  syncCart,
} from "./PreventiveHealthAPI";

const COLORS = {
  headerBg: "#1C39BB",
  cta: "#0451CF",
  textTitle: "#0F172A",
  textBody: "#64748B",
  divider: "#E2E8F0",
  priceBlue: "#2563EB",
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

export default function WomenHealthOverview({ navigation, route }: any) {
  const insets = useSafeAreaInsets();

  const packageId = route.params?.packageId;
  const categoryPackageId =
    route.params?.categoryPackageId || route.params?.id;

  const [categoryDetail, setCategoryDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addedVisible, setAddedVisible] = useState(false);

  const store = useMemo(() => getPreventiveCartStore(), []);
  const [cartItems, setCartItems] = useState(store.getState().items);

  useEffect(() => {
    return store.subscribe((s) => setCartItems(s.items));
  }, [store]);

  /* ================= FETCH ================= */

  const fetchAll = async () => {
    try {
      const [, categoryRes] = await Promise.all([
        syncCart(),
        getPackageById(categoryPackageId),
      ]);

      setCategoryDetail(categoryRes);
    } catch (e) {
      console.log("Overview error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, []);

  /* ================= SELECT PACKAGE ================= */

  const selectedPackage = useMemo(() => {
    const list = categoryDetail?.recommended_packages;
    if (!Array.isArray(list)) return null;

    return list.find((p: any) => p.id === packageId) || null;
  }, [categoryDetail, packageId]);

  /* ================= DETAIL ================= */

  const detail = useMemo(() => {
    if (!selectedPackage) return null;

    return {
      price: selectedPackage.price,
      overview: selectedPackage.overview,
      overviewTitle: selectedPackage.overview_title,
      tests: selectedPackage.tests_display_names || [],
      testsTitle: selectedPackage.tests_included_title,
      whyTitle: selectedPackage.why_important_title,
      whyPoints: selectedPackage.why_important_points || [],
      prepTitle: selectedPackage.preparation_title,
      prepPoints: selectedPackage.preparation_points || [],
    };
  }, [selectedPackage]);

  const cartCount = cartItems.length;

  const priceFormatted = `₹${String(detail?.price || "0").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  )}`;

  /* ================= UI ================= */

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title={selectedPackage?.package_name || "Package"}
            onBackPress={() => navigation.goBack()}
            cartCount={cartCount}
            showRight2
            rightIcon2="cart-outline"
            onRightPress2={() => navigation.navigate("PreventiveCart")}
          />
        </SafeAreaView>
      </View>

      <View style={styles.root}>
        {loading ? (
          <AppSkeleton variant="default" />
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{ paddingBottom: vs(120) }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
            >
              <View style={styles.body}>
                {/* PRICE */}
                <View style={styles.valueRow}>
                  <View style={styles.titleWithAccent}>
                    <View style={styles.accentBar} />
                    <Text style={styles.valueLabel}>Package Value</Text>
                  </View>
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>
                      {priceFormatted}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* OVERVIEW */}
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.accentBar} />
                  <Text style={styles.sectionTitle}>
                    {detail?.overviewTitle || "Overview"}
                  </Text>
                </View>
                <Text style={styles.bodyText}>{detail?.overview}</Text>

                <View style={styles.divider} />

                {/* TESTS */}
                <Text style={styles.sectionTitlePlain}>
                  {detail?.testsTitle || "Tests Included"}
                </Text>

                <View style={styles.chipWrap}>
                  {detail?.tests?.map((t: string) => (
                    <View key={t} style={styles.chip}>
                      <Text style={styles.chipText}>{t}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.divider} />

                {/* WHY */}
                <Text style={styles.sectionTitlePlain}>
                  {detail?.whyTitle || "Why This Test is Important"}
                </Text>

                <BulletList items={detail?.whyPoints || []} />

                <View style={styles.divider} />

                {/* PREP */}
                <Text style={styles.sectionTitlePlain}>
                  {detail?.prepTitle || "Preparation Before the Test"}
                </Text>

                <BulletList items={detail?.prepPoints || []} />
              </View>
            </ScrollView>

            {/* FOOTER */}
            <View style={[styles.footer, { paddingBottom: insets.bottom || 12 }]}>
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={async () => {
                  try {
                    if (packageId) {
                      await addPackageToCart(packageId);
                      await syncCart();
                    } else {
                      store.addItem({ id: `pkg-${Date.now()}`, title: "Package" });
                    }
                    setAddedVisible(true);
                  } catch (e) {
                    console.log("Add to cart error", e);
                  }
                }}
              >
                <Text style={styles.bookBtnText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <CustomPopup
        isVisible={addedVisible}
        onClose={() => setAddedVisible(false)}
        onConfirm={() => setAddedVisible(false)}
        title="Product added to cart"
        message="Successfully"
        iconName="checkmark-circle-outline"
        confirmText="OK"
      />
    </>
  );
}


const styles = StyleSheet.create({
    flex: { flex: 1 },
    headerShell: {
      backgroundColor: COLORS.headerBg,
      borderBottomLeftRadius: ms(18),
      borderBottomRightRadius: ms(18),
      overflow: "hidden",
    },
    headerSafe: {
      backgroundColor: COLORS.headerBg,
    },
    root: {
      flex: 1,
      backgroundColor: "#FFFFFF",
    },
    scrollContent: {
      flexGrow: 1,
    },
    body: {
      paddingHorizontal: HPAD,
      paddingTop: vs(18),
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    titleWithAccent: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: ms(12),
    },
    accentBar: {
      width: ms(4),
      height: ms(22),
      borderRadius: ms(2),
      backgroundColor: COLORS.headerBg,
      marginRight: ms(10),
    },
    valueLabel: {
      flex: 1,
      fontSize: s(17),
      fontWeight: "700",
      color: COLORS.textTitle,
    },
    priceBadge: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.divider,
      backgroundColor: "#FFFFFF",
      paddingVertical: vs(6),
      paddingHorizontal: ms(12),
      borderRadius: ms(8),
    },
    priceBadgeText: {
      fontSize: s(15),
      fontWeight: "600",
      color: COLORS.priceBlue,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.divider,
      marginVertical: vs(16),
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
      fontWeight: "400",
      color: COLORS.textBody,
    },
    paragraphBelowTitle: {
      marginBottom: vs(10),
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -ms(4),
    },
    chip: {
      backgroundColor: '#EBEEFF',
      paddingVertical: vs(8),
      paddingHorizontal: ms(14),
      borderRadius: ms(24),
      marginHorizontal: ms(4),
      marginBottom: vs(8),
    },
    chipText: {
      color: "#1E40AF",
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
      backgroundColor: "#FFFFFF",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.divider,
    },
    bookBtn: {
      backgroundColor: COLORS.cta,
      borderRadius: ms(28),
      paddingVertical: vs(14),
      alignItems: "center",
      justifyContent: "center",
    },
    bookBtnText: {
      color: "#FFFFFF",
      fontSize: s(16),
      fontWeight: "700",
    },
  });
  