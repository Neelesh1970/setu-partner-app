import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PixelRatio,
  GestureResponderEvent,
  Image,
  useWindowDimensions,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { NavigationProp } from "@react-navigation/native";

/* ================= TYPES ================= */

type IconType = "ion" | "material";

interface PreventiveHealthHeaderProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;

  /** When set, shows a circular initials avatar before the title (e.g. home profile). */
  avatarInitials?: string;
  /** When set, shows a profile photo inside the avatar (falls back to initials on error). */
  avatarImageUrl?: string | null;
  /** When set, the avatar is tappable (e.g. open Profile from Home). */
  onAvatarPress?: () => void;

  // RIGHT ICON 1
  showRight1?: boolean;
  rightIcon1?: string;
  rightIcon1Type?: IconType;
  onRightPress1?: (event: GestureResponderEvent) => void;

  // RIGHT ICON 2
  showRight2?: boolean;
  rightIcon2?: string;
  rightIcon2Type?: IconType;
  onRightPress2?: (event: GestureResponderEvent) => void;

  cartCount?: number;

  /** When set, replaces the right icon buttons (e.g. custom action on Home). */
  rightSlot?: React.ReactNode;
}

const HEADER_BG = "#1C39BB";

/* ================= COMPONENT ================= */

const PreventiveHealthHeader: React.FC<PreventiveHealthHeaderProps> = ({
  title = "",
  showBack = true,
  onBackPress,

  avatarInitials,
  avatarImageUrl,
  onAvatarPress,

  showRight1 = false,
  rightIcon1 = "search-outline",
  rightIcon1Type = "ion",
  onRightPress1,

  showRight2 = false,
  rightIcon2 = "calendar-outline",
  rightIcon2Type = "ion",
  onRightPress2,

  cartCount = 0,

  rightSlot,
}) => {
  const { width } = useWindowDimensions();
  const rs = (n: number) =>
    Math.round(PixelRatio.roundToNearestPixel(n * (width / 375)));

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          padding: rs(12),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        avatar: {
          width: rs(44),
          height: rs(44),
          borderRadius: rs(22),
          backgroundColor: "rgba(255,255,255,0.25)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: rs(8),
          overflow: "hidden",
        },
        avatarAfterBack: {
          marginLeft: rs(6),
        },
        avatarText: {
          color: "#FFFFFF",
          fontWeight: "700",
          fontSize: rs(14),
        },
        title: {
          color: "#FFFFFF",
          fontSize: rs(20),
          fontWeight: "700",
          flex: 1,
          minWidth: 0,
        },
        iconBtn: {
          width: rs(36),
          height: rs(36),
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [width],
  );

  const backIconSize = rs(25);
  const iconSize = rs(24);

  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const trimmedAvatarUrl = avatarImageUrl?.trim() ?? "";
  useEffect(() => {
    setAvatarImageFailed(false);
  }, [trimmedAvatarUrl]);

  const navigation = useNavigation<NavigationProp<any>>();

  const handleBack = () => {
    if (onBackPress) onBackPress();
    else navigation.goBack();
  };

  const renderIcon = (type: IconType, name?: string) => {
    if (!name) return null;

    if (type === "material") {
      return (
        <MaterialCommunityIcons
          name={name}
          size={iconSize}
          color="#fff"
        />
      );
    }

    return <Ionicons name={name} size={iconSize} color="#fff" />;
  };

  const initials = avatarInitials?.trim();
  const showAvatar = Boolean(initials) || Boolean(trimmedAvatarUrl);
  const showAvatarImage = Boolean(trimmedAvatarUrl) && !avatarImageFailed;

  const titleMarginLeft =
    showAvatar ? 0 : showBack ? rs(6) : 0;

  return (
    <View style={styles.root}>
      <View style={dynamicStyles.header}>
        {/* LEFT */}
        <View style={styles.leftWrap}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              style={dynamicStyles.iconBtn}
              hitSlop={10}
            >
              <Ionicons
                name="arrow-back"
                size={backIconSize}
                color="#fff"
              />
            </TouchableOpacity>
          )}

          {showAvatar &&
            (onAvatarPress ? (
              <TouchableOpacity
                onPress={onAvatarPress}
                activeOpacity={0.85}
                style={[
                  dynamicStyles.avatar,
                  showBack ? dynamicStyles.avatarAfterBack : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                {showAvatarImage ? (
                  <Image
                    source={{ uri: trimmedAvatarUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    onError={() => setAvatarImageFailed(true)}
                  />
                ) : (
                  <Text style={dynamicStyles.avatarText}>{initials || "?"}</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  dynamicStyles.avatar,
                  showBack ? dynamicStyles.avatarAfterBack : null,
                ]}
              >
                {showAvatarImage ? (
                  <Image
                    source={{ uri: trimmedAvatarUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    onError={() => setAvatarImageFailed(true)}
                  />
                ) : (
                  <Text style={dynamicStyles.avatarText}>{initials || "?"}</Text>
                )}
              </View>
            ))}

          <Text
            numberOfLines={1}
            style={[dynamicStyles.title, { marginLeft: titleMarginLeft }]}
          >
            {title}
          </Text>
        </View>

        {/* RIGHT */}
        <View style={styles.rightWrap}>
          {rightSlot != null ? (
            rightSlot
          ) : (
            <>
              {showRight1 && (
                <TouchableOpacity
                  onPress={onRightPress1}
                  style={dynamicStyles.iconBtn}
                  hitSlop={10}
                >
                  {renderIcon(rightIcon1Type, rightIcon1)}
                </TouchableOpacity>
              )}

              {showRight2 && (
                <TouchableOpacity
                  onPress={onRightPress2}
                  style={dynamicStyles.iconBtn}
                  hitSlop={10}
                >
                  {renderIcon(rightIcon2Type, rightIcon2)}

                  {cartCount > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>
                        {cartCount > 99 ? "99+" : cartCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
};

export default PreventiveHealthHeader;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  root: {
    backgroundColor: HEADER_BG,
  },
  leftWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  rightWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  cartBadge: {
    position: "absolute",
    right: -4,
    top: -2,
    backgroundColor: "#3d8840",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
});
