import { describe, it, expect } from 'vitest';
import { getNationalStats, groupByState, sortDams, filterDams, mergeDamData } from '../src/utils/storage.ts';
import type { DamDisplay, DamRef, StorageSnapshot } from '../src/types.ts';

const makeDam = (overrides: Partial<DamDisplay> = {}): DamDisplay => ({
  id: 'test',
  name: 'Test Dam',
  state: 'NSW',
  capacity_ml: 1_000_000,
  lat: -33,
  lon: 150,
  authority: 'Test Authority',
  station_no: '999999',
  ...overrides,
});

const makeSnap = (percent_full: number, value_ml: number | null = null): StorageSnapshot => ({
  station_no: '999999',
  percent_full,
  value_ml,
  updated: '2026-04-13T00:00:00Z',
  history: [],
});

describe('getNationalStats', () => {
  it('handles empty array', () => {
    const stats = getNationalStats([]);
    expect(stats.totalCapacity_ml).toBe(0);
    expect(stats.percentFull).toBe(0);
    expect(stats.damsWithData).toBe(0);
    expect(stats.totalDams).toBe(0);
    expect(stats.fullestState).toBe('—');
    expect(stats.driestState).toBe('—');
  });

  it('computes national totals correctly with snapshot data', () => {
    const dams: DamDisplay[] = [
      makeDam({ id: 'a', state: 'NSW', capacity_ml: 1_000_000, snapshot: makeSnap(80, 800_000) }),
      makeDam({ id: 'b', state: 'VIC', capacity_ml: 2_000_000, snapshot: makeSnap(50, 1_000_000) }),
    ];
    const stats = getNationalStats(dams);
    expect(stats.totalCapacity_ml).toBe(3_000_000);
    expect(stats.totalCurrent_ml).toBe(1_800_000);
    expect(stats.percentFull).toBeCloseTo(60, 1);
    expect(stats.damsWithData).toBe(2);
  });

  it('ignores dams without snapshot data', () => {
    const dams: DamDisplay[] = [
      makeDam({ id: 'a', snapshot: makeSnap(80, 800_000) }),
      makeDam({ id: 'b' }), // no snapshot
    ];
    const stats = getNationalStats(dams);
    expect(stats.damsWithData).toBe(1);
    expect(stats.totalDams).toBe(2);
  });

  it('identifies fullest and driest states', () => {
    const dams: DamDisplay[] = [
      makeDam({ id: 'a', state: 'QLD', snapshot: makeSnap(90, 900_000) }),
      makeDam({ id: 'b', state: 'SA', snapshot: makeSnap(20, 200_000) }),
      makeDam({ id: 'c', state: 'NSW', snapshot: makeSnap(60, 600_000) }),
    ];
    const stats = getNationalStats(dams);
    expect(stats.fullestState).toBe('QLD');
    expect(stats.driestState).toBe('SA');
  });

  it('uses estimated volume when value_ml is null', () => {
    const dams: DamDisplay[] = [
      makeDam({ capacity_ml: 1_000_000, snapshot: makeSnap(75, null) }),
    ];
    const stats = getNationalStats(dams);
    expect(stats.totalCurrent_ml).toBeCloseTo(750_000, 0);
    expect(stats.percentFull).toBeCloseTo(75, 1);
  });
});

describe('groupByState', () => {
  it('groups dams by state correctly', () => {
    const dams: DamDisplay[] = [
      makeDam({ id: 'a', state: 'NSW' }),
      makeDam({ id: 'b', state: 'VIC' }),
      makeDam({ id: 'c', state: 'NSW' }),
    ];
    const groups = groupByState(dams);
    expect(groups.has('NSW')).toBe(true);
    expect(groups.has('VIC')).toBe(true);
    expect(groups.get('NSW')!.dams).toHaveLength(2);
    expect(groups.get('VIC')!.dams).toHaveLength(1);
  });

  it('computes state capacity totals', () => {
    const dams: DamDisplay[] = [
      makeDam({ id: 'a', state: 'NSW', capacity_ml: 500_000 }),
      makeDam({ id: 'b', state: 'NSW', capacity_ml: 300_000 }),
    ];
    const groups = groupByState(dams);
    expect(groups.get('NSW')!.totalCapacity_ml).toBe(800_000);
  });

  it('handles dams without snapshots gracefully', () => {
    const dams: DamDisplay[] = [makeDam({ state: 'TAS' })];
    const groups = groupByState(dams);
    expect(groups.get('TAS')!.percentFull).toBe(0);
  });
});

