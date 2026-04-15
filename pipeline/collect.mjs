/**
 * BOM WISKI water storage data collector.
 * Fetches Storage Volume (ML) for major Australian reservoirs from the
 * Bureau of Meteorology Water Data Online KISTERS API, then computes
 * percent full from known capacities.
 *
 * Outputs: public/data/storage.json
 *
 * WISKI API base: https://www.bom.gov.au/waterdata/services
 * All data is public — no authentication required.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data');
const OUT_FILE = join(OUT_DIR, 'storage.json');

const WISKI_BASE = 'https://www.bom.gov.au/waterdata/services';

/**
 * Reference list of major Australian reservoirs.
 * capacity_ml is the full supply capacity in megalitres.
 */
const DAMS = [
  // NSW
  { id: 'eucumbene',  station_no: '222538',     name: 'Lake Eucumbene',       capacity_ml: 4798400 },
  { id: 'warragamba', station_no: '212212',     name: 'Warragamba Dam',        capacity_ml: 2027000 },
  { id: 'burrendong', station_no: '421078',     name: 'Burrendong Reservoir',  capacity_ml: 1188000 },
  { id: 'blowering',  station_no: '412107',     name: 'Blowering Reservoir',   capacity_ml: 1631000 },
  { id: 'copeton',    station_no: '418035',     name: 'Copeton Reservoir',     capacity_ml: 1361000 },
  { id: 'burrinjuck', station_no: '410131',     name: 'Burrinjuck Reservoir',  capacity_ml: 1026000 },
  { id: 'keepit',     station_no: '419041',     name: 'Keepit Reservoir',      capacity_ml: 425510 },
  { id: 'windamere',  station_no: '421148',     name: 'Lake Windamere',        capacity_ml: 368120 },
  { id: 'glenbawn',   station_no: '210097',     name: 'Glenbawn Reservoir',    capacity_ml: 750000 },
  // NSW/VIC
  { id: 'hume',       station_no: '401027',     name: 'Lake Hume',             capacity_ml: 3005157 },
  // ACT
  { id: 'googong',    station_no: '410748',     name: 'Googong Reservoir',     capacity_ml: 121400 },
  // VIC
  { id: 'dartmouth',  station_no: '401224A',    name: 'Lake Dartmouth',        capacity_ml: 3856232 },
  { id: 'eildon',     station_no: 'sp-o10334',  name: 'Lake Eildon',           capacity_ml: 3334158 },
  { id: 'thomson',    station_no: '225256A',    name: 'Thomson Reservoir',     capacity_ml: 1068000 },
  { id: 'cardinia',   station_no: '228263A',    name: 'Cardinia Reservoir',    capacity_ml: 286000 },
  // QLD
  { id: 'wivenhoe',   station_no: '143036A',    name: 'Lake Wivenhoe',        capacity_ml: 1165238 },
  { id: 'somerset',   station_no: '143305A',    name: 'Somerset Dam',          capacity_ml: 379849 },
  { id: 'hinze',      station_no: '146033A',    name: 'Hinze Dam',             capacity_ml: 310730 },
  { id: 'north_pine', station_no: '142801A',    name: 'North Pine Dam',        capacity_ml: 214302 },
  // SA
  { id: 'mt_bold',    station_no: 'SAWMTBORS.1', name: 'Mount Bold Reservoir', capacity_ml: 46200 },
  { id: 'happy_valley', station_no: 'SAWHAPVRS.1', name: 'Happy Valley Reservoir', capacity_ml: 11600 },
  // WA
  { id: 'mundaring',  station_no: 'PI_230045.1',  name: 'Mundaring Weir',       capacity_ml: 63600 },
  { id: 'serpentine', station_no: 'PI_238185.1',  name: 'Serpentine Reservoir',  capacity_ml: 137580 },
  { id: 'north_dandalup', station_no: 'PI_14564.1', name: 'North Dandalup Reservoir', capacity_ml: 60800 },
  // TAS
  { id: 'gordon',     station_no: '646.1',      name: 'Lake Gordon',           capacity_ml: 12359300 },
  { id: 'great_lake', station_no: '139.2',      name: 'Great Lake',            capacity_ml: 2274000 },
];

const HISTORY_DAYS = 365;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Get the ts_id for Storage Volume (ML) daily mean timeseries at a station.
 */
