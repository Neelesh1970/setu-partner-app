import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ms, s, vs } from "react-native-size-matters";

interface CustomPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  iconName?: string;
  showIcon?: boolean;
  confirmText?: string;
}

const CustomPopup: React.FC<CustomPopupProps> = ({
  isVisible,
  onClose,
  onConfirm,
  title,
  message,
  iconName = "checkmark-circle-outline",
  showIcon = true,
  confirmText = "OK",
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {showIcon ? (
            <Ionicons
              name={iconName}
              size={ms(52)}
              color="#22C55E"
              style={styles.icon}
            />
          ) : null}

          <Text style={styles.title}>{title}</Text>

          {!!message && <Text style={styles.message}>{message}</Text>}

          <TouchableOpacity style={styles.btn} onPress={onConfirm}>
            <Text style={styles.btnText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default CustomPopup;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    width: "85%", // ✅ slightly wider
    backgroundColor: "#FFFFFF",
    borderRadius: ms(20), // ✅ smoother corners
    paddingVertical: vs(24),
    paddingHorizontal: ms(20),
    alignItems: "center",
  },

  icon: {
    marginBottom: vs(10),
  },

  title: {
    fontSize: s(18), // ✅ slightly bigger
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: vs(6),
  },

  message: {
    fontSize: s(14),
    color: "#64748B",
    textAlign: "center",
    marginBottom: vs(18), // ✅ more spacing
  },

  btn: {
    width: "100%", // ✅ FULL WIDTH (MOST IMPORTANT FIX)
    backgroundColor: "#0451CF",
    borderRadius: ms(26),
    paddingVertical: vs(14), // ✅ taller button
    alignItems: "center",
    justifyContent: "center",
  },

  btnText: {
    color: "#FFFFFF",
    fontSize: s(16),
    fontWeight: "700",
  },
});
