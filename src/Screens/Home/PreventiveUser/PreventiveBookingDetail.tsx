import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
  BackHandler,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { ms, s, vs } from "react-native-size-matters";

import PreventiveHealthHeader from "./PreventiveHealthHeader";
import AppSkeleton from "../Components/AppSkeleton";
import { createPreventiveBooking, getSlots } from "./PreventiveHealthAPI";
import { resolvePreventiveBookingIdentity } from "../../../Utils/preventivePatient";
import { PREVENTIVE_BASE_URL } from "../../../api/apiConfig";
import {
  getPrimaryCenterId,
  getPreventiveClientBookedSlotIds,
  getPreventiveMemberAppUserId,
  getPreventivePatientId,
  getRegisteredPatientAuthToken,
  getRegisteredPatientRefreshToken,
  recordPreventiveClientBookedSlot,
} from "../../../Utils/storage";

/** Booking API expects `patient_id` as the preventive patient UUID (`/patients[].id`), not the app user id (`user.id`). */

const LOG_TAG = "[PreventiveBookingDetail]";
const CREATE_BOOKING_URL = `${PREVENTIVE_BASE_URL.replace(/\/$/, "")}/api/v1/bookings`;

function maskToken(token: string | null | undefined): string {
  if (!token) return "(empty)";
  return token.length > 20 ? `${token.slice(0, 20)}…[${token.length} chars]` : token;
}

function formatBookingApiError(e: unknown): string {
  const err = e as {
    message?: string;
    response?: {
      status?: number;
      statusText?: string;
      data?: { message?: string; path?: string; method?: string };
    };
    config?: { method?: string; baseURL?: string; url?: string; data?: unknown };
  };
  const status = err?.response?.status;
  const apiMsg = err?.response?.data?.message;
  const apiPath = err?.response?.data?.path;
  const fullUrl = `${err?.config?.baseURL ?? ""}${err?.config?.url ?? ""}`;

  console.error(`${LOG_TAG} ─── API ERROR ───`);
  console.error(`${LOG_TAG} HTTP status:`, status, err?.response?.statusText ?? "");
  console.error(`${LOG_TAG} API message:`, apiMsg ?? "—");
  console.error(`${LOG_TAG} API path:`, apiPath ?? "—");
  console.error(`${LOG_TAG} Request:`, err?.config?.method?.toUpperCase() ?? "?", fullUrl);
  console.error(`${LOG_TAG} Request body:`, err?.config?.data ?? "—");
  console.error(
    `${LOG_TAG} Response body:`,
    JSON.stringify(err?.response?.data ?? null, null, 2),
  );

  if (status && apiMsg) return `${status}: ${apiMsg}`;
  if (status) return `HTTP ${status}`;
  return err?.message ?? "Booking failed";
}

function logBookingCurl(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);
  console.log(`${LOG_TAG} ─── CURL (replace TOKEN / REFRESH) ───`);
  console.log(
    `curl -X POST "${CREATE_BOOKING_URL}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Authorization: Bearer TOKEN" ` +
      `-H "x-refresh-token: REFRESH" ` +
      `-d '${body}'`,
  );
}

const COLORS = {
  headerBg: "#1C39BB",
  bg: "#FFFFFF",
  textPrimary: "#0F172A",
  textMuted: "#64748B",
  border: "#D1D5DB",
  cardBg: "#FFFFFF",
  cta: "#1C39BB",
  ctaText: "#FFFFFF",
  active: "#1C39BB",
  activeText: "#FFFFFF",
};

const HPAD = ms(16);

function DateCard({
  item,
  selected,
  onPress,
}: {
  item: { month: string; dayNum: string; dow: string };
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.dateCard,
        selected ? styles.dateCardActive : styles.dateCardInactive,
      ]}
    >
      <Text style={[styles.dateMonth, selected ? styles.dateTextActive : null]}>
        {item.month}
      </Text>
      <Text style={[styles.dateDayNum, selected ? styles.dateTextActive : null]}>
        {item.dayNum}
      </Text>
      <Text style={[styles.dateDow, selected ? styles.dateTextActive : null]}>
        {item.dow}
      </Text>
    </TouchableOpacity>
  );
}

