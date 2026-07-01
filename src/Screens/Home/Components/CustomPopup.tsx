import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { BlurView } from "@react-native-community/blur";
import { COLORS } from "../../../Constants/theme";

interface CustomPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  iconName?: string;
  showIcon?: boolean;
  confirmText?: string;
  cancelText?: string;
  secondaryConfirmText?: string;
  onSecondaryConfirm?: () => void;
  iconColor?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  confirmStyle?: StyleProp<ViewStyle>;
}

const ICON_COLOR = COLORS.PRIMARY;

const PopupBackdrop = () =>
  Platform.OS === "ios" ? (
    <BlurView
      style={StyleSheet.absoluteFill}
      blurType="light"
      blurAmount={8}
      reducedTransparencyFallbackColor="rgba(0,0,0,0.45)"
    />
  ) : (
    <View style={[StyleSheet.absoluteFill, styles.androidBackdrop]} />
  );

const CustomPopup: React.FC<CustomPopupProps> = ({
  isVisible,
  onClose,
  onConfirm,
  title,
  message,
  iconName = "checkmark-circle-outline",
  showIcon = true,
  confirmText = "OK",
  cancelText,
  secondaryConfirmText,
  onSecondaryConfirm,
  iconColor = ICON_COLOR,
  compact = false,
  style,
  confirmStyle,
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View style={styles.overlay}>
        <PopupBackdrop />

        <SafeAreaView style={styles.centered}>
          <View style={[styles.container, compact && styles.containerCompact, style]}>
            {showIcon ? (
              <View
                style={[
                  styles.iconBadge,
                  compact && styles.iconBadgeCompact,
                  { backgroundColor: `${iconColor}14` },
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={compact ? 40 : 50}
                  color={iconColor}
                />
              </View>
            ) : null}

            <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>

            {!!message && (
              <Text style={[styles.message, compact && styles.messageCompact]}>{message}</Text>
            )}

            {cancelText ? (
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            ) : null}

            {secondaryConfirmText && onSecondaryConfirm ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onSecondaryConfirm}
              >
                <Text style={styles.cancelText}>{secondaryConfirmText}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.confirmButton, confirmStyle]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default CustomPopup;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  androidBackdrop: {
    backgroundColor: "rgba(17, 24, 39, 0.4)",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "84%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  containerCompact: {
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  iconBadgeCompact: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
    color: "#111827",
  },
  titleCompact: {
    fontSize: 16,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 21,
    paddingHorizontal: 2,
  },
  messageCompact: {
    marginBottom: 14,
    fontSize: 13,
  },
  cancelButton: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 4,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cancelText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 15,
  },
  confirmButton: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 4,
    backgroundColor: COLORS.PRIMARY,
  },
  confirmText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
});
