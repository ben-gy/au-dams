/**
 * Client-side BOM Water Data Online (KISTERS WISKI) fetcher.
 *
 * Fetches Storage Volume (ML) timeseries directly from the browser —
 * the WISKI API is HTTPS, CORS-open, and keyless. Mirrors the logic of
 * pipeline/collect.mjs, which now only refreshes the committed fallback
 * snapshot (public/data/storage.json) monthly.
 *
 * Politeness/robustness:
 * - Results cached in localStorage for 6h (BOM readings are daily).
 * - Resolved ts_ids cached for 30 days (stable WISKI identifiers),
 *   halving the request count on repeat visits.
 * - At most 4 concurrent requests; every failure degrades to the
 *   fallback snapshot rather than throwing.
 */

import type { DamRef, StorageSnapshot } from '../types.ts';

const WISKI_BASE = 'https://www.bom.gov.au/waterdata/services';
const HISTORY_DAYS = 365;
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 15_000;

export const DATA_CACHE_KEY = 'audams:live:v1';
export const TSID_CACHE_KEY = 'audams:tsids:v1';
export const DATA_TTL_MS = 6 * 3_600_000;
export const TSID_TTL_MS = 30 * 86_400_000;

export interface LiveData {
  fetched_at: string;
  snapshots: StorageSnapshot[];
}

/** True if a cache entry saved at `savedAt` is still within `ttlMs` of `now`. */
export function isFresh(savedAt: number, ttlMs: number, now: number): boolean {
  return Number.isFinite(savedAt) && savedAt <= now && now - savedAt < ttlMs;
}

/**
 * Pick the best Storage Volume ts_id from a WISKI getTimeseriesList
 * response (array-of-arrays, first row is headers).
 * Priority: DailyMean in ML → any ML (non-manual) → any Storage Volume.
 */
export function pickVolumeTsId(data: unknown): string | null {
  if (!Array.isArray(data) || data.length < 2) return null;

  const headers = data[0] as string[];
  const rows = data.slice(1) as string[][];
  const tsIdIdx = headers.indexOf('ts_id');
  const tsNameIdx = headers.indexOf('ts_name');
  const paramIdx = headers.indexOf('parametertype_name');
  const unitIdx = headers.indexOf('ts_unitsymbol');
  if (tsIdIdx < 0) return null;

  const field = (row: string[], idx: number) => String(row[idx] ?? '').toLowerCase();

  for (const row of rows) {
    if (field(row, paramIdx).includes('storage volume') &&
        field(row, tsNameIdx).includes('dailymean') &&
        field(row, unitIdx) === 'ml') {
      return row[tsIdIdx];
    }
  }
  for (const row of rows) {
    if (field(row, paramIdx).includes('storage volume') &&
        field(row, unitIdx) === 'ml' &&
        !field(row, tsNameIdx).includes('manual')) {
      return row[tsIdIdx];
    }
  }
  for (const row of rows) {
    if (field(row, paramIdx).includes('storage volume')) {
      return row[tsIdIdx];
    }
  }
  return null;
}

/**
 * Parse a WISKI getTimeseriesValues response into date/value pairs.
 * Response shape: [{ data: [[timestamp, value], ...] }].
 */
export function parseHistory(data: unknown): { date: string; value_ml: number }[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  const series = data[0] as { data?: unknown };
  if (!series || !Array.isArray(series.data)) return [];

  const history: { date: string; value_ml: number }[] = [];
  for (const row of series.data as [string, string][]) {
    const timestamp = row[0];
    const valueStr = row[1];
    if (!timestamp || valueStr === null || valueStr === undefined || valueStr === '') continue;
    const val = parseFloat(String(valueStr));
    if (isNaN(val) || val < 0) continue;
    history.push({ date: String(timestamp).substring(0, 10), value_ml: val });
  }
  return history;
}

/**
 * Build a StorageSnapshot from a dam reference and its volume history.
 * Matches the shape the pipeline writes to storage.json.
 */
