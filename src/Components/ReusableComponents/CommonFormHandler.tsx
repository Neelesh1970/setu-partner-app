import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

type RadioItem = {
  id: string;
  name: string;
  disabled?: boolean;
};

type CommonFormHandlerProps = {
  type: 'radio';
  value: string;
  onChange: (value: string) => void;
  data: RadioItem[];
  keyField: string;
  valueField: string;
  activeColor?: string;
  radioGroupStyle?: StyleProp<ViewStyle>;
  radioContainerStyle?: StyleProp<ViewStyle>;
  radioOuterCircleStyle?: StyleProp<ViewStyle>;
  radioInnerCircleStyle?: StyleProp<ViewStyle>;
  radioLabelStyle?: StyleProp<TextStyle>;
};

const CommonFormHandler: React.FC<CommonFormHandlerProps> = ({
  value,
  onChange,
  data,
  activeColor = '#2563EB',
  radioGroupStyle,
  radioContainerStyle,
  radioOuterCircleStyle,
  radioInnerCircleStyle,
  radioLabelStyle,
}) => {
  return (
    <View style={radioGroupStyle}>
      {data.map((item) => {
        const label = item.name;
        const selected = value === label;
        const disabled = Boolean(item.disabled);

        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.9}
            disabled={disabled}
            onPress={() => onChange(label)}
            style={[
              styles.radioRow,
              radioContainerStyle,
              disabled && styles.disabledRow,
            ]}
          >
            <View
              style={[
                styles.radioOuter,
                radioOuterCircleStyle,
                selected && { borderColor: activeColor },
                disabled && styles.disabledOuter,
              ]}
            >
              {selected ? (
                <View
                  style={[
                    styles.radioInner,
                    radioInnerCircleStyle,
                    { backgroundColor: activeColor },
                  ]}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.radioLabel,
                radioLabelStyle,
                disabled && styles.disabledLabel,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default CommonFormHandler;

const styles = StyleSheet.create({
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  disabledRow: {
    opacity: 0.5,
  },
  disabledOuter: {
    borderColor: '#E5E7EB',
  },
  disabledLabel: {
    color: '#94A3B8',
  },
});
