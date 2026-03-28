// =============================================================================
// OHIO SOS SCANNER — Main Worker
// Cloudflare Worker: entity filing intelligence for DSH corridor
//
// Silo 9: Entity Formation Intelligence
// Two modes:
//   - Weekly (Monday): Brave Search for corridor entity formation news
//   - Monthly (15th): Bulk CSV ingest from Ohio SOS business reports
//
// Writes to existing Supabase `signals` table (shared with zizu-scanner)
// =============================================================================

import { CORRIDOR, SEARCH_SOURCES, BRAVE_CONFIG } from "./sources.js";
import { CORRIDOR_COUNTIES, getZone, isWorthClassifying } from "./counties.js";
import { parseCSV } from "./csv-parser.js";
import { classifyEntities, classifySearchContent } from "./classifier.js";

// ---------------------------------------------------------------------------
// SUPABASE HELPERS
// ---------------------------------------------------------------------------

async function supabaseInsert(env, table, rows) {
  if (!rows.length) return { inserted: 0 };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`Supabase insert error: ${err}`);
    return { inserted: 0, error: err };
  }

  return { inserted: rows.length };
}

async function supabaseCheckExists(env, signalKeys) {
  if (!signalKeys.length) return new Set();

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/signals?source_key=in.(${signalKeys.map(k => `"${k}"`).join(",")})&select=source_key`,
    {
      headers: {
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  if (!response.ok) return new Set();
  const existing = await response.json();
  return new Set(existing.map(r => r.source_key));
}

// ---------------------------------------------------------------------------
// MODE 1: BULK CSV INGEST (Monthly)
// ---------------------------------------------------------------------------

async function runBulkIngest(env) {
  console.log("=== Ohio SOS Bulk CSV Ingest ===");
  const errors = [];
  const allSignals = [];

  // Attempt to fetch the business reports download page
  // Ohio SOS publishes CSVs at known URLs — we try common patterns
  const csvUrls = [
    "https://www.ohiosos.gov/businesses/business-reports/download-business-report/",
  ];

  // Since the direct CSV download URL requires navigating the page
  // (which we can't do in a Worker), we use a fallback strategy:
  // 1. Try fetching the known download page
  // 2. If blocked (403), fall back to Brave Search for recent filing data
  // 3. Log the issue for manual CSV upload to R2

  for (const url of csvUrls) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "ZizuCorridorScanner/1.0 (research; loxleyai.io)",
          "Accept": "text/csv,text/plain,*/*",
        },
      });

      if (resp.ok) {
        const contentType = resp.headers.get("content-type") || "";

        if (contentType.includes("csv") || contentType.includes("text/plain")) {
          const csvText = await resp.text();
          const { data } = parseCSV(csvText);
          const filtered = filterByCounty(data);
          console.log(`CSV: ${data.length} total rows, ${filtered.length} corridor matches`);

          if (filtered.length > 0) {
            const signals = await classifyCSVEntities(filtered, env);
            allSignals.push(...signals);
          }
        } else {
          // Got HTML page, not CSV — need to parse for download links
          const html = await resp.text();
          const csvLinks = extractCSVLinks(html);
          console.log(`Found ${csvLinks.length} CSV download links`);

          for (const link of csvLinks) {
            try {
              const csvResp = await fetch(link, {
                headers: {
                  "User-Agent": "ZizuCorridorScanner/1.0 (research; loxleyai.io)",
                },
              });
              if (csvResp.ok) {
                const csvText = await csvResp.text();
                const { data } = parseCSV(csvText);
                const filtered = filterByCounty(data);
                console.log(`CSV ${link}: ${data.length} rows, ${filtered.length} corridor`);

                if (filtered.length > 0) {
                  const signals = await classifyCSVEntities(filtered, env);
                  allSignals.push(...signals);
                }
              }
            } catch (e) {
              errors.push(`CSV download error (${link}): ${e.message}`);
            }
          }
        }
      } else {
        console.warn(`Ohio SOS returned ${resp.status} — falling back to search mode`);
        errors.push(`Ohio SOS bulk download returned ${resp.status}`);
      }
    } catch (e) {
      errors.push(`Bulk fetch error: ${e.message}`);
    }
  }

  // If bulk failed, run expanded search as fallback
  if (allSignals.length === 0) {
    console.log("Bulk CSV unavailable — running expanded search fallback");
    const searchSignals = await runSearchScan(env, true); // expanded = true
    allSignals.push(...searchSignals.signals);
    errors.push(...searchSignals.errors);
  }

  return { signals: allSignals, errors };
}

// Extract CSV download links from Ohio SOS HTML page
function extractCSVLinks(html) {
  const links = [];
  // Look for href patterns pointing to CSV files
  const hrefPattern = /href="([^"]*\.csv[^"]*)"/gi;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    let url = match[1];
    if (!url.startsWith("http")) {
      url = `https://www.ohiosos.gov${url.startsWith("/") ? "" : "/"}${url}`;
    }
    links.push(url);
  }
  return links;
}

