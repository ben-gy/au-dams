export interface DamRef {
  id: string;
  name: string;
  state: string;
  capacity_ml: number;
  lat: number;
  lon: number;
  authority: string;
  station_no: string;
}

export interface HistoryPoint {
  date: string; // ISO date "YYYY-MM-DD"
  percent: number;
  ml: number | null;
}

export interface StorageSnapshot {
  station_no: string;
  percent_full: number;
  value_ml: number | null;
  updated: string; // ISO timestamp
  history: HistoryPoint[];
}

export interface StorageData {
  fetched_at: string; // ISO timestamp
  snapshots: StorageSnapshot[];
}

export interface DamDisplay extends DamRef {
  snapshot?: StorageSnapshot;
}

export type SortField = 'name' | 'percent' | 'capacity' | 'state';
export type SortDir = 'asc' | 'desc';

export interface NationalStats {
  totalCapacity_ml: number;
  totalCurrent_ml: number;
  percentFull: number;
  damsWithData: number;
  totalDams: number;
  fullestState: string;
  driestState: string;
}

export interface StateStats {
  state: string;
  totalCapacity_ml: number;
  totalCurrent_ml: number;
  percentFull: number;
  dams: DamDisplay[];
}
