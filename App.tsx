import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { UnitDetailScreen } from './src/screens/UnitDetailScreen';
import { loadHVACData, HVACUnit, UnitAnomalyReport } from './src/types';

type Screen =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'dashboard'; units: HVACUnit[] }
  | { name: 'detail'; report: UnitAnomalyReport & { unit: HVACUnit }; units: HVACUnit[] };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });

  useEffect(() => {
    loadHVACData()
      .then(units => setScreen({ name: 'dashboard', units }))
      .catch(err => setScreen({ name: 'error', message: String(err) }));
  }, []);

  if (screen.name === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading sensor data...</Text>
      </View>
    );
  }

  if (screen.name === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⚠ Failed to load CSV</Text>
        <Text style={styles.errorSub}>{screen.message}</Text>
      </View>
    );
  }

  if (screen.name === 'detail') {
    return (
      <UnitDetailScreen
        report={screen.report}
        onBack={() => setScreen({ name: 'dashboard', units: screen.units })}
      />
    );
  }

  return (
    <DashboardScreen
      units={screen.units}
      onSelectUnit={report =>
        setScreen({ name: 'detail', report, units: (screen as any).units })
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280' },
  errorText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  errorSub: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32 },
});
