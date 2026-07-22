import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    Modal,
    ActivityIndicator,
    Platform,
    BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ms, s, vs } from "react-native-size-matters";
import { useFocusEffect } from "@react-navigation/native";

import PreventiveHealthHeader from "./PreventiveHealthHeader";
// import CustomPopup from "../Components/CustomPopup";

import { getCart, removeFromCart, getPreventivePatients } from "./PreventiveHealthAPI";
import { getPreventiveCartStore } from "../../../Utils/preventiveCartStore";
import { getStoredPreventivePatientIdV1 } from "../../../Utils/preventivePatient";

const COLORS = {
    headerBg: "#1C39BB",
    bg: "#FFFFFF",
    textPrimary: "#0F172A",
    textMuted: "#94A3B8",
    divider: "#E2E8F0",
    cta: "#2563EB",
};

const HPAD = ms(16);

export default function PreventiveCart({ navigation }: any) {
    const store = useMemo(() => getPreventiveCartStore(), []);
    /** Do not seed from AsyncStorage before a successful GET /cart — otherwise a failed fetch leaves stale items visible. */
    const [items, setItems] = useState<any[]>([]);
    const [cartLoading, setCartLoading] = useState(true);
    const [cartFetchError, setCartFetchError] = useState<string | null>(null);
    const [addMoreLabel, setAddMoreLabel] = useState("Add More");
    const [refreshing, setRefreshing] = useState(false);
    const [showRemovePopup, setShowRemovePopup] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [removeLoading, setRemoveLoading] = useState(false);
    const [continueLoading, setContinueLoading] = useState(false);
    /** Ignore AsyncStorage-driven store updates until GET /cart finishes — otherwise hydrate replays stale items during/after a failed fetch. */
    const ignoreStoreSubscriptionRef = useRef(true);

    /* 🔥 Sync store (after first fetch — e.g. add from another screen) */
    useEffect(() => {
        return store.subscribe((s: any) => {
            if (ignoreStoreSubscriptionRef.current) return;
            setItems(s.items);
        });
    }, [store]);

    /* ─── Price helper: supports multiple API shapes ─── */
    const getPrice = (it: any): number => {
        const raw =
            it?.item?.price ??
            it?.price ??
            it?.item_price ??
            0;
        return Number(raw) || 0;
    };

    /* 🔥 Fetch cart — server is source of truth; on failure clear UI + store so cached AsyncStorage does not masquerade as live cart */
    const fetchCart = useCallback(async () => {
        ignoreStoreSubscriptionRef.current = true;
        setCartFetchError(null);
        try {
            const res = await getCart();

            const data = res?.data ?? res;

            if (data?.items) {
                setItems(data.items);
                store.setItems(data.items);
                setAddMoreLabel(data.add_more_button || "Add More");
            } else {
                setItems([]);
                store.setItems([]);
            }
        } catch (e) {
            setCartFetchError("Could not load cart. Check your connection and try again.");
            setItems([]);
            store.setItems([]);
        } finally {
            ignoreStoreSubscriptionRef.current = false;
            setCartLoading(false);
        }
    }, [store]);

    const handleContinue = useCallback(async () => {
        if (continueLoading) return;

        setContinueLoading(true);
        try {
            const storedPatientId = await getStoredPreventivePatientIdV1();
            if (storedPatientId) {
                console.log("[PreventiveFlow] PreventiveCart Continue — skip SelectPatient", {
                    storedPatientId,
                    nextScreen: "PreventiveBookingDetail",
                });
                navigation.navigate("PreventiveBookingDetail", { fromScreen: "PreventiveCart" });
                return;
            }

            console.log("[PreventiveFlow] PreventiveCart Continue — no stored patient, GET /patients");
            const list = await getPreventivePatients();
            console.log("[PreventiveFlow] PreventiveCart Continue GET /patients", {
                count: Array.isArray(list) ? list.length : 0,
                patients: list,
            });
            if (Array.isArray(list) && list.length > 0) {
                navigation.navigate("SelectPatient", { fromScreen: "PreventiveCart" });
            } else {
                navigation.navigate("PatientDetail", { fromScreen: "PreventiveCart" });
            }
        } catch (e) {
            console.log("[PreventiveFlow] PreventiveCart Continue GET /patients failed", e);
            navigation.navigate("PatientDetail", { fromScreen: "PreventiveCart" });
        } finally {
            setContinueLoading(false);
        }
    }, [continueLoading, navigation]);

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
            setCartLoading(true);
            void fetchCart();
        }, [fetchCart])
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchCart();
        setRefreshing(false);
    };

    const handleConfirmRemove = async () => {
        if (!selectedItem) return;

        try {
            setRemoveLoading(true);

            const item_type = selectedItem?.item_type;
            const item_id = selectedItem?.item_id || selectedItem?.item?.id;

            await removeFromCart({ item_type, item_id });
            await fetchCart();
        } catch (e) {
        } finally {
            setRemoveLoading(false);
            setShowRemovePopup(false);
            setSelectedItem(null);
        }
    };

    const formatRupee = (n: number) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return "₹0";
        return `₹${Math.round(num)}`;
    };

    const devices = useMemo(
        () => items.filter((it) => it?.item_type === "device"),
        [items]
    );

    const healthPackages = useMemo(
        () => items.filter((it) => it?.item_type === "health_package"),
        [items]
    );

    const listData = useMemo(() => {
        const out: any[] = [];

        if (devices.length > 0) {
            out.push({ __type: "header", id: "hdr-devices", label: "Devices" });
            devices.forEach((it) =>
                out.push({ __type: "item", id: `device-${it.id}`, cartItem: it })
            );
        }

        if (healthPackages.length > 0) {
            out.push({
                __type: "header",
                id: "hdr-packages",
                label: "Health Packages",
            });
            healthPackages.forEach((it) =>
                out.push({ __type: "item", id: `pkg-${it.id}`, cartItem: it })
            );
        }

        return out;
    }, [devices, healthPackages]);

    const total = useMemo(() => {
        return items.reduce(
            (sum, it) => sum + getPrice(it) * (it.quantity || 1),
            0
        );
    }, [items]);

    const renderItem = ({ item }: any) => {
        if (item.__type === "header") {
            return <Text style={styles.sectionHeader}>{item.label}</Text>;
        }

        const cartItem = item.cartItem;

        const title =
            cartItem.item_type === "health_package"
                ? cartItem?.item?.package_name
                : cartItem?.item?.device_name;

        return (
            <View style={styles.card}>
                <View style={styles.rowTop}>
                    <View style={styles.leftCol}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.subTitle}>
                            Qty: {cartItem?.quantity || 1}
                        </Text>
                    </View>

                    <View style={styles.rightCol}>
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedItem(cartItem);
                                setShowRemovePopup(true);
                            }}
                            style={styles.closeBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={18} color="#94A3B8" />
                        </TouchableOpacity>

                        <Text style={styles.price}>
                            {formatRupee(getPrice(cartItem) * (cartItem.quantity || 1))}
                        </Text>
                    </View>
                </View>

                <View style={styles.divider} />
            </View>
        );
    };

    if (cartLoading) {
        return (
            <>
                <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />
                <View style={styles.headerShell}>
                    <SafeAreaView edges={['top']} style={styles.headerSafe}>
                        <PreventiveHealthHeader
                            title="Cart"
                            onBackPress={() => navigation.goBack()}
                        />
                    </SafeAreaView>
                </View>
                <SafeAreaView style={styles.bodySafe}>
                    <View style={styles.empty}>
                        <ActivityIndicator size="large" color={COLORS.cta} />
                    </View>
                </SafeAreaView>
            </>
        );
    }

    if (items.length === 0) {
        return (
            <>
                <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />
                <View style={styles.headerShell}>
                    <SafeAreaView edges={['top']} style={styles.headerSafe}>
                        <PreventiveHealthHeader
                            title="Cart"
                            onBackPress={() => navigation.goBack()}
                        />
                    </SafeAreaView>
                </View>
                <SafeAreaView style={styles.bodySafe}>
                    <View style={styles.empty}>
                        {cartFetchError ? (
                            <Text style={styles.fetchErrorText}>{cartFetchError}</Text>
                        ) : (
                            <Text>No items in cart</Text>
                        )}

                        <TouchableOpacity
                            style={styles.addMoreBtn}
                            onPress={() => navigation.navigate("HealthCheckupDevices")}
                        >
                            <Text style={{ color: "#fff" }}>Add More</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </>
        );
    }

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="#1C39BB" />

            <View style={styles.headerShell}>
                <SafeAreaView edges={['top']} style={styles.headerSafe}>
                    <PreventiveHealthHeader
                        title="Cart"
                        onBackPress={() => navigation.goBack()}
                    />
                </SafeAreaView>
            </View>

            <SafeAreaView style={styles.bodySafe}>
                <FlatList
                    style={styles.list}
                    data={listData}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                    contentContainerStyle={styles.listContent}
                    ListFooterComponent={
                        <View style={styles.addMoreWrapper}>
                            <TouchableOpacity
                                style={styles.addMoreBtn}
                                activeOpacity={0.9}
                                onPress={() => navigation.navigate("PreventiveHealth")}
                            >
                                <Text style={styles.addMoreText}>
                                    {addMoreLabel}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    }
                />

                <View style={styles.footer}>
                    <View style={styles.footerRow}>
                        <Text style={styles.footerPrice}>
                            {formatRupee(total)}
                        </Text>

                        <TouchableOpacity
                            style={styles.continueBtn}
                            onPress={() => void handleContinue()}
                            disabled={continueLoading}
                        >
                            {continueLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.continueText}>Continue</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            <Modal visible={showRemovePopup} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Ionicons
                            name="trash-outline"
                            size={28}
                            color="#1C39BB"
                            style={{ marginBottom: 10 }}
                        />

                        <Text style={styles.modalTitle}>Remove Item</Text>

                        <Text style={styles.modalMessage}>
                            Are you sure you want to remove this item?
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => {
                                    if (removeLoading) return;
                                    setShowRemovePopup(false);
                                    setSelectedItem(null);
                                }}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.confirmBtn}
                                onPress={handleConfirmRemove}
                            >
                                <Text style={styles.confirmText}>
                                    {removeLoading ? "Removing..." : "Confirm"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    headerShell: {
        backgroundColor: "#1C39BB",
        borderBottomLeftRadius: ms(18),
        borderBottomRightRadius: ms(18),
        overflow: "hidden",
    },
    headerSafe: {
        backgroundColor: "#1C39BB",
    },
    bodySafe: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    list: {
        flex: 1,
    },
    footer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        paddingHorizontal: 16,
        paddingVertical: 12,
      },
      
      footerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
      
      footerPrice: {
        fontSize: 20,
        fontWeight: "800",
        color: "#2563EB",
      },
      
      continueBtn: {
        backgroundColor: "#1C39BB",
        paddingHorizontal: 32,   // 🔥 increase width
        paddingVertical: 14,     // 🔥 taller button
        borderRadius: 8,
        minWidth: 130,           // 🔥 consistent width
        alignItems: "center",
      },
      
      continueText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 14,
      },
    listContent: {
        paddingHorizontal: HPAD,
        paddingTop: vs(16),
        paddingBottom: vs(120),
    },
    sectionHeader: {
        fontSize: s(18),
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: vs(10),
    },
    card: {
        paddingVertical: 10,
      },
    rowTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    leftCol: {
        flex: 1,
        marginRight: ms(12),
    },
    rightCol: {
        alignItems: "flex-end",
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
      },
      subTitle: {
        fontSize: 12,
        color: "#94A3B8",
      },
      price: {
        fontSize: 16,
        fontWeight: "700",
        color: "#2563EB",
      },
      divider: {
        height: 1,
        backgroundColor: "#E5E7EB",
        marginVertical: 10,
      },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: vs(12),
    },
    totalLabel: {
        fontSize: s(14),
        fontWeight: "600",
        color: "#64748B",
    },
    total: {
        fontSize: s(18),
        fontWeight: "700",
        color: "#0F172A",
    },
    btn: {
        backgroundColor: "#0451CF",
        borderRadius: ms(28),
        paddingVertical: vs(14),
        alignItems: "center",
        justifyContent: "center",
    },
    btnText: {
        color: "#FFFFFF",
        fontSize: s(16),
        fontWeight: "700",
    },
    empty: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: ms(24),
    },
    fetchErrorText: {
        color: "#B91C1C",
        fontSize: s(14),
        textAlign: "center",
        marginBottom: vs(16),
        lineHeight: 20,
    },
    addMoreWrapper: {
        marginTop: vs(16),
        marginBottom: vs(20),
        alignItems: "center",
    },
    addMoreBtn: {
        backgroundColor: "#1C39BB",
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 8,
        alignSelf: "center",
      },
    addMoreText: {
        color: "#FFFFFF",
        fontSize: s(14),
        fontWeight: "700",
    },
    closeBtn: {
        marginBottom: vs(4),
        alignSelf: "flex-end",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalBox: {
        width: "80%",
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    modalMessage: {
        marginTop: 8,
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
    },
    modalActions: {
        flexDirection: "row",
        marginTop: 20,
    },
    cancelBtn: {
        padding: 10,
        marginRight: 10,
    },
    confirmBtn: {
        backgroundColor: "#1C39BB",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    cancelText: {
        color: "#64748B",
        fontWeight: "600",
    },
    confirmText: {
        color: "#fff",
        fontWeight: "700",
    },
});