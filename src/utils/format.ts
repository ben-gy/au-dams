/**
 * Format megalitres as gigalitres with appropriate precision.
 * 1 GL = 1,000 ML
 */
export function formatGL(ml: number): string {
  const gl = ml / 1000;
  if (gl >= 10_000) {
    return Math.round(gl).toLocaleString('en-AU') + ' GL';
  }
  if (gl >= 1_000) {
    return gl.toFixed(0) + ' GL';
  }
  if (gl >= 100) {
    return gl.toFixed(1) + ' GL';
  }
  return gl.toFixed(1) + ' GL';
}

/**
 * Format a percentage with one decimal place.
 */
export function formatPercent(p: number, decimals = 1): string {
  if (!isFinite(p)) return '—';
  return p.toFixed(decimals) + '%';
}

/**
 * Format an ISO date string as "13 Apr 2026".
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Australia/Sydney',
  });
}

/**
 * Format an ISO timestamp as a relative time string.
 */
export function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'unknown';
  const diffMs = now - then;
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD === 1) return 'yesterday';
  return `${diffD}d ago`;
}

/**
 * Return a CSS color variable name based on storage percentage.
 */
export function getStorageColor(percent: number): string {
  if (percent >= 80) return 'var(--status-good)';
  if (percent >= 60) return 'var(--status-info)';
  if (percent >= 40) return 'var(--status-warn)';
  if (percent >= 20) return '#fb923c';
  return 'var(--status-bad)';
}

/**
 * Return a hex color based on storage percentage (for Leaflet markers).
 */
export function getStorageHex(percent: number): string {
  if (percent >= 80) return '#34d399';
  if (percent >= 60) return '#60a5fa';
  if (percent >= 40) return '#fbbf24';
  if (percent >= 20) return '#fb923c';
  return '#f87171';
}

/**
 * Return a status label for a storage level.
 */
export function getStorageLabel(percent: number): string {
  if (percent >= 80) return 'Full';
  if (percent >= 60) return 'Good';
  if (percent >= 40) return 'Moderate';
  if (percent >= 20) return 'Low';
  return 'Critical';
}

/**
 * Compute marker radius for Leaflet based on capacity (log-scaled).
 */
export function getMarkerRadius(capacityMl: number, maxCapacityMl: number): number {
  const ratio = Math.log(capacityMl + 1) / Math.log(maxCapacityMl + 1);
  return Math.max(6, Math.round(ratio * 28));
}
