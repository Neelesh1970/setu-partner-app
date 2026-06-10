import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  BackHandler,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ms, s, vs } from "react-native-size-matters";
import RazorpayCheckout from "react-native-razorpay";
import PreventiveHealthHeader from "./PreventiveHealthHeader";
import {
  payUpi,
  payCash,
  verifyRazorpay,
} from "../../../api/preventivePayment";
import { getUser } from "../../../Utils/storage";
import type { RootStackParamList } from "../../../navigation/types";

/* ─────────────────────────── constants ─────────────────────────── */

const COLORS = {
  headerBg:    "#1C39BB",
  bg:          "#F8FAFC",
  textPrimary: "#0F172A",
  textMuted:   "#64748B",
  divider:     "#E2E8F0",
  cta:         "#1D4ED8",
  ctaText:     "#FFFFFF",
  radioBorder: "#CBD5E1",
  white:       "#FFFFFF",
};

const HPAD = ms(16);

/* ─────────────────────────── helpers ───────────────────────────── */

const formatRupee = (n: number | string): string => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "₹0.00";
  return `₹${num.toFixed(2)}`;
};

type UpiOrderFields = {
  key: string;
  orderId: string;
  amountPaise: number;
  currency: string;
};

function extractUpiOrderFromResponse(raw: unknown): UpiOrderFields | null {
  const root = raw as Record<string, unknown>;
  const d =
    root?.data != null && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const key      = String(d.razorpay_key_id ?? d.key_id ?? d.key ?? "").trim();
  const orderId  = String(d.razorpay_order_id ?? d.order_id ?? "").trim();
  const amountPaise = Number(d.amount_paise ?? d.amount ?? 0);
  const currency = String(d.currency ?? "INR").trim() || "INR";
  if (!key || !orderId || !Number.isFinite(amountPaise) || amountPaise <= 0) {
    return null;
  }
  return { key, orderId, amountPaise, currency };
}

function isRazorpayUserCancelled(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const e = err as { code?: number; description?: string; error?: { description?: string } };
  if (e.code === 0) return true;
  const desc = String(e.description ?? e.error?.description ?? "").toLowerCase();
  return desc.includes("cancel");
}

function extractSdkPaymentIds(data: Record<string, unknown>): {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
} | null {
  const orderId = String(
    data.razorpay_order_id ??
      (data as { razorpayOrderId?: string }).razorpayOrderId ??
      data.order_id ??
      "",
  ).trim();
  const paymentId = String(
    data.razorpay_payment_id ??
      (data as { razorpayPaymentId?: string }).razorpayPaymentId ??
      data.payment_id ??
      "",
  ).trim();
  const signature = String(
    data.razorpay_signature ??
      (data as { razorpaySignature?: string }).razorpaySignature ??
      data.signature ??
      "",
  ).trim();
  if (!orderId || !paymentId || !signature) return null;
  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  };
}

/* ─────────────────────── RadioRow subcomponent ─────────────────── */

type RadioRowProps = { label: string; selected: boolean; onPress: () => void };

function RadioRow({ label, selected, onPress }: RadioRowProps): React.JSX.Element {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.radioRow}>
      <Text style={styles.radioLabel}>{label}</Text>
      <View style={[styles.radioOuter, selected ? styles.radioOuterOn : null]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </TouchableOpacity>
  );
}

/* ─────────────────────────── component ─────────────────────────── */

type Props = NativeStackScreenProps<RootStackParamList, "PreventivePayment">;