function SlotCard({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!!disabled}
      style={[
        styles.slotCard,
        disabled ? styles.slotCardDisabled : null,
        selected ? styles.slotCardActive : styles.slotCardInactive,
      ]}
    >
      <Text style={[styles.slotText, selected ? styles.slotTextActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const hhmm = (t: unknown) => {
  const str = t != null ? String(t) : "";
  return str.length >= 5 ? str.slice(0, 5) : str;
};

function normalizeSlotRows(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.center)) return o.center;
    if (Array.isArray(o.slots)) return o.slots;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

type SlotRow = { id: string; label: string; disabled: boolean; start_time: unknown };

function mapRawSlots(rows: unknown[]): Omit<SlotRow, "start_time">[] {
  const mapped: SlotRow[] = rows
    .map((r, idx) => {
      if (!r || typeof r !== "object") return null;
      const row = r as Record<string, unknown>;
      if (row.is_active === false) return null;

      const id = row.id != null ? String(row.id) : `${idx}`;
      const label =
        row.start_time && row.end_time
          ? `${hhmm(row.start_time)} - ${hhmm(row.end_time)}`
          : row.label
            ? String(row.label)
            : "";

      if (!label) return null;

      const seatsRaw = row.seats_per_slot;
      const bookedRaw = row.booked_seats;
      const seats =
        typeof seatsRaw === "number" ? seatsRaw : Number(String(seatsRaw ?? ""));
      const booked =
        typeof bookedRaw === "number" ? bookedRaw : Number(String(bookedRaw ?? ""));
      const capacityFull =
        Number.isFinite(seats) &&
        seats > 0 &&
        Number.isFinite(booked) &&
        booked >= seats;

      const disabled =
        row.is_slot_full === true ||
        row.is_full === true ||
        (typeof row.available === "number" && row.available <= 0) ||
        capacityFull;

      return {
        id: String(id),
        label: String(label),
        disabled,
        start_time: row.start_time,
      };
    })
    .filter((x): x is SlotRow => x != null);

  mapped.sort((a, b) => {
    const aa = a.start_time != null ? String(a.start_time) : "";
    const bb = b.start_time != null ? String(b.start_time) : "";
    return aa.localeCompare(bb);
  });

  return mapped.map(({ start_time: _st, ...rest }) => rest);
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function buildDateStrip() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const offsets = [-2, -1, 0, 1, 2, 3];
  return offsets.map((off) => {
    const d = new Date(base);
    d.setDate(d.getDate() + off);
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const id = `${yyyy}-${mm}-${dd}`;
    const month = MONTHS_SHORT[d.getMonth()];
    const dayNum = dd;
    const dowRaw = DOW_SHORT[d.getDay()];
    const dow: string = dowRaw === "Sun" ? "sun" : dowRaw;
    return { id, month, dayNum, dow };
  });
}

export default function PreventiveBookingDetail({ navigation }: any) {
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [rawSlotPayload, setRawSlotPayload] = useState<unknown>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [clientBookedSlotIds, setClientBookedSlotIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const dates = useMemo(() => buildDateStrip(), []);

  const slots = useMemo(() => {
    const rows = normalizeSlotRows(rawSlotPayload);
    const base = mapRawSlots(rows);
    const bookedHere = new Set(clientBookedSlotIds);
    return base.map((s) => ({
      ...s,
      disabled: s.disabled || bookedHere.has(s.id),
    }));
  }, [rawSlotPayload, clientBookedSlotIds]);

  /** Keep selection if still available; if it became full/missing, move to next then first open slot. */
  useEffect(() => {
    if (slotsLoading) return;

    setSelectedSlotId((prev) => {
      if (slots.length === 0) return null;

      const idx = prev != null ? slots.findIndex((s) => s.id === prev) : -1;
      if (idx >= 0) {
        const cur = slots[idx];
        if (!cur.disabled) return prev;
        const after = slots.slice(idx + 1).find((s) => !s.disabled);
        if (after) return after.id;
      }

      const firstOpen = slots.find((s) => !s.disabled) ?? null;
      return firstOpen?.id ?? null;
    });
  }, [slots, slotsLoading]);

  const loadCenterId = useCallback(async () => {
    const id = await getPrimaryCenterId();
    setCenterId(id && String(id).trim() ? String(id).trim() : null);
  }, []);

  const fetchSlotsForSelection = useCallback(
    async (centerOverride?: string | null) => {
      const cid =
        centerOverride !== undefined ? centerOverride : centerId;
      if (!selectedDateId || !cid) {
        if (!cid) setRawSlotPayload(null);
        return;
      }
      setSlotsLoading(true);
      try {
        const data = await getSlots({ centerId: cid, date: selectedDateId });
        setRawSlotPayload(data);
      } catch (e) {
        setRawSlotPayload(null);
      } finally {
        setSlotsLoading(false);
      }
    },
    [centerId, selectedDateId]
  );

  const reloadClientBookedSlots = useCallback(
    async (centerOverride?: string | null) => {
      const cid =
        centerOverride !== undefined ? centerOverride : centerId;
      if (!cid || !selectedDateId) {
        setClientBookedSlotIds([]);
        return;
      }
      const ids = await getPreventiveClientBookedSlotIds(cid, selectedDateId);
      setClientBookedSlotIds(ids);
    },
    [centerId, selectedDateId]
  );

  useFocusEffect(
    useCallback(() => {
      if (!selectedDateId && dates?.[2]?.id) setSelectedDateId(dates[2].id);
      loadCenterId();
    }, [dates, loadCenterId, selectedDateId])
  );

  useFocusEffect(
    useCallback(() => {
      void reloadClientBookedSlots();
    }, [reloadClientBookedSlots])
  );

  useEffect(() => {
    fetchSlotsForSelection();
  }, [fetchSlotsForSelection]);

  useEffect(() => {
    void reloadClientBookedSlots();
  }, [reloadClientBookedSlots]);

  const onContinue = useCallback(async () => {
    console.log(`${LOG_TAG} Continue pressed`);
    console.log(`${LOG_TAG} UI state — date:`, selectedDateId, "slot:", selectedSlotId, "center:", centerId);

    try {
      const [cachedPatientId, memberAppUserId, accessToken, refreshToken] =
        await Promise.all([
          getPreventivePatientId(),
          getPreventiveMemberAppUserId(),
          getRegisteredPatientAuthToken(),
          getRegisteredPatientRefreshToken(),
        ]);

      console.log(`${LOG_TAG} Storage — cached preventive_patient_id:`, cachedPatientId ?? "null");
      console.log(`${LOG_TAG} Storage — member app_user_id:`, memberAppUserId ?? "null");
      console.log(`${LOG_TAG} Storage — patient access token:`, maskToken(accessToken));
      console.log(`${LOG_TAG} Storage — patient refresh token:`, maskToken(refreshToken));

      console.log(`${LOG_TAG} Resolving patient UUID + address (profile/patients APIs)…`);
      const { patientId, addressId } = await resolvePreventiveBookingIdentity();
      console.log(`${LOG_TAG} Resolved patient_id for booking payload:`, patientId ?? "null");
      console.log(`${LOG_TAG} Resolved address_id for booking payload:`, addressId ?? "null");

      if (!patientId) {
        console.warn(`${LOG_TAG} Abort — no patient_id resolved`);
        Alert.alert(
          "Booking",
          "Could not find your patient profile. Please reopen Preventive Health and try again.",
        );
        return;
      }
      if (!centerId) {
        console.warn(`${LOG_TAG} Abort — centerId missing`);
        Alert.alert("Booking", "Center is not configured. Please reopen Preventive Health.");
        return;
      }
      if (!selectedDateId) {
        console.warn(`${LOG_TAG} Abort — no date selected`);
        return;
      }
      if (!selectedSlotId) {
        console.warn(`${LOG_TAG} Abort — no slot selected`);
        return;
      }

      const chosen = slots.find((s) => s.id === selectedSlotId);
      if (!chosen || chosen.disabled) {
        console.warn(`${LOG_TAG} Abort — slot missing or disabled`, chosen);
        return;
      }

      const payload: Record<string, unknown> = {
        patient_id: String(patientId),
        service_type: "center",
        booking_date: String(selectedDateId),
        slot_id: String(selectedSlotId),
        use_cart: true,
        center_id: String(centerId),
      };
      if (addressId) {
        payload.address_id = String(addressId);
      }

      console.log(`${LOG_TAG} ─── CREATE BOOKING ───`);
      console.log(`${LOG_TAG} POST ${CREATE_BOOKING_URL}`);
      console.log(`${LOG_TAG} Payload:`, JSON.stringify(payload, null, 2));
      if (patientId === memberAppUserId) {
        console.warn(
          `${LOG_TAG} Note: patient_id equals app_user_id — if API expects a separate patients-row id, booking may fail.`,
        );
      }
      logBookingCurl(payload);

      setSubmitting(true);
      try {
        const res = await createPreventiveBooking(payload);
        console.log(`${LOG_TAG} Booking API success response:`, JSON.stringify(res, null, 2));

        const bookingId =
          res?.data?.booking_id != null
            ? String(res.data.booking_id)
            : res?.data?.booking?.id != null
              ? String(res.data.booking.id)
              : null;
        const ok = res?.success === true && !!bookingId;
        if (!ok) {
          console.warn(`${LOG_TAG} Booking rejected — success=${String(res?.success)} bookingId=${bookingId ?? "null"}`);
          Alert.alert(
            "Booking",
            res?.message ?? "Could not confirm booking.",
          );
          return;
        }
        console.log(`${LOG_TAG} Booking created — navigating to PreventiveCheckout, bookingId:`, bookingId);
        await recordPreventiveClientBookedSlot(
          String(centerId),
          String(selectedDateId),
          String(selectedSlotId),
        );
        navigation.navigate("PreventiveCheckout", { bookingId });
      } catch (e: unknown) {
        Alert.alert("Booking", formatBookingApiError(e));
      } finally {
        setSubmitting(false);
      }
    } catch (e: unknown) {
      console.error(`${LOG_TAG} Unexpected error in onContinue:`, e);
      Alert.alert("Booking", formatBookingApiError(e));
    }
  }, [centerId, navigation, selectedDateId, selectedSlotId, slots]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const raw = await getPrimaryCenterId();
      const normalized =
        raw && String(raw).trim() ? String(raw).trim() : null;
      setCenterId(normalized);
      await fetchSlotsForSelection(normalized);
      await reloadClientBookedSlots();
    } finally {
      setRefreshing(false);
    }
  }, [fetchSlotsForSelection, reloadClientBookedSlots]);

  useFocusEffect(
    useCallback(() => {
      let isNavigating = false;

      const handleBack = () => {
        if (isNavigating) return true;
        isNavigating = true;
        navigation.goBack();
        return true;
      };

      let backSub: { remove: () => void } | undefined;
      if (Platform.OS === "android") {
        backSub = BackHandler.addEventListener("hardwareBackPress", handleBack);
      }

      return () => {
        backSub?.remove();
      };
    }, [navigation])
  );

  const selectedSlotRow = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) ?? null,
    [slots, selectedSlotId]
  );

  const ctaDisabled =
    submitting ||
    !selectedSlotId ||
    slots.length === 0 ||
    !centerId ||
    !selectedSlotRow ||
    selectedSlotRow.disabled;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <View style={styles.headerShell}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <PreventiveHealthHeader
            title="Booking details"
            onBackPress={() => navigation.goBack()}
          />
        </SafeAreaView>
      </View>

      <SafeAreaView style={styles.bodySafe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <Text style={styles.sectionTitle}>Select date</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesRow}
          >
            {dates.map((d) => (
              <DateCard
                key={d.id}
                item={d}
                selected={selectedDateId === d.id}
                onPress={() => setSelectedDateId(d.id)}
              />
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { marginTop: vs(18) }]}>
            Select time slot
          </Text>

          <View style={styles.slotsWrap}>
            {slotsLoading ? (
              <View style={styles.slotsSkeletonWrap} pointerEvents="none">
                <AppSkeleton variant="default" />
              </View>
            ) : !centerId ? (
              <View style={{ width: "100%", alignItems: "center", marginTop: 20 }}>
                <Text style={{ fontSize: 14, color: "#64748B", fontWeight: "600" }}>
                  Center is not configured. Please reopen Preventive Health.
                </Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={{ width: "100%", alignItems: "center", marginTop: 20 }}>
                <Text style={{ fontSize: 14, color: "#64748B", fontWeight: "600" }}>
                  No slots are available
                </Text>
              </View>
            ) : (
              slots.map((sl) => (
                <SlotCard
                  key={sl.id}
                  label={sl.label}
                  selected={selectedSlotId === sl.id && !sl.disabled}
                  disabled={!!sl.disabled}
                  onPress={() => {
                    if (sl.disabled) return;
                    setSelectedSlotId(sl.id);
                  }}
                />
              ))
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.cta, ctaDisabled && { opacity: 0.5 }]}
            disabled={ctaDisabled}
            onPress={onContinue}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.ctaText} />
            ) : (
              <Text style={styles.ctaText}>Continue</Text>
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
    borderBottomLeftRadius: ms(18),
    borderBottomRightRadius: ms(18),
    overflow: "hidden",
  },
  headerSafe: {
    backgroundColor: COLORS.headerBg,
  },
  bodySafe: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: {
    paddingHorizontal: HPAD,
    paddingTop: vs(18),
    paddingBottom: vs(130),
  },
  sectionTitle: {
    fontSize: s(14),
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  datesRow: {
    paddingVertical: vs(12),
    columnGap: ms(10),
  },
  dateCard: {
    width: ms(58),
    borderRadius: ms(8),
    paddingVertical: vs(10),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  dateCardInactive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  dateCardActive: {
    borderColor: COLORS.active,
    backgroundColor: COLORS.active,
  },
  dateMonth: {
    fontSize: s(12),
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  dateDayNum: {
    fontSize: s(18),
    fontWeight: "900",
    color: COLORS.textPrimary,
    marginTop: vs(4),
  },
  dateDow: {
    fontSize: s(12),
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: vs(4),
    textTransform: "none",
  },
  dateTextActive: {
    color: COLORS.activeText,
  },
  slotsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: vs(14),
    marginTop: vs(12),
  },
  slotsSkeletonWrap: {
    width: "100%",
    height: vs(170),
    overflow: "hidden",
  },
  slotCard: {
    width: "31.5%",
    borderRadius: ms(6),
    borderWidth: 1,
    paddingVertical: vs(12),
    alignItems: "center",
    justifyContent: "center",
  },
  slotCardInactive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  slotCardActive: {
    borderColor: COLORS.active,
    backgroundColor: COLORS.active,
  },
  slotCardDisabled: {
    opacity: 0.45,
  },
  slotText: {
    fontSize: s(12),
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  slotTextActive: {
    color: COLORS.activeText,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: HPAD,
    paddingTop: vs(12),
    paddingBottom: Platform.OS === "ios" ? vs(18) : vs(16),
    backgroundColor: COLORS.bg,
  },
  cta: {
    backgroundColor: COLORS.cta,
    borderRadius: ms(26),
    paddingVertical: vs(14),
    alignItems: "center",
  },
  ctaText: {
    color: COLORS.ctaText,
    fontSize: s(16),
    fontWeight: "800",
  },
});
