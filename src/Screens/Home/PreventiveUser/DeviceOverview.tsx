import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Platform,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ms, s, vs } from "react-native-size-matters";
import { useFocusEffect } from "@react-navigation/native";
import PreventiveHealthHeader from "./PreventiveHealthHeader";
import CustomPopup from "../Components/CustomPopup";
import { getPreventiveCartStore } from "../../../Utils/preventiveCartStore";

import { addToCart, syncCart } from "./PreventiveHealthAPI";

const { width: SCREEN_W } = Dimensions.get("window");
const BANNER_H = Math.min(SCREEN_W * 0.65, ms(280));

const DeviceOverview = ({ navigation, route }: any) => {
  const device = route.params?.deviceData ?? {};
  const currentDeviceId = device?.id ?? null;
  const isActive = device?.is_active !== false;

  const [refreshing, setRefreshing] = useState(false);
  const [addedVisible, setAddedVisible] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartData, setCartData] = useState<any>(null);
  const [cartLoaded, setCartLoaded] = useState(false);

  const store = useMemo(() => getPreventiveCartStore(), []);

  const syncCartFromServer = useCallback(async () => {
    const res = await syncCart();
    setCartData(res ?? null);
    return res;
  }, []);

  const cartCount = cartLoaded
    ? Array.isArray(cartData?.items)
      ? cartData.items.length
      : 0
    : 0;

  const isCurrentDeviceAdded = useMemo(() => {
    if (!currentDeviceId) return false;
    const items = Array.isArray(cartData?.items) ? cartData.items : [];
    return items.some(
      (it: any) =>
        it?.item_type === "device" &&
        (String(it?.item_id) === String(currentDeviceId) ||
          String(it?.item?.id) === String(currentDeviceId))
    );
  }, [cartData?.items, currentDeviceId]);


  useEffect(() => {
    let isNavigating = false;

    const handleBack = () => {
      if (isNavigating) return true;
      isNavigating = true;
      navigation.replace("PreventiveHealth");
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


  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const run = async () => {
        try {
          await syncCartFromServer();
        } catch {
          if (mounted) setCartData(null);
        } finally {
          if (mounted) setCartLoaded(true);
        }
      };
      void run();
      return () => {
        mounted = false;
      };
    }, [syncCartFromServer])
  );

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await syncCartFromServer();
    } catch {
      setCartData(null);
    } finally {
      setRefreshing(false);
    }
  }, [syncCartFromServer]);

  const handleAddToCart = async () => {
    const itemId = device?.id ?? null;
    if (!isActive || isAddingToCart || isCurrentDeviceAdded) return;

    try {
      setIsAddingToCart(true);
      if (itemId) {
        await addToCart(itemId);
      } else {
        const title = String(device?.device_name ?? "device");
        store.addItem({
          id: `test-${title}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, ""),
          title,
          testsCount: 1,
          price: Number(device?.price) || 0,
        });
      }
      const res = await syncCart();
      setCartData(res ?? null);
      setAddedVisible(true);
    } catch (e) {
      console.log("Add to cart error", e);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const headerTitle = device?.device_name ?? "Device";

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />

      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title={headerTitle}
          onBackPress={() => navigation.goBack()}
          cartCount={cartCount}
          showRight2
          rightIcon2="cart-outline"
          onRightPress2={() => navigation.navigate("PreventiveCart")}
        />
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Banner Card */}
        <View style={styles.bannerCard}>
          {device.image_url ? (
            <Image
              source={{ uri: device.image_url }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.bannerImage} />
          )}
        </View>

        <View style={styles.body}>
          {/* Title + Price Row */}
          <View style={styles.titlePriceRow}>
            <View style={styles.titleWithAccent}>
              <View style={styles.accentBar} />
              <Text style={styles.deviceTitle}>{device.device_name}</Text>
            </View>

            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>₹{device.price}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Overview */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.accentBar} />
            <Text style={styles.sectionTitle}>Overview</Text>
          </View>
          <Text style={styles.bodyText}>{device.overview}</Text>

          <View style={styles.divider} />

          {/* Parameters */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.accentBar} />
            <Text style={styles.sectionTitle}>Parameters</Text>
          </View>
          <View style={styles.chipWrap}>
            {device.parameters?.map((p: string) => (
              <View key={p} style={styles.chip}>
                <Text style={styles.chipText}>{p}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Normal Range */}
          <Text style={styles.sectionTitlePlain}>Normal Range</Text>
          {Object.entries(device.normal_range || {}).map(([key, val]) => (
            <View key={key} style={styles.normalRow}>
              <Text style={styles.normalLabel}>{key}:</Text>
              <View style={styles.normalHighlight}>
                <Text style={styles.normalHighlightText}>{String(val)}</Text>
              </View>
            </View>
          ))}

          <View style={styles.divider} />

          {/* Test Preparation */}
          <Text style={styles.sectionTitlePlain}>Test Preparation</Text>
          <Text style={styles.bodyText}>{device.test_preparation}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, !isActive && styles.btnDisabled]}
          disabled={isAddingToCart || isCurrentDeviceAdded || !isActive}
          activeOpacity={0.88}
          onPress={handleAddToCart}
        >
          <Text
            style={[
              styles.btnText,
              !isActive && styles.btnTextDisabled,
            ]}
          >
            {isCurrentDeviceAdded ? "Added to cart" : "Add To Cart"}
          </Text>
        </TouchableOpacity>
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
};

export default DeviceOverview;

const styles = StyleSheet.create({
  headerSafe: {
    backgroundColor: "#1C39BB",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: "hidden",
  },
  bannerCard: {
    marginHorizontal: 16,
    height: BANNER_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    marginTop: 16,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  body: {
    padding: 16,
  },
  titlePriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleWithAccent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  accentBar: {
    width: 4,
    height: 22,
    backgroundColor: "#1C39BB",
    marginRight: 10,
  },
  deviceTitle: {
    fontSize: s(16),
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  priceBadge: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 6,
    borderRadius: 8,
  },
  priceText: {
    fontSize: s(14),
    fontWeight: "600",
    color: "#2563EB",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: vs(8),
  },
  sectionTitle: {
    fontSize: s(15),
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionTitlePlain: {
    fontSize: s(15),
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: vs(8),
  },
  bodyText: {
    fontSize: s(13),
    color: "#475569",
    lineHeight: s(20),
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: ms(10),
    paddingVertical: ms(6),
    borderRadius: 20,
    margin: 4,
  },
  chipText: {
    fontSize: s(12),
    color: "#1E40AF",
    fontWeight: "500",
  },
  normalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: vs(8),
    gap: ms(10),
  },
  normalLabel: {
    fontSize: s(13),
    fontWeight: "600",
    color: "#334155",
  },
  normalHighlight: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: ms(10),
    paddingVertical: ms(6),
    borderRadius: 10,
  },
  normalHighlightText: {
    fontSize: s(12),
    color: "#1E40AF",
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  btn: {
    backgroundColor: "#0451CF",
    borderRadius: ms(28),
    paddingVertical: vs(14),
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    backgroundColor: "#94A3B8",
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: s(16),
    fontWeight: "700",
  },
  btnTextDisabled: {
    color: "#E2E8F0",
  },
});
