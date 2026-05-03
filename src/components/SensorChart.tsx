import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Line, Circle, Rect } from 'react-native-svg';
import { SensorName, SensorScore } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 60;

type Props = {
  sensor: SensorName;
  values: (number | null)[];
  score: SensorScore;
  color: string;
};

const SENSOR_LABELS: Record<SensorName, string> = {
  temp:      'Temperature (°C)',
  airflow:   'Airflow (CFM)',
  vibration: 'Vibration (mm/s)',
  pressure:  'Pressure (PSI)',
  power:     'Power (kW)',
};

const SENSOR_ICONS: Record<SensorName, string> = {
  temp:      '🌡',
  airflow:   '💨',
  vibration: '📳',
  pressure:  '🔩',
  power:     '⚡',
};

const TREND_SYMBOLS = { rising: '↑', falling: '↓', stable: '→' };

export function SensorChart({ sensor, values, score, color }: Props) {
  const chartData = useMemo(() => {
    const slice = values.slice(-100);
    const filled: number[] = [];
    let prev: number | null = null;
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] !== null) { prev = slice[i] as number; filled.push(prev); }
      else if (prev !== null) { filled.push(prev); }
      else {
        let next: number | null = null;
        for (let j = i + 1; j < slice.length; j++) { if (slice[j] !== null) { next = slice[j] as number; break; } }
        filled.push(next ?? 0);
      }
    }
    if (filled.length === 0) return null;
    const min = Math.min(...filled);
    const max = Math.max(...filled);
    const range = Math.max(max - min, 1e-6);
    const pad = range * 0.1;
    const pMin = min - pad, pMax = max + pad, pRange = pMax - pMin;
    const toY = (v: number) => CHART_HEIGHT - ((v - pMin) / pRange) * CHART_HEIGHT;
    const points = filled.map((v, i) => `${((i / (filled.length - 1)) * CHART_WIDTH).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    return {
      points,
      meanY: toY(score.baselineMean),
      upperY: Math.max(0, toY(score.baselineMean + 2 * score.baselineStd)),
      lowerY: Math.min(CHART_HEIGHT, toY(score.baselineMean - 2 * score.baselineStd)),
      min, max, filled,
      lastY: Math.min(CHART_HEIGHT - 2, Math.max(2, toY(filled[filled.length - 1]))),
    };
  }, [values, score]);

  if (!chartData) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{SENSOR_ICONS[sensor]} {SENSOR_LABELS[sensor]}</Text>
        <View style={styles.rightHeader}>
          <Text style={[styles.trend, { color: score.anomalous ? '#EF4444' : '#6B7280' }]}>
            {TREND_SYMBOLS[score.trend]} {score.trend}
          </Text>
          <Text style={[styles.zscore, { color: Math.abs(score.zScore) > 2 ? '#EF4444' : '#6B7280' }]}>
            z={score.zScore.toFixed(1)}
          </Text>
        </View>
      </View>
      <View style={styles.chartContainer}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Rect x={0} y={chartData.upperY} width={CHART_WIDTH} height={Math.max(0, chartData.lowerY - chartData.upperY)} fill="rgba(156,163,175,0.12)" />
          <Line x1={0} y1={chartData.meanY} x2={CHART_WIDTH} y2={chartData.meanY} stroke="rgba(156,163,175,0.5)" strokeWidth={1} strokeDasharray="4,3" />
          <Polyline points={chartData.points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={CHART_WIDTH} cy={chartData.lastY} r={4} fill={color} />
        </Svg>
        <View style={styles.axisLabels}>
          <Text style={styles.axisLabel}>{chartData.max.toFixed(2)}</Text>
          <Text style={styles.axisLabel}>{chartData.min.toFixed(2)}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Current: <Text style={{ fontWeight: '700', color: score.anomalous ? '#EF4444' : '#374151' }}>
            {score.lastValue !== null ? score.lastValue.toFixed(3) : '--'}
          </Text>
        </Text>
        <Text style={styles.footerText}>Baseline: {score.baselineMean.toFixed(3)} ±{score.baselineStd.toFixed(3)}</Text>
        {score.anomalous && <Text style={styles.anomalyFlag}>⚠ {Math.abs(score.zScore).toFixed(1)}σ deviation</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  rightHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  trend: { fontSize: 12, fontWeight: '500' },
  zscore: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  chartContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  axisLabels: { justifyContent: 'space-between', height: CHART_HEIGHT, paddingVertical: 2 },
  axisLabel: { fontSize: 9, color: '#9CA3AF', fontFamily: 'monospace' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 4 },
  footerText: { fontSize: 11, color: '#6B7280' },
  anomalyFlag: { fontSize: 11, color: '#EF4444', fontWeight: '600' },
});
