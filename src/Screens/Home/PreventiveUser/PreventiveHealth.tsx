import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
  Platform,
  BackHandler,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ms, s, vs } from "react-native-size-matters";
import { useFocusEffect } from "@react-navigation/native";

import PreventiveHealthHeader from "./PreventiveHealthHeader";
import AppSkeleton from "../Components/AppSkeleton";
// import PreventiveHealthBanner from "./Components/PreventiveHealthBanner";
// import InfoFooterCard from "../../Utils/InfoFooterCard";

import {
  getDevices,
  getPackages,
  getScreenings,
  getCart,
  getPatients,
} from "./PreventiveHealthAPI";
import {
  logStoredSessionToConsole,
  savePreventivePatientId,
  getPreventivePatientId,
  getUserID,
} from "../../../Utils/storage";

const { width } = Dimensions.get("window");

const GRID_PAD = 16;
const GRID_GAP = 12;

const IMG_FOOTER =
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=75";

const CONCERN_SCREENING = [
  { id: "c1", title: "Heart Disease\nScreening", icon: "heart-outline" },
  { id: "c2", title: "Diabetes risk\nScreening", icon: "nutrition-outline" },
  { id: "c3", title: "Lung Health\nScreening", icon: "medkit-outline" },
  { id: "c4", title: "Cancer risk\nScreening", icon: "pulse-outline" },
  { id: "c5", title: "Kidney Health\nScreening", icon: "water-outline" },
  { id: "c6", title: "Liver Health\nScreening", icon: "body-outline" },
  { id: "c7", title: "Eye Health\nScreening", icon: "happy-outline" },
  { id: "c8", title: "ENT Health\nScreening", icon: "woman-outline" },
];

const CONCERN_ICON_BY_SLUG: Record<string, string> = {
  "heart-disease-screening": "heart-outline",
  "diabetes-risk-screening": "nutrition-outline",
  "lung-health-screening": "medkit-outline",
  "cancer-risk-screening": "pulse-outline",
  "kidney-health-screening": "water-outline",
  "liver-health-screening": "body-outline",
  "eye-health-screening": "happy-outline",
  "ent-health-screening": "woman-outline",
};

const PACKAGE_CARD_SIZE = ms(170);
const CONCERN_CARD_W = Math.min(ms(148), width * 0.4);
const DEVICE_TILE_W = (width - ms(GRID_PAD) * 2 - ms(GRID_GAP) * 2) / 3;

