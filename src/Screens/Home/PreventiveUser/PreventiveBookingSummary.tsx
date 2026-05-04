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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { ms, s, vs } from "react-native-size-matters";
import PreventiveHealthHeader from "./PreventiveHealthHeader";
import AppSkeleton from "../Components/AppSkeleton";
import { getBooking } from "../../../api/preventivePayment";
import { COLORS as THEME } from "../../../Constants/theme";

const COLORS = {
  headerBg: THEME.PRIMARY,
  bg: "#FFFFFF",
  textPrimary: "#000000",
  textSecondary: "#6B6B6B",
  cardBorder: "#E0E5F0",
  cta: THEME.PRIMARY,
};

const HPAD = ms(16);

function pickString(obj: unknown, keys: string[]): string {
  if (obj == null || typeof obj !== "object") return "—";
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "—";
}

function capitalizeFirstWord(s: string): string {
  const t = s.trim();
  if (!t) return "—";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function normalizeItems(booking: Record<string, unknown> | null): Record<string, unknown>[] {
  if (booking == null) return [];
  const raw = booking.items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x != null && typeof x === "object") as Record<string, unknown>[];
}

export default function PreventiveBookingSummary({ navigation }: { navigation: any }) {
  const route = useRoute<any>();
  const bookingId = route.params?.bookingId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) {
      setLoading(false);
      Alert.alert("Booking", "Missing booking id.");
      return;
    }
    setLoading(true);
    try {
      const res = await getBooking(bookingId);
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
            items: inner.items ?? d.items,
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
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as Error).message)
          : "Failed to load booking";
      console.log("getBooking error", e);
      Alert.alert("Booking", msg);
      setBooking(null);
      setPayment(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patient =
    booking?.patient != null && typeof booking.patient === "object"
      ? (booking.patient as Record<string, unknown>)
      : null;

  const items = normalizeItems(booking);
  const firstItem = items[0] ?? null;

  const packageName = (() => {
    if (firstItem == null) return "—";
    const pkg = pickString(firstItem, ["source_package_name"]);
    if (pkg !== "—") return pkg;
    return pickString(firstItem, ["device_name"]);
  })();

  const testNames = items
    .map((it) => pickString(it, ["device_name"]))
    .filter((n) => n !== "—");

  const totalPrice = pickString(booking, ["total_price"]);
  const paymentStatusBooking = pickString(booking, ["payment_status"]);
  const paymentStatusPayment = pickString(payment, ["status"]);

  const displayStatusRaw =
    paymentStatusBooking !== "—" ? paymentStatusBooking : paymentStatusPayment;
  const displayPaymentStatus =
    displayStatusRaw === "—"
      ? "—"
      : displayStatusRaw.toLowerCase() === "success"
        ? "Paid"
        : capitalizeFirstWord(displayStatusRaw);

  const patientName = pickString(patient, ["full_name"]);
  const patientAge = patient?.age != null ? String(patient.age) : "—";
  const patientGender = capitalizeFirstWord(pickString(patient, ["gender"]));
  const patientPhone = pickString(patient, ["phone"]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title="Test details"
          onBackPress={() => navigation.navigate("PreventiveHealth")}
        />
      </SafeAreaView>

      <SafeAreaView style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {loading ? (
            <View style={styles.skeletonWrap} pointerEvents="none">
              <AppSkeleton variant="default" />
            </View>
          ) : (
            <>
              <Text style={styles.sectionHeading}>Patient Details</Text>
              <Card>
                <Row label="Patient Name" value={patientName} isLast={false} />
                <Row label="Age" value={patientAge} isLast={false} />
                <Row label="Gender" value={patientGender} isLast={false} />
                <Row label="Contact Number" value={patientPhone} isLast />
              </Card>

              <Text style={[styles.sectionHeading, styles.sectionHeadingSpaced]}>
                Test Details
              </Text>
              <Card>
                <Row label="Package Name" value={packageName} isLast={false} />
                <TestNamesRow names={testNames} />
              </Card>

              <Text style={[styles.sectionHeading, styles.sectionHeadingSpaced]}>
                Payment Info
              </Text>
              <Card>
                <Row
                  label="Amount"
                  value={totalPrice !== "—" ? `₹${totalPrice}` : "—"}
                  isLast={false}
                />
                <Row label="Payment Status" value={displayPaymentStatus} isLast />
              </Card>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate("PreventiveHealth")}
          >
            <Text style={styles.ctaText}>Perform Test</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const valueTextAndroidProps =
  Platform.OS === "android"
    ? ({
        textBreakStrategy: "simple" as const,
        android_hyphenationFrequency: "none" as const,
      })
    : {};

function Row({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, isLast ? styles.rowLast : null]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueWrap}>
        <Text style={styles.value} {...valueTextAndroidProps}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function TestNamesRow({ names }: { names: string[] }) {
  return (
    <View style={[styles.row, styles.rowLast]}>
      <Text style={styles.label}>Test</Text>
      <View style={styles.valueWrap}>
        {names.length === 0 ? (
          <Text style={styles.value} {...valueTextAndroidProps}>
            —
          </Text>
        ) : (
          names.map((n, i) => (
            <Text
              key={`${n}-${i}`}
              style={[styles.value, i > 0 ? styles.testNameLine : null]}
              {...valueTextAndroidProps}
            >
              {n}
            </Text>
          ))
        )}
      </View>
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

  body: { flex: 1, backgroundColor: COLORS.bg },

  scroll: {
    paddingHorizontal: HPAD,
    paddingTop: vs(20),
    paddingBottom: vs(100),
  },

  skeletonWrap: {
    width: "100%",
    height: vs(320),
    marginTop: vs(8),
    overflow: "hidden",
  },

  sectionHeading: {
    fontSize: s(17),
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: vs(10),
  },

  sectionHeadingSpaced: {
    marginTop: vs(20),
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: ms(12),
    paddingHorizontal: ms(14),
    paddingVertical: ms(14),
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: vs(14),
    gap: ms(12),
  },

  rowLast: {
    marginBottom: 0,
  },

  label: {
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: "38%",
    fontSize: s(15),
    color: COLORS.textSecondary,
  },

  /**
   * Fills remaining row width so Text measures at full width (avoids shrink-wrap +
   * mid-word breaks). Do not use alignItems "flex-end" here — it narrows Text.
   */
  valueWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "stretch",
  },

  value: {
    width: "100%",
    fontSize: s(15),
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "right",
  },

  testNameLine: {
    marginTop: vs(6),
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingHorizontal: HPAD,
    paddingTop: vs(12),
    paddingBottom: Platform.OS === "ios" ? vs(20) : vs(14),
  },

  cta: {
    backgroundColor: COLORS.cta,
    borderRadius: ms(32),
    paddingVertical: vs(14),
    alignItems: "center",
  },

  ctaText: {
    color: "#FFFFFF",
    fontSize: s(16),
    fontWeight: "700",
  },
});
