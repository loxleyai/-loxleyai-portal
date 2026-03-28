// =============================================================================
// OHIO SOS SCANNER — Sources & Configuration
// Corridor definition, Brave Search queries, and API config
// =============================================================================

// DSH Corridor: Dayton–Springfield–Hamilton, Ohio
export const CORRIDOR = {
  id: "dsh-ohio",
  name: "Dayton–Springfield–Hamilton",
  lzcs: "DSH-0042",
  state: "OH",
  metro: "Dayton-Springfield-Hamilton MSA",
};

// Brave Search API configuration
export const BRAVE_CONFIG = {
  endpoint: "https://api.search.brave.com/res/v1/web/search",
  resultsPerQuery: 20,
  freshness: "pw", // past week
};

// Search queries targeting entity formation activity in the DSH corridor
export const SEARCH_SOURCES = [
  {
    key: "dayton-llc-filings",
    query: "site:ohiosos.gov new LLC filing Dayton Ohio 2026",
    zone: "dayton-core",
    silo: "entity_formation",
  },
  {
    key: "springfield-llc-filings",
    query: "site:ohiosos.gov new LLC filing Springfield Ohio 2026",
    zone: "springfield",
    silo: "entity_formation",
  },
  {
    key: "hamilton-llc-filings",
    query: "site:ohiosos.gov new LLC filing Hamilton Ohio 2026",
    zone: "hamilton",
    silo: "entity_formation",
  },
  {
    key: "montgomery-county-business",
    query: "Montgomery County Ohio new business formation entity filing",
    zone: "dayton-core",
    silo: "entity_formation",
  },
  {
    key: "clark-county-business",
    query: "Clark County Ohio new business entity formation filing",
    zone: "springfield",
    silo: "entity_formation",
  },
  {
    key: "butler-county-business",
    query: "Butler County Ohio new business formation entity filing",
    zone: "hamilton",
    silo: "entity_formation",
  },
  {
    key: "warren-county-business",
    query: "Warren County Ohio new business formation LLC",
    zone: "warren-corridor",
    silo: "entity_formation",
  },
  {
    key: "greene-county-business",
    query: "Greene County Ohio new business entity LLC formation",
    zone: "greene-corridor",
    silo: "entity_formation",
  },
  {
    key: "dsh-real-estate-llc",
    query: "Ohio real estate LLC formation Dayton Springfield Hamilton property management",
    zone: "corridor-wide",
    silo: "entity_formation",
  },
  {
    key: "dsh-construction-entity",
    query: "Ohio construction company formation Dayton Springfield Hamilton contractor LLC",
    zone: "corridor-wide",
    silo: "entity_formation",
  },
  {
    key: "dsh-development-entity",
    query: "Ohio development company LLC formation Dayton Springfield Hamilton redevelopment",
    zone: "corridor-wide",
    silo: "entity_formation",
  },
  {
    key: "ohio-sos-weekly-filings",
    query: "Ohio Secretary of State business filings weekly report new entities",
    zone: "corridor-wide",
    silo: "entity_formation",
  },
];
