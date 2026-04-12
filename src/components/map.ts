import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import type { DamDisplay } from '../types.ts';
import { getStorageHex, getMarkerRadius, getStorageLabel, formatPercent, formatGL } from '../utils/format.ts';

let mapInstance: LeafletMap | null = null;

export async function initMap(
  containerId: string,
  dams: DamDisplay[],
  onSelect: (dam: DamDisplay) => void
): Promise<void> {
  const L = await import('leaflet');

  const container = document.getElementById(containerId)!;
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  const map = L.map(container, {
    center: [-27.5, 134],
    zoom: 4,
    zoomControl: true,
  });

  // CartoDB dark tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  const maxCap = Math.max(...dams.map(d => d.capacity_ml));

  for (const dam of dams) {
    const pct = dam.snapshot?.percent_full;
    const color = pct !== undefined ? getStorageHex(pct) : '#3d4f6f';
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

    marker.on('click', () => {
      onSelect(dam);
    });

    marker.addTo(map);
  }

  mapInstance = map;
}

export function updateMapMarker(_dam: DamDisplay): void {
  // Markers are rebuilt on full re-render; individual updates not needed for static pipeline data
}

function buildPopupHtml(dam: DamDisplay): string {
  const pct = dam.snapshot?.percent_full;
  const ml = dam.snapshot?.value_ml;

  const pctStr = pct !== undefined ? formatPercent(pct) : '—';
  const volStr = ml !== null && ml !== undefined ? formatGL(ml) : (pct !== undefined ? formatGL(dam.capacity_ml * pct / 100) : '—');
  const color = pct !== undefined ? getStorageHex(pct) : '#3d4f6f';
  const label = pct !== undefined ? getStorageLabel(pct) : 'No data';

  return `
    <div class="popup-name">${dam.name}</div>
    <div class="popup-state">${dam.state} · ${dam.authority}</div>
    <div class="popup-pct" style="color:${color}">${pctStr}</div>
    <div class="popup-vol">${volStr} of ${formatGL(dam.capacity_ml)}</div>
    <span class="popup-status" style="background:${color}22;color:${color}">${label}</span>
  `;
}
