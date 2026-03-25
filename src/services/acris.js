/**
 * NYC ACRIS (Automated City Register Information System) data service.
 * Uses NYC OpenData Socrata API.
 * Real Property Master: bnx9-e6tj
 * Real Property Parties: 636b-3b5g
 * Real Property Legals: 8h5j-fqxa
 */

const ACRIS_MASTER = "https://data.cityofnewyork.us/resource/bnx9-e6tj.json";
const ACRIS_PARTIES = "https://data.cityofnewyork.us/resource/636b-3b5g.json";
const ACRIS_LEGALS = "https://data.cityofnewyork.us/resource/8h5j-fqxa.json";

/**
 * Fetch deed and transfer records for a given BBL (Borough-Block-Lot).
 */
export async function fetchAcrisDeeds(bbl, { limit = 20 } = {}) {
  if (!bbl) return [];

  // Parse BBL: first digit = borough, next 5 = block, last 4 = lot
  const borough = bbl.substring(0, 1);
  const block = bbl.substring(1, 6);
  const lot = bbl.substring(6, 10);

  // Step 1: Find document IDs from legals table by block/lot
  const legalsParams = new URLSearchParams({
    $where: `borough = '${borough}' AND block = '${block.replace(/^0+/, "")}' AND lot = '${lot.replace(/^0+/, "")}'`,
    $limit: String(limit),
    $select: "document_id,recorded_borough,good_through_date",
  });

  let legalsResp;
  try {
    legalsResp = await fetch(`${ACRIS_LEGALS}?${legalsParams}`);
    if (!legalsResp.ok) throw new Error(`ACRIS Legals: ${legalsResp.status}`);
  } catch (err) {
    console.warn("ACRIS Legals fetch failed:", err.message);
    return [];
  }

  const legals = await legalsResp.json();
  if (legals.length === 0) return [];

  const docIds = [...new Set(legals.map((l) => l.document_id))].slice(0, 10);

  // Step 2: Fetch master records for these document IDs
  const docIdList = docIds.map((id) => `'${id}'`).join(",");
  const masterParams = new URLSearchParams({
    $where: `document_id IN (${docIdList}) AND doc_type IN ('DEED','DEEDO','RPTT')`,
    $limit: "20",
    $select:
      "document_id,doc_type,document_amt,recorded_datetime,modified_date",
    $order: "recorded_datetime DESC",
  });

  let masterResp;
  try {
    masterResp = await fetch(`${ACRIS_MASTER}?${masterParams}`);
    if (!masterResp.ok) throw new Error(`ACRIS Master: ${masterResp.status}`);
  } catch (err) {
    console.warn("ACRIS Master fetch failed:", err.message);
    return [];
  }

  const masters = await masterResp.json();
  if (masters.length === 0) return [];

  // Step 3: Fetch party names for these documents
  const masterDocIds = masters.map((m) => `'${m.document_id}'`).join(",");
  const partiesParams = new URLSearchParams({
    $where: `document_id IN (${masterDocIds})`,
    $limit: "50",
    $select: "document_id,party_type,name",
  });

  let parties = [];
  try {
    const partiesResp = await fetch(`${ACRIS_PARTIES}?${partiesParams}`);
    if (partiesResp.ok) {
      parties = await partiesResp.json();
    }
  } catch {
    // Parties are supplemental; continue without them
  }

  // Group parties by document
  const partiesByDoc = {};
  for (const p of parties) {
    if (!partiesByDoc[p.document_id]) partiesByDoc[p.document_id] = [];
    partiesByDoc[p.document_id].push({
      type: p.party_type === "1" ? "Grantor" : "Grantee",
      name: p.name,
    });
  }

  return masters.map((m) => ({
    source: "ACRIS",
    documentId: m.document_id,
    docType: m.doc_type,
    amount: parseFloat(m.document_amt) || 0,
    recordedDate: m.recorded_datetime
      ? new Date(m.recorded_datetime).toLocaleDateString()
      : "N/A",
    parties: partiesByDoc[m.document_id] || [],
    grantor:
      (partiesByDoc[m.document_id] || [])
        .filter((p) => p.type === "Grantor")
        .map((p) => p.name)
        .join(", ") || "N/A",
    grantee:
      (partiesByDoc[m.document_id] || [])
        .filter((p) => p.type === "Grantee")
        .map((p) => p.name)
        .join(", ") || "N/A",
  }));
}
