import { HVACUnit, SensorReading } from '../data/csvLoader';

export type SensorName = 'temp' | 'airflow' | 'vibration' | 'pressure' | 'power';

export type SensorScore = {
  sensor: SensorName;
  zScore: number;
  rateOfChange: number;
  trend: 'rising' | 'falling' | 'stable';
  anomalous: boolean;
  lastValue: number | null;
  baselineMean: number;
  baselineStd: number;
};

export type UnitAnomalyReport = {
  unitId: string;
  priority: number;
  level: 'normal' | 'watch' | 'warning' | 'critical';
  sensorScores: SensorScore[];
  correlatedSensors: SensorName[];
  dominantIssue: string;
  dataQuality: number;
  missingRateLast24: number;
};

const SENSOR_WEIGHTS: Record<SensorName, number> = {
  vibration: 1.5,
  power:     1.3,
  temp:      1.2,
  pressure:  1.3,
  airflow:   1.0,
};

const Z_THRESHOLD = 2.0;

function interpolateMissing(values: (number | null)[]): number[] {
  const result: number[] = new Array(values.length).fill(0);
  let lastKnown: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) { lastKnown = values[i] as number; result[i] = lastKnown; }
    else if (lastKnown !== null) result[i] = lastKnown;
  }
  let firstKnown: number | null = null;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null) firstKnown = values[i] as number;
    else if (firstKnown !== null && result[i] === 0) result[i] = firstKnown;
  }
  return result;
}

function computeStats(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, std: Math.max(Math.sqrt(variance), 1e-6) };
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  return den === 0 ? 0 : num / den;
}

function scoreSensor(
  readings: SensorReading[],
  sensor: SensorName,
  baselineWindow = 100,
  recentWindow = 24
): SensorScore {
  const allValues = readings.map(r => r[sensor] as number | null);
  const filled = interpolateMissing(allValues);
  const baseline = filled.slice(0, baselineWindow);
  const recent = filled.slice(-recentWindow);
  const lastValue = allValues[allValues.length - 1];
  const { mean, std } = computeStats(baseline);
  const recentMean = computeStats(recent).mean;
  const zScore = (recentMean - mean) / std;
  const roc = linearSlope(filled.slice(-24));
  const rocNorm = Math.abs(roc) / std;
  const trend: 'rising' | 'falling' | 'stable' =
    rocNorm > 0.05 ? (roc > 0 ? 'rising' : 'falling') : 'stable';
  return { sensor, zScore, rateOfChange: roc, trend, anomalous: Math.abs(zScore) > Z_THRESHOLD, lastValue, baselineMean: mean, baselineStd: std };
}

function describeIssue(scores: SensorScore[], correlated: SensorName[]): string {
  if (correlated.length === 0) {
    const top = [...scores].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))[0];
    if (!top?.anomalous) return 'All sensors within normal range';
    return `${top.sensor} deviation — isolated, likely noise or calibration drift`;
  }
  const has = (s: SensorName) => correlated.includes(s);
  if (has('vibration') && has('power') && has('airflow') && has('temp'))
    return 'Motor/bearing failure: vibration + power surge + airflow drop + heat — inspect immediately';
  if (has('vibration') && has('power') && has('airflow'))
    return 'Fan/motor degradation: vibration rising, power up, airflow dropping';
  if (has('vibration') && has('power'))
    return 'Bearing degradation pattern: vibration + motor power both rising';
  if (has('pressure') && !has('vibration') && !has('power'))
    return 'Pressure anomaly — possible refrigerant loss or pressure sensor fault';
  if (has('temp') && has('airflow') && !has('vibration'))
    return 'Airflow restriction: reduced flow causing temperature rise';
  if (has('power') && has('temp') && !has('vibration'))
    return 'Compressor strain: power and temperature elevated together';
  return `Multi-sensor anomaly: ${correlated.join(', ')} deviating together`;
}

export function analyzeUnit(unit: HVACUnit): UnitAnomalyReport {
  const sensors: SensorName[] = ['temp', 'airflow', 'vibration', 'pressure', 'power'];
  const sensorScores = sensors.map(s => scoreSensor(unit.readings, s));
  const correlated = sensorScores.filter(s => s.anomalous).map(s => s.sensor);
  const last24 = unit.readings.slice(-24);
  const missingCount = last24.reduce((acc, r) => acc + sensors.filter(s => r[s] === null).length, 0);
  const missingRate = missingCount / (last24.length * sensors.length);
  const dataQuality = Math.max(0.3, 1 - missingRate * 2);
  let rawScore = sensorScores.reduce((acc, s) => acc + SENSOR_WEIGHTS[s.sensor] * Math.min(Math.abs(s.zScore), 8), 0);
  let priority = Math.min(100, (rawScore / 50) * 100);
  if (correlated.length >= 2) priority = Math.min(100, priority * 1.5);
  if (correlated.length >= 3) priority = Math.min(100, priority * 1.3);
  if (correlated.length >= 4) priority = Math.min(100, priority * 1.2);
  const maxRocNorm = Math.max(...sensorScores.map(s => Math.abs(s.rateOfChange) / Math.max(s.baselineStd, 1e-6)));
  if (maxRocNorm > 0.5) priority = Math.min(100, priority * 1.2);
  priority = Math.round(priority * dataQuality);
  const level: UnitAnomalyReport['level'] =
    priority >= 70 ? 'critical' : priority >= 45 ? 'warning' : priority >= 20 ? 'watch' : 'normal';
  return { unitId: unit.id, priority, level, sensorScores, correlatedSensors: correlated, dominantIssue: describeIssue([...sensorScores], correlated), dataQuality, missingRateLast24: missingRate };
}

export function analyzeAllUnits(units: HVACUnit[]): (UnitAnomalyReport & { unit: HVACUnit })[] {
  return units.map(unit => ({ ...analyzeUnit(unit), unit })).sort((a, b) => b.priority - a.priority);
}
