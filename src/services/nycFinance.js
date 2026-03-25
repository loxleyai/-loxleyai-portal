/**
 * NYC Department of Finance — Property Assessment data service.
 * Uses NYC OpenData Socrata API.
 * Property Valuation and Assessment Data: yjxr-fw8i
 * DOF Exemption Details: y7az-s7wc
 */

const ASSESSMENT_ENDPOINT =
  "https://data.cityofnewyork.us/resource/yjxr-fw8i.json";
const EXEMPTIONS_ENDPOINT =
  "https://data.cityofnewyork.us/resource/y7az-s7wc.json";

/**
 * Fetch assessed value data for a BBL.
 */
export async function fetchAssessedValues(bbl, { limit = 5 } = {}) {
  if (!bbl) return null;

  const borough = bbl.substring(0, 1);
  const block = bbl.substring(1, 6).replace(/^0+/, "");
  const lot = bbl.substring(6, 10).replace(/^0+/, "");

  const params = new URLSearchParams({
    $where: `boro = '${borough}' AND block = '${block}' AND lot = '${lot}'`,
    $limit: String(limit),
    $order: "fy DESC",
  });

  try {
    const resp = await fetch(`${ASSESSMENT_ENDPOINT}?${params}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.length === 0) return null;

    const latest = data[0];
    return {
      source: "NYC Finance",
      fiscalYear: latest.fy || "N/A",
      marketValueLand: parseFloat(latest.curmkttot) || 0,
      marketValueTotal: parseFloat(latest.curmkttot) || 0,
      assessedValue: parseFloat(latest.curactavl) || parseFloat(latest.curacttot) || 0,
      transitionalAssessed: parseFloat(latest.curtrnvl) || 0,
      taxClass: latest.txcl || "N/A",
      buildingClass: latest.bldg_cls || "N/A",
      history: data.map((d) => ({
        year: d.fy,
        assessed: parseFloat(d.curacttot) || 0,
        market: parseFloat(d.curmkttot) || 0,
      })),
    };
  } catch (err) {
    console.warn("NYC Finance assessment fetch failed:", err.message);
    return null;
  }
}

/**
 * Fetch tax exemption status for a BBL.
 */
export async function fetchExemptions(bbl) {
  if (!bbl) return [];

  const borough = bbl.substring(0, 1);
  const block = bbl.substring(1, 6).replace(/^0+/, "");
  const lot = bbl.substring(6, 10).replace(/^0+/, "");

  const params = new URLSearchParams({
    $where: `boro = '${borough}' AND block = '${block}' AND lot = '${lot}'`,
    $limit: "10",
  });

  try {
    const resp = await fetch(`${EXEMPTIONS_ENDPOINT}?${params}`);
    if (!resp.ok) return [];
    const data = await resp.json();

    return data.map((d) => ({
      source: "NYC Finance",
      exemptionCode: d.exmptcode || d.exemption_code || "N/A",
      exemptionDescription: d.exmptdesc || d.exemption_desc || "N/A",
      exemptionAmount: parseFloat(d.exmptvalu || d.exemption_value || 0),
    }));
  } catch (err) {
    console.warn("NYC Finance exemptions fetch failed:", err.message);
    return [];
  }
}
