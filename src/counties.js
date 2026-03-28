// =============================================================================
// OHIO SOS SCANNER — County Configuration
// DSH Corridor counties, zone mapping, and entity name filtering
// =============================================================================

// Counties within the DSH (Dayton–Springfield–Hamilton) corridor
export const CORRIDOR_COUNTIES = new Set([
  "MONTGOMERY",   // Dayton
  "CLARK",         // Springfield
  "BUTLER",        // Hamilton
  "WARREN",        // Lebanon / Mason
  "GREENE",        // Xenia / Beavercreek / Fairborn
  "MIAMI",         // Troy / Piqua
  "PREBLE",        // Eaton — western fringe
  "CHAMPAIGN",     // Urbana — northern fringe
  "CLINTON",       // Wilmington — southern connector
  "DARKE",         // Greenville — western rural
]);

// Map counties to corridor zones for spatial analysis
const ZONE_MAP = {
  MONTGOMERY: "dayton-core",
  CLARK: "springfield",
  BUTLER: "hamilton",
  WARREN: "warren-corridor",
  GREENE: "greene-corridor",
  MIAMI: "miami-north",
  PREBLE: "western-fringe",
  CHAMPAIGN: "northern-fringe",
  CLINTON: "southern-connector",
  DARKE: "western-rural",
};

/**
 * Get the corridor zone for a given county name.
 * @param {string} county - County name (case-insensitive)
 * @returns {string|null} Zone identifier or null if not in corridor
 */
export function getZone(county) {
  const normalized = (county || "").toUpperCase().trim();
  return ZONE_MAP[normalized] || null;
}

// Entity name patterns that indicate noise (not worth classifying)
const NOISE_PATTERNS = [
  /^[A-Z]{1,3}\d{5,}$/i,                  // Alphanumeric codes (e.g., AB12345)
  /^THE\s+ESTATE\s+OF/i,                   // Estate filings
  /^IN\s+RE:/i,                             // Court filings
  /TRUST$/i,                                // Trusts (usually not commercial entities)
  /^DBA\s/i,                                // DBA-only filings
  /^\d+$/,                                  // Pure numeric names
  /^[A-Z]\s*$/i,                            // Single letter names
  /REVOCABLE\s+TRUST/i,                     // Revocable trusts
  /IRREVOCABLE\s+TRUST/i,                   // Irrevocable trusts
  /LIVING\s+TRUST/i,                        // Living trusts
  /FAMILY\s+TRUST/i,                        // Family trusts
  /TESTAMENTARY/i,                          // Testamentary trusts
];

// Minimum name length to be worth classifying
const MIN_NAME_LENGTH = 3;

/**
 * Determine if an entity name is worth sending to the classifier.
 * Filters out trusts, estates, numeric-only names, and other noise.
 * @param {string} name - Entity name
 * @returns {boolean}
 */
export function isWorthClassifying(name) {
  if (!name || name.trim().length < MIN_NAME_LENGTH) return false;
  const trimmed = name.trim();
  return !NOISE_PATTERNS.some(pattern => pattern.test(trimmed));
}
