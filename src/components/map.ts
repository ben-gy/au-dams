import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import type { DamDisplay } from '../types.ts';
import { getStorageHex, getMarkerRadius, getStorageLabel, formatPercent, formatGL } from '../utils/format.ts';

let mapInstance: LeafletMap | null = null;
let markersLayer: LayerGroup | null = null;
let leaflet: typeof import('leaflet') | null = null;

export async function initMap(
  containerId: string,
  dams: DamDisplay[],
  onSelect: (dam: DamDisplay) => void
): Promise<void> {
  const L = await import('leaflet');
  leaflet = L;

  const container = document.getElementById(containerId)!;
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
    markersLayer = null;
  }

  const map = L.map(container, {
    center: [-27.5, 134],
    zoom: 4,
    zoomControl: true,
  });

  // CartoDB Voyager — clean, neutral light tiles suitable for civic/environment sites
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  mapInstance = map;

  refreshMarkers(dams, onSelect);
}

/**
 * Rebuild the marker layer from current dam data without touching the
 * map view — used when live BOM data arrives after the initial paint.
 */
export function refreshMarkers(
  dams: DamDisplay[],
  onSelect: (dam: DamDisplay) => void
): void {
  const L = leaflet;
  if (!L || !markersLayer) return;

  markersLayer.clearLayers();

  const maxCap = Math.max(...dams.map(d => d.capacity_ml));

  for (const dam of dams) {
    const pct = dam.snapshot?.percent_full;
    const color = pct !== undefined ? getStorageHex(pct) : '#a0aec0';
    const radius = getMarkerRadius(dam.capacity_ml, maxCap);

    const marker = L.circleMarker([dam.lat, dam.lon], {
      radius,
      fillColor: color,
      fillOpacity: 0.75,
      color: color,
      weight: 1.5,
      opacity: 0.9,
    });

    const popupHtml = buildPopupHtml(dam);
    marker.bindPopup(popupHtml, { maxWidth: 220, autoPan: false });

    const tipPct = pct !== undefined ? formatPercent(pct) : 'No data';
    marker.bindTooltip(`${dam.name} · ${tipPct}`, { direction: 'top' });

    marker.on('click', () => {
      onSelect(dam);
    });

    marker.addTo(markersLayer);
  }
}

function buildPopupHtml(dam: DamDisplay): string {
  const pct = dam.snapshot?.percent_full;
  const ml = dam.snapshot?.value_ml;

  const pctStr = pct !== undefined ? formatPercent(pct) : '—';
  const volStr = ml !== null && ml !== undefined ? formatGL(ml) : (pct !== undefined ? formatGL(dam.capacity_ml * pct / 100) : '—');
  const color = pct !== undefined ? getStorageHex(pct) : '#a0aec0';
  const label = pct !== undefined ? getStorageLabel(pct) : 'No data';

  return `
    <div class="popup-name">${dam.name}</div>
    <div class="popup-state">${dam.state} · ${dam.authority}</div>
    <div class="popup-pct" style="color:${color}">${pctStr}</div>
    <div class="popup-vol">${volStr} of ${formatGL(dam.capacity_ml)}</div>
    <span class="popup-status" style="background:${color}22;color:${color}">${label}</span>
  `;
}
