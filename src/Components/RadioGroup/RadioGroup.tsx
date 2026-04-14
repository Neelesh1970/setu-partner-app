import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';

interface RadioGroupProps {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  options,
  selected,
  onSelect,
}) => {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map(option => {
          const isSelected = selected === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => onSelect(option)}
              activeOpacity={0.7}
            >
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
              <Text
                style={[styles.optionText, isSelected && styles.optionTextSelected]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default RadioGroup;

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
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 10,
    backgroundColor: COLORS.WHITE,
    gap: SPACING.XS,
  },
  cardSelected: {
    borderColor: COLORS.CARD_SELECTED_BORDER,
    backgroundColor: COLORS.CARD_SELECTED_BG,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.PRIMARY,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.PRIMARY,
  },
  optionText: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
  },
  optionTextSelected: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
});
