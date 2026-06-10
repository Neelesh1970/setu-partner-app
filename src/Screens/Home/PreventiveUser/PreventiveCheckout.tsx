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
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { ms, s, vs } from "react-native-size-matters";
import PreventiveHealthHeader from "./PreventiveHealthHeader";
import AppSkeleton from "../Components/AppSkeleton";
import { getBookingCheckout } from "./PreventiveHealthAPI";

const COLORS = {
  headerBg: "#1C39BB",
  bg: "#F8FAFC",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  divider: "#E2E8F0",
  cta: "#1D4ED8",
};

const HPAD = ms(16);

const format = (n: number) => `₹${n.toFixed(2)}`;

const BillRow = ({ label, value, bold }: any) => (
  <View style={styles.row}>
    <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
    <Text style={[styles.value, bold && styles.bold]}>
      {format(value)}
    </Text>
  </View>
);

type BillState = {
  packagePrice: number;
  deviceUsageFee: number;
  technicianFee: number;
  consumablesCharge: number;
  reportFee: number;
  amountPayable: number;
};

const DEFAULT_BILL: BillState = {
  packagePrice: 0,
  deviceUsageFee: 0,
  technicianFee: 0,
  consumablesCharge: 0,
  reportFee: 0,
  amountPayable: 0,
};

export default function PreventiveCheckout({ navigation }: any) {
  const route = useRoute<any>();
  const bookingId = route.params?.bookingId as string | undefined;

  useEffect(() => {
    if (bookingId) {
    }
  }, [bookingId]);

  useEffect(() => {
    let isNavigating = false;

    const handleBack = () => {
      if (isNavigating) return true;
      isNavigating = true;
      navigation.goBack();
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

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<BillState>(DEFAULT_BILL);

  const loadCheckout = useCallback(async () => {
    if (!bookingId) {
      setLoading(false);
      Alert.alert("Checkout", "Missing booking. Go back and try again.");
      return;
    }
    setLoading(true);
    try {
      const res = await getBookingCheckout(bookingId);
      const bd = res?.data?.bill_details;
      if (!bd) {
        Alert.alert(
          "Checkout",
          res?.message ?? "Could not load bill details.",
        );
        setBill(DEFAULT_BILL);
        return;
      }
      setBill({
        packagePrice: Number(bd.package_price ?? 0),
        deviceUsageFee: Number(bd.device_usage_fee ?? 0),
        technicianFee: Number(bd.technician_fee ?? 0),
        consumablesCharge: Number(bd.consumables_charge ?? 0),
        reportFee: Number(bd.report_generation_fee ?? 0),
        amountPayable: Number(bd.amount_payable ?? 0),
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as Error).message)
          : "Failed to load checkout";
      Alert.alert("Checkout", msg);
      setBill(DEFAULT_BILL);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void loadCheckout();
  }, [loadCheckout]);

  const handleContinue = async () => {
    if (!bookingId) {
      Alert.alert("Checkout", "Missing booking. Go back and try again.");
      return;
    }
    setSubmitting(true);
    try {
      navigation.navigate("PreventivePayment", {
        bookingId,
        amountPayable: bill.amountPayable,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* HEADER */}
      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="Checkout"
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>

      {/* BODY */}
      <SafeAreaView style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* BILL DETAILS */}
          <Text style={styles.sectionTitle}>Bill details</Text>

          {loading ? (
            <View style={styles.billSkeletonWrap} pointerEvents="none">
              <AppSkeleton variant="default" />
            </View>
          ) : (
            <>
              <BillRow label="Package Price" value={bill.packagePrice} />
              <BillRow label="Device Usage Fee" value={bill.deviceUsageFee} />
              <BillRow
                label="Technician / Screening Fee"
                value={bill.technicianFee}
              />
              <BillRow
                label="Consumables Charge"
                value={bill.consumablesCharge}
              />
              <BillRow
                label="Report Generation Fee"
                value={bill.reportFee}
              />

              <View style={styles.divider} />

              <BillRow
                label="Amount Payable"
                value={bill.amountPayable}
                bold
              />
            </>
          )}
        </ScrollView>

        {/* FOOTER */}
        <View style={styles.footer}>
          {loading ? (
            <View style={styles.footerAmountSkeleton} pointerEvents="none">
              <AppSkeleton variant="default" />
            </View>
          ) : (
            <Text style={styles.amount}>₹{bill.amountPayable}</Text>
          )}

          <TouchableOpacity
            style={[styles.cta, (submitting || loading) && { opacity: 0.7 }]}
            disabled={submitting || loading || !bookingId}
            onPress={handleContinue}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Continue to payment</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

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
    paddingBottom: vs(120),
  },

  billSkeletonWrap: {
    width: "100%",
    height: vs(280),
    marginBottom: vs(8),
    overflow: "hidden",
  },

  footerAmountSkeleton: {
    width: ms(100),
    height: vs(34),
    overflow: "hidden",
    borderRadius: ms(6),
  },

  sectionTitle: {
    fontSize: s(18),
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: vs(14),
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(18),
  },

  label: {
    fontSize: s(15),
    color: COLORS.textSecondary,
  },

  value: {
    fontSize: s(15),
    fontWeight: "600",
    color: COLORS.textPrimary,
  },

  bold: {
    fontWeight: "800",
    color: COLORS.textPrimary,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: vs(14),
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  amount: {
    fontSize: s(26),
    fontWeight: "800",
    color: COLORS.cta,
  },

  cta: {
    backgroundColor: COLORS.cta,
    borderRadius: ms(10),
    paddingVertical: vs(14),
    paddingHorizontal: ms(28),
  },

  ctaText: {
    color: "#FFFFFF",
    fontSize: s(16),
    fontWeight: "700",
  },
});
