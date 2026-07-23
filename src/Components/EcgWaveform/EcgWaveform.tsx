import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../Constants/theme';
import {
  downsampleEcgMinMaxEnvelope,
  getEcgLaneBaseline,
  splitEcgLeads,
} from '../../Utils/ashaEcgParser';

/** Fewer visible samples = wider horizontal spacing per beat (PQRST spread). */
const VISIBLE_SAMPLES = 110;
const LANE_HEIGHT = 64;
const PLOT_HEIGHT = LANE_HEIGHT * 2;
const MIN_VERTICAL_RANGE = 28;
const LEAD1_COLOR = '#8F1D3C';
const LEAD2_COLOR = '#18B8C8';

type Point = { x: number; y: number };

type EcgWaveformProps = {
  samples: number[];
  /** @deprecated Kept for call-site compat; sample count is not shown on the waveform. */
  sampleCountLabel?: string;
  showFullWave?: boolean;
};

function buildLanePoints(
  laneSamples: number[],
  width: number,
  height: number,
): Point[] {
  if (laneSamples.length === 0 || width <= 0) {
    return [];
  }

  const bucketCount = Math.max(8, Math.floor(width / 3.2));
  const fitted = downsampleEcgMinMaxEnvelope(laneSamples, bucketCount);
  const baseline = getEcgLaneBaseline(fitted);

  let min = fitted[0];
  let max = fitted[0];
  fitted.forEach(sample => {
    if (sample < min) min = sample;
    if (sample > max) max = sample;
  });

  const range = Math.max(max - min, MIN_VERTICAL_RANGE);
  const halfRange = range / 2;
  const centerY = height / 2;
  const verticalScale = height * 0.47;

  return fitted.map((sample, index) => ({
    x: (index / Math.max(1, fitted.length - 1)) * width,
    y: centerY - ((sample - baseline) / halfRange) * verticalScale,
  }));
}

type EcgPolylineProps = {
  points: Point[];
  color: string;
};

const EcgPolyline: React.FC<EcgPolylineProps> = ({ points, color }) => {
  if (points.length < 2) {
    return null;
  }

  return (
    <>
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 0.35) {
          return null;
        }

        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const midX = (point.x + next.x) / 2;
        const midY = (point.y + next.y) / 2;

        return (
          <View
            key={`${index}-${midX}`}
            style={[
              styles.segment,
              {
                left: midX - length / 2,
                top: midY - 1,
                width: length,
                backgroundColor: color,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}
    </>
  );
};

type EcgGridProps = {
  width: number;
  height: number;
};

const EcgGrid: React.FC<EcgGridProps> = ({ width, height }) => {
  if (width <= 0) {
    return null;
  }

  const minorVertical = 24;
  const minorHorizontal = 8;

  return (
    <>
      {Array.from({ length: minorVertical }, (_, index) => {
        const left = (index / (minorVertical - 1)) * width;
        const isMajor = index % 5 === 0;
        return (
          <View
            key={`v-${index}`}
            style={[
              isMajor ? styles.gridLineMajorVertical : styles.gridLineMinorVertical,
              { left },
            ]}
          />
        );
      })}
      {Array.from({ length: minorHorizontal }, (_, index) => {
        const top = (index / (minorHorizontal - 1)) * height;
        const isMajor = index % 2 === 0;
        return (
          <View
            key={`h-${index}`}
            style={[
              isMajor ? styles.gridLineMajorHorizontal : styles.gridLineMinorHorizontal,
              { top },
            ]}
          />
        );
      })}
    </>
  );
};

type EcgLeadLaneProps = {
  samples: number[];
  color: string;
  width: number;
};

const EcgLeadLane: React.FC<EcgLeadLaneProps> = ({ samples, color, width }) => {
  const points = useMemo(
    () => buildLanePoints(samples, width, LANE_HEIGHT),
    [samples, width],
  );

  return (
    <View style={styles.lane}>
      <View style={styles.laneMidline} />
      <EcgPolyline points={points} color={color} />
    </View>
  );
};

const EcgWaveform: React.FC<EcgWaveformProps> = ({
  samples,
  showFullWave = false,
}) => {
  const [plotWidth, setPlotWidth] = useState(0);
  const visibleSamples = useMemo(
    () => (showFullWave ? samples : samples.slice(-VISIBLE_SAMPLES)),
    [samples, showFullWave],
  );
  const { lead1, lead2 } = useMemo(() => splitEcgLeads(visibleSamples), [visibleSamples]);

  const onPlotLayout = useCallback((event: LayoutChangeEvent) => {
    setPlotWidth(event.nativeEvent.layout.width);
  }, []);

  const hasWave = visibleSamples.length > 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>ECG Waveform</Text>
      </View>

      <View style={styles.plotShell} onLayout={onPlotLayout}>
        <EcgGrid width={plotWidth} height={PLOT_HEIGHT} />
        {!hasWave ? (
          <Text style={styles.empty}>Waiting for ECG wave...</Text>
        ) : (
          <>
            <EcgLeadLane samples={lead1} color={LEAD1_COLOR} width={plotWidth} />
            <View style={styles.laneSeparator} />
            <EcgLeadLane samples={lead2} color={LEAD2_COLOR} width={plotWidth} />
          </>
        )}
      </View>
    </View>
  );
};

export default EcgWaveform;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
    alignSelf: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.XS,
  },
  title: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  plotShell: {
    width: '100%',
    alignSelf: 'stretch',
    height: PLOT_HEIGHT,
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: '#d9dee8',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  gridLineMinorVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#f0f2f6',
  },
  gridLineMajorVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#e2e7ef',
  },
  gridLineMinorHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f0f2f6',
  },
  gridLineMajorHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#e2e7ef',
  },
  lane: {
    height: LANE_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  laneMidline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: LANE_HEIGHT / 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d8dee8',
  },
  laneSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d5dbe6',
  },
  segment: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  empty: {
    textAlign: 'center',
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
  },
});
