import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pickVolumeTsId,
  parseHistory,
  toSnapshot,
  isFresh,
  fetchLiveData,
  DATA_CACHE_KEY,
  TSID_CACHE_KEY,
  DATA_TTL_MS,
} from '../src/utils/bom.ts';
import type { DamRef } from '../src/types.ts';

const HEADERS = ['ts_id', 'ts_name', 'parametertype_name', 'ts_unitsymbol'];

describe('pickVolumeTsId', () => {
  it('returns null for non-array or empty responses', () => {
    expect(pickVolumeTsId(null)).toBeNull();
    expect(pickVolumeTsId({ error: 'DatasourceError' })).toBeNull();
    expect(pickVolumeTsId([])).toBeNull();
    expect(pickVolumeTsId([HEADERS])).toBeNull();
  });

  it('prefers Storage Volume DailyMean in ML', () => {
    const data = [
      HEADERS,
      ['1', 'DMQaQc.Merged.HourlyMean.HR', 'Storage Volume', 'ML'],
      ['2', 'DMQaQc.Merged.DailyMean.09', 'Storage Volume', 'ML'],
      ['3', 'DMQaQc.Merged.DailyMean.09', 'Storage Level', 'm'],
    ];
    expect(pickVolumeTsId(data)).toBe('2');
  });

  it('falls back to any non-manual Storage Volume in ML', () => {
    const data = [
      HEADERS,
      ['1', 'Manual.Entry', 'Storage Volume', 'ML'],
      ['2', 'DMQaQc.Merged.HourlyMean.HR', 'Storage Volume', 'ML'],
    ];
    expect(pickVolumeTsId(data)).toBe('2');
  });

  it('falls back to any Storage Volume as a last resort', () => {
    const data = [
      HEADERS,
      ['7', 'Whatever', 'Storage Volume', 'GL'],
    ];
    expect(pickVolumeTsId(data)).toBe('7');
  });

  it('returns null when no Storage Volume timeseries exists', () => {
    const data = [
      HEADERS,
      ['1', 'DMQaQc.Merged.DailyMean.09', 'Storage Level', 'm'],
    ];
    expect(pickVolumeTsId(data)).toBeNull();
  });

  it('returns null when ts_id column is missing', () => {
    const data = [
      ['ts_name', 'parametertype_name'],
      ['DailyMean', 'Storage Volume'],
    ];
    expect(pickVolumeTsId(data)).toBeNull();
  });
});

describe('parseHistory', () => {
  it('returns empty for malformed responses', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory([])).toEqual([]);
    expect(parseHistory([{}])).toEqual([]);
    expect(parseHistory({ error: 'boom' })).toEqual([]);
  });

  it('parses timestamp/value rows and truncates dates', () => {
    const data = [{
      data: [
        ['2026-07-01T00:00:00.000+10:00', '123456.7'],
        ['2026-07-02T00:00:00.000+10:00', '123500.0'],
      ],
    }];
    expect(parseHistory(data)).toEqual([
      { date: '2026-07-01', value_ml: 123456.7 },
      { date: '2026-07-02', value_ml: 123500.0 },
    ]);
  });

  it('skips null, empty, negative, and non-numeric values', () => {
    const data = [{
      data: [
        ['2026-07-01T00:00:00', null],
        ['2026-07-02T00:00:00', ''],
        ['2026-07-03T00:00:00', '-5'],
        ['2026-07-04T00:00:00', 'abc'],
        ['2026-07-05T00:00:00', '42'],
      ],
    }];
    expect(parseHistory(data)).toEqual([{ date: '2026-07-05', value_ml: 42 }]);
  });
});

describe('toSnapshot', () => {
  const dam = { station_no: '212212', capacity_ml: 2_000_000 };

  it('returns null for empty history', () => {
    expect(toSnapshot(dam, [], '2026-07-12T00:00:00Z')).toBeNull();
  });

  it('computes percent full from the latest value', () => {
    const snap = toSnapshot(dam, [
      { date: '2026-07-01', value_ml: 900_000 },
      { date: '2026-07-02', value_ml: 1_000_000 },
    ], '2026-07-12T00:00:00Z')!;

    expect(snap.station_no).toBe('212212');
    expect(snap.percent_full).toBe(50);
    expect(snap.value_ml).toBe(1_000_000);
    expect(snap.updated).toBe('2026-07-12T00:00:00Z');
    expect(snap.history).toHaveLength(2);
    expect(snap.history[0]).toEqual({ date: '2026-07-01', percent: 45, ml: 900_000 });
  });

  it('caps percent at 100 when a dam spills', () => {
    const snap = toSnapshot(dam, [{ date: '2026-07-01', value_ml: 2_500_000 }], '2026-07-12T00:00:00Z')!;
    expect(snap.percent_full).toBe(100);
    expect(snap.history[0].percent).toBe(100);
  });
});