// Filter CSV rows to corridor counties only
function filterByCounty(rows) {
  return rows.filter(row => {
    // Ohio SOS LLC CSV uses "Agent County" as last column
    // After header normalization: agent_county
    const county = (row.agent_county || row.county || row.County || row.COUNTY || "").toUpperCase().trim();
    return CORRIDOR_COUNTIES.has(county);
  });
}

// Classify CSV entities in batches of 20
async function classifyCSVEntities(rows, env) {
  const signals = [];
  const batchSize = 20;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    // Pre-filter: skip entities not worth classifying
    const worthClassifying = batch.filter(row => {
      const name = row.entity_name || row.business_name || row.name || "";
      return isWorthClassifying(name);
    });

    if (!worthClassifying.length) continue;

    // Normalize to consistent shape (Ohio SOS LLC CSV fields)
    const normalized = worthClassifying.map(row => ({
      entity_name: row.business_name || row.entity_name || row.name || "Unknown",
      entity_number: row.charter_number || row.document_number || row.entity_number || "",
      filing_type: row.transaction_type || row.filing_type || row.type || "",
      filing_date: row.effective_date || row.filing_date || row.date || "",
      county: row.agent_county || row.county || "",
      status: row.status || "Active",
      agent_name: row.agent_address_name || row.agent_name || row.agent || "",
      agent_address: row.agent_address_1 || row.agent_address || "",
      filing_city: row.filing_city || "",
    }));

    const classifications = await classifyEntities(normalized, env);

    for (let j = 0; j < normalized.length; j++) {
      const entity = normalized[j];
      const cls = classifications[j];

      // Skip noise
      if (cls.classification === "NOISE") continue;

      const zone = getZone(entity.county);
      const sourceKey = `ohio-sos-${entity.entity_number || entity.entity_name.replace(/\s+/g, "-").toLowerCase()}-${entity.filing_date}`;

      signals.push({
        corridor_id: CORRIDOR.id,
        source_key: sourceKey,
        source_type: "ohio_sos_csv",
        silo: cls.silo || "entity_formation",
        zone: zone || "corridor-wide",
        classification: cls.classification,
        title: entity.entity_name,
        summary: cls.summary,
        raw_data: JSON.stringify({
          entity_number: entity.entity_number,
          filing_type: entity.filing_type,
          filing_date: entity.filing_date,
          county: entity.county,
          status: entity.status,
          agent_name: entity.agent_name,
          agent_address: entity.agent_address,
          thesis_connection: cls.thesis_connection,
        }),
        source_url: `https://businesssearch.ohiosos.gov/?=&BusinessName=${encodeURIComponent(entity.entity_name)}`,
        detected_at: new Date().toISOString(),
        lcp_status: "pending",
      });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// MODE 2: BRAVE SEARCH SCAN (Weekly)
// ---------------------------------------------------------------------------

async function runSearchScan(env, expanded = false) {
  console.log(`=== Ohio SOS Search Scan (${expanded ? "expanded" : "weekly"}) ===`);
  const errors = [];
  const signals = [];

  for (const source of SEARCH_SOURCES) {
    try {
      const searchUrl = `${BRAVE_CONFIG.endpoint}?q=${encodeURIComponent(source.query)}&count=${BRAVE_CONFIG.resultsPerQuery}&freshness=${BRAVE_CONFIG.freshness}`;

      const resp = await fetch(searchUrl, {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": env.BRAVE_API_KEY,
        },
      });

      if (!resp.ok) {
        errors.push(`Brave search failed for ${source.key}: ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const results = data.web?.results || [];

      if (!results.length) {
        console.log(`No results for ${source.key}`);
        continue;
      }

      // Concatenate snippets for classification
      const content = results.map(r =>
        `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description || ""}`
      ).join("\n---\n");

      const classified = await classifySearchContent(source, content, env);

      for (const signal of classified) {
        if (signal.classification === "NOISE") continue;

        const sourceKey = `ohio-sos-search-${source.key}-${(signal.entity_name || "").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

        signals.push({
          corridor_id: CORRIDOR.id,
          source_key: sourceKey,
          source_type: "ohio_sos_search",
          silo: signal.silo || "entity_formation",
          zone: source.zone || "corridor-wide",
          classification: signal.classification || "LOW",
          title: signal.entity_name || source.key,
          summary: signal.summary || "",
          raw_data: JSON.stringify({
            search_query: source.query,
            thesis_connection: signal.thesis_connection,
            source_url: signal.source_url,
          }),
          source_url: signal.source_url || results[0]?.url || "",
          detected_at: new Date().toISOString(),
          lcp_status: "pending",
        });
      }

      console.log(`${source.key}: ${classified.length} signals extracted, ${classified.filter(s => s.classification !== "NOISE").length} after noise filter`);

    } catch (e) {
      errors.push(`Search error (${source.key}): ${e.message}`);
    }
  }

  return { signals, errors };
}

// ---------------------------------------------------------------------------
// MAIN SCAN ORCHESTRATOR
// ---------------------------------------------------------------------------

async function runScan(env, mode = "auto") {
  const startTime = Date.now();
  console.log(`Ohio SOS Scanner starting — mode: ${mode}`);

  let allSignals = [];
  let allErrors = [];

  if (mode === "bulk" || mode === "auto") {
    // On the 15th (or manual bulk trigger), run full CSV ingest
    const today = new Date();
    const isBulkDay = today.getUTCDate() === 15 || mode === "bulk";

    if (isBulkDay) {
      const bulkResult = await runBulkIngest(env);
      allSignals.push(...bulkResult.signals);
      allErrors.push(...bulkResult.errors);
    }
  }

  if (mode === "search" || mode === "auto") {
    const searchResult = await runSearchScan(env);
    allSignals.push(...searchResult.signals);
    allErrors.push(...searchResult.errors);
  }

  // Dedup against existing signals in Supabase
  if (allSignals.length > 0) {
    const sourceKeys = allSignals.map(s => s.source_key);
    const existing = await supabaseCheckExists(env, sourceKeys);
    const newSignals = allSignals.filter(s => !existing.has(s.source_key));

    console.log(`Total signals: ${allSignals.length}, New: ${newSignals.length}, Duplicates skipped: ${allSignals.length - newSignals.length}`);

    if (newSignals.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < newSignals.length; i += 50) {
        const batch = newSignals.slice(i, i + 50);
        await supabaseInsert(env, "signals", batch);
      }

      // Send email digest if Resend is configured
      if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
        await sendDigest(env, newSignals);
      }
    }

    // Log the scan
    await supabaseInsert(env, "scan_log", [{
      scanner: "ohio-sos-scanner",
      corridor_id: CORRIDOR.id,
      mode,
      sources_checked: SEARCH_SOURCES.length + (mode === "bulk" ? 1 : 0),
      signals_found: newSignals.length,
      errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
      duration_ms: Date.now() - startTime,
      scanned_at: new Date().toISOString(),
    }]);

    return {
      status: "ok",
      mode,
      signals: newSignals.length,
      errors: allErrors.length,
      duration: Date.now() - startTime,
    };
  }

  // No signals found
  await supabaseInsert(env, "scan_log", [{
    scanner: "ohio-sos-scanner",
    corridor_id: CORRIDOR.id,
    mode,
    sources_checked: SEARCH_SOURCES.length,
    signals_found: 0,
    errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
    duration_ms: Date.now() - startTime,
    scanned_at: new Date().toISOString(),
  }]);

  return {
    status: "ok",
    mode,
    signals: 0,
    errors: allErrors.length,
    duration: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// EMAIL DIGEST
// ---------------------------------------------------------------------------

async function sendDigest(env, signals) {
  const highSignals = signals.filter(s => s.classification === "HIGH");
  const medSignals = signals.filter(s => s.classification === "MEDIUM");
  const lowSignals = signals.filter(s => s.classification === "LOW");

  const formatSignal = (s) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-weight:600;">${s.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;">
        <span style="background:${s.classification === "HIGH" ? "#B85C4A" : s.classification === "MEDIUM" ? "#D4A843" : "#6B8E7F"};color:white;padding:2px 8px;border-radius:3px;font-size:12px;">${s.classification}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:13px;">${s.summary}</td>
    </tr>`;

  const html = `
    <div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;color:#1A2332;">
      <div style="background:#1A2332;padding:24px 32px;border-radius:4px 4px 0 0;">
        <h1 style="color:#ffffff;font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;margin:0;">
          Ohio SOS Entity Intelligence
        </h1>
        <p style="color:#6B8E7F;font-size:13px;margin:4px 0 0;">
          ${CORRIDOR.name} Corridor &middot; LZCS ${CORRIDOR.lzcs} &middot; ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
      <div style="padding:24px 32px;background:#ffffff;border:1px solid #e5e5e5;border-top:none;">
        <p style="font-size:14px;line-height:1.6;">
          <strong>${signals.length}</strong> new entity formation signal${signals.length !== 1 ? "s" : ""} detected:
          ${highSignals.length ? `<strong style="color:#B85C4A;">${highSignals.length} HIGH</strong>` : ""}
          ${medSignals.length ? `<strong style="color:#D4A843;">${medSignals.length} MEDIUM</strong>` : ""}
          ${lowSignals.length ? `<strong style="color:#6B8E7F;">${lowSignals.length} LOW</strong>` : ""}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f7f7f7;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Entity</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Level</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Analysis</th>
            </tr>
          </thead>
          <tbody>
            ${[...highSignals, ...medSignals, ...lowSignals].map(formatSignal).join("")}
          </tbody>
        </table>
      </div>
      <div style="padding:16px 32px;background:#f7f7f7;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 4px 4px;">
        <p style="font-size:11px;color:#999;margin:0;">
          Zizu AI Ecosystem &middot; Silo 9: Entity Formation Intelligence &middot; Ohio Secretary of State
          <br>Loxley Signal &middot; House of Loxley Holdings LLC &middot; Cognitive Intelligence
        </p>
      </div>
    </div>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Zizu Scanner <scanner@loxleyai.io>",
        to: env.ALERT_EMAIL,
        subject: `[ENTITY] ${highSignals.length ? "HIGH: " : ""}${signals.length} new Ohio filings — ${CORRIDOR.name}`,
        html,
      }),
    });
    console.log("Digest email sent");
  } catch (e) {
    console.error(`Email error: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// WORKER EXPORT
// ---------------------------------------------------------------------------

export default {
  // Cron trigger
  async scheduled(event, env, ctx) {
    const cronTime = event.cron;
    // "0 13 * * 1" = Monday weekly search
    // "0 13 15 * *" = 15th monthly bulk
    const mode = cronTime === "0 13 15 * *" ? "bulk" : "search";
    ctx.waitUntil(runScan(env, mode));
  },

  // HTTP trigger
  async fetch(request, env) {
    const url = new URL(request.url);

    // Manual scan trigger
    if (url.pathname === "/scan" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${env.SCAN_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Optional mode param: ?mode=bulk|search|auto
      const mode = url.searchParams.get("mode") || "auto";
      const result = await runScan(env, mode);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        scanner: "ohio-sos-scanner",
        silo: "entity_formation",
        corridor: CORRIDOR.name,
        lzcs: CORRIDOR.lzcs,
        search_sources: SEARCH_SOURCES.length,
        counties: [...CORRIDOR_COUNTIES],
        timestamp: new Date().toISOString(),
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // CSV upload endpoint — manual ingest of downloaded CSV
    if (url.pathname === "/ingest" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${env.SCAN_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      const csvText = await request.text();
      const { data } = parseCSV(csvText);
      const filtered = filterByCounty(data);

      if (!filtered.length) {
        return new Response(JSON.stringify({
          status: "ok",
          total_rows: data.length,
          corridor_matches: 0,
          message: "No corridor county matches found in uploaded CSV.",
        }), { headers: { "Content-Type": "application/json" } });
      }

      const signals = await classifyCSVEntities(filtered, env);
      const sourceKeys = signals.map(s => s.source_key);
      const existing = await supabaseCheckExists(env, sourceKeys);
      const newSignals = signals.filter(s => !existing.has(s.source_key));

      if (newSignals.length > 0) {
        for (let i = 0; i < newSignals.length; i += 50) {
          await supabaseInsert(env, "signals", newSignals.slice(i, i + 50));
        }
      }

      return new Response(JSON.stringify({
        status: "ok",
        total_rows: data.length,
        corridor_matches: filtered.length,
        classified: signals.length,
        new_signals: newSignals.length,
        duplicates_skipped: signals.length - newSignals.length,
      }, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(
      "Ohio SOS Entity Scanner — Zizu AI Ecosystem\n\n" +
      "POST /scan          Run automated scan (?mode=bulk|search|auto)\n" +
      "POST /ingest         Upload Ohio SOS CSV for manual ingest\n" +
      "GET  /health         Health check\n",
      { status: 200, headers: { "Content-Type": "text/plain" } }
    );
  },
};
