import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, RefreshControl } from 'react-native';
import { UnitCard } from '../components/UnitCard';
import { analyzeAllUnits, UnitAnomalyReport, HVACUnit } from '../types';

type FilterLevel = 'all' | 'critical' | 'warning' | 'watch';

type Props = {
  units: HVACUnit[];
  onSelectUnit: (report: UnitAnomalyReport & { unit: HVACUnit }) => void;
};

export function DashboardScreen({ units, onSelectUnit }: Props) {
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const allReports = useMemo(() => analyzeAllUnits(units), [units, refreshTick]);

  const filtered = useMemo(() =>
    filter === 'all' ? allReports : allReports.filter(r => r.level === filter),
    [allReports, filter]
  );

  const criticalCount = allReports.filter(r => r.level === 'critical').length;
  const warningCount  = allReports.filter(r => r.level === 'warning').length;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshTick(t => t + 1); setRefreshing(false); }, 600);
  };

  const filterButtons: { key: FilterLevel; label: string; color: string }[] = [
    { key: 'all',      label: 'All',         color: '#374151' },
    { key: 'critical', label: '🔴 Critical', color: '#EF4444' },
    { key: 'warning',  label: '🟡 Warning',  color: '#F59E0B' },
    { key: 'watch',    label: '🔵 Watch',    color: '#3B82F6' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>⚡ HVAC Guardian</Text>
          <Text style={styles.subtitle}>{units.length} units · {units[0]?.readings.length ?? 0} readings each</Text>
        </View>
        <View style={styles.alertSummary}>
          {criticalCount > 0 && <View style={[styles.alertBubble, { backgroundColor: '#EF4444' }]}><Text style={styles.alertBubbleText}>{criticalCount}</Text></View>}
          {warningCount  > 0 && <View style={[styles.alertBubble, { backgroundColor: '#F59E0B' }]}><Text style={styles.alertBubbleText}>{warningCount}</Text></View>}
        </View>
      </View>

      {criticalCount + warningCount === 0 ? (
        <View style={styles.allClearBanner}><Text style={styles.allClearText}>✅ No critical issues — all units within normal range</Text></View>
      ) : (
        <View style={styles.urgentBanner}><Text style={styles.urgentText}>🚨 {criticalCount + warningCount} unit{criticalCount + warningCount > 1 ? 's' : ''} need attention</Text></View>
      )}

      <View style={styles.filterRow}>
        {filterButtons.map(btn => (
          <TouchableOpacity
            key={btn.key}
            style={[styles.filterBtn, filter === btn.key && { backgroundColor: btn.color + '22', borderColor: btn.color }]}
            onPress={() => setFilter(btn.key)}
          >
            <Text style={[styles.filterLabel, filter === btn.key && { color: btn.color, fontWeight: '700' }]}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoStrip}>
        <Text style={styles.infoText}>📊 Ranked by anomaly score · multi-sensor correlation filters noise</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.unitId}
        renderItem={({ item }) => (
          <UnitCard report={item} rank={allReports.indexOf(item) + 1} onPress={() => onSelectUnit(item)} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No units match this filter.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  appTitle: { fontSize: 20, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  subtitle: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  alertSummary: { flexDirection: 'row', gap: 6 },
  alertBubble: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  alertBubbleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  allClearBanner: { backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#BBF7D0' },
  allClearText: { fontSize: 13, color: '#166534', fontWeight: '500' },
  urgentBanner: { backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FECACA' },
  urgentText: { fontSize: 13, color: '#991B1B', fontWeight: '700' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  filterLabel: { fontSize: 12, color: '#6B7280' },
  infoStrip: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#EFF6FF', borderBottomWidth: 1, borderBottomColor: '#DBEAFE' },
  infoText: { fontSize: 11, color: '#1E40AF' },
  list: { paddingVertical: 8 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14 },
});
