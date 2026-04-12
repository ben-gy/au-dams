# AU Dams — Australian Reservoir Monitor

**Live storage levels for Australia's major dams and reservoirs**

🔗 **Live:** [https://au-dams.benrichardson.dev](https://au-dams.benrichardson.dev)

## What is this?

AU Dams is a real-time web dashboard tracking water storage levels across 26 major Australian reservoirs. It fetches daily storage readings from the Bureau of Meteorology's Water Data Online (KISTERS/WISKI) API and renders them on an interactive map alongside sortable tables and 12-month history charts.

The site covers reservoirs in every state and territory — from Warragamba Dam (Sydney's primary water supply) to Lake Gordon in Tasmania (Australia's largest by volume). Each reservoir shows current percentage full, storage volume, capacity, and trend data over the past 12 months.

Water storage levels are updated every 6 hours via a GitHub Actions data pipeline that writes processed JSON to the repository. The static site then reads that JSON — no backend server required.

## Who is this for?

Australians who want to quickly check water security conditions across the country — homeowners on tank water wondering about upstream supply, farmers tracking catchment recovery after drought, journalists or researchers monitoring long-term trends, and policy watchers keeping an eye on climate resilience. If you've ever Googled "how full is Warragamba Dam", this is the site you wanted.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| [BOM Water Data Online](http://www.bom.gov.au/waterdata/) | Storage level % for all major reservoirs via KISTERS WISKI API | Daily readings |

All data is publicly available from the Australian Bureau of Meteorology under the Water Regulations 2008. No authentication is required.

## Features

- **Interactive Leaflet map** — All 26 dams shown as circles sized by capacity, color-coded by fill level
- **State-grouped dam list** — Scrollable sidebar with per-state aggregate storage and individual dam readings
- **12-month history chart** — SVG area chart showing storage trajectory for the selected dam
- **National summary header** — Aggregate storage %, fullest state, driest state, dam count
- **Sort & search** — Sort by % full, name, capacity, or state; search by dam name, state, or authority
- **Color-coded status** — Green (>80%), blue (60–80%), yellow (40–60%), orange (20–40%), red (<20%)
- **Dark theme** — Full dark UI with CartoDB dark map tiles

## Tech Stack

- **Runtime:** Vanilla TypeScript
- **Build:** Vite 6
- **Testing:** Vitest (59 tests)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** GitHub Actions pipeline → BOM WISKI API → `public/data/storage.json`
- **Map:** Leaflet 1.9 with CartoDB dark tiles
- **Charts:** Hand-rolled SVG (no D3)

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build
npm run preview
```

## How it works

1. **Pipeline** (`pipeline/collect.mjs`) runs every 6 hours via GitHub Actions
2. For each reservoir, it queries the BOM WISKI API's `getTimeseriesList` to find the "Storage Level - %Full" timeseries ID
3. It then fetches 365 days of daily readings with `getTimeseriesValues`
4. Results are written to `public/data/storage.json` and committed to the repo
5. GitHub Pages serves the updated JSON alongside the static site
6. The browser fetches `/data/storage.json` on page load and renders the dashboard

## License

MIT
