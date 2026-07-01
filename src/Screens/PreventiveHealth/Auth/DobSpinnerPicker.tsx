import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { moderateScale, verticalScale } from 'react-native-size-matters';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const PICKER_HEIGHT = verticalScale(150);
const ITEM_HEIGHT = PICKER_HEIGHT / 3;
const HIGHLIGHT_COLOR = 'rgba(232, 234, 246, 0.92)';
const SETTLE_ANIMATION_MS = 220;

const getDaysInMonth = (monthIndex: number, year: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

const clampDate = (date: Date, minimumDate: Date, maximumDate: Date) => {
  if (date < minimumDate) {
    return minimumDate;
  }
  if (date > maximumDate) {
    return maximumDate;
  }
  return date;
};

const getClampedIndex = (offsetY: number, itemCount: number) => {
  const maxIndex = Math.max(0, itemCount - 1);
  const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
  return Math.max(0, Math.min(rawIndex, maxIndex));
};

interface WheelColumnProps<T> {
  items: T[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  formatItem?: (item: T) => string;
}

function WheelColumn<T>({
  items,
  selectedIndex,
  onIndexChange,
  formatItem,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const isDraggingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const isSettlingRef = useRef(false);
  const committedIndexRef = useRef(selectedIndex);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [centerIndex, setCenterIndex] = useState(selectedIndex);

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      const safeIndex = Math.max(0, Math.min(index, items.length - 1));
      isProgrammaticScrollRef.current = animated;
      scrollRef.current?.scrollTo({
        y: safeIndex * ITEM_HEIGHT,
        animated,
      });
      setCenterIndex(safeIndex);
    },
    [items.length],
  );

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const commitIndex = useCallback(
    (index: number) => {
      const safeIndex = Math.max(0, Math.min(index, items.length - 1));

      if (safeIndex === committedIndexRef.current) {
        setCenterIndex(safeIndex);
        return;
      }

      committedIndexRef.current = safeIndex;
      setCenterIndex(safeIndex);
      onIndexChange(safeIndex);
    },
    [items.length, onIndexChange],
  );

  const settleScroll = useCallback(
    (offsetY: number) => {
      if (isSettlingRef.current) {
        return;
      }

      const clampedIndex = getClampedIndex(offsetY, items.length);
      const targetY = clampedIndex * ITEM_HEIGHT;
      const needsSnap = Math.abs(offsetY - targetY) > 0.5;

      setCenterIndex(clampedIndex);

      if (needsSnap) {
        isSettlingRef.current = true;
        clearSettleTimer();
        scrollToIndex(clampedIndex, true);
        settleTimerRef.current = setTimeout(() => {
          isSettlingRef.current = false;
          isProgrammaticScrollRef.current = false;
          commitIndex(clampedIndex);
        }, SETTLE_ANIMATION_MS);
        return;
      }

      commitIndex(clampedIndex);
    },
    [clearSettleTimer, commitIndex, items.length, scrollToIndex],
  );

  useEffect(() => {
    const safeIndex = Math.max(0, Math.min(selectedIndex, items.length - 1));

    if (isDraggingRef.current || isProgrammaticScrollRef.current || isSettlingRef.current) {
      return;
    }

    if (safeIndex === committedIndexRef.current) {
      setCenterIndex(safeIndex);
      return;
    }

    committedIndexRef.current = safeIndex;
    setCenterIndex(safeIndex);
    scrollToIndex(safeIndex, false);
  }, [items.length, scrollToIndex, selectedIndex]);

  useEffect(() => clearSettleTimer, [clearSettleTimer]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = getClampedIndex(
        event.nativeEvent.contentOffset.y,
        items.length,
      );
      setCenterIndex(prev => (prev === nextIndex ? prev : nextIndex));
    },
    [items.length],
  );

  const handleScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
    isSettlingRef.current = false;
    clearSettleTimer();
  }, [clearSettleTimer]);

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityY = event.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(velocityY) > 0.05) {
        return;
      }

      isDraggingRef.current = false;
      settleScroll(event.nativeEvent.contentOffset.y);
    },
    [settleScroll],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        isDraggingRef.current = false;
        return;
      }

      isDraggingRef.current = false;
      settleScroll(event.nativeEvent.contentOffset.y);
    },
    [settleScroll],
  );

  return (
    <View style={styles.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={styles.wheelContent}
      >
        {items.map((item, index) => {
          const isSelected = index === centerIndex;
          const label = formatItem ? formatItem(item) : String(item);

          return (
            <View
              key={`${label}-${index}`}
              style={styles.wheelItem}
            >
              <Text
                style={[
                  styles.wheelItemText,
                  isSelected
                    ? styles.wheelItemTextSelected
                    : styles.wheelItemTextUnselected,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface DobSpinnerPickerProps {
  value: Date;
  onChange: (event: DateTimePickerEvent | null, selectedDate?: Date) => void;
  minimumDate: Date;
  maximumDate: Date;
}

const DobSpinnerPicker: React.FC<DobSpinnerPickerProps> = ({
  value,
  onChange,
  minimumDate,
  maximumDate,
}) => {
  const month = value.getMonth();
  const day = value.getDate();
  const year = value.getFullYear();

  const years = useMemo(() => {
    const list: number[] = [];
    for (
      let y = minimumDate.getFullYear();
      y <= maximumDate.getFullYear();
      y += 1
    ) {
      list.push(y);
    }
    return list;
  }, [minimumDate, maximumDate]);

  const days = useMemo(() => {
    const count = getDaysInMonth(month, year);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [month, year]);

  const dayIndex = Math.min(day - 1, days.length - 1);
  const yearIndex = Math.max(0, years.indexOf(year));

  const updateDate = useCallback(
    (nextMonth: number, nextDay: number, nextYear: number) => {
      const daysInMonth = getDaysInMonth(nextMonth, nextYear);
      const clampedDay = Math.min(nextDay, daysInMonth);
      const next = clampDate(
        new Date(nextYear, nextMonth, clampedDay),
        minimumDate,
        maximumDate,
      );

      if (next.getTime() === value.getTime()) {
        return;
      }

      onChange(null, next);
    },
    [maximumDate, minimumDate, onChange, value],
  );

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosPickerWrap}>
        <DateTimePicker
          value={value}
          mode="date"
          display="spinner"
          onChange={onChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          textColor="#000000"
          themeVariant="light"
          style={styles.iosPicker}
        />
      </View>
    );
  }

  return (
    <View style={styles.androidPickerWrap}>
      <View style={styles.selectionHighlight} pointerEvents="none" />
      <View style={styles.wheelsRow}>
        <WheelColumn
          items={MONTHS}
          selectedIndex={month}
          onIndexChange={index => updateDate(index, day, year)}
        />
        <WheelColumn
          items={days}
          selectedIndex={dayIndex}
          onIndexChange={index => updateDate(month, days[index], year)}
          formatItem={item => String(item)}
        />
        <WheelColumn
          items={years}
          selectedIndex={yearIndex}
          onIndexChange={index => updateDate(month, day, years[index])}
          formatItem={item => String(item)}
        />
      </View>
    </View>
  );
};

export default DobSpinnerPicker;

const styles = StyleSheet.create({
  iosPickerWrap: {
    width: '100%',
    height: PICKER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iosPicker: {
    width: '100%',
    height: PICKER_HEIGHT,
  },
  androidPickerWrap: {
    width: '100%',
    height: PICKER_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectionHighlight: {
    position: 'absolute',
    left: moderateScale(4),
    right: moderateScale(4),
    top: ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    backgroundColor: HIGHLIGHT_COLOR,
    borderRadius: moderateScale(8),
    zIndex: 1,
  },
  wheelsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  wheelColumn: {
    flex: 1,
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  wheelContent: {
    paddingVertical: ITEM_HEIGHT,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    textAlign: 'center',
  },
  wheelItemTextSelected: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#000000',
  },
  wheelItemTextUnselected: {
    fontSize: moderateScale(15),
    fontWeight: '400',
    color: '#B0B0B0',
  },
});
