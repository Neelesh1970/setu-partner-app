import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { ms, s, vs } from "react-native-size-matters";
import RazorpayCheckout from "react-native-razorpay";
import PreventiveHealthHeader from "./PreventiveHealthHeader";
import { getBookingCheckout } from "./PreventiveHealthAPI";
import {
  payUpi,
  payCash,
  verifyRazorpay,
} from "../../../api/preventivePayment";
import { getUser } from "../../../Utils/storage";

const COLORS = {
  headerBg: "#1C39BB",
  bg: "#F8FAFC",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  divider: "#E2E8F0",
  cta: "#1D4ED8",
};

const HPAD = ms(16);

const RadioRow = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.radioRow} onPress={onPress}>
    <Text style={styles.radioText}>{label}</Text>
    <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
      {selected && <View style={styles.radioInner} />}
    </View>
  </TouchableOpacity>
);

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
  const key = String(
    d.razorpay_key_id ?? d.key_id ?? d.key ?? "",
  ).trim();
  const orderId = String(
    d.razorpay_order_id ?? d.order_id ?? "",
  ).trim();
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
  const desc = String(
    e.description ?? e.error?.description ?? "",
  ).toLowerCase();
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

export default function PreventivePayment({ navigation }: { navigation: any }) {
  const route = useRoute<any>();
  const bookingId = route.params?.bookingId as string | undefined;
  const amountPayableParam = route.params?.amountPayable as number | undefined;

  const [paymentMode, setPaymentMode] = useState<"upi" | "cash">("upi");
  const [processing, setProcessing] = useState(false);
  const [amountPayable, setAmountPayable] = useState<number>(
    typeof amountPayableParam === "number" && Number.isFinite(amountPayableParam)
      ? amountPayableParam
      : 0,
  );

  const loadAmountIfNeeded = useCallback(async () => {
    if (
      typeof amountPayableParam === "number" &&
      Number.isFinite(amountPayableParam) &&
      amountPayableParam > 0
    ) {
      setAmountPayable(amountPayableParam);
      return;
    }
    if (!bookingId) return;
    try {
      const res = await getBookingCheckout(bookingId);
      const ap = res?.data?.bill_details?.amount_payable;
      if (ap != null && Number.isFinite(Number(ap))) {
        setAmountPayable(Number(ap));
      }
    } catch {
      // ignore; display stays 0 until user pays
    }
  }, [amountPayableParam, bookingId]);

  useEffect(() => {
    void loadAmountIfNeeded();
  }, [loadAmountIfNeeded]);

  const handleUpiPayment = async () => {
    if (!bookingId) {
      Alert.alert("Payment", "Missing booking.");
      return;
    }
    setProcessing(true);
    try {
      const orderRes = await payUpi(bookingId);
      const order = extractUpiOrderFromResponse(orderRes);
      if (!order) {
        Alert.alert(
          "Payment",
          (orderRes as { message?: string })?.message ??
            "Could not start UPI payment. Invalid order from server.",
        );
        return;
      }

      const user = await getUser<{
        mobile?: string;
        phone?: string;
        email?: string;
      }>();
      const contact = String(user?.mobile ?? user?.phone ?? "").replace(/\D/g, "");
      const email = String(user?.email ?? "").trim() || "user@example.com";

      const sdkData = await RazorpayCheckout.open({
        key: order.key,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Booking payment",
        description: "Preventive health booking",
        prefill: {
          contact: contact.length >= 10 ? contact : undefined,
          email,
        },
        theme: { color: "#1C39BB" },
      });

      const payload = extractSdkPaymentIds(sdkData as Record<string, unknown>);
      if (!payload) {
        Alert.alert("Payment", "Missing payment details from Razorpay.");
        return;
      }

      const verifyRes = await verifyRazorpay(bookingId, payload);
      if (verifyRes?.success !== true) {
        Alert.alert(
          "Payment",
          verifyRes?.message ?? "Payment verification failed.",
        );
        return;
      }

      navigation.replace("PreventiveBookingSummary", { bookingId });
    } catch (e: unknown) {
      if (isRazorpayUserCancelled(e)) {
        Alert.alert("Payment", "Payment cancelled.");
        return;
      }
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as Error).message)
          : "Payment failed";
      console.log("Pay UPI error", e);
      Alert.alert("Payment", msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleCashPayment = async () => {
    if (!bookingId) {
      Alert.alert("Payment", "Missing booking.");
      return;
    }
    setProcessing(true);
    try {
      const res = await payCash(bookingId);
      if (res?.success !== true) {
        Alert.alert("Payment", res?.message ?? "Cash payment could not be recorded.");
        return;
      }
      navigation.replace("PreventiveBookingSummary", { bookingId });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as Error).message)
          : "Failed to confirm cash payment";
      console.log("Pay cash error", e);
      Alert.alert("Payment", msg);
    } finally {
      setProcessing(false);
    }
  };

  const onPrimaryPress = () => {
    if (paymentMode === "upi") void handleUpiPayment();
    else void handleCashPayment();
  };

  const primaryLabel =
    paymentMode === "upi" ? "Pay Now" : "Continue";

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title="Payment"
          onBackPress={() => navigation.goBack()}
        />
      </SafeAreaView>

      <SafeAreaView style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <Text style={styles.amountLabel}>Amount payable</Text>
          <Text style={styles.amount}>₹{amountPayable}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Payment mode</Text>
          <RadioRow
            label="UPI"
            selected={paymentMode === "upi"}
            onPress={() => setPaymentMode("upi")}
          />
          <RadioRow
            label="Cash"
            selected={paymentMode === "cash"}
            onPress={() => setPaymentMode("cash")}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, processing && { opacity: 0.75 }]}
            disabled={processing || !bookingId}
            onPress={onPrimaryPress}
          >
            {processing ? (
              <View style={styles.ctaProcessing}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.ctaText}>Processing...</Text>
              </View>
            ) : (
              <Text style={styles.ctaText}>{primaryLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  headerSafe: {
    backgroundColor: COLORS.headerBg,
    borderBottomLeftRadius: ms(22),
    borderBottomRightRadius: ms(22),
    overflow: "hidden",
  },

  body: { flex: 1 },

  scroll: {
    paddingHorizontal: HPAD,
    paddingTop: vs(24),
    paddingBottom: vs(100),
  },

  amountLabel: {
    fontSize: s(18),
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: vs(8),
  },

  amount: {
    fontSize: s(26),
    fontWeight: "800",
    color: COLORS.cta,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: vs(20),
  },

  sectionTitle: {
    fontSize: s(18),
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: vs(14),
  },

  radioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: vs(14),
  },

  radioText: {
    fontSize: s(15),
    color: COLORS.textPrimary,
  },

  radioOuter: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  radioOuterActive: {
    borderColor: COLORS.cta,
  },

  radioInner: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: COLORS.cta,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingHorizontal: HPAD,
    paddingTop: vs(12),
    paddingBottom: Platform.OS === "ios" ? vs(20) : vs(14),
  },

  cta: {
    backgroundColor: COLORS.cta,
    borderRadius: ms(10),
    paddingVertical: vs(14),
    alignItems: "center",
  },

  ctaProcessing: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
  },

  ctaText: {
    color: "#FFFFFF",
    fontSize: s(16),
    fontWeight: "700",
  },
});
