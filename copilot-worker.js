/**
 * Copilot Worker — Backend proxy for MLS/MLSLI data feeds.
 *
 * Runs on port 3002, proxied by Vite dev server at /api/*.
 * Provides endpoints:
 *   GET /api/mls/listings?corridor=...
 *   GET /api/mls/sales?corridor=...
 *
 * To connect a real MLSLI feed:
 *   1. Set MLSLI_API_KEY and MLSLI_BASE_URL in .env
 *   2. Implement the RETS/Web API calls in fetchFromMLSLI()
 *
 * For now, returns curated sample data for UES corridors.
 */

import { createServer } from "node:http";

const PORT = process.env.WORKER_PORT || 3002;

// Sample UES listing data keyed by approximate corridor
const UES_LISTINGS = {
  default: [
    {
      source: "MLSLI",
      address: "220 E 61st St, Apt 4B",
      type: "Condo",
      price: 1_275_000,
      bedrooms: 1,
      bathrooms: 1,
      sqft: 780,
      status: "Active",
      listedDate: "2026-02-18",
      mlsId: "MLSLI-892341",
    },
    {
      source: "MLSLI",
      address: "233 E 61st St, Apt 7A",
      type: "Co-op",
      price: 925_000,
      bedrooms: 2,
      bathrooms: 1,
      sqft: 1020,
      status: "Active",
      listedDate: "2026-03-05",
      mlsId: "MLSLI-892487",
    },
    {
      source: "MLSLI",
      address: "245 E 61st St, Apt 2C",
      type: "Condo",
      price: 1_850_000,
      bedrooms: 2,
      bathrooms: 2,
      sqft: 1250,
      status: "Contract Signed",
      listedDate: "2026-01-20",
      mlsId: "MLSLI-891002",
    },
  ],
};

const UES_SALES = {
  default: [
    {
      source: "MLSLI",
      address: "228 E 61st St, Apt 6D",
      type: "Condo",
      salePrice: 1_180_000,
      saleDate: "2025-11-15",
      pricePerSqft: 1_513,
      mlsId: "MLSLI-887654",
    },
    {
      source: "MLSLI",
      address: "241 E 61st St, Apt 3F",
      type: "Co-op",
      salePrice: 810_000,
      saleDate: "2025-09-03",
      pricePerSqft: 1_185,
      mlsId: "MLSLI-884321",
    },
    {
      source: "MLSLI",
      address: "215 E 61st St, Apt 12A",
      type: "Condo",
      salePrice: 2_450_000,
      saleDate: "2025-07-22",
      pricePerSqft: 1_750,
      mlsId: "MLSLI-881999",
    },
  ],
};

/**
 * Placeholder for real MLSLI API integration.
 * Replace this with actual RETS/Web API calls when credentials are available.
 */
async function fetchFromMLSLI(type, corridor) {
  const apiKey = process.env.MLSLI_API_KEY;
  const baseUrl = process.env.MLSLI_BASE_URL;

  if (apiKey && baseUrl) {
    // TODO: Implement real MLSLI RETS/Web API call
    // const resp = await fetch(`${baseUrl}/properties?...`, {
    //   headers: { Authorization: `Bearer ${apiKey}` },
    // });
    // return await resp.json();
    console.log(`[copilot-worker] Would fetch ${type} from ${baseUrl} for: ${corridor}`);
  }

  // Return sample data
  if (type === "listings") return UES_LISTINGS.default;
  if (type === "sales") return UES_SALES.default;
  return [];
}

function parseQuery(url) {
  const u = new URL(url, "http://localhost");
  return Object.fromEntries(u.searchParams.entries());
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const query = parseQuery(req.url);

  try {
    if (path === "/api/mls/listings") {
      const data = await fetchFromMLSLI("listings", query.corridor || "");
      const limit = parseInt(query.limit, 10) || 20;
      res.writeHead(200);
      res.end(JSON.stringify(data.slice(0, limit)));
    } else if (path === "/api/mls/sales") {
      const data = await fetchFromMLSLI("sales", query.corridor || "");
      const limit = parseInt(query.limit, 10) || 20;
      res.writeHead(200);
      res.end(JSON.stringify(data.slice(0, limit)));
    } else if (path === "/api/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok", service: "copilot-worker" }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    }
  } catch (err) {
    console.error("[copilot-worker] Error:", err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[copilot-worker] MLS proxy running on http://localhost:${PORT}`);
  console.log(`[copilot-worker] Endpoints:`);
  console.log(`  GET /api/mls/listings?corridor=...`);
  console.log(`  GET /api/mls/sales?corridor=...`);
  console.log(`  GET /api/health`);
});
