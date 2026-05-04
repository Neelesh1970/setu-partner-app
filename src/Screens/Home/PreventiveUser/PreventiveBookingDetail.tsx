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
import { createPreventiveBooking, getPatients, getSlots } from "./PreventiveHealthAPI";
import {
  getPrimaryCenterId,
  getUserID,
  getPreventivePatientId,
  getPreventiveClientBookedSlotIds,
  recordPreventiveClientBookedSlot,
  savePreventivePatientId,
} from "../../../Utils/storage";

/** Booking API expects `patient_id` as the preventive patient UUID (`/patients[].id`), not the app user id (`user.id`). */
const PATIENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPreventivePatientUuid(value: string | null | undefined): boolean {
  return !!value && PATIENT_UUID_RE.test(String(value).trim());
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
        console.log("getSlots error", e);
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

  const resolvePreventivePatientUuid = useCallback(async (): Promise<
    string | null
  > => {
    const appUserId = await getUserID();
    if (!appUserId) {
      console.log("[PreventiveBookingDetail] Missing user id (verify user.id) in storage");
      return null;
    }

    let pid = await getPreventivePatientId();
    if (!isPreventivePatientUuid(pid)) {
      pid = null;
    }

    if (!pid) {
      try {
        const list = await getPatients();
        if (!list.length) {
          console.log(
            "[PreventiveBookingDetail] No patients from API; cannot resolve patient UUID"
          );
          return null;
        }
        const match = list.find((p) => String(p?.user_id) === String(appUserId));
        const row = match ?? (list.length === 1 ? list[0] : null);
        if (!row?.id) {
          console.log("[PreventiveBookingDetail] No patient row for this user");
          return null;
        }
        pid = String(row.id);
        await savePreventivePatientId(pid);
      } catch (e) {
        console.log("[PreventiveBookingDetail] getPatients error", e);
        return null;
      }
    }

    console.log(
      "[PreventiveBookingDetail] user id (verify user.id):",
      String(appUserId),
      "| patient_id (UUID from /patients):",
      pid
    );
    return pid;
  }, []);

  const onContinue = useCallback(async () => {
    try {
      const patientId = await resolvePreventivePatientUuid();

      if (!patientId) {
        console.log("Missing patient_id (UUID) for booking");
        return;
      }
      if (!centerId) {
        console.log("Missing center id in storage");
        return;
      }
      if (!selectedDateId) {
        console.log("Missing selectedDateId");
        return;
      }
      if (!selectedSlotId) {
        console.log("Missing selectedSlotId");
        return;
      }

      const chosen = slots.find((s) => s.id === selectedSlotId);
      if (!chosen || chosen.disabled) {
        console.log("Selected slot is full or invalid; pick another time.");
        return;
      }

      const payload = {
        patient_id: String(patientId),
        service_type: "center",
        booking_date: String(selectedDateId),
        slot_id: String(selectedSlotId),
        use_cart: true,
        center_id: String(centerId),
      };

      console.log("Booking payload", payload);

      setSubmitting(true);
      try {
        const res = await createPreventiveBooking(payload);
        const bookingId =
          res?.data?.booking_id != null
            ? String(res.data.booking_id)
            : res?.data?.booking?.id != null
              ? String(res.data.booking.id)
              : null;
        const ok = res?.success === true && !!bookingId;
        if (!ok) {
          Alert.alert(
            "Booking",
            res?.message ?? "Could not confirm booking.",
          );
          return;
        }
        await recordPreventiveClientBookedSlot(
          String(centerId),
          String(selectedDateId),
          String(selectedSlotId),
        );
        console.log("[PreventiveBookingDetail] booking id:", bookingId);
        navigation.navigate("PreventiveCheckout", { bookingId });
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as Error).message)
            : "Booking failed";
        console.log("createPreventiveBooking error", e);
        Alert.alert("Booking", msg);
      } finally {
        setSubmitting(false);
      }
    } catch (e) {
      console.log("Continue booking error", e);
    }
  }, [centerId, navigation, resolvePreventivePatientUuid, selectedDateId, selectedSlotId, slots]);

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

      <SafeAreaView style={styles.headerSafe}>
        <PreventiveHealthHeader
          title="Booking details"
          onBackPress={() => navigation.goBack()}
        />
      </SafeAreaView>

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
  headerSafe: {
    backgroundColor: COLORS.headerBg,
    borderBottomLeftRadius: ms(18),
    borderBottomRightRadius: ms(18),
    overflow: "hidden",
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
