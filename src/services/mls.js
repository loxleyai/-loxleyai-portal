/**
 * MLS / MLSLI listing data service.
 * Connects to copilot-worker.js backend for MLS data proxy.
 * Falls back to simulated data when worker is unavailable.
 */

const WORKER_BASE = "/api/mls";

/**
 * Fetch current listings for a corridor from the MLS proxy.
 */
export async function fetchListings(corridor, { limit = 20 } = {}) {
  try {
    const params = new URLSearchParams({ corridor, limit: String(limit) });
    const resp = await fetch(`${WORKER_BASE}/listings?${params}`);
    if (!resp.ok) throw new Error(`MLS proxy: ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn("MLS listings fetch failed, using fallback:", err.message);
    return generateFallbackListings(corridor);
  }
}

/**
 * Fetch recent sales data for a corridor from the MLS proxy.
 */
export async function fetchRecentSales(corridor, { limit = 20 } = {}) {
  try {
    const params = new URLSearchParams({ corridor, limit: String(limit) });
    const resp = await fetch(`${WORKER_BASE}/sales?${params}`);
    if (!resp.ok) throw new Error(`MLS proxy: ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn("MLS sales fetch failed, using fallback:", err.message);
    return generateFallbackSales(corridor);
  }
}

/**
 * Fallback: generate representative listing data when MLS proxy unavailable.
 * Clearly marked as simulated so users know to connect the real feed.
 */
function generateFallbackListings(corridor) {
  return [
    {
      source: "MLS (simulated)",
      address: `220 E 61st St`,
      type: "Condo",
      price: 1_250_000,
      bedrooms: 1,
      bathrooms: 1,
      sqft: 750,
      status: "Active",
      listedDate: "2026-02-15",
      note: "Simulated — connect MLSLI feed via copilot-worker for real data",
    },
    {
      source: "MLS (simulated)",
      address: `235 E 61st St`,
      type: "Co-op",
      price: 895_000,
      bedrooms: 2,
      bathrooms: 1,
      sqft: 950,
      status: "Active",
      listedDate: "2026-03-01",
      note: "Simulated — connect MLSLI feed via copilot-worker for real data",
    },
  ];
}

function generateFallbackSales(corridor) {
  return [
    {
      source: "MLS (simulated)",
      address: `228 E 61st St`,
      type: "Condo",
      salePrice: 1_150_000,
      saleDate: "2025-11-22",
      pricePerSqft: 1_533,
      note: "Simulated — connect MLSLI feed via copilot-worker for real data",
    },
    {
      source: "MLS (simulated)",
      address: `241 E 61st St`,
      type: "Co-op",
      salePrice: 780_000,
      saleDate: "2025-09-10",
      pricePerSqft: 1_200,
      note: "Simulated — connect MLSLI feed via copilot-worker for real data",
    },
  ];
}