async function getVolumeTsId(stationNo) {
  const url = `${WISKI_BASE}?service=kisters&type=queryServices&request=getTimeseriesList` +
    `&datasource=0&station_no=${stationNo}` +
    `&returnfields=ts_id,ts_name,parametertype_name,ts_unitsymbol` +
    `&format=json`;

  let data;
  try {
    data = await fetchJson(url);
  } catch (err) {
    console.warn(`  [WARN] getTimeseriesList failed for ${stationNo}: ${err.message}`);
    return null;
  }

  if (!Array.isArray(data) || data.length < 2) return null;

  const headers = data[0];
  const rows = data.slice(1);
  const tsIdIdx = headers.indexOf('ts_id');
  const tsNameIdx = headers.indexOf('ts_name');
  const paramIdx = headers.indexOf('parametertype_name');
  const unitIdx = headers.indexOf('ts_unitsymbol');

  if (tsIdIdx < 0) return null;

  // Priority 1: Storage Volume DailyMean (best for dashboard — smooth, one value per day)
  for (const row of rows) {
    const param = (row[paramIdx] ?? '').toLowerCase();
    const name = (row[tsNameIdx] ?? '').toLowerCase();
    const unit = (row[unitIdx] ?? '').toLowerCase();
    if (param.includes('storage volume') && name.includes('dailymean') && unit === 'ml') {
      return row[tsIdIdx];
    }
  }

  // Priority 2: Any Storage Volume with unit ML
  for (const row of rows) {
    const param = (row[paramIdx] ?? '').toLowerCase();
    const name = (row[tsNameIdx] ?? '').toLowerCase();
    const unit = (row[unitIdx] ?? '').toLowerCase();
    if (param.includes('storage volume') && unit === 'ml' && !name.includes('manual')) {
      return row[tsIdIdx];
    }
  }

  // Priority 3: Any Storage Volume
  for (const row of rows) {
    const param = (row[paramIdx] ?? '').toLowerCase();
    if (param.includes('storage volume')) {
      return row[tsIdIdx];
    }
  }

  return null;
}

/**
 * Fetch time series values for a given ts_id over the past N days.
 * Returns array of { date, value_ml } objects.
 */
async function fetchHistory(tsId) {
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_DAYS * 86_400_000);
  const toStr = fmtDate(to);
  const fromStr = fmtDate(from);

  const url = `${WISKI_BASE}?service=kisters&type=queryServices&request=getTimeseriesValues` +
    `&datasource=0&ts_id=${tsId}` +
    `&from=${fromStr}&to=${toStr}` +
    `&returnfields=Timestamp,Value` +
    `&format=json`;

  let data;
  try {
    data = await fetchJson(url);
  } catch (err) {
    console.warn(`  [WARN] getTimeseriesValues failed for ts_id ${tsId}: ${err.message}`);
    return [];
  }

  if (!Array.isArray(data) || data.length === 0) return [];

  const series = data[0];
  if (!series || !Array.isArray(series.data)) return [];

  const history = [];
  for (const row of series.data) {
    const timestamp = row[0];
    const valueStr = row[1];
    if (!timestamp || valueStr === null || valueStr === undefined || valueStr === '') continue;
    const val = parseFloat(valueStr);
    if (isNaN(val) || val < 0) continue;

    const dateStr = timestamp.substring(0, 10);
    history.push({ date: dateStr, value_ml: val });
  }

  return history;
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  console.log('🌊 AU Dams — collecting BOM water storage data…');
  mkdirSync(OUT_DIR, { recursive: true });

  const snapshots = [];
  let successCount = 0;

  for (const dam of DAMS) {
    console.log(`  → ${dam.name} (${dam.station_no})`);

    const tsId = await getVolumeTsId(dam.station_no);
    if (!tsId) {
      console.log(`     ⚠  No storage volume ts_id found`);
      continue;
    }

    console.log(`     ts_id: ${tsId}`);
    const history = await fetchHistory(tsId);

    if (history.length === 0) {
      console.log(`     ⚠  No history data`);
      continue;
    }

    // Compute percent full from volume and known capacity
    const latest = history[history.length - 1];
    const percentFull = Math.min(100, (latest.value_ml / dam.capacity_ml) * 100);

    // Convert history to include percent
    const historyWithPct = history.map(h => ({
      date: h.date,
      percent: Math.min(100, (h.value_ml / dam.capacity_ml) * 100),
      ml: h.value_ml,
    }));

    snapshots.push({
      station_no: dam.station_no,
      percent_full: parseFloat(percentFull.toFixed(1)),
      value_ml: latest.value_ml,
      updated: new Date().toISOString(),
      history: historyWithPct,
    });

    console.log(`     ✓  ${percentFull.toFixed(1)}% full — ${latest.value_ml.toLocaleString()} ML (${history.length} data points)`);
    successCount++;

    // Small delay to be respectful of the API
    await new Promise(r => setTimeout(r, 300));
  }

  const output = {
    fetched_at: new Date().toISOString(),
    snapshots,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Done — ${successCount}/${DAMS.length} dams fetched`);
  console.log(`   Written to ${OUT_FILE}`);
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