export function toSnapshot(
  dam: Pick<DamRef, 'station_no' | 'capacity_ml'>,
  history: { date: string; value_ml: number }[],
  fetchedAtIso: string
): StorageSnapshot | null {
  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const percentFull = Math.min(100, (latest.value_ml / dam.capacity_ml) * 100);

  return {
    station_no: dam.station_no,
    percent_full: parseFloat(percentFull.toFixed(1)),
    value_ml: latest.value_ml,
    updated: fetchedAtIso,
    history: history.map(h => ({
      date: h.date,
      percent: Math.min(100, (h.value_ml / dam.capacity_ml) * 100),
      ml: h.value_ml,
    })),
  };
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function discoverTsId(stationNo: string): Promise<string | null> {
  const url = `${WISKI_BASE}?service=kisters&type=queryServices&request=getTimeseriesList` +
    `&datasource=0&station_no=${encodeURIComponent(stationNo)}` +
    `&returnfields=ts_id,ts_name,parametertype_name,ts_unitsymbol` +
    `&format=json`;
  return pickVolumeTsId(await fetchJson(url));
}

async function fetchVolumeHistory(tsId: string): Promise<{ date: string; value_ml: number }[]> {
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_DAYS * 86_400_000);
  const url = `${WISKI_BASE}?service=kisters&type=queryServices&request=getTimeseriesValues` +
    `&datasource=0&ts_id=${encodeURIComponent(tsId)}` +
    `&from=${fmtDate(from)}&to=${fmtDate(to)}` +
    `&returnfields=Timestamp,Value` +
    `&format=json`;
  return parseHistory(await fetchJson(url));
}

/** localStorage helpers — a full quota or private-mode browser must never break the app. */
function readStore<T>(key: string): { savedAt: number; value: T } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; value: T };
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.savedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStore<T>(key: string, value: T, now: number): void {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: now, value }));
  } catch {
    // ignore — caching is best-effort
  }
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Fetch one dam's snapshot. Tries a cached ts_id first; on any failure
 * re-discovers the ts_id once. Returns null instead of throwing.
 */
async function fetchDamSnapshot(
  dam: DamRef,
  tsIds: Record<string, string>,
  fetchedAtIso: string
): Promise<StorageSnapshot | null> {
  try {
    const cachedTsId = tsIds[dam.station_no];
    if (cachedTsId) {
      try {
        const history = await fetchVolumeHistory(cachedTsId);
        const snap = toSnapshot(dam, history, fetchedAtIso);
        if (snap) return snap;
      } catch {
        // stale ts_id or transient error — fall through to re-discovery
      }
      delete tsIds[dam.station_no];
    }

    const tsId = await discoverTsId(dam.station_no);
    if (!tsId) return null;
    tsIds[dam.station_no] = tsId;

    const history = await fetchVolumeHistory(tsId);
    return toSnapshot(dam, history, fetchedAtIso);
  } catch {
    return null;
  }
}

/**
 * Fetch live storage data for all dams directly from BOM.
 * Returns cached data when fresh; null when nothing could be fetched
 * (offline, BOM outage, CORS failure) — callers keep the fallback snapshot.
 */
export async function fetchLiveData(dams: DamRef[]): Promise<LiveData | null> {
  const now = Date.now();

  const cached = readStore<LiveData>(DATA_CACHE_KEY);
  if (cached && isFresh(cached.savedAt, DATA_TTL_MS, now) && cached.value.snapshots.length > 0) {
    return cached.value;
  }

  const tsIdStore = readStore<Record<string, string>>(TSID_CACHE_KEY);
  const tsIds: Record<string, string> =
    tsIdStore && isFresh(tsIdStore.savedAt, TSID_TTL_MS, now) ? { ...tsIdStore.value } : {};

  const fetchedAtIso = new Date(now).toISOString();
  const results = await mapLimit(dams, CONCURRENCY, d => fetchDamSnapshot(d, tsIds, fetchedAtIso));
  const snapshots = results.filter((s): s is StorageSnapshot => s !== null);

  if (Object.keys(tsIds).length > 0) {
    writeStore(TSID_CACHE_KEY, tsIds, tsIdStore && isFresh(tsIdStore.savedAt, TSID_TTL_MS, now) ? tsIdStore.savedAt : now);
  }

  if (snapshots.length === 0) return null;

  const live: LiveData = { fetched_at: fetchedAtIso, snapshots };
  writeStore(DATA_CACHE_KEY, live, now);
  return live;
}
