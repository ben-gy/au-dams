// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { DamRef, DamDisplay, NationalStats, StateStats, SortField, SortDir, StorageSnapshot } from '../types.ts';

/**
 * Compute national aggregate statistics across all dams that have snapshot data.
 */
export function getNationalStats(dams: DamDisplay[]): NationalStats {
  const withData = dams.filter(d => d.snapshot !== undefined);
  if (withData.length === 0) {
    return {
      totalCapacity_ml: 0,
      totalCurrent_ml: 0,
      percentFull: 0,
      damsWithData: 0,
      totalDams: dams.length,
      fullestState: '—',
      driestState: '—',
    };
  }

  const totalCapacity_ml = withData.reduce((s, d) => s + d.capacity_ml, 0);
  const totalCurrent_ml = withData.reduce((s, d) => {
    return s + (d.snapshot!.value_ml ?? d.capacity_ml * (d.snapshot!.percent_full / 100));
  }, 0);
  const percentFull = totalCapacity_ml > 0 ? (totalCurrent_ml / totalCapacity_ml) * 100 : 0;

  const stateMap = groupByState(withData);
  const stateEntries = Array.from(stateMap.entries());

  let fullestState = '—';
  let driestState = '—';
  let maxPct = -Infinity;
  let minPct = Infinity;

  for (const [state, stats] of stateEntries) {
    if (stats.percentFull > maxPct) { maxPct = stats.percentFull; fullestState = state; }
    if (stats.percentFull < minPct) { minPct = stats.percentFull; driestState = state; }
  }

  return { totalCapacity_ml, totalCurrent_ml, percentFull, damsWithData: withData.length, totalDams: dams.length, fullestState, driestState };
}

/**
 * Group dams by state and compute per-state statistics.
 */
export function groupByState(dams: DamDisplay[]): Map<string, StateStats> {
  const map = new Map<string, StateStats>();

  for (const dam of dams) {
    if (!map.has(dam.state)) {
      map.set(dam.state, {
        state: dam.state,
        totalCapacity_ml: 0,
        totalCurrent_ml: 0,
        percentFull: 0,
        dams: [],
      });
    }
    const stats = map.get(dam.state)!;
    stats.dams.push(dam);
    stats.totalCapacity_ml += dam.capacity_ml;
    if (dam.snapshot) {
      const currentMl = dam.snapshot.value_ml ?? dam.capacity_ml * (dam.snapshot.percent_full / 100);
      stats.totalCurrent_ml += currentMl;
    }
  }

  for (const stats of map.values()) {
    stats.percentFull = stats.totalCapacity_ml > 0
      ? (stats.totalCurrent_ml / stats.totalCapacity_ml) * 100
      : 0;
  }

  return map;
}

/**
 * Sort dams by the given field and direction.
 */
export function sortDams(dams: DamDisplay[], by: SortField, dir: SortDir = 'asc'): DamDisplay[] {
  const sorted = [...dams].sort((a, b) => {
    let cmp = 0;
    switch (by) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'state':
        cmp = a.state.localeCompare(b.state) || a.name.localeCompare(b.name);
        break;
      case 'capacity':
        cmp = a.capacity_ml - b.capacity_ml;
        break;
      case 'percent': {
        const aP = a.snapshot?.percent_full ?? -1;
        const bP = b.snapshot?.percent_full ?? -1;
        cmp = aP - bP;
        break;
      }
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

/**
 * Filter dams by a search query (matches name, state, or authority).
 */
export function filterDams(dams: DamDisplay[], query: string): DamDisplay[] {
  if (!query.trim()) return dams;
  const q = query.toLowerCase().trim();
  return dams.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.state.toLowerCase().includes(q) ||
    d.authority.toLowerCase().includes(q)
  );
}

/**
 * Merge reference dam data with live snapshot data.
 */
export function mergeDamData(
  refs: DamRef[],
  snapshots: StorageSnapshot[]
): DamDisplay[] {
  const snapMap = new Map(snapshots.map(s => [s.station_no, s]));
  return refs.map(ref => ({
    ...ref,
    snapshot: snapMap.get(ref.station_no),
  }));
}