export default function PreventivePayment({ navigation, route }: Props): React.JSX.Element {
  const bookingId         = route.params?.bookingId;
  const amountPayableParam = route.params?.amountPayable;
  const insets            = useSafeAreaInsets();

  const [paymentMode, setPaymentMode]     = useState<"upi" | "cash">("upi");
  const [paying, setPaying]               = useState<boolean>(false);
  const [cashConfirmed, setCashConfirmed] = useState<boolean>(false);
  const [amountPayable, setAmountPayable] = useState<number>(
    typeof amountPayableParam === "number" && Number.isFinite(amountPayableParam)
      ? amountPayableParam
      : 0,
  );

  const userRef = useRef<{ mobile?: string; phone?: string; email?: string } | null>(null);

  useEffect(() => {
    async function loadUser(): Promise<void> {
      try {
        const u = await getUser<{ mobile?: string; phone?: string; email?: string }>();
        userRef.current = u;
      } catch (e) {
      }
    }
    void loadUser();
  }, []);

  useEffect(() => {
    if (
      typeof amountPayableParam === "number" &&
      Number.isFinite(amountPayableParam) &&
      amountPayableParam > 0
    ) {
      setAmountPayable(amountPayableParam);
    }
  }, [amountPayableParam]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = (): boolean => {
        navigation.goBack();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [navigation]),
  );

  /* ── UPI payment ── */

  const handleUpiPayment = useCallback(async (): Promise<void> => {
    if (!bookingId) {
      console.warn("[PAY][UPI] ❌ bookingId is missing — aborting");
      Alert.alert("Payment", "Missing booking.");
      return;
    }
    setPaying(true);
    try {
      // ── Step 1: create Razorpay order ──────────────────────────
      const orderRes = await payUpi(bookingId);

      const order = extractUpiOrderFromResponse(orderRes);

      if (!order) {
        console.warn("[PAY][UPI] ❌ extractUpiOrderFromResponse returned null");
        console.warn("[PAY][UPI]    raw orderRes was :", JSON.stringify(orderRes, null, 2));
        Alert.alert(
          "Payment",
          (orderRes as { message?: string })?.message ??
            "Could not start UPI payment. Invalid order from server.",
        );
        return;
      }

      // ── Step 2: open Razorpay SDK ──────────────────────────────
      const u       = userRef.current;
      const contact = String(u?.mobile ?? u?.phone ?? "").replace(/\D/g, "");
      const email   = String(u?.email ?? "").trim() || "user@example.com";

      const razorpayOptions = {
        key:      order.key,
        order_id: order.orderId,
        amount:   order.amountPaise,
        currency: order.currency,
        name:        "Booking payment",
        description: "Preventive health booking",
        prefill: {
          contact: contact.length >= 10 ? contact : undefined,
          email,
        },
        theme: { color: COLORS.headerBg },
      };

      const sdkData = await RazorpayCheckout.open(razorpayOptions);

      const payload = extractSdkPaymentIds(sdkData as Record<string, unknown>);

      if (!payload) {
        console.warn("[PAY][UPI] ❌ extractSdkPaymentIds returned null — sdkData was :", JSON.stringify(sdkData, null, 2));
        Alert.alert("Payment", "Missing payment details from Razorpay.");
        return;
      }

      // ── Step 3: verify on backend ──────────────────────────────
      const verifyRes = await verifyRazorpay(bookingId, payload);

      if (verifyRes?.success !== true) {
        console.warn("[PAY][UPI] ❌ verification failed — response :", JSON.stringify(verifyRes, null, 2));
        Alert.alert("Payment", verifyRes?.message ?? "Payment verification failed.");
        return;
      }

      navigation.replace("PreventiveBookingSummary", { bookingId });
    } catch (e: unknown) {
      if (isRazorpayUserCancelled(e)) {
        Alert.alert("Payment", "Payment cancelled.");
        return;
      }
      // Print every useful field from the error
      const axiosErr = e as {
        message?: string;
        code?: string;
        response?: { status?: number; data?: unknown; headers?: unknown };
        request?: unknown;
        config?: { url?: string; method?: string; baseURL?: string; headers?: unknown; data?: unknown };
      };
      console.error("[PAY][UPI] ❌ UNEXPECTED ERROR ──────────────────────────");
      console.error("[PAY][UPI]    message          :", axiosErr?.message);
      console.error("[PAY][UPI]    code             :", axiosErr?.code);
      console.error("[PAY][UPI]    response.status  :", axiosErr?.response?.status);
      console.error("[PAY][UPI]    response.data    :", JSON.stringify(axiosErr?.response?.data, null, 2));
      console.error("[PAY][UPI]    request sent?    :", axiosErr?.request != null ? "yes" : "no (never left device)");
      console.error("[PAY][UPI]    config.url       :", axiosErr?.config?.url);
      console.error("[PAY][UPI]    config.baseURL   :", axiosErr?.config?.baseURL);
      console.error("[PAY][UPI]    config.method    :", axiosErr?.config?.method);
      console.error("[PAY][UPI]    full error dump  :", JSON.stringify(e, null, 2));
      const msg =
        axiosErr?.message ?? "Payment failed";
      Alert.alert("Payment", msg);
    } finally {
      setPaying(false);
    }
  }, [bookingId, amountPayable, navigation]);

  /* ── Cash payment — step 1: register with API ── */

  const handleCashPayment = useCallback(async (): Promise<void> => {
    if (!bookingId) {
      console.warn("[PAY][CASH] ❌ bookingId is missing — aborting");
      Alert.alert("Payment", "Missing booking.");
      return;
    }
    setPaying(true);
    try {
      const res = await payCash(bookingId);

      if (res?.success !== true) {
        console.warn("[PAY][CASH] ❌ success !== true — message :", res?.message);
        Alert.alert("Payment", res?.message ?? "Cash payment could not be recorded.");
        return;
      }
      setCashConfirmed(true);
    } catch (e: unknown) {
      const axiosErr = e as {
        message?: string;
        code?: string;
        response?: { status?: number; data?: unknown };
        request?: unknown;
        config?: { url?: string; method?: string; baseURL?: string };
      };
      console.error("[PAY][CASH] ❌ UNEXPECTED ERROR ─────────────────────────");
      console.error("[PAY][CASH]    message         :", axiosErr?.message);
      console.error("[PAY][CASH]    code            :", axiosErr?.code);
      console.error("[PAY][CASH]    response.status :", axiosErr?.response?.status);
      console.error("[PAY][CASH]    response.data   :", JSON.stringify(axiosErr?.response?.data, null, 2));
      console.error("[PAY][CASH]    request sent?   :", axiosErr?.request != null ? "yes" : "no (never left device)");
      console.error("[PAY][CASH]    config.url      :", axiosErr?.config?.url);
      console.error("[PAY][CASH]    config.baseURL  :", axiosErr?.config?.baseURL);
      console.error("[PAY][CASH]    full error dump :", JSON.stringify(e, null, 2));
      Alert.alert("Payment", axiosErr?.message ?? "Failed to confirm cash payment");
    } finally {
      setPaying(false);
    }
  }, [bookingId, amountPayable, cashConfirmed]);

  /* ── Primary CTA handler ── */

  const handlePayNow = useCallback(async (): Promise<void> => {
    if (paying) {
      return;
    }
    if (paymentMode === "upi") {
      await handleUpiPayment();
    } else if (cashConfirmed) {
      // Second tap — navigate to summary
      if (!bookingId) {
        console.warn("[PAY][CASH] ❌ bookingId missing on confirm tap");
        Alert.alert("Payment", "Missing booking.");
        return;
      }
      navigation.replace("PreventiveBookingSummary", { bookingId });
    } else {
      // First tap — register cash with API
      await handleCashPayment();
    }
  }, [
    paying,
    paymentMode,
    cashConfirmed,
    bookingId,
    handleUpiPayment,
    handleCashPayment,
    navigation,
  ]);

  const ctaLabel = paying
    ? "Processing..."
    : cashConfirmed
    ? "Confirm & Continue"
    : "Pay Now";

  /* ── render ── */

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="Payment"
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>

      <SafeAreaView style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 90, 110) },
          ]}
        >
          {/* Amount card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount Payable</Text>
            <Text style={styles.amountValue}>{formatRupee(amountPayable)}</Text>
          </View>

          {/* Payment method section */}
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          <View style={styles.paymentCard}>
            <RadioRow
              label="Pay using UPI"
              selected={paymentMode === "upi"}
              onPress={() => {
                setPaymentMode("upi");
                setCashConfirmed(false);
              }}
            />
            <View style={styles.methodDivider} />
            <RadioRow
              label="Pay with Cash"
              selected={paymentMode === "cash"}
              onPress={() => setPaymentMode("cash")}
            />
          </View>

          {/* Cash info note */}
          {paymentMode === "cash" && (
            <View style={styles.cashNote}>
              <Ionicons name="information-circle-outline" size={ms(18)} color="#D97706" />
              <Text style={styles.cashNoteText}>
                Cash will be collected by the technician at the time of visit.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky footer */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(
                insets.bottom + 8,
                Platform.OS === "ios" ? vs(16) : vs(12),
              ),
            },
          ]}
        >
          <Text style={styles.footerAmount}>{formatRupee(amountPayable)}</Text>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.cta, paying && { opacity: 0.7 }]}
            onPress={handlePayNow}
            disabled={paying || !bookingId}
          >
            {paying ? (
              <View style={styles.ctaInner}>
                <ActivityIndicator color={COLORS.ctaText} size="small" />
                <Text style={[styles.ctaText, { marginLeft: ms(8) }]}>Processing...</Text>
              </View>
            ) : (
              <View style={styles.ctaInner}>
                <Text style={styles.ctaText}>{ctaLabel}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={ms(18)}
                  color={COLORS.ctaText}
                  style={{ marginLeft: ms(6) }}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────── styles ────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  headerShell: {
    backgroundColor: COLORS.headerBg,
    borderBottomLeftRadius: ms(22),
    borderBottomRightRadius: ms(22),
    overflow: "hidden",
  },
  headerSafe: {
    backgroundColor: COLORS.headerBg,
  },

  body: { flex: 1 },

  scroll: {
    paddingHorizontal: HPAD,
    paddingTop: vs(20),
  },

  amountCard: {
    backgroundColor: COLORS.white,
    borderRadius: ms(12),
    padding: ms(20),
    alignItems: "center",
    marginBottom: vs(24),
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  amountLabel: {
    fontSize: s(13),
    color: COLORS.textMuted,
    fontWeight: "600",
    marginBottom: vs(6),
  },

  amountValue: {
    fontSize: s(30),
    fontWeight: "900",
    color: COLORS.cta,
  },

  sectionTitle: {
    fontSize: s(15),
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: vs(12),
  },

  paymentCard: {
    backgroundColor: COLORS.white,
    borderRadius: ms(12),
    paddingHorizontal: ms(16),
    marginBottom: vs(16),
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },

  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: vs(16),
  },

  radioLabel: {
    flex: 1,
    fontSize: s(15),
    fontWeight: "600",
    color: COLORS.textPrimary,
  },

  radioOuter: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 1.5,
    borderColor: COLORS.radioBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  radioOuterOn: { borderColor: COLORS.cta },

  radioInner: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: COLORS.cta,
  },

  methodDivider: { height: 1, backgroundColor: COLORS.divider },

  cashNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: ms(10),
    padding: ms(12),
    gap: ms(8),
  },

  cashNoteText: {
    flex: 1,
    fontSize: s(13),
    color: "#92400E",
    fontWeight: "500",
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
    paddingHorizontal: HPAD,
    paddingTop: vs(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  footerAmount: {
    fontSize: s(24),
    fontWeight: "900",
    color: COLORS.cta,
  },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.cta,
    borderRadius: ms(10),
    paddingVertical: vs(14),
    paddingHorizontal: ms(24),
  },

  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  ctaText: {
    color: COLORS.ctaText,
    fontSize: s(15),
    fontWeight: "800",
  },
});
