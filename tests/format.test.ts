import { describe, it, expect } from 'vitest';
import {
  formatGL,
  formatPercent,
  formatDate,
  formatRelative,
  getStorageColor,
  getStorageHex,
  getStorageLabel,
  getMarkerRadius,
} from '../src/utils/format.ts';

describe('formatGL', () => {
  it('formats large volumes with locale commas', () => {
    expect(formatGL(12_467_000)).toBe('12,467 GL');
  });

  it('formats medium volumes without commas', () => {
    expect(formatGL(1_068_000)).toBe('1068 GL');
  });

  it('formats small volumes with one decimal', () => {
    expect(formatGL(49_000)).toBe('49.0 GL');
  });

  it('formats very small volumes correctly', () => {
    expect(formatGL(11_000)).toBe('11.0 GL');
  });

  it('handles zero', () => {
    expect(formatGL(0)).toBe('0.0 GL');
  });
});

describe('formatPercent', () => {
  it('formats normal percentage', () => {
    expect(formatPercent(85.3)).toBe('85.3%');
  });

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats 100%', () => {
    expect(formatPercent(100)).toBe('100.0%');
  });

  it('respects decimals parameter', () => {
    expect(formatPercent(73.456, 2)).toBe('73.46%');
  });

  it('returns dash for NaN/Infinity', () => {
    expect(formatPercent(Infinity)).toBe('—');
    expect(formatPercent(NaN)).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats valid ISO date string', () => {
    const result = formatDate('2026-04-13T00:00:00.000Z');
    // Should contain month abbreviation and year
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/2026/);
  });

  it('handles invalid input gracefully', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('handles ISO date-only string', () => {
    const result = formatDate('2026-01-15T00:00:00Z');
    expect(result).toMatch(/Jan/);
  });
});

describe('formatRelative', () => {
  it('returns "just now" for recent timestamps', () => {
    const recent = new Date(Date.now() - 10_000).toISOString();
    expect(formatRelative(recent)).toBe('just now');
  });

  it('returns hours ago for timestamps within 24h', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(formatRelative(twoHoursAgo)).toBe('2h ago');
  });

  it('returns "yesterday" for ~24h ago', () => {
    const yesterdayish = new Date(Date.now() - 25 * 3_600_000).toISOString();
    expect(formatRelative(yesterdayish)).toBe('yesterday');
  });

  it('returns "unknown" for invalid timestamp', () => {
    expect(formatRelative('invalid')).toBe('unknown');
  });
});

describe('getStorageColor', () => {
  it('returns green for >80%', () => {
    expect(getStorageColor(85)).toBe('var(--status-good)');
    expect(getStorageColor(100)).toBe('var(--status-good)');
  });

  it('returns info/blue for 60-80%', () => {
    expect(getStorageColor(65)).toBe('var(--status-info)');
    expect(getStorageColor(60)).toBe('var(--status-info)');
  });

  it('returns yellow for 40-60%', () => {
    expect(getStorageColor(50)).toBe('var(--status-warn)');
  });

  it('returns orange for 20-40%', () => {
    expect(getStorageColor(30)).toBe('#fb923c');
  });

  it('returns red for <20%', () => {
    expect(getStorageColor(10)).toBe('var(--status-bad)');
    expect(getStorageColor(0)).toBe('var(--status-bad)');
  });
});

describe('getStorageHex', () => {
  it('returns hex green for full dams', () => {
    expect(getStorageHex(90)).toBe('#34d399');
  });

  it('returns hex blue for 60-80%', () => {
    expect(getStorageHex(70)).toBe('#60a5fa');
  });

  it('returns hex red for critically low', () => {
    expect(getStorageHex(5)).toBe('#f87171');
  });

  it('boundary at exactly 80% returns green', () => {
    expect(getStorageHex(80)).toBe('#34d399');
  });

  it('boundary at exactly 20% returns orange', () => {
    expect(getStorageHex(20)).toBe('#fb923c');
  });
});

describe('getStorageLabel', () => {
  it('labels critically low dams', () => {
    expect(getStorageLabel(10)).toBe('Critical');
  });

  it('labels full dams', () => {
    expect(getStorageLabel(95)).toBe('Full');
  });

  it('labels moderate dams', () => {
    expect(getStorageLabel(50)).toBe('Moderate');
  });

  it('labels low dams', () => {
    expect(getStorageLabel(25)).toBe('Low');
  });

  it('labels good dams', () => {
    expect(getStorageLabel(65)).toBe('Good');
  });
});

describe('getMarkerRadius', () => {
  it('max capacity dam gets largest radius', () => {
    const max = 12_467_000;
    expect(getMarkerRadius(max, max)).toBe(28);
  });

  it('very small dam gets minimum radius', () => {
    const radius = getMarkerRadius(1000, 12_467_000);
    expect(radius).toBeGreaterThanOrEqual(6);
  });

  it('medium dam gets medium radius', () => {
    const r = getMarkerRadius(2_000_000, 12_467_000);
    expect(r).toBeGreaterThan(6);
    expect(r).toBeLessThan(28);
  });
});