export default function PreventiveHealth({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);

  const [rawDevices, setDevices] = useState<any[]>([]);
  const [rawPackages, setPackages] = useState<any[]>([]);
  const [rawScreenings, setScreenings] = useState<any[]>([]);
  const [cartCount, setCartCount] = useState(0);

  const [loading, setLoading] = useState(true);

  const syncPreventivePatientFromApi = useCallback(async () => {
    try {
      const cached = await getPreventivePatientId();
      if (cached) {
        console.log("[PreventiveHealth] Patient ID (cached):", cached);
      }

      const [list, appUserId] = await Promise.all([getPatients(), getUserID()]);
      if (!list.length) return;

      const match = list.find((p) => String(p?.user_id) === String(appUserId));
      const row = match ?? (list.length === 1 ? list[0] : null);
      if (!row?.id) return;

      const pid = String(row.id);
      await savePreventivePatientId(pid);
      console.log("[PreventiveHealth] Patient ID:", pid);
    } catch (e) {
      console.log("[PreventiveHealth] getPatients error", e);
    }
  }, []);

  /* ================= LOG SCREEN OPEN ================= */

  useFocusEffect(
    useCallback(() => {
      console.log('========== PreventiveHealth Screen Opened ==========');
      console.log('Screen   : PreventiveHealth');
      console.log('Status   : Screen is now active / focused');
      console.log('====================================================');

      void (async () => {
        await syncPreventivePatientFromApi();
        await logStoredSessionToConsole("[PreventiveHealth]", "preventiveHealth");
      })();
    }, [syncPreventivePatientFromApi])
  );

  /* ================= FETCH ================= */

  const fetchAll = async () => {
    try {
      setLoading(true);

      const [devices, packages, screenings, cart] = await Promise.all([
        getDevices(),
        getPackages(),
        getScreenings(),
        getCart(),
      ]);

      setDevices(devices);
      setPackages(packages);
      setScreenings(screenings);
      setCartCount(cart?.items?.length || 0);
    } catch (e) {
      console.log("ERROR:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll(); // refresh cart like redux
    }, [])
  );

  /* ================= BACK ================= */

  useEffect(() => {
    let isNavigating = false;

    const handleBack = () => {
      if (isNavigating) return true;
      isNavigating = true;
      console.log('[PreventiveHealth] Hardware back pressed — navigating to Home');
      navigation.navigate("Home");
      return true;
    };

    let backSub: any;
    if (Platform.OS === "android") {
      backSub = BackHandler.addEventListener("hardwareBackPress", handleBack);
    }

    return () => {
      backSub?.remove();
    };
  }, [navigation]);

  /* ================= REFRESH ================= */

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncPreventivePatientFromApi();
    await fetchAll();
    setRefreshing(false);
  }, [syncPreventivePatientFromApi]);

  /* ================= MEMO ================= */

  const packages = useMemo(
    () =>
      rawPackages.map((item) => ({
        id: item.id,
        title: item.package_name,
        image: item.image_url || IMG_FOOTER,
      })),
    [rawPackages]
  );

  const concernScreenings = useMemo(() => {
    return rawScreenings.map((it, idx) => ({
      ...it,
      id: it?.id ?? String(idx),
      title: it?.title ?? "",
      icon:
        CONCERN_ICON_BY_SLUG[it?.slug] ||
        CONCERN_SCREENING[idx]?.icon ||
        "heart-outline",
    }));
  }, [rawScreenings]);

  const previewDevices = useMemo(
    () =>
      rawDevices.slice(0, 9).map((item) => ({
        id: item.id,
        label: item.device_name,
        imageUri: item.image_url,
        isActive: item.is_active !== false,
        fullData: item,
      })),
    [rawDevices]
  );

  const formatTitle = (title: string) => {
    const words = title.split(" ");
    if (words.length === 1) return title;
    if (words.length === 2) return `${words[0]}\n${words[1]}`;
    const mid = Math.ceil(words.length / 2);
    return `${words.slice(0, mid).join(" ")}\n${words
      .slice(mid)
      .join(" ")}`;
  };

  /* ================= RENDER ================= */

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />

      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title="Select and perform test"
          onBackPress={() => navigation.navigate("Home")}
          showRight1
          rightIcon1="receipt-outline"
          onRightPress1={() => navigation.navigate("MyBookings")}
          showRight2
          rightIcon2="cart-outline"
          cartCount={cartCount}
          onRightPress2={() => navigation.navigate("PreventiveCart")}
        />
      </SafeAreaView>

      <SafeAreaView style={styles.bodySafe}>
        {loading ? (
          <AppSkeleton variant="booktest_home" />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {/* DEVICES */}
            {rawDevices.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Health Checkup Devices
                  </Text>

                  <TouchableOpacity
                    onPress={() => navigation.navigate("HealthCheckupDevices")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.exploreAll}>Explore all</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={previewDevices}
                  numColumns={3}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={styles.devicesGridContent}
                  columnWrapperStyle={styles.devicesColumnWrapper}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.deviceTile}
                      onPress={() =>
                        navigation.navigate("DeviceOverview", {
                          deviceData: item.fullData,
                        })
                      }
                    >
                      <View style={styles.deviceImageWrapper}>
                        {item.imageUri ? (
                          <Image
                            source={{ uri: item.imageUri }}
                            style={styles.deviceImage}
                          />
                        ) : (
                          <View style={[styles.deviceImage, styles.devicePlaceholder]} />
                        )}
                        <View
                          style={[
                            styles.deviceStatusBadge,
                            item.isActive
                              ? styles.deviceBadgeActive
                              : styles.deviceBadgeInactive,
                          ]}
                        >
                          <Text style={styles.deviceBadgeText}>
                            {item.isActive ? "Active" : "Inactive"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.deviceLabel} numberOfLines={2}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

            {/* PACKAGES */}
            {packages.length > 0 && (
              <>
                <Text style={styles.sectionTitleSpaced}>
                  Preventive Health Packages
                </Text>

                <FlatList
                  data={packages}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(it) => it.id}
                  contentContainerStyle={styles.hListContent}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.pkgCard}
                      onPress={() =>
                        navigation.navigate("HealthPackage", {
                          categoryPackageId: item.id,
                          title: item.title,
                        })
                      }
                    >
                      <Image
                        source={{ uri: item.image }}
                        style={styles.pkgImage}
                        resizeMode="contain"
                      />
                      <View style={styles.pkgOverlay}>
                        <Text
                          style={[styles.pkgTitle, styles.pkgTitleChild]}
                          numberOfLines={2}
                        >
                          {formatTitle(item.title)}
                        </Text>
                        <View style={styles.pkgArrow}>
                          <Ionicons
                            name="arrow-forward-outline"
                            size={18}
                            color="#2563EB"
                            style={{ transform: [{ rotate: "-45deg" }] }}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

            {/* SCREENINGS */}
            {concernScreenings.length > 0 && (
              <>
                <Text style={styles.sectionTitleSpaced}>
                  Health Concern Based Screening
                </Text>

                <FlatList
                  data={concernScreenings}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(it) => it.id}
                  contentContainerStyle={styles.concernListContent}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.concernCard, { width: CONCERN_CARD_W }]}
                      onPress={() =>
                        navigation.navigate("Screening", {
                          screening: item,
                        })
                      }
                    >
                      <View style={styles.concernIconWrap}>
                        <Ionicons
                          name={item.icon}
                          size={ms(22)}
                          color="#2563EB"
                        />
                      </View>
                      <Text style={styles.concernTitle}>{item.title}</Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}


