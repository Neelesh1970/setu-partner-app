
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  Platform,
  BackHandler,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ms, s, vs } from "react-native-size-matters";
import PreventiveHealthHeader from "./PreventiveHealthHeader";
import AppSkeleton from "../Components/AppSkeleton";
import { FlatList } from "react-native";
import RemoteImage from "../../../Components/RemoteImage/RemoteImage";
import { useFocusEffect } from "@react-navigation/native";

import { getDevices, getCart } from "./PreventiveHealthAPI";

const { width } = Dimensions.get("window");

const GRID_PAD = 16;
const GRID_GAP = 12;

const HealthCheckupDevices = ({ navigation }: any) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cartCount = Array.isArray(cart?.items) ? cart.items.length : 0;

  const fetchData = async () => {
    try {
      const [deviceRes, cartRes] = await Promise.all([
        getDevices(),
        getCart(),
      ]);

      setDevices(deviceRes || []);
      setCart(cartRes || null);
    } catch (e) {
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

  // useFocusEffect(
  //   useCallback(() => {
  //     const handleBack = () => {
  //       navigation.replace("PreventiveHealth");
  //       return true;
  //     };

  //     let backSub;
  //     if (Platform.OS === "android") {
  //       backSub = BackHandler.addEventListener(
  //         "hardwareBackPress",
  //         handleBack
  //       );
  //     }

  //     return () => backSub?.remove();
  //   }, [])
  // );

  const colW = useMemo(
    () => (width - GRID_PAD * 2 - GRID_GAP * 2) / 3,
    []
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />

      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="Health Checkup Devices"
            onBackPress={() => navigation.goBack()}
            showRight2
            rightIcon2="cart-outline"
            rightIcon2Type="ion"
            cartCount={cartCount}
            onRightPress2={() => navigation.navigate("PreventiveCart")}
          />
        </SafeAreaView>
      </View>

      <SafeAreaView style={styles.bodySafe}>
        {loading ? <AppSkeleton variant="default" /> : <FlatList
          data={devices}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item, index }) => {
            const isActive = item.is_active !== false;
            return (
            <TouchableOpacity
              style={[
                styles.tile,
                {
                  width: colW,
                  marginRight: (index + 1) % 3 === 0 ? 0 : GRID_GAP,
                },
              ]}
              onPress={() =>
                navigation.navigate("DeviceOverview", {
                  deviceData: item,
                })
              }
            >
              <View style={styles.imageWrapper}>
                {item.image_url ? (
                  <RemoteImage
                    source={{ uri: item.image_url }}
                    style={styles.tileImage}
                  />
                ) : (
                  <View style={styles.tilePlaceholder} />
                )}
                <View
                  style={[
                    styles.statusBadge,
                    isActive ? styles.badgeActive : styles.badgeInactive,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>
              <Text style={styles.tileLabel} numberOfLines={1}>
                {item.device_name}
              </Text>
            </TouchableOpacity>
            );
          }}
        />}
      </SafeAreaView>
    </>
  );
};

export default HealthCheckupDevices;

const styles = StyleSheet.create({
  headerShell: {
    backgroundColor: "#1C39BB",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: "hidden",
  },
  headerSafe: {
    backgroundColor: "#1C39BB",
  },
  bodySafe: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  listContainer: {
    paddingHorizontal: ms(16),
    paddingTop: vs(16),
  },
  row: {
    marginBottom: vs(14),
  },
  tile: {
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1,
    marginBottom: vs(6),
  },
  tileImage: {
    width: "100%",
    height: "100%",
    borderRadius: ms(12),
    backgroundColor: "#E2E8F0",
  },
  tilePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: ms(12),
    backgroundColor: "#E2E8F0",
  },
  statusBadge: {
    position: "absolute",
    top: ms(5),
    right: ms(5),
    paddingHorizontal: ms(5),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  badgeActive: {
    backgroundColor: "#1C39BB",
  },
  badgeInactive: {
    backgroundColor: "rgba(100, 116, 139, 0.88)",
  },
  badgeText: {
    fontSize: s(8),
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  tileLabel: {
    fontSize: s(11),
    textAlign: "center",
  },
});