describe('sortDams', () => {
  const dams: DamDisplay[] = [
    makeDam({ id: 'c', name: 'Charlie', state: 'VIC', capacity_ml: 3_000_000, snapshot: makeSnap(30) }),
    makeDam({ id: 'a', name: 'Alpha', state: 'NSW', capacity_ml: 1_000_000, snapshot: makeSnap(80) }),
    makeDam({ id: 'b', name: 'Bravo', state: 'QLD', capacity_ml: 2_000_000, snapshot: makeSnap(55) }),
  ];

  it('sorts by name ascending', () => {
    const sorted = sortDams(dams, 'name', 'asc');
    expect(sorted[0].name).toBe('Alpha');
    expect(sorted[2].name).toBe('Charlie');
  });

  it('sorts by percent descending', () => {
    const sorted = sortDams(dams, 'percent', 'desc');
    expect(sorted[0].snapshot?.percent_full).toBe(80);
    expect(sorted[2].snapshot?.percent_full).toBe(30);
  });

  it('sorts by capacity ascending', () => {
    const sorted = sortDams(dams, 'capacity', 'asc');
    expect(sorted[0].capacity_ml).toBe(1_000_000);
    expect(sorted[2].capacity_ml).toBe(3_000_000);
  });

  it('sorts by state alphabetically', () => {
    const sorted = sortDams(dams, 'state', 'asc');
    expect(sorted[0].state).toBe('NSW');
  });

  it('dams without snapshot sort last when sorting by percent', () => {
    const withNoData: DamDisplay[] = [...dams, makeDam({ id: 'd', name: 'Delta' })];
    const sorted = sortDams(withNoData, 'percent', 'desc');
    expect(sorted[sorted.length - 1].id).toBe('d');
  });

  it('does not mutate the original array', () => {
    const original = [...dams];
    sortDams(dams, 'name', 'desc');
    expect(dams).toEqual(original);
  });
});

describe('filterDams', () => {
  const dams: DamDisplay[] = [
    makeDam({ id: 'w', name: 'Warragamba Dam', state: 'NSW', authority: 'WaterNSW' }),
    makeDam({ id: 'g', name: 'Lake Gordon', state: 'TAS', authority: 'Hydro Tasmania' }),
    makeDam({ id: 'e', name: 'Lake Wivenhoe', state: 'QLD', authority: 'Seqwater' }),
  ];

  it('returns all dams for empty query', () => {
    expect(filterDams(dams, '')).toHaveLength(3);
    expect(filterDams(dams, '   ')).toHaveLength(3);
  });

  it('filters by name (case insensitive)', () => {
    const result = filterDams(dams, 'warra');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('w');
  });

  it('filters by state', () => {
    const result = filterDams(dams, 'tas');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g');
  });

  it('filters by authority', () => {
    const result = filterDams(dams, 'hydro');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g');
  });

  it('returns empty array when no match', () => {
    expect(filterDams(dams, 'zzznomatch')).toHaveLength(0);
  });

  it('matches partial names', () => {
    const result = filterDams(dams, 'lake');
    expect(result).toHaveLength(2);
  });
});

describe('mergeDamData', () => {
  const refs: DamRef[] = [
    { id: 'a', name: 'Alpha', state: 'NSW', capacity_ml: 1_000_000, lat: -33, lon: 150, authority: 'Test', station_no: '111' },
    { id: 'b', name: 'Bravo', state: 'VIC', capacity_ml: 2_000_000, lat: -37, lon: 145, authority: 'Test', station_no: '222' },
  ];

  const snap: StorageSnapshot = {
    station_no: '111',
    percent_full: 75,
    value_ml: 750_000,
    updated: '2026-04-13T00:00:00Z',
    history: [],
  };

  it('merges snapshot data with reference data', () => {
    const merged = mergeDamData(refs, [snap]);
    const alpha = merged.find(d => d.id === 'a')!;
    expect(alpha.snapshot?.percent_full).toBe(75);
  });

  it('leaves dams without snapshots as undefined', () => {
    const merged = mergeDamData(refs, [snap]);
    const bravo = merged.find(d => d.id === 'b')!;
    expect(bravo.snapshot).toBeUndefined();
  });

  it('returns all reference dams', () => {
    const merged = mergeDamData(refs, []);
    expect(merged).toHaveLength(2);
  });

  it('preserves all reference data fields', () => {
    const merged = mergeDamData(refs, [snap]);
    const alpha = merged.find(d => d.id === 'a')!;
    expect(alpha.name).toBe('Alpha');
    expect(alpha.capacity_ml).toBe(1_000_000);
    expect(alpha.station_no).toBe('111');
  });
});
