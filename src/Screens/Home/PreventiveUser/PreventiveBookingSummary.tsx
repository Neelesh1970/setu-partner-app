import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ms, s, vs } from "react-native-size-matters";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import PreventiveHealthHeader from "./PreventiveHealthHeader";
import { getBooking } from "../../../api/preventivePayment";
import type { RootStackParamList } from "../../../navigation/types";

/* ─────────────────────────── constants ─────────────────────────── */

const COLORS = {
  headerBg:   "#1C39BB",
  bg:         "#F8FAFC",
  textPrimary:"#0F172A",
  textMuted:  "#64748B",
  divider:    "#E2E8F0",
  cta:        "#1D4ED8",
  ctaText:    "#FFFFFF",
  success:    "#16A34A",
  pending:    "#D97706",
  cardBg:     "#FFFFFF",
  cardBorder: "#E2E8F0",
};

const HPAD = ms(16);

/* ─────────────────────── InfoRow subcomponent ───────────────────── */

type InfoRowProps = { label: string; value: string; valueColor?: string };

function InfoRow({ label, value, valueColor }: InfoRowProps): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

/* ─────────────────────────── component ─────────────────────────── */

type Props = NativeStackScreenProps<RootStackParamList, "PreventiveBookingSummary">;

export default function PreventiveBookingSummary({ navigation, route }: Props): React.JSX.Element {
  const bookingId = route.params?.bookingId;

  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  /* ── fetch booking detail ── */

  useEffect(() => {
    if (!bookingId) return;

    async function fetchBooking(): Promise<void> {
      setLoading(true);
      try {
        const res  = await getBooking(bookingId as string);
        const data = res?.data;
        let b: Record<string, unknown> | null = null;
        let p: Record<string, unknown> | null = null;

        if (data != null && typeof data === "object") {
          const d = data as Record<string, unknown>;

          if (d.booking != null && typeof d.booking === "object") {
            const inner = d.booking as Record<string, unknown>;
            b = {
              ...inner,
              patient: inner.patient ?? d.patient,
              items:   inner.items   ?? d.items,
            };
          } else if (d.id != null || d.total_price != null) {
            b = d;
          }

          if (d.payment != null && typeof d.payment === "object") {
            p = d.payment as Record<string, unknown>;
          }
          if (!p && b?.payment != null && typeof b.payment === "object") {
            p = b.payment as Record<string, unknown>;
          }
        }

        setBooking(b);
        setPayment(p);
      } catch (e) {
        console.log("[PreventiveBookingSummary] fetch error", e);
      } finally {
        setLoading(false);
      }
    }

    void fetchBooking();
  }, [bookingId]);

  /* ── hardware back → home ── */

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

  /* ── derived display values ── */

  const displayBookingId = String(booking?.id ?? bookingId ?? "—");
  const amount           = Number(booking?.total_price ?? 0);
  const serviceType      = String(booking?.service_type ?? "—");

  const paymentStatusRaw = String(
    booking?.payment_status ?? payment?.status ?? "—",
  );
  const isSuccess =
    paymentStatusRaw.toLowerCase() === "paid" ||
    paymentStatusRaw.toLowerCase() === "success";
  const displayStatus = isSuccess
    ? "Paid"
    : paymentStatusRaw !== "—"
    ? paymentStatusRaw.charAt(0).toUpperCase() + paymentStatusRaw.slice(1).toLowerCase()
    : "—";
  const statusColor = isSuccess ? COLORS.success : COLORS.pending;

  const paymentMethodRaw = String(payment?.payment_method ?? "—");
  const paymentMethod    =
    paymentMethodRaw !== "—" ? paymentMethodRaw.toUpperCase() : "—";
  const methodIcon: string =
    paymentMethod === "UPI" ? "phone-portrait-outline" : "cash-outline";

  /* ── render ── */

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title="Booking Summary"
          onBackPress={() => navigation.navigate("PreventiveHealth")}
        />
      </SafeAreaView>

      <SafeAreaView style={styles.body}>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={COLORS.cta} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {/* Status badge */}
            <View style={[styles.badge, { borderColor: statusColor }]}>
              <Ionicons
                name={isSuccess ? "checkmark-circle" : "time-outline"}
                size={ms(40)}
                color={statusColor}
              />
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {isSuccess ? "Payment Successful" : "Booking Confirmed"}
              </Text>
            </View>

            {/* Booking details card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Booking Details</Text>
              <View style={styles.cardDivider} />
              <InfoRow label="Booking ID"     value={displayBookingId} />
              <InfoRow label="Service Type"   value={serviceType} />
              <InfoRow label="Amount"         value={`₹${amount.toFixed(2)}`} />
              <InfoRow label="Payment Method" value={paymentMethod} />
              <InfoRow
                label="Status"
                value={displayStatus}
                valueColor={statusColor}
              />
            </View>

            {/* Payment method strip */}
            <View style={styles.methodStrip}>
              <Ionicons name={methodIcon} size={ms(22)} color={COLORS.cta} />
              <Text style={styles.methodText}>
                {paymentMethod === "UPI"
                  ? "Paid via UPI"
                  : "Cash payment selected — Amount will be collected at the time of visit."}
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.cta}
            onPress={() => navigation.navigate("TestActivity", {})}
          >
            <Text style={styles.ctaText}>View My Bookings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────── styles ────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  headerSafe: {
    backgroundColor: COLORS.headerBg,
    borderBottomLeftRadius: ms(22),
    borderBottomRightRadius: ms(22),
    overflow: "hidden",
  },

  body: { flex: 1 },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  scroll: {
    paddingHorizontal: HPAD,
    paddingTop: vs(24),
    paddingBottom: vs(100),
  },

  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: ms(14),
    paddingVertical: vs(24),
    marginBottom: vs(20),
  },

  badgeText: {
    marginTop: vs(10),
    fontSize: s(17),
    fontWeight: "800",
  },

  card: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: ms(12),
    padding: ms(16),
    marginBottom: vs(16),
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },

  cardTitle: {
    fontSize: s(15),
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: vs(10),
  },

  cardDivider: { height: 1, backgroundColor: COLORS.divider, marginBottom: vs(10) },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: vs(7),
  },

  infoLabel: {
    fontSize: s(13),
    fontWeight: "600",
    color: COLORS.textMuted,
    flex: 1,
  },

  infoValue: {
    fontSize: s(13),
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "right",
    flex: 1,
  },

  methodStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: ms(10),
    paddingHorizontal: ms(14),
    paddingVertical: vs(14),
    gap: ms(10),
  },

  methodText: {
    flex: 1,
    fontSize: s(13),
    fontWeight: "600",
    color: COLORS.textPrimary,
  },

  footer: {
    paddingHorizontal: HPAD,
    paddingTop: vs(12),
    paddingBottom: Platform.OS === "ios" ? vs(24) : vs(18),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.cardBg,
  },

  cta: {
    backgroundColor: COLORS.cta,
    borderRadius: ms(10),
    paddingVertical: vs(15),
    alignItems: "center",
    justifyContent: "center",
  },

  ctaText: {
    color: COLORS.ctaText,
    fontSize: s(15),
    fontWeight: "800",
  },
});
