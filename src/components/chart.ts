import type { HistoryPoint } from '../types.ts';

/**
 * Render an SVG area chart for dam storage history.
 * Returns an SVG element string (or an actual SVGElement).
 */
export function renderHistoryChart(history: HistoryPoint[], container: HTMLElement): void {
  container.innerHTML = '';

  if (history.length < 2) {
    const msg = document.createElement('p');
    msg.className = 'no-history';
    msg.textContent = 'No history data available yet.';
    container.appendChild(msg);
    return;
  }

  const W = container.clientWidth || 320;
  const H = 130;
  const PAD = { top: 12, right: 8, bottom: 24, left: 30 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;
  const minPct = 0;
  const maxPct = 100;

  const xScale = (i: number) => PAD.left + (i / (n - 1)) * chartW;
  const yScale = (p: number) => PAD.top + chartH - ((p - minPct) / (maxPct - minPct)) * chartH;

  // Build path data
  const points = sorted.map((pt, i) => ({ x: xScale(i), y: yScale(pt.percent) }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[n - 1].x.toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

  // X-axis labels — show ~5 evenly spaced month markers
  const xLabels: Array<{ x: number; label: string }> = [];
  const step = Math.max(1, Math.floor(n / 5));
  for (let i = 0; i < n; i += step) {
    const d = new Date(sorted[i].date);
    const label = d.toLocaleDateString('en-AU', { month: 'short', timeZone: 'Australia/Sydney' });
    xLabels.push({ x: xScale(i), label });
  }

  // Y-axis grid lines at 25, 50, 75%
  const yGridLines = [25, 50, 75].map(p => ({ y: yScale(p), label: `${p}%` }));

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.classList.add('history-chart');

  // Gradient definition
  const defs = document.createElementNS(ns, 'defs');
  const grad = document.createElementNS(ns, 'linearGradient');
  grad.setAttribute('id', 'area-grad');
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
  const stop1 = document.createElementNS(ns, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', '#38bdf8');
  stop1.setAttribute('stop-opacity', '0.25');
  const stop2 = document.createElementNS(ns, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', '#38bdf8');
  stop2.setAttribute('stop-opacity', '0.02');
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Y-axis grid lines
  for (const gl of yGridLines) {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', String(PAD.left));
    line.setAttribute('x2', String(PAD.left + chartW));
    line.setAttribute('y1', String(gl.y));
    line.setAttribute('y2', String(gl.y));
    line.setAttribute('stroke', '#1e2d45');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', String(PAD.left - 4));
    text.setAttribute('y', String(gl.y + 3));
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('fill', '#5b6a8b');
    text.setAttribute('font-size', '9');
    text.setAttribute('font-family', 'SF Mono, Fira Code, monospace');
    text.textContent = gl.label;
    svg.appendChild(text);
  }

  // Area fill
  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', 'url(#area-grad)');
  svg.appendChild(area);

  // Line
  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', linePath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#38bdf8');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);

  // X-axis labels
  for (const lbl of xLabels) {
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', String(lbl.x));
    text.setAttribute('y', String(H - 4));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#5b6a8b');
    text.setAttribute('font-size', '9');
    text.setAttribute('font-family', '-apple-system, Helvetica, sans-serif');
    text.textContent = lbl.label;
    svg.appendChild(text);
  }

  container.appendChild(svg);
}
