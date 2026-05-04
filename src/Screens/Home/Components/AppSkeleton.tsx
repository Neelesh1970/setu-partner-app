import React, { memo, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: W } = Dimensions.get("window");
const BANNER_CARD_HEIGHT = Math.min(W * 0.43, 190);
const BANNER_FULL_SLOT_HEIGHT = 40 + BANNER_CARD_HEIGHT;

interface BlockProps {
  style?: ViewStyle;
  shimmerStyle: { transform: { translateX: Animated.Value }[] };
}

function Block({ style, shimmerStyle }: BlockProps) {
  return (
    <View style={[styles.block, style]}>
      <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]} />
    </View>
  );
}

type SkeletonVariant =
  | "default"
  | "booktest_home"
  | "banner_carousel"
  | "list"
  | "card"
  | "generic_compare"
  | "generic_list"
  | "generic_address"
  | "generic_prescription_grid";

interface AppSkeletonProps {
  variant?: SkeletonVariant;
}

/**
 * AppSkeleton
 * usage: <AppSkeleton variant="booktest_home" />
 * variants: "default" | "booktest_home" | "banner_carousel" | "list" | "card"
 *           "generic_compare" | "generic_list" | "generic_address" | "generic_prescription_grid"
 */
const AppSkeleton = memo(function AppSkeleton({ variant = "default" }: AppSkeletonProps) {
  const x = useRef(new Animated.Value(-W)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: W,
        duration: 1100,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [x]);

  const shimmerStyle = { transform: [{ translateX: x }] };

  /* ── banner_carousel ─────────────────────────────────────────── */
  if (variant === "banner_carousel") {
    return (
      <View style={{ height: BANNER_FULL_SLOT_HEIGHT, justifyContent: "center" }}>
        <Block
          style={{
            height: BANNER_CARD_HEIGHT,
            width: W * 0.86,
            borderRadius: 16,
            alignSelf: "center",
          }}
          shimmerStyle={shimmerStyle}
        />
      </View>
    );
  }

  /* ── booktest_home ───────────────────────────────────────────── */
  if (variant === "booktest_home") {
    return (
      <View style={styles.screen}>
        <Block style={{ height: 64, borderRadius: 0, marginBottom: 12 }} shimmerStyle={shimmerStyle} />
        <Block style={{ height: 44, borderRadius: 8, marginHorizontal: 14, marginBottom: 14 }} shimmerStyle={shimmerStyle} />
        <Block style={{ height: 200, borderRadius: 16, marginHorizontal: 14, marginBottom: 14 }} shimmerStyle={shimmerStyle} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: 14, marginBottom: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Block
              key={`pill-${i}`}
              style={{ height: 34, width: (W - 28 - 24) / 3, borderRadius: 999, marginRight: 8, marginBottom: 8 }}
              shimmerStyle={shimmerStyle}
            />
          ))}
        </View>

        <Block style={{ height: 48, borderRadius: 12, marginHorizontal: 14, marginBottom: 18 }} shimmerStyle={shimmerStyle} />
        <Block style={{ height: 18, width: 180, borderRadius: 6, marginHorizontal: 14, marginBottom: 8 }} shimmerStyle={shimmerStyle} />
        <Block style={{ height: 14, width: W - 28, borderRadius: 6, marginHorizontal: 14, marginBottom: 18 }} shimmerStyle={shimmerStyle} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Block
              key={`grid-${i}`}
              style={{ height: 120, width: (W - 28 - 12) / 2, borderRadius: 16, marginBottom: 12 }}
              shimmerStyle={shimmerStyle}
            />
          ))}
        </View>

        <Block style={{ height: 18, width: 200, borderRadius: 6, marginHorizontal: 14, marginTop: 8, marginBottom: 12 }} shimmerStyle={shimmerStyle} />
        <View style={{ flexDirection: "row", paddingHorizontal: 14, marginBottom: 18 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Block
              key={`h1-${i}`}
              style={{ height: 140, width: 140, borderRadius: 16, marginRight: 12 }}
              shimmerStyle={shimmerStyle}
            />
          ))}
        </View>

        <Block style={{ height: 18, width: 200, borderRadius: 6, marginHorizontal: 14, marginBottom: 12 }} shimmerStyle={shimmerStyle} />
        <View style={{ flexDirection: "row", paddingHorizontal: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Block
              key={`h2-${i}`}
              style={{ height: 140, width: 140, borderRadius: 16, marginRight: 12 }}
              shimmerStyle={shimmerStyle}
            />
          ))}
        </View>
      </View>
    );
  }

  /* ── generic_compare ─────────────────────────────────────────── */
  if (variant === "generic_compare") {
    return (
      <View style={[styles.screen, { backgroundColor: "#e5f9f7ff", paddingHorizontal: 16 }]}>
        <Block style={{ height: 48, borderRadius: 8, marginBottom: 16 }} shimmerStyle={shimmerStyle} />
        <Block style={{ height: 24, width: 100, borderRadius: 4, marginBottom: 12 }} shimmerStyle={shimmerStyle} />
        <View style={{ flexDirection: "row", height: 240, borderRadius: 8, marginBottom: 16 }}>
          <Block style={{ flex: 1, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }} shimmerStyle={shimmerStyle} />
          <Block style={{ flex: 1, borderTopRightRadius: 8, borderBottomRightRadius: 8 }} shimmerStyle={shimmerStyle} />
        </View>
        <Block style={{ height: 72, borderRadius: 8, marginBottom: 20 }} shimmerStyle={shimmerStyle} />
        <Block style={{ height: 18, width: 160, borderRadius: 4, marginBottom: 12 }} shimmerStyle={shimmerStyle} />
        {[1, 2, 3].map((i) => (
          <Block key={i} style={{ height: 100, borderRadius: 12, marginBottom: 12 }} shimmerStyle={shimmerStyle} />
        ))}
      </View>
    );
  }

  /* ── generic_list ────────────────────────────────────────────── */
  if (variant === "generic_list") {
    return (
      <View style={[styles.screen, { backgroundColor: "#e5f9f7ff", paddingHorizontal: 16 }]}>
        <Block style={{ height: 48, borderRadius: 8, marginBottom: 16 }} shimmerStyle={shimmerStyle} />
        {[1, 2, 3, 4].map((i) => (
          <Block key={i} style={{ height: 120, borderRadius: 12, marginBottom: 12 }} shimmerStyle={shimmerStyle} />
        ))}
      </View>
    );
  }

  /* ── generic_address ─────────────────────────────────────────── */
  if (variant === "generic_address") {
    return (
      <View style={[styles.screen, { backgroundColor: "#e5f9f7ff", paddingHorizontal: 15 }]}>
        <Block style={{ height: 48, borderRadius: 8, marginBottom: 24 }} shimmerStyle={shimmerStyle} />
        {[1, 2, 3].map((i) => (
          <Block key={i} style={{ height: 140, borderRadius: 12, marginBottom: 16 }} shimmerStyle={shimmerStyle} />
        ))}
      </View>
    );
  }

  /* ── generic_prescription_grid ───────────────────────────────── */
  if (variant === "generic_prescription_grid") {
    return (
      <View style={[styles.screen, { backgroundColor: "#e5f9f7ff", paddingHorizontal: 16 }]}>
        <Block style={{ height: 44, borderRadius: 8, marginBottom: 16 }} shimmerStyle={shimmerStyle} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Block
              key={i}
              style={{ height: 140, width: (W - 48) / 2 - 6, borderRadius: 12, marginBottom: 12 }}
              shimmerStyle={shimmerStyle}
            />
          ))}
        </View>
      </View>
    );
  }

  /* ── default ─────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.screen}>
      <Block style={{ height: 64, borderRadius: 0, marginBottom: 12 }} shimmerStyle={shimmerStyle} />
      <Block style={{ height: 44, borderRadius: 8, marginHorizontal: 14, marginBottom: 14 }} shimmerStyle={shimmerStyle} />
      <Block style={{ height: 180, borderRadius: 16, marginHorizontal: 14, marginBottom: 14 }} shimmerStyle={shimmerStyle} />
      <Block style={{ height: 14, width: W - 28, borderRadius: 6, marginHorizontal: 14, marginBottom: 10 }} shimmerStyle={shimmerStyle} />
      <Block style={{ height: 14, width: W * 0.7, borderRadius: 6, marginHorizontal: 14, marginBottom: 10 }} shimmerStyle={shimmerStyle} />
      <Block style={{ height: 14, width: W * 0.55, borderRadius: 6, marginHorizontal: 14, marginBottom: 10 }} shimmerStyle={shimmerStyle} />
    </SafeAreaView>
  );
});

export default AppSkeleton;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 10,
  },
  block: {
    backgroundColor: "#E9EDF5",
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 140,
    backgroundColor: "rgba(255,255,255,0.55)",
    opacity: 0.7,
  },
});
