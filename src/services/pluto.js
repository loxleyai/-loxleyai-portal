/**
 * NYC PLUTO (Primary Land Use Tax Lot Output) data service.
 * Uses NYC OpenData Socrata API — free, no key required (with rate limits).
 * Dataset ID: 64uk-42ks (MapPLUTO latest)
 */

const PLUTO_ENDPOINT = "https://data.cityofnewyork.us/resource/64uk-42ks.json";

/**
 * Parse a corridor string like "E 61st between 2nd and 3rd Ave"
 * into structured street/avenue data for querying PLUTO.
 */
export function parseCorridor(corridor) {
  const match = corridor.match(
    /^(E|W)?\s*(\d+)\w*\s*(St|Street|Ave|Avenue)?\s*between\s+(.+?)\s+and\s+(.+?)$/i
  );
  if (!match) {
    return { street: corridor.trim(), fromAve: null, toAve: null };
  }

  const direction = (match[1] || "E").toUpperCase();
  const number = match[2];
  const streetName = `${direction} ${number}`;

  return {
    street: streetName,
    streetNumber: parseInt(number, 10),
    direction,
    fromAve: match[4].trim(),
    toAve: match[5].trim(),
  };
}

/**
 * Map avenue names to approximate address ranges on cross-streets.
 * This is a simplified mapping for Manhattan east-side avenues.
 */
const AVENUE_ADDRESS_RANGES = {
  "1st": 1,
  "1st Ave": 1,
  "2nd": 200,
  "2nd Ave": 200,
  "3rd": 300,
  "3rd Ave": 300,
  "Lexington": 400,
  "Lex": 400,
  "Park": 500,
  "Park Ave": 500,
  "Madison": 600,
  "Madison Ave": 600,
  "5th": 700,
  "5th Ave": 700,
};

function getAvenueRange(fromAve, toAve) {
  const from = AVENUE_ADDRESS_RANGES[fromAve];
  const to = AVENUE_ADDRESS_RANGES[toAve];
  if (from != null && to != null) {
    return { low: Math.min(from, to), high: Math.max(from, to) + 99 };
  }
  return null;
}

/**
 * Fetch PLUTO tax lot data for a given corridor.
 * Returns an array of property records.
 */
export async function fetchPlutoData(corridor, { borough = "MN", limit = 50 } = {}) {
  const parsed = parseCorridor(corridor);
  const streetNum = parsed.streetNumber || 61;
  const direction = parsed.direction || "E";

  // Build a SoQL query to find lots on this street
  // PLUTO uses street name fields; we search by street name pattern
  const streetPattern = `${direction} ${streetNum}`;

  const params = new URLSearchParams({
    $where: `upper(address) LIKE '%${streetNum}%ST%' AND borough = '${borough}'`,
    $limit: String(limit),
    $select: [
      "address",
      "bbl",
      "block",
      "lot",
      "zipcode",
      "bldgclass",
      "landuse",
      "ownername",
      "numbldgs",
      "numfloors",
      "unitstotal",
      "unitsres",
      "yearbuilt",
      "assessland",
      "assesstot",
      "lotarea",
      "bldgarea",
      "condono",
      "latitude",
      "longitude",
    ].join(","),
  });

  const url = `${PLUTO_ENDPOINT}?${params}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    throw new Error(`PLUTO API error: ${resp.status} ${resp.statusText}`);
  }

  const raw = await resp.json();

  // Filter to the avenue range if we can
  const range = parsed.fromAve && parsed.toAve
    ? getAvenueRange(parsed.fromAve, parsed.toAve)
    : null;

  const results = raw.map((lot) => ({
    source: "PLUTO",
    address: lot.address || "Unknown",
    bbl: lot.bbl,
    block: lot.block,
    lotNumber: lot.lot,
    zipcode: lot.zipcode,
    buildingClass: lot.bldgclass,
    landUse: describeLandUse(lot.landuse),
    owner: lot.ownername || "N/A",
    numBuildings: parseInt(lot.numbldgs, 10) || 0,
    numFloors: parseFloat(lot.numfloors) || 0,
    totalUnits: parseInt(lot.unitstotal, 10) || 0,
    residentialUnits: parseInt(lot.unitsres, 10) || 0,
    yearBuilt: parseInt(lot.yearbuilt, 10) || 0,
    assessedLand: parseFloat(lot.assessland) || 0,
    assessedTotal: parseFloat(lot.assesstot) || 0,
    lotArea: parseFloat(lot.lotarea) || 0,
    buildingArea: parseFloat(lot.bldgarea) || 0,
    condoNumber: lot.condono || null,
    lat: parseFloat(lot.latitude) || null,
    lng: parseFloat(lot.longitude) || null,
  }));

  // If we have an avenue range, try to filter by address number
  if (range) {
    const filtered = results.filter((r) => {
      const addrNum = parseInt(r.address, 10);
      return !isNaN(addrNum) && addrNum >= range.low && addrNum <= range.high;
    });
    return filtered.length > 0 ? filtered : results;
  }

  return results;
}

function describeLandUse(code) {
  const codes = {
    "01": "One & Two Family Buildings",
    "02": "Multi-Family Walk-Up",
    "03": "Multi-Family Elevator",
    "04": "Mixed Residential & Commercial",
    "05": "Commercial & Office",
    "06": "Industrial & Manufacturing",
    "07": "Transportation & Utility",
    "08": "Public Facilities & Institutions",
    "09": "Open Space & Recreation",
    "10": "Parking Facilities",
    "11": "Vacant Land",
  };
  return codes[code] || code || "Unknown";
}
