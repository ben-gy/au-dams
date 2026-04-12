import './style.css';
import { DAMS, STATE_ORDER } from './data/dams.ts';
import type { DamDisplay, SortField, SortDir, StorageData } from './types.ts';
import { mergeDamData, getNationalStats, groupByState, sortDams, filterDams } from './utils/storage.ts';
import { formatGL, formatPercent, formatDate, formatRelative, getStorageColor, getStorageHex, getStorageLabel } from './utils/format.ts';
import { renderHistoryChart } from './components/chart.ts';
import { initMap } from './components/map.ts';

interface AppState {
  dams: DamDisplay[];
  selectedDam: DamDisplay | null;
  sortField: SortField;
  sortDir: SortDir;
  searchQuery: string;
  dataFetchedAt: string | null;
  loading: boolean;
  error: string | null;
}

const state: AppState = {
  dams: [],
  selectedDam: null,
  sortField: 'percent',
  sortDir: 'desc',
  searchQuery: '',
  dataFetchedAt: null,
  loading: true,
  error: null,
};

function buildShell(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <header class="site-header" role="banner">
      <div class="site-logo">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="14" width="24" height="10" rx="1" fill="#38bdf8" opacity="0.9"/>
          <rect x="6" y="16" width="20" height="6" rx="1" fill="#0ea5e9" opacity="0.7"/>
          <rect x="13" y="8" width="6" height="8" rx="1" fill="#60a5fa"/>
          <path d="M6 19 Q10 17 14 19 Q18 21 22 19 Q26 17 28 19" stroke="#7dd3fc" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
        <div>
          <div class="site-logo-text">AU Dams</div>
          <div class="site-logo-sub">Reservoir Monitor</div>
        </div>
      </div>
      <div class="header-stats" id="header-stats">
        <div class="header-stat">
          <div class="header-stat-label">National Storage</div>
          <div class="header-stat-value" id="stat-national">—</div>
        </div>
        <div class="header-stat">
          <div class="header-stat-label">Fullest State</div>
          <div class="header-stat-value good" id="stat-fullest">—</div>
        </div>
        <div class="header-stat">
          <div class="header-stat-label">Driest State</div>
          <div class="header-stat-value bad" id="stat-driest">—</div>
        </div>
        <div class="header-stat">
          <div class="header-stat-label">Tracking</div>
          <div class="header-stat-value" id="stat-count">— dams</div>
        </div>
      </div>
      <div class="header-right">
        <div class="data-freshness" id="data-freshness">
          <span class="dot"></span>Loading…
        </div>
      </div>
    </header>

    <div class="main-content" role="main">
      <aside class="left-panel" aria-label="Dam list">
        <div class="panel-controls">
          <input
            type="search"
            class="search-input"
            id="search-input"
            placeholder="Search dams…"
            aria-label="Search dams"
          />
          <div class="sort-controls" role="group" aria-label="Sort options">
            <span class="sort-label">Sort:</span>
            <button class="sort-btn" data-sort="percent" aria-pressed="true">% Full</button>
            <button class="sort-btn" data-sort="name">Name</button>
            <button class="sort-btn" data-sort="capacity">Size</button>
            <button class="sort-btn" data-sort="state">State</button>
          </div>
        </div>
        <div class="dam-list" id="dam-list" role="list" aria-label="Australian dams"></div>
      </aside>

      <div class="map-wrap" role="region" aria-label="Map">
        <div id="map"></div>
        <div class="map-legend" aria-hidden="true">
          <div class="legend-title">Storage Level</div>
          <div class="legend-item"><div class="legend-dot" style="background:#34d399"></div>&gt;80% Full</div>
          <div class="legend-item"><div class="legend-dot" style="background:#60a5fa"></div>60–80%</div>
          <div class="legend-item"><div class="legend-dot" style="background:#fbbf24"></div>40–60%</div>
          <div class="legend-item"><div class="legend-dot" style="background:#fb923c"></div>20–40%</div>
          <div class="legend-item"><div class="legend-dot" style="background:#f87171"></div>&lt;20%</div>
        </div>
      </div>

      <aside class="detail-panel" id="detail-panel" aria-label="Dam detail">
        <div class="detail-inner" id="detail-inner"></div>
      </aside>
    </div>

    <footer class="site-footer" role="contentinfo">
      <span class="footer-item">
        Data: <a href="http://www.bom.gov.au/waterdata/" target="_blank" rel="noopener">Bureau of Meteorology Water Data Online</a>
      </span>
      <span class="footer-item">Updated every 6 hours via GitHub Actions</span>
      <span class="footer-item">No tracking · No cookies · Open source</span>
    </footer>
  `;
}

function updateHeaderStats(): void {
  const stats = getNationalStats(state.dams);
  const el = (id: string) => document.getElementById(id);

  const nat = el('stat-national');
  if (nat) {
    nat.textContent = stats.damsWithData > 0 ? formatPercent(stats.percentFull) : '—';
    nat.className = 'header-stat-value';
    if (stats.percentFull >= 60) nat.classList.add('good');
    else if (stats.percentFull >= 40) nat.classList.add('warn');
    else nat.classList.add('bad');
  }

  const fullest = el('stat-fullest');
  if (fullest) fullest.textContent = stats.fullestState;

  const driest = el('stat-driest');
  if (driest) driest.textContent = stats.driestState;

  const count = el('stat-count');
  if (count) count.textContent = `${stats.damsWithData}/${stats.totalDams} dams`;

  const fresh = document.getElementById('data-freshness');
  if (fresh) {
    const dot = fresh.querySelector('.dot') as HTMLElement;
    if (state.dataFetchedAt) {
      const ageH = (Date.now() - new Date(state.dataFetchedAt).getTime()) / 3_600_000;
      dot.className = 'dot' + (ageH > 24 ? ' stale' : '');
      fresh.innerHTML = `<span class="${dot.className}"></span>Data: ${formatRelative(state.dataFetchedAt)}`;
    } else if (state.error) {
      fresh.innerHTML = '<span class="dot error"></span>Data unavailable';
    }
  }
}

function renderDamList(): void {
  const container = document.getElementById('dam-list')!;
  const filtered = filterDams(state.dams, state.searchQuery);
  const sorted = sortDams(filtered, state.sortField, state.sortDir);

  // Group by state if sorting by state/percent/capacity, or flat if by name
  const grouped = state.sortField === 'state' || state.sortField === 'percent' || state.sortField === 'capacity';

  if (grouped) {
    const stateMap = groupByState(sorted);
    const orderedStates = STATE_ORDER.filter(s => stateMap.has(s));
    // Add any states not in STATE_ORDER
    for (const s of stateMap.keys()) {
      if (!orderedStates.includes(s)) orderedStates.push(s);
    }

    let html = '';
    for (const st of orderedStates) {
      const stats = stateMap.get(st)!;
      const statePct = stats.dams.some(d => d.snapshot)
        ? formatPercent(stats.percentFull)
        : '—';
      const color = stats.dams.some(d => d.snapshot) ? getStorageColor(stats.percentFull) : 'var(--text-muted)';
      html += `<div class="state-heading" role="rowgroup">
        <span>${st}</span>
        <span class="state-pct" style="color:${color}">${statePct}</span>
      </div>`;
      for (const dam of stats.dams) {
        html += damItemHtml(dam);
      }
    }
    container.innerHTML = html;
  } else {
    container.innerHTML = sorted.map(damItemHtml).join('');
  }

  // Attach click handlers
  container.querySelectorAll<HTMLElement>('.dam-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id!;
      const dam = state.dams.find(d => d.id === id);
      if (dam) selectDam(dam);
    });
  });

  // Highlight selected
  if (state.selectedDam) {
    const sel = container.querySelector(`[data-id="${state.selectedDam.id}"]`);
    sel?.classList.add('selected');
  }
}

function damItemHtml(dam: DamDisplay): string {
  const pct = dam.snapshot?.percent_full;
  const pctStr = pct !== undefined ? formatPercent(pct) : '';
  const color = pct !== undefined ? getStorageColor(pct) : 'var(--text-muted)';
  const barWidth = pct !== undefined ? Math.min(100, pct) : 0;

  return `
    <div class="dam-item" role="listitem" tabindex="0" data-id="${dam.id}" aria-label="${dam.name}, ${pctStr}">
      <div class="dam-item-name">${dam.name}</div>
      ${pct !== undefined
        ? `<div class="dam-item-pct" style="color:${color}">${pctStr}</div>`
        : `<div class="dam-item-no-data">No data</div>`
      }
      <div class="dam-item-authority">${dam.authority}</div>
      <div class="dam-item-bar-wrap">
        <div class="dam-item-bar" style="width:${barWidth}%;background:${color}"></div>
      </div>
    </div>
  `;
}

function selectDam(dam: DamDisplay): void {
  state.selectedDam = dam;
  renderDetailPanel();
  renderDamList(); // re-render to update selected highlight
}

function renderDetailPanel(): void {
  const panel = document.getElementById('detail-panel')!;
  const inner = document.getElementById('detail-inner')!;
  const dam = state.selectedDam;

  if (!dam) {
    panel.classList.remove('open');
    return;
  }

  panel.classList.add('open');

  const pct = dam.snapshot?.percent_full;
  const ml = dam.snapshot?.value_ml;
  const color = pct !== undefined ? getStorageColor(pct) : 'var(--text-muted)';
  const hex = pct !== undefined ? getStorageHex(pct) : '#3d4f6f';
  const pctStr = pct !== undefined ? formatPercent(pct) : '—';
  const currentVol = ml !== null && ml !== undefined
    ? formatGL(ml)
    : pct !== undefined ? formatGL(dam.capacity_ml * pct / 100) : '—';
  const barWidth = pct !== undefined ? Math.min(100, pct) : 0;
  const label = pct !== undefined ? getStorageLabel(pct) : 'No data';
  const updatedStr = dam.snapshot ? formatDate(dam.snapshot.updated) : '—';

  inner.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-name">${dam.name}</div>
        <div class="detail-meta">${dam.state} · ${dam.authority}</div>
      </div>
      <button class="detail-close" id="detail-close" aria-label="Close detail panel">✕</button>
    </div>

    <div class="detail-storage">
      <div class="storage-big" style="color:${color}">${pctStr}</div>
      <div class="storage-vol">${currentVol} of ${formatGL(dam.capacity_ml)} capacity</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
        <span style="font-size:var(--font-size-xs);padding:1px 6px;border-radius:10px;background:${hex}22;color:${hex};font-weight:600">${label}</span>
      </div>
      <div class="storage-bar-wrap">
        <div class="storage-bar" style="width:${barWidth}%;background:${color}"></div>
      </div>
    </div>

    <div class="detail-stats">
      <div class="detail-stat">
        <div class="detail-stat-label">Capacity</div>
        <div class="detail-stat-value">${formatGL(dam.capacity_ml)}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-label">Current Volume</div>
        <div class="detail-stat-value">${currentVol}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-label">BOM Station</div>
        <div class="detail-stat-value">${dam.station_no}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-label">Last Updated</div>
        <div class="detail-stat-value">${updatedStr}</div>
      </div>
    </div>

    <div class="detail-chart">
      <div class="chart-title">12-month storage history</div>
      <div id="history-chart-container"></div>
    </div>
  `;

  document.getElementById('detail-close')!.addEventListener('click', () => {
    state.selectedDam = null;
    panel.classList.remove('open');
    renderDamList();
  });

  const chartContainer = document.getElementById('history-chart-container')!;
  if (dam.snapshot?.history && dam.snapshot.history.length > 0) {
    renderHistoryChart(dam.snapshot.history, chartContainer);
  } else {
    chartContainer.innerHTML = '<p class="no-history">History data will appear after the pipeline runs.</p>';
  }
}

function updateSortButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('.sort-btn').forEach(btn => {
    const active = btn.dataset.sort === state.sortField;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

async function loadData(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch('/data/storage.json', { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: StorageData = await res.json();

    state.dams = mergeDamData(DAMS, data.snapshots);
    state.dataFetchedAt = data.fetched_at;
    state.loading = false;
  } catch (err) {
    state.loading = false;
    if (err instanceof Error && err.name !== 'AbortError') {
      state.error = err.message;
    }
    // Fall back to reference data only (no snapshot data)
    state.dams = DAMS.map(d => ({ ...d }));
  } finally {
    clearTimeout(timeout);
  }
}

export async function init(): Promise<void> {
  buildShell();

  await loadData();

  // Initialize Leaflet map
  await initMap('map', state.dams, selectDam);

  // Render dam list
  renderDamList();
  updateHeaderStats();

  // Search handler with debounce
  let searchTimer: ReturnType<typeof setTimeout>;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = (e.target as HTMLInputElement).value;
      renderDamList();
    }, 300);
  });

  // Sort buttons
  document.querySelectorAll<HTMLButtonElement>('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.sort as SortField;
      if (state.sortField === field) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortDir = field === 'percent' ? 'desc' : 'asc';
      }
      updateSortButtons();
      renderDamList();
    });
  });

  updateSortButtons();
}
