import { Asset } from 'expo-asset';

export type SensorReading = {
  timestamp: string;
  temp: number | null;
  pressure: number | null;
  airflow: number | null;
  vibration: number | null;
  power: number | null;
};

export type HVACUnit = {
  id: string;
  name: string;
  location: string;
  readings: SensorReading[];
  meta: {
    installYear: number;
    lastMaintenance: string;
    nominalTemp: number;
    nominalPressure: number;
    nominalAirflow: number;
    nominalVibration: number;
    nominalPower: number;
  };
};

// Static metadata per unit (not in CSV)
const UNIT_META: Record<string, Omit<HVACUnit, 'id' | 'name' | 'readings'>> = {
  HVAC_1: { location: 'Assembly Line A — North Bay',    meta: { installYear: 2019, lastMaintenance: '2024-11-15', nominalTemp: 22.01,  nominalPressure: 1.206, nominalAirflow: 320.1, nominalVibration: 0.020, nominalPower: 4.98 } },
  HVAC_2: { location: 'Assembly Line B — East Bay',     meta: { installYear: 2021, lastMaintenance: '2025-03-01', nominalTemp: 21.99,  nominalPressure: 1.202, nominalAirflow: 319.2, nominalVibration: 0.020, nominalPower: 5.07 } },
  HVAC_3: { location: 'Packaging Zone — West Wing',     meta: { installYear: 2020, lastMaintenance: '2025-01-08', nominalTemp: 21.97,  nominalPressure: 1.190, nominalAirflow: 320.5, nominalVibration: 0.021, nominalPower: 5.00 } },
  HVAC_4: { location: 'Warehouse — Storage Block C',    meta: { installYear: 2018, lastMaintenance: '2024-10-22', nominalTemp: 21.98,  nominalPressure: 1.200, nominalAirflow: 319.5, nominalVibration: 0.020, nominalPower: 4.97 } },
  HVAC_5: { location: 'Server Room — IT Infrastructure',meta: { installYear: 2022, lastMaintenance: '2025-02-14', nominalTemp: 22.00,  nominalPressure: 1.197, nominalAirflow: 319.2, nominalVibration: 0.020, nominalPower: 4.95 } },
};

function parseFloat_or_null(val: string): number | null {
  const v = val.trim();
  if (v === '' || v === 'null' || v === 'NaN') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseCSV(text: string): HVACUnit[] {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const idx = {
    timestamp: headers.indexOf('timestamp'),
    unit_id:   headers.indexOf('unit_id'),
    temp:      headers.indexOf('temp'),
    pressure:  headers.indexOf('pressure'),
    airflow:   headers.indexOf('airflow'),
    vibration: headers.indexOf('vibration'),
    power:     headers.indexOf('power'),
  };

  // Group readings by unit_id, preserving order
  const unitMap = new Map<string, SensorReading[]>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    const unitId = cols[idx.unit_id]?.trim();
    if (!unitId) continue;

    if (!unitMap.has(unitId)) unitMap.set(unitId, []);
    unitMap.get(unitId)!.push({
      timestamp: cols[idx.timestamp]?.trim() ?? '',
      temp:      parseFloat_or_null(cols[idx.temp] ?? ''),
      pressure:  parseFloat_or_null(cols[idx.pressure] ?? ''),
      airflow:   parseFloat_or_null(cols[idx.airflow] ?? ''),
      vibration: parseFloat_or_null(cols[idx.vibration] ?? ''),
      power:     parseFloat_or_null(cols[idx.power] ?? ''),
    });
  }

  const units: HVACUnit[] = [];
  unitMap.forEach((readings, unitId) => {
    const meta = UNIT_META[unitId];
    units.push({
      id: unitId.toLowerCase().replace('_', '-'),
      name: unitId.replace('_', '-'),
      location: meta?.location ?? 'Unknown',
      readings,
      meta: meta?.meta ?? {
        installYear: 2020, lastMaintenance: 'Unknown',
        nominalTemp: 22, nominalPressure: 1.2,
        nominalAirflow: 320, nominalVibration: 0.02, nominalPower: 5.0,
      },
    });
  });

  return units.sort((a, b) => a.name.localeCompare(b.name));
}

// Require the asset at build time so Metro bundles it
const CSV_ASSET = require('../../assets/hvac_sensor_data.csv');

export async function loadHVACData(): Promise<HVACUnit[]> {
  const [asset] = await Asset.loadAsync(CSV_ASSET);
  const uri = asset.localUri ?? asset.uri;
  const response = await fetch(uri);
  const text = await response.text();
  return parseCSV(text);
}