describe('isFresh', () => {
  const now = 1_800_000_000_000;

  it('is fresh within the TTL', () => {
    expect(isFresh(now - 1000, 60_000, now)).toBe(true);
  });

  it('expires past the TTL', () => {
    expect(isFresh(now - 61_000, 60_000, now)).toBe(false);
  });

  it('rejects future or invalid timestamps', () => {
    expect(isFresh(now + 1000, 60_000, now)).toBe(false);
    expect(isFresh(NaN, 60_000, now)).toBe(false);
  });
});

describe('fetchLiveData', () => {
  const dams: DamRef[] = [{
    id: 'warragamba',
    name: 'Warragamba Dam',
    state: 'NSW',
    capacity_ml: 2_000_000,
    lat: -33.889,
    lon: 150.594,
    authority: 'WaterNSW',
    station_no: '212212',
  }];

  const listResponse = [
    HEADERS,
    ['380185010', 'DMQaQc.Merged.DailyMean.09', 'Storage Volume', 'ML'],
  ];
  const valuesResponse = [{
    data: [
      ['2026-07-10T00:00:00.000+10:00', '1000000'],
      ['2026-07-11T00:00:00.000+10:00', '1100000'],
    ],
  }];

  const okJson = (body: unknown) => ({
    ok: true,
    json: () => Promise.resolve(body),
  }) as Response;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discovers ts_id, fetches history, caches results', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('getTimeseriesList')) return Promise.resolve(okJson(listResponse));
      if (url.includes('getTimeseriesValues')) return Promise.resolve(okJson(valuesResponse));
      return Promise.reject(new Error('unexpected url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const live = await fetchLiveData(dams);
    expect(live).not.toBeNull();
    expect(live!.snapshots).toHaveLength(1);
    expect(live!.snapshots[0].percent_full).toBe(55);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // ts_id and data both cached
    expect(JSON.parse(localStorage.getItem(TSID_CACHE_KEY)!).value['212212']).toBe('380185010');
    expect(JSON.parse(localStorage.getItem(DATA_CACHE_KEY)!).value.snapshots).toHaveLength(1);
  });

  it('serves fresh cache without hitting the network', async () => {
    const cached = { fetched_at: new Date().toISOString(), snapshots: [{ station_no: '212212', percent_full: 50, value_ml: 1, updated: '', history: [] }] };
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), value: cached }));

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const live = await fetchLiveData(dams);
    expect(live!.snapshots[0].percent_full).toBe(50);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores an expired data cache', async () => {
    const cached = { fetched_at: '2026-07-01T00:00:00Z', snapshots: [{ station_no: '212212', percent_full: 50, value_ml: 1, updated: '', history: [] }] };
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ savedAt: Date.now() - DATA_TTL_MS - 1, value: cached }));

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('getTimeseriesList')) return Promise.resolve(okJson(listResponse));
      return Promise.resolve(okJson(valuesResponse));
    });
    vi.stubGlobal('fetch', fetchMock);

    const live = await fetchLiveData(dams);
    expect(live!.snapshots[0].percent_full).toBe(55);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('uses a cached ts_id and skips discovery', async () => {
    localStorage.setItem(TSID_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), value: { '212212': '380185010' } }));

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('getTimeseriesValues')) return Promise.resolve(okJson(valuesResponse));
      return Promise.reject(new Error('should not discover'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const live = await fetchLiveData(dams);
    expect(live!.snapshots).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-discovers when the cached ts_id fails', async () => {
    localStorage.setItem(TSID_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), value: { '212212': 'stale-id' } }));

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('ts_id=stale-id')) return Promise.resolve({ ok: false, status: 404 } as Response);
      if (url.includes('getTimeseriesList')) return Promise.resolve(okJson(listResponse));
      if (url.includes('getTimeseriesValues')) return Promise.resolve(okJson(valuesResponse));
      return Promise.reject(new Error('unexpected url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const live = await fetchLiveData(dams);
    expect(live!.snapshots).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(TSID_CACHE_KEY)!).value['212212']).toBe('380185010');
  });

  it('returns null when every request fails (BOM outage)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

    const live = await fetchLiveData(dams);
    expect(live).toBeNull();
    expect(localStorage.getItem(DATA_CACHE_KEY)).toBeNull();
  });

  it('returns null on HTTP 500 responses without caching', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response)));

    const live = await fetchLiveData(dams);
    expect(live).toBeNull();
    expect(localStorage.getItem(DATA_CACHE_KEY)).toBeNull();
  });
});
