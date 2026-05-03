import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar } from 'react-native';
import { SensorChart } from '../components/SensorChart';
import { UnitAnomalyReport, HVACUnit, SensorName } from '../types';

type Props = {
  report: UnitAnomalyReport & { unit: HVACUnit };
  onBack: () => void;
};

const LEVEL_COLORS = { critical: '#EF4444', warning: '#F59E0B', watch: '#3B82F6', normal: '#22C55E' };

const SENSOR_COLORS: Record<SensorName, string> = {
  temp:      '#EF4444',
  airflow:   '#3B82F6',
  vibration: '#F59E0B',
  pressure:  '#8B5CF6',
  power:     '#10B981',
};

// Order by diagnostic importance
const SENSOR_ORDER: SensorName[] = ['vibration', 'power', 'temp', 'airflow', 'pressure'];

export function UnitDetailScreen({ report, onBack }: Props) {
  const { unit } = report;
  const levelColor = LEVEL_COLORS[report.level];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{unit.name}</Text>
        <View style={[styles.levelDot, { backgroundColor: levelColor }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Summary card */}
        <View style={[styles.summaryCard, { borderLeftColor: levelColor }]}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.unitTitle}>{unit.name}</Text>
              <Text style={styles.unitLocation}>📍 {unit.location}</Text>
            </View>
            <View style={[styles.priorityCircle, { borderColor: levelColor }]}>
              <Text style={[styles.priorityNum, { color: levelColor }]}>{report.priority}</Text>
              <Text style={styles.priorityLabel}>/ 100</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <MetaBadge label="Install" value={unit.meta.installYear.toString()} />
            <MetaBadge label="Last Service" value={unit.meta.lastMaintenance} />
            <MetaBadge label="Data Quality" value={`${Math.round(report.dataQuality * 100)}%`} />
          </View>

          {report.correlatedSensors.length >= 2 ? (
            <View style={[styles.signalBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Text style={styles.signalText}>⚡ HIGH CONFIDENCE — {report.correlatedSensors.length} sensors co-anomalous: {report.correlatedSensors.join(', ')}</Text>
              <Text style={styles.signalSub}>Multiple concurrent deviations = real equipment issue, not noise.</Text>
            </View>
          ) : report.correlatedSensors.length === 1 ? (
            <View style={[styles.signalBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <Text style={styles.signalText}>⚠ LOW CONFIDENCE — only {report.correlatedSensors[0]} anomalous</Text>
              <Text style={styles.signalSub}>Isolated single-sensor deviation — likely noise. Monitor, don't panic.</Text>
            </View>
          ) : (
            <View style={[styles.signalBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={styles.signalText}>✅ All sensors within normal range</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sensor Trends (all readings)</Text>
          <Text style={styles.sectionSub}>Grey band = ±2σ normal range · Dashed = baseline mean</Text>
          {SENSOR_ORDER.map(sensor => {
            const score = report.sensorScores.find(s => s.sensor === sensor)!;
            const values = unit.readings.map(r => r[sensor] as number | null);
            return <SensorChart key={sensor} sensor={sensor} values={values} score={score} color={SENSOR_COLORS[sensor]} />;
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anomaly Score Breakdown</Text>
          <View style={styles.scoreTable}>
            <View style={styles.tableHeader}>
              {['Sensor','Z-Score','Trend','Status'].map(h => (
                <Text key={h} style={[styles.tableCell, styles.tableHead]}>{h}</Text>
              ))}
            </View>
            {report.sensorScores.map(s => (
              <View key={s.sensor} style={[styles.tableRow, s.anomalous && styles.tableRowHighlight]}>
                <Text style={[styles.tableCell, { textTransform: 'capitalize' }]}>{s.sensor}</Text>
                <Text style={[styles.tableCell, { fontFamily: 'monospace', color: Math.abs(s.zScore) > 2 ? '#EF4444' : '#374151' }]}>
                  {s.zScore > 0 ? '+' : ''}{s.zScore.toFixed(2)}
                </Text>
                <Text style={styles.tableCell}>{s.trend === 'rising' ? '↑' : s.trend === 'falling' ? '↓' : '→'}</Text>
                <Text style={[styles.tableCell, { color: s.anomalous ? '#EF4444' : '#22C55E', fontWeight: '700' }]}>
                  {s.anomalous ? 'FLAGGED' : 'OK'}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.footnote}>Z-score = deviation from unit's own first-100-reading baseline. |z| &gt; 2.0 = anomalous.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBadge}>
      <Text style={styles.metaBadgeLabel}>{label}</Text>
      <Text style={styles.metaBadgeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 8 },
  backBtn: { paddingRight: 8 },
  backText: { fontSize: 14, color: '#6366F1', fontWeight: '600' },
  navTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  scroll: { padding: 16 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  unitTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  unitLocation: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  priorityCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center' },
  priorityNum: { fontSize: 20, fontWeight: '800' },
  priorityLabel: { fontSize: 9, color: '#9CA3AF', marginTop: -2 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metaBadge: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flex: 1, alignItems: 'center' },
  metaBadgeLabel: { fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaBadgeValue: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 2 },
  signalBanner: { borderRadius: 8, borderWidth: 1, padding: 10 },
  signalText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  signalSub: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
  scoreTable: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 8 },
  tableHead: { fontWeight: '700', color: '#6B7280', fontSize: 11, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  tableRowHighlight: { backgroundColor: '#FEF2F2' },
  tableCell: { flex: 1, textAlign: 'center', fontSize: 12, color: '#374151' },
  footnote: { fontSize: 10, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' },
});
