/**
 * BOM WISKI water storage data collector.
 * Fetches storage level (% full) for major Australian reservoirs from the
 * Bureau of Meteorology Water Data Online KISTERS API.
 *
 * Outputs: public/data/storage.json
 *
 * WISKI API base: http://www.bom.gov.au/waterdata/services
 * All data is public — no authentication required.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data');
const OUT_FILE = join(OUT_DIR, 'storage.json');

const WISKI_BASE = 'http://www.bom.gov.au/waterdata/services';

/** Reference list of major Australian reservoirs */
const DAMS = [
  // NSW
  { id: 'eucumbene',  station_no: '410088', name: 'Lake Eucumbene' },
  { id: 'hume',       station_no: '401507', name: 'Lake Hume' },
  { id: 'warragamba', station_no: '212212', name: 'Warragamba Dam' },
  { id: 'burrendong', station_no: '421112', name: 'Burrendong Reservoir' },
  { id: 'blowering',  station_no: '412107', name: 'Blowering Reservoir' },
  { id: 'copeton',    station_no: '416014', name: 'Copeton Reservoir' },
  { id: 'burrinjuck', station_no: '412030', name: 'Burrinjuck Reservoir' },
  { id: 'keepit',     station_no: '418025', name: 'Keepit Reservoir' },
  { id: 'windamere',  station_no: '421200', name: 'Lake Windamere' },
  { id: 'glenbawn',   station_no: '210044', name: 'Glenbawn Reservoir' },
  // ACT
  { id: 'googong',    station_no: '410151', name: 'Googong Reservoir' },
  // VIC
  { id: 'dartmouth',  station_no: '403205', name: 'Lake Dartmouth' },
  { id: 'eildon',     station_no: '404207', name: 'Lake Eildon' },
  { id: 'thomson',    station_no: '228207', name: 'Thomson Reservoir' },
  { id: 'cardinia',   station_no: '227232', name: 'Cardinia Reservoir' },
  // QLD
  { id: 'wivenhoe',   station_no: '143009', name: 'Lake Wivenhoe' },
  { id: 'somerset',   station_no: '143028', name: 'Somerset Dam' },
  { id: 'hinze',      station_no: '145014', name: 'Hinze Dam' },
  { id: 'north_pine', station_no: '143068', name: 'North Pine Dam' },
  // SA
  { id: 'mt_bold',    station_no: '504584', name: 'Mount Bold Reservoir' },
  { id: 'happy_valley', station_no: '502198', name: 'Happy Valley Reservoir' },
  // WA
  { id: 'mundaring',  station_no: '616008', name: 'Mundaring Weir' },
  { id: 'serpentine', station_no: '616107', name: 'Serpentine Reservoir' },
  { id: 'north_dandalup', station_no: '616115', name: 'North Dandalup Reservoir' },
  // TAS
  { id: 'gordon',     station_no: '316039', name: 'Lake Gordon' },
  { id: 'great_lake', station_no: '314213', name: 'Great Lake' },
];

const HISTORY_DAYS = 365;
const PARAM_NAMES = ['Storage Level - %Full', 'Storage Level (% Full)', 'Percent Full', '%Full'];

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Get the ts_id for the storage % timeseries at a given station.
 * Tries multiple parametertype_name values.
 */
async function getStorageTsId(stationNo) {
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

  // First row is headers
  const headers = data[0];
  const rows = data.slice(1);
  const tsIdIdx = headers.indexOf('ts_id');
  const tsNameIdx = headers.indexOf('ts_name');
  const paramIdx = headers.indexOf('parametertype_name');

  if (tsIdIdx < 0) return null;

  // Look for storage % parameter
  for (const row of rows) {
    const paramName = row[paramIdx] ?? '';
    const tsName = row[tsNameIdx] ?? '';
    const combined = (paramName + ' ' + tsName).toLowerCase();

    if (
      PARAM_NAMES.some(p => paramName.toLowerCase().includes(p.toLowerCase())) ||
      combined.includes('%full') ||
      combined.includes('percent full') ||
      combined.includes('storage level') && combined.includes('%')
    ) {
      return row[tsIdIdx];
    }
  }

  return null;
}

/**
 * Fetch time series values for a given ts_id over the past N days.
 * Returns array of { date, percent } objects.
 */
async function fetchHistory(tsId) {
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_DAYS * 86_400_000);
  const toStr = formatDate(to);
  const fromStr = formatDate(from);

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

  // Response is an array; first element has .data
  const series = data[0];
  if (!series || !Array.isArray(series.data)) return [];

  const history = [];
  for (const row of series.data) {
    const timestamp = row[0];
    const valueStr = row[1];
    if (!timestamp || valueStr === null || valueStr === undefined || valueStr === '') continue;
    const val = parseFloat(valueStr);
    if (isNaN(val) || val < 0 || val > 110) continue; // sanity check

    // Parse date from ISO timestamp
    const dateStr = timestamp.substring(0, 10); // "YYYY-MM-DD"
    history.push({ date: dateStr, percent: Math.min(100, val), ml: null });
  }

  return history;
}

function formatDate(d) {
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

    const tsId = await getStorageTsId(dam.station_no);
    if (!tsId) {
      console.log(`     ⚠  No storage ts_id found`);
      continue;
    }

    console.log(`     ts_id: ${tsId}`);
    const history = await fetchHistory(tsId);

    if (history.length === 0) {
      console.log(`     ⚠  No history data`);
      continue;
    }

    const latest = history[history.length - 1];
    const percentFull = latest.percent;

    snapshots.push({
      station_no: dam.station_no,
      percent_full: percentFull,
      value_ml: null, // BOM WISKI % only; volume requires separate fetch
      updated: new Date().toISOString(),
      history: history,
    });

    console.log(`     ✓  ${percentFull.toFixed(1)}% full (${history.length} data points)`);
    successCount++;

    // Small delay to be respectful of the API
    await new Promise(r => setTimeout(r, 250));
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
