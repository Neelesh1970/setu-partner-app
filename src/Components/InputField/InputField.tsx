import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardTypeOptions,
} from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  prefix?: string;
  maxLength?: number;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  prefix,
  maxLength,
}) => {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={[styles.input, prefix ? styles.inputWithPrefix : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.PLACEHOLDER}
          keyboardType={keyboardType}
          maxLength={maxLength}
        />
      </View>
    </View>
  );
};

export default InputField;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.MD,
  },
  label: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '500',
    marginBottom: SPACING.XS,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 10,
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SPACING.MD,
  },
  prefix: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '600',
    marginRight: SPACING.SM,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.MD,
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_PRIMARY,
  },
  inputWithPrefix: {
    borderLeftWidth: 1,
    borderLeftColor: COLORS.BORDER,
    paddingLeft: SPACING.SM,
  },
});
