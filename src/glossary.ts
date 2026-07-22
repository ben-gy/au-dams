// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * Domain glossary for Australian water storage terminology.
 * Used by inline ℹ tooltips throughout the UI.
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const glossary: Record<string, GlossaryEntry> = {
  'storage_level': {
    term: 'Storage Level',
    definition: 'The percentage of a dam\'s total capacity currently holding water. 100% means the dam is completely full. Levels can temporarily exceed 100% during flood events when water spills over the dam wall.',
  },
  'capacity': {
    term: 'Capacity',
    definition: 'The maximum volume of water a dam or reservoir can hold, measured in megalitres (ML) or gigalitres (GL). 1 GL equals 1,000 ML, which is roughly 400 Olympic swimming pools.',
  },
  'gigalitre': {
    term: 'Gigalitre (GL)',
    definition: 'A unit of volume equal to one billion litres (1,000,000,000 L). One gigalitre is approximately 400 Olympic swimming pools. Australia\'s largest dams hold thousands of gigalitres.',
  },
  'megalitre': {
    term: 'Megalitre (ML)',
    definition: 'A unit of volume equal to one million litres. One megalitre fills roughly 0.4 Olympic swimming pools. Dam capacities and water allocations are commonly expressed in megalitres.',
  },
  'bom': {
    term: 'Bureau of Meteorology (BOM)',
    definition: 'Australia\'s national weather, climate, and water agency. BOM collects and publishes water storage data for major dams across all states and territories through its Water Data Online service.',
  },
  'catchment': {
    term: 'Catchment',
    definition: 'The geographic area of land where rainfall drains into a particular river, dam, or waterway. Larger catchments generally collect more water. Catchment health directly affects water quality and supply.',
  },
  'inflow': {
    term: 'Inflow',
    definition: 'Water entering a dam from rivers, streams, and runoff. Inflow rates vary with rainfall and are a key factor in whether dam levels rise or fall. Seasonal patterns strongly influence inflow.',
  },
  'water_authority': {
    term: 'Water Authority',
    definition: 'The government body or utility responsible for managing a dam and its water supply. Different states have different authorities — for example, WaterNSW in New South Wales and Melbourne Water in Victoria.',
  },
  'spill': {
    term: 'Spill / Overflow',
    definition: 'When a dam reaches or exceeds capacity, water flows over the spillway — a controlled structure designed to safely release excess water. Spilling means the dam is at or above 100% capacity.',
  },
  'pipeline': {
    term: 'Data Pipeline',
    definition: 'An automated process that collects the latest dam storage data from BOM every 6 hours and publishes it to this site. If data appears stale, the pipeline may have encountered an error.',
  },
  'national_storage': {
    term: 'National Storage',
    definition: 'A weighted average of storage levels across all tracked dams, giving a single percentage that represents Australia\'s overall water security. Weighted by each dam\'s capacity so larger dams have more influence.',
  },
  'water_security': {
    term: 'Water Security',
    definition: 'The reliable availability of an adequate quantity and quality of water. When dam storage drops below 40\u201350%, water authorities may introduce usage restrictions to protect supply.',
  },
};

export function lookupTerm(key: string): GlossaryEntry | null {
  return glossary[key] ?? null;
}

export function getAllTerms(): Array<GlossaryEntry & { key: string }> {
  return Object.entries(glossary)
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => a.term.localeCompare(b.term));
}
