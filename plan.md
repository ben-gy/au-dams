# Site Plan: Australian Reservoir Monitor

## Overview
- **Name:** AU Dams — Australian Reservoir Monitor
- **Repo name:** au-dams
- **Tagline:** Live storage levels for Australia's major dams and reservoirs

## Target Audience
Australian homeowners, farmers, policy researchers, and water-conscious citizens who want to know current water storage conditions across Australia. Particularly useful for people in drought-prone regions and those concerned about water security. SEO targets: "Warragamba Dam level", "Sydney dam storage", "Australian dam levels", "how full is [dam name]".

## Value Proposition
A single, fast, map-based dashboard showing all major Australian reservoirs at a glance — something no official government site does well. Users can instantly see whether their region is heading into a water crisis or recovering from one, compare states, and view 12-month history for any reservoir.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|-------------------|-----------------|----------------|
| BOM WISKI API | http://www.bom.gov.au/waterdata/services | Storage level % for all major reservoirs | Daily | No |
| Embedded reference | src/data/dams.ts | Capacity, location, name, authority | Static | N/A |

## Key Features
1. **Interactive map** — Australia-wide Leaflet map with circle markers sized by capacity, colored by fill %
2. **State overview** — Left panel lists dams grouped by state with current % and trend
3. **Dam detail panel** — Click any dam for 12-month history chart, exact volumes, and metadata
4. **National summary bar** — Header shows total national storage %, Australia's driest/fullest states
5. **Sort & filter** — Sort by name, state, % full, capacity; filter by state or search by name
6. **Color-coded status** — Green (>80%), blue (60-80%), yellow (40-60%), orange (20-40%), red (<20%)
7. **Data freshness** — Shows when pipeline last ran; never silently serves stale data

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite
- **Data strategy:** Pipeline (GitHub Actions → BOM WISKI API → public/data/storage.json)
- **Key libraries:** Leaflet 1.9 (map), no charting library (hand-rolled SVG)
- **Tile layer:** CartoDB dark_all (matches dark theme)

## Layout
- Fixed header (44px): logo, national summary stats, last-updated indicator
- Main area (flex row):
  - Left panel (340px, scrollable): state-grouped dam list with search/sort controls
  - Map (flex 1): Leaflet map fills remaining space
  - Detail panel (360px, sliding): shows when a dam is selected — history chart, volumes, metadata
- Footer status bar (28px): data source attribution, pipeline status

## Pages/Views
Single page. Map is the primary view. Detail panel slides in from right when dam is selected.
