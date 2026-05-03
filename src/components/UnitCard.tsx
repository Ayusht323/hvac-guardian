import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { UnitAnomalyReport, HVACUnit } from '../types';

const LEVEL_COLORS = {
  critical: { bg: '#FEF2F2', border: '#EF4444', badge: '#EF4444', text: '#991B1B' },
  warning:  { bg: '#FFFBEB', border: '#F59E0B', badge: '#F59E0B', text: '#92400E' },
  watch:    { bg: '#EFF6FF', border: '#3B82F6', badge: '#3B82F6', text: '#1E40AF' },
  normal:   { bg: '#F0FDF4', border: '#22C55E', badge: '#22C55E', text: '#166534' },
};

const LEVEL_LABEL = {
  critical: 'CRITICAL',
  warning:  'WARNING',
  watch:    'WATCH',
  normal:   'NORMAL',
};

const LEVEL_ICON = {
  critical: '🔴',
  warning:  '🟡',
  watch:    '🔵',
  normal:   '🟢',
};

type Props = {
  report: UnitAnomalyReport & { unit: HVACUnit };
  rank: number;
  onPress: () => void;
};

export function UnitCard({ report, rank, onPress }: Props) {
  const colors = LEVEL_COLORS[report.level];
  const lastReading = report.unit.readings[report.unit.readings.length - 1];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bg, borderLeftColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.rank}>#{rank}</Text>
          <Text style={styles.unitName}>{report.unit.name}</Text>
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={styles.badgeText}>{LEVEL_LABEL[report.level]}</Text>
          </View>
        </View>
        <Text style={styles.location}>{report.unit.location}</Text>
      </View>

      <View style={styles.issueRow}>
        <Text style={styles.issueIcon}>{LEVEL_ICON[report.level]}</Text>
        <Text style={[styles.issueText, { color: colors.text }]} numberOfLines={2}>
          {report.dominantIssue}
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Priority" value={`${report.priority}`} unit="/100" highlight={report.priority >= 70} />
        <Metric
          label="Temp"
          value={lastReading.temp !== null ? lastReading.temp.toFixed(1) : '--'}
          unit="°C"
          highlight={report.sensorScores.find(s => s.sensor === 'temp')?.anomalous ?? false}
        />
        <Metric
          label="Vibration"
          value={lastReading.vibration !== null ? lastReading.vibration.toFixed(3) : '--'}
          unit="mm/s"
          highlight={report.sensorScores.find(s => s.sensor === 'vibration')?.anomalous ?? false}
        />
        <Metric
          label="Power"
          value={lastReading.power !== null ? lastReading.power.toFixed(1) : '--'}
          unit="kW"
          highlight={report.sensorScores.find(s => s.sensor === 'power')?.anomalous ?? false}
        />
      </View>

      {report.correlatedSensors.length >= 2 && (
        <View style={styles.correlationBanner}>
          <Text style={styles.correlationText}>
            ⚡ {report.correlatedSensors.length} sensors deviating together — high confidence signal
          </Text>
        </View>
      )}

      {report.missingRateLast24 > 0.15 && (
        <View style={styles.dataWarning}>
          <Text style={styles.dataWarningText}>
            ⚠ {Math.round(report.missingRateLast24 * 100)}% sensor data missing last 2h
          </Text>
        </View>
      )}

      <Text style={styles.tapHint}>Tap for analysis →</Text>
    </TouchableOpacity>
  );
}

function Metric({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, highlight && styles.metricHighlight]}>
        {value}
        <Text style={styles.metricUnit}>{unit}</Text>
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { marginBottom: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  rank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    width: 20,
  },
  unitName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  location: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 28,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 8,
    padding: 8,
  },
  issueIcon: { fontSize: 14 },
  issueText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metric: { alignItems: 'center', flex: 1 },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  metricHighlight: { color: '#EF4444' },
  metricUnit: {
    fontSize: 10,
    fontWeight: '400',
    color: '#9CA3AF',
  },
  metricLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  correlationBanner: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  correlationText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
  },
  dataWarning: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    padding: 5,
    marginBottom: 6,
  },
  dataWarningText: {
    fontSize: 11,
    color: '#6B7280',
  },
  tapHint: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 2,
  },
});
