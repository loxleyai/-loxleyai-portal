import { useState, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { fetchPlutoData } from "../services/pluto.js";
import { fetchAcrisDeeds } from "../services/acris.js";
import {
  fetchAssessedValues,
  fetchExemptions,
} from "../services/nycFinance.js";
import { fetchListings, fetchRecentSales } from "../services/mls.js";

// ── Default corridors ──────────────────────────────────────────────────────
const DEFAULT_CORRIDORS = [
  // UES — NYC
  "E 61st between 2nd and 3rd Ave",
  "E 62nd between 2nd and 3rd Ave",
  "E 63rd between Lexington and 3rd Ave",
  "E 65th between 2nd and 3rd Ave",
  "E 72nd between 2nd and 3rd Ave",
  // Midwest — I-270 Corridor
  "I-270 Corridor, Columbus OH",
  "I-270 Corridor, Frederick MD",
  "I-270 Corridor, Germantown MD",
  // Southeast — Atlanta-Charlotte-Nashville
  "Atlanta Midtown, GA",
  "Charlotte South End, NC",
  "Nashville Gulch, TN",
  "Atlanta Buckhead, GA",
  "Charlotte NoDa, NC",
  "Nashville East, TN",
];

// ── Helpers ────────────────────────────────────────────────────────────────
function formatCurrency(n) {
  if (n == null || isNaN(n)) return "N/A";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function timestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PropertyCopilot_Demo({ session }) {
  const [corridor, setCorridor] = useState(DEFAULT_CORRIDORS[0]);
  const [customCorridor, setCustomCorridor] = useState("");
  const [logs, setLogs] = useState([]);
  const [properties, setProperties] = useState([]);
  const [listings, setListings] = useState([]);
  const [sales, setSales] = useState([]);
  const [running, setRunning] = useState(false);
  const [expandedBBL, setExpandedBBL] = useState(null);
  const logRef = useRef(null);

  const log = useCallback((msg, type = "info") => {
    setLogs((prev) => [...prev, { time: timestamp(), msg, type }]);
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  // ── Agent pipeline ─────────────────────────────────────────────────────
  const runAgent = useCallback(async () => {
    const target = customCorridor.trim() || corridor;
    setRunning(true);
    setProperties([]);
    setListings([]);
    setSales([]);
    setExpandedBBL(null);
    setLogs([]);

    log(`▶ Starting Property Copilot agent for: ${target}`);
    log("  Neighborhood context: Upper East Side (friends-ues.org)");

    // ── Step 1: PLUTO ────────────────────────────────────────────────────
    log("⏳ Fetching PLUTO tax lot data from NYC OpenData...", "fetch");
    let plutoResults = [];
    try {
      plutoResults = await fetchPlutoData(target);
      log(
        `✓ Found ${plutoResults.length} properties on ${target}`,
        "success"
      );
      setProperties(plutoResults);
    } catch (err) {
      log(`✗ PLUTO fetch failed: ${err.message}`, "error");
    }

    // ── Step 2: MLS (parallel) ───────────────────────────────────────────
    log("⏳ Fetching MLS listings and recent sales...", "fetch");
    try {
      const [listingData, salesData] = await Promise.all([
        fetchListings(target),
        fetchRecentSales(target),
      ]);
      setListings(listingData);
      setSales(salesData);
      log(
        `✓ MLS: ${listingData.length} active listings, ${salesData.length} recent sales`,
        "success"
      );
    } catch (err) {
      log(`✗ MLS fetch failed: ${err.message}`, "error");
    }

    // ── Step 3: ACRIS + NYC Finance (per-property enrichment) ────────────
    if (plutoResults.length > 0) {
      log(
        `⏳ Enriching ${Math.min(plutoResults.length, 10)} properties with ACRIS deeds & NYC Finance data...`,
        "fetch"
      );

      const enriched = [...plutoResults];
      const batch = enriched.slice(0, 10); // Limit to 10 to avoid rate limits

      const enrichmentResults = await Promise.allSettled(
        batch.map(async (prop, i) => {
          const bbl = prop.bbl;
          if (!bbl) return { index: i, deeds: [], assessed: null, exemptions: [] };

          const [deeds, assessed, exemptions] = await Promise.all([
            fetchAcrisDeeds(bbl).catch(() => []),
            fetchAssessedValues(bbl).catch(() => null),
            fetchExemptions(bbl).catch(() => []),
          ]);

          return { index: i, deeds, assessed, exemptions };
        })
      );

      let acrisCount = 0;
      let financeCount = 0;

      for (const result of enrichmentResults) {
        if (result.status === "fulfilled") {
          const { index, deeds, assessed, exemptions } = result.value;
          enriched[index] = {
            ...enriched[index],
            deeds,
            assessed,
            exemptions,
          };
          if (deeds.length > 0) acrisCount++;
          if (assessed) financeCount++;
        }
      }

      log(`✓ ACRIS: deed records found for ${acrisCount} properties`, "success");
      log(
        `✓ NYC Finance: assessed values for ${financeCount} properties`,
        "success"
      );
      setProperties(enriched);
    }

    // ── Summary ──────────────────────────────────────────────────────────
    log("─".repeat(50));
    log(`✓ Agent complete. Summary for ${target}:`, "success");
    log(`  Properties found: ${plutoResults.length}`);
    log(`  Total residential units: ${plutoResults.reduce((s, p) => s + (p.residentialUnits || 0), 0)}`);
    log(`  Data sources: PLUTO, ACRIS, NYC Finance, MLS`);

    setRunning(false);
  }, [corridor, customCorridor, log]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={styles.title}>
              Loxley AI — Property Copilot
            </h1>
            <p style={styles.subtitle}>
              Real-time corridor intelligence from NYC OpenData, ACRIS, NYC Finance
              &amp; MLS
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <span style={{ color: "#64748b", fontSize: 13, whiteSpace: "nowrap" }}>
              {session?.user?.email}
            </span>
            <button
              onClick={() => supabase.auth.signOut()}
              style={styles.signOutButton}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Corridor selector */}
      <div style={styles.controls}>
        <label style={styles.label}>Corridor:</label>
        <select
          value={corridor}
          onChange={(e) => setCorridor(e.target.value)}
          style={styles.select}
          disabled={running}
        >
          {DEFAULT_CORRIDORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <span style={styles.or}>or</span>

        <input
          type="text"
          placeholder="Custom corridor (e.g., E 70th between Park and Lex)"
          value={customCorridor}
          onChange={(e) => setCustomCorridor(e.target.value)}
          style={styles.input}
          disabled={running}
        />

        <button
          onClick={runAgent}
          disabled={running}
          style={{
            ...styles.button,
            ...(running ? styles.buttonDisabled : {}),
          }}
        >
          {running ? "Agent Running..." : "Start Agent"}
        </button>
      </div>

      {/* Main content area */}
      <div style={styles.content}>
        {/* Left: Log panel */}
        <div style={styles.logPanel} ref={logRef}>
          <h3 style={styles.panelTitle}>Agent Log</h3>
          {logs.length === 0 && (
            <p style={styles.placeholder}>
              Click &quot;Start Agent&quot; to begin fetching real data for a
              corridor.
            </p>
          )}
          {logs.map((entry, i) => (
            <div
              key={i}
              style={{
                ...styles.logEntry,
                color: logColors[entry.type] || "#ccc",
              }}
            >
              <span style={styles.logTime}>[{entry.time}]</span> {entry.msg}
            </div>
          ))}
        </div>

        {/* Right: Results */}
        <div style={styles.resultsPanel}>
          {/* Properties table */}
          {properties.length > 0 && (
            <div>
              <h3 style={styles.panelTitle}>
                Properties ({properties.length})
              </h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Address</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Owner</th>
                    <th style={styles.th}>Units</th>
                    <th style={styles.th}>Year Built</th>
                    <th style={styles.th}>Assessed Value</th>
                    <th style={styles.th}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p, i) => (
                    <PropertyRow
                      key={p.bbl || i}
                      property={p}
                      expanded={expandedBBL === p.bbl}
                      onToggle={() =>
                        setExpandedBBL(
                          expandedBBL === p.bbl ? null : p.bbl
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Listings */}
          {listings.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={styles.panelTitle}>
                Active Listings ({listings.length})
              </h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Address</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Price</th>
                    <th style={styles.th}>Beds</th>
                    <th style={styles.th}>SqFt</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l, i) => (
                    <tr key={i}>
                      <td style={styles.td}>{l.address}</td>
                      <td style={styles.td}>{l.type}</td>
                      <td style={styles.td}>{formatCurrency(l.price)}</td>
                      <td style={styles.td}>{l.bedrooms}</td>
                      <td style={styles.td}>
                        {l.sqft ? l.sqft.toLocaleString() : "N/A"}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            background:
                              l.status === "Active" ? "#22c55e" : "#eab308",
                          }}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td style={styles.td}>{l.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent Sales */}
          {sales.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={styles.panelTitle}>
                Recent Sales ({sales.length})
              </h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Address</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Sale Price</th>
                    <th style={styles.th}>$/SqFt</th>
                    <th style={styles.th}>Sale Date</th>
                    <th style={styles.th}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s, i) => (
                    <tr key={i}>
                      <td style={styles.td}>{s.address}</td>
                      <td style={styles.td}>{s.type}</td>
                      <td style={styles.td}>
                        {formatCurrency(s.salePrice)}
                      </td>
                      <td style={styles.td}>
                        {s.pricePerSqft
                          ? formatCurrency(s.pricePerSqft)
                          : "N/A"}
                      </td>
                      <td style={styles.td}>{s.saleDate}</td>
                      <td style={styles.td}>{s.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Property Row with expandable detail ────────────────────────────────────
function PropertyRow({ property: p, expanded, onToggle }) {
  return (
    <>
      <tr style={styles.tableRow}>
        <td style={styles.td}>{p.address}</td>
        <td style={styles.td}>{p.landUse}</td>
        <td style={styles.td}>{p.owner}</td>
        <td style={styles.td}>
          {p.totalUnits > 0
            ? `${p.totalUnits} (${p.residentialUnits} res)`
            : "N/A"}
        </td>
        <td style={styles.td}>{p.yearBuilt || "N/A"}</td>
        <td style={styles.td}>{formatCurrency(p.assessedTotal)}</td>
        <td style={styles.td}>
          <button onClick={onToggle} style={styles.detailButton}>
            {expanded ? "▲ Hide" : "▼ Show"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={styles.detailCell}>
            <PropertyDetail property={p} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Property Detail Panel ──────────────────────────────────────────────────
function PropertyDetail({ property: p }) {
  return (
    <div style={styles.detail}>
      <div style={styles.detailGrid}>
        {/* PLUTO info */}
        <div style={styles.detailSection}>
          <h4 style={styles.detailHeading}>PLUTO — Tax Lot</h4>
          <dl style={styles.dl}>
            <dt>BBL</dt>
            <dd>{p.bbl || "N/A"}</dd>
            <dt>Block / Lot</dt>
            <dd>
              {p.block || "N/A"} / {p.lotNumber || "N/A"}
            </dd>
            <dt>Building Class</dt>
            <dd>{p.buildingClass || "N/A"}</dd>
            <dt>Floors</dt>
            <dd>{p.numFloors || "N/A"}</dd>
            <dt>Lot Area</dt>
            <dd>{p.lotArea ? `${p.lotArea.toLocaleString()} sqft` : "N/A"}</dd>
            <dt>Building Area</dt>
            <dd>
              {p.buildingArea
                ? `${p.buildingArea.toLocaleString()} sqft`
                : "N/A"}
            </dd>
            <dt>Assessed Land</dt>
            <dd>{formatCurrency(p.assessedLand)}</dd>
            <dt>Assessed Total</dt>
            <dd>{formatCurrency(p.assessedTotal)}</dd>
          </dl>
        </div>

        {/* ACRIS deeds */}
        <div style={styles.detailSection}>
          <h4 style={styles.detailHeading}>ACRIS — Deed Records</h4>
          {p.deeds && p.deeds.length > 0 ? (
            p.deeds.map((d, i) => (
              <div key={i} style={styles.deedCard}>
                <div>
                  <strong>{d.docType}</strong> — {d.recordedDate}
                </div>
                <div>Amount: {formatCurrency(d.amount)}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Grantor: {d.grantor}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Grantee: {d.grantee}
                </div>
              </div>
            ))
          ) : (
            <p style={styles.noData}>No deed records found</p>
          )}
        </div>

        {/* NYC Finance */}
        <div style={styles.detailSection}>
          <h4 style={styles.detailHeading}>NYC Finance — Assessment</h4>
          {p.assessed ? (
            <dl style={styles.dl}>
              <dt>Fiscal Year</dt>
              <dd>{p.assessed.fiscalYear}</dd>
              <dt>Market Value</dt>
              <dd>{formatCurrency(p.assessed.marketValueTotal)}</dd>
              <dt>Assessed Value</dt>
              <dd>{formatCurrency(p.assessed.assessedValue)}</dd>
              <dt>Tax Class</dt>
              <dd>{p.assessed.taxClass}</dd>
            </dl>
          ) : (
            <p style={styles.noData}>No assessment data found</p>
          )}

          {p.exemptions && p.exemptions.length > 0 && (
            <>
              <h5 style={{ color: "#d97706", margin: "8px 0 4px" }}>
                Tax Exemptions
              </h5>
              {p.exemptions.map((ex, i) => (
                <div key={i} style={{ fontSize: 12, color: "#64748b" }}>
                  {ex.exemptionDescription}: {formatCurrency(ex.exemptionAmount)}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const logColors = {
  info: "#475569",
  fetch: "#2563eb",
  success: "#16a34a",
  error: "#dc2626",
};

const styles = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "#f8fafc",
    color: "#1e293b",
    minHeight: "100vh",
    padding: "24px",
  },
  header: {
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 16,
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 14,
    color: "#64748b",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  label: {
    fontWeight: 600,
    fontSize: 14,
    color: "#475569",
  },
  select: {
    background: "#ffffff",
    color: "#1e293b",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 14,
  },
  or: {
    color: "#94a3b8",
    fontSize: 13,
  },
  input: {
    background: "#ffffff",
    color: "#1e293b",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 14,
    flex: 1,
    minWidth: 240,
  },
  button: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonDisabled: {
    background: "#93c5fd",
    cursor: "not-allowed",
    opacity: 0.7,
  },
  signOutButton: {
    background: "none",
    border: "1px solid #cbd5e1",
    color: "#64748b",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
  },
  content: {
    display: "grid",
    gridTemplateColumns: "380px 1fr",
    gap: 24,
  },
  logPanel: {
    background: "#ffffff",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    padding: 16,
    maxHeight: "80vh",
    overflowY: "auto",
    fontFamily: '"Fira Code", "SF Mono", Consolas, monospace',
    fontSize: 12,
    lineHeight: 1.6,
  },
  panelTitle: {
    margin: "0 0 12px",
    fontSize: 16,
    fontWeight: 600,
    color: "#0f172a",
  },
  placeholder: {
    color: "#94a3b8",
    fontStyle: "italic",
  },
  logEntry: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  logTime: {
    color: "#94a3b8",
  },
  resultsPanel: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    borderBottom: "2px solid #e2e8f0",
    color: "#64748b",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "top",
  },
  tableRow: {},
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color: "#fff",
  },
  detailButton: {
    background: "none",
    border: "1px solid #cbd5e1",
    color: "#2563eb",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 11,
    cursor: "pointer",
  },
  detailCell: {
    padding: 0,
    borderBottom: "1px solid #e2e8f0",
  },
  detail: {
    background: "#f1f5f9",
    padding: "16px 10px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 20,
  },
  detailSection: {
    background: "#ffffff",
    borderRadius: 6,
    padding: 12,
    border: "1px solid #e2e8f0",
  },
  detailHeading: {
    margin: "0 0 8px",
    fontSize: 13,
    fontWeight: 600,
    color: "#2563eb",
  },
  dl: {
    margin: 0,
    fontSize: 12,
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "4px 12px",
  },
  deedCard: {
    background: "#f8fafc",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
    fontSize: 12,
    border: "1px solid #e2e8f0",
  },
  noData: {
    color: "#94a3b8",
    fontSize: 12,
    fontStyle: "italic",
  },
};