const styles = StyleSheet.create({
  headerSafe: {
    backgroundColor: "#2563EB",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: "hidden",
  },
  bodySafe: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  pkgImage: {
    width: "100%",
    height: "100%",
    borderRadius: ms(20),
  },
  scrollContent: {
    paddingBottom: vs(32),
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: ms(GRID_PAD),
    marginTop: vs(20),
    marginBottom: vs(10),
  },
  sectionTitle: {
    fontSize: s(16),
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionTitleSpaced: {
    fontSize: s(16),
    fontWeight: "700",
    color: "#0F172A",
    paddingHorizontal: ms(GRID_PAD),
    marginTop: vs(20),
    marginBottom: vs(12),
  },
  exploreAll: {
    fontSize: s(13),
    fontWeight: "600",
    color: "#2563EB",
  },
  devicesGridContent: {
    paddingHorizontal: ms(GRID_PAD),
    paddingBottom: vs(8),
  },
  devicesColumnWrapper: {
    justifyContent: "space-between",
    marginBottom: vs(12),
  },
  deviceTile: {
    width: DEVICE_TILE_W,
    alignItems: "center",
  },
  deviceImageWrapper: {
    width: "100%",
    aspectRatio: 1,
    marginBottom: vs(6),
  },
  deviceImage: {
    width: "100%",
    height: "100%",
    borderRadius: ms(12),
    backgroundColor: "#E2E8F0",
  },
  devicePlaceholder: {
    backgroundColor: "#E2E8F0",
  },
  deviceStatusBadge: {
    position: "absolute",
    top: ms(5),
    right: ms(5),
    paddingHorizontal: ms(5),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  deviceBadgeActive: {
    backgroundColor: "#1C39BB",
  },
  deviceBadgeInactive: {
    backgroundColor: "rgba(100, 116, 139, 0.88)",
  },
  deviceBadgeText: {
    fontSize: s(8),
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  deviceImagePlaceholder: {
    backgroundColor: "#E2E8F0",
  },
  deviceLabel: {
    fontSize: s(11),
    fontWeight: "500",
    color: "#1E293B",
    textAlign: "center",
  },
  devicesLoaderWrap: {
    paddingHorizontal: ms(GRID_PAD),
    paddingVertical: vs(8),
    alignItems: "center",
    justifyContent: "center",
  },
  hListContent: {
    paddingLeft: ms(GRID_PAD),
    paddingRight: ms(8),
    paddingBottom: vs(6),
  },
  pkgCard: {
    width: PACKAGE_CARD_SIZE,
    height: PACKAGE_CARD_SIZE,
    borderRadius: ms(20),
    overflow: "hidden",
    marginRight: ms(12),
    backgroundColor: "#E4E7F7",
  },
  pkgCardChild: {
    borderRadius: ms(14),
  },
  pkgImageFill: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  pkgImageChild: {
    borderRadius: ms(14),
  },
  pkgOverlay: {
    position: "absolute",
    bottom: ms(12),
    alignSelf: "center",
    width: ms(156),
    minHeight: ms(56),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(20),
    paddingLeft: ms(14),
    paddingRight: ms(6),
    paddingVertical: ms(6),
  },
  pkgTitle: {
    fontSize: s(14),
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },
  pkgTitleChild: {
    lineHeight: s(16),
  },
  pkgArrow: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  concernListContent: {
    paddingLeft: ms(GRID_PAD),
    paddingRight: ms(8),
    paddingBottom: vs(10),
  },
  concernCard: {
    aspectRatio: 1,
    marginRight: ms(10),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
    padding: ms(12),
    justifyContent: "space-between",
  },
  concernIconWrap: {
    alignSelf: "flex-end",
  },
  concernTitle: {
    fontSize: s(12),
    fontWeight: "500",
    color: "#1E293B",
    textAlign: "left",
    lineHeight: s(16),
  },
});