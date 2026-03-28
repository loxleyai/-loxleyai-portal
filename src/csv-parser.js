// =============================================================================
// OHIO SOS SCANNER — CSV Parser
// Lightweight CSV parser for Ohio Secretary of State business report CSVs
// =============================================================================

/**
 * Parse CSV text into an array of objects with normalized header keys.
 *
 * Ohio SOS CSVs use headers like:
 *   "Charter #","Business Name","Status","Filing Date","Agent County" ...
 *
 * Headers are normalized to snake_case:
 *   charter_number, business_name, status, filing_date, agent_county
 *
 * @param {string} text - Raw CSV text
 * @returns {{ headers: string[], data: object[] }}
 */
export function parseCSV(text) {
  if (!text || !text.trim()) {
    return { headers: [], data: [] };
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    return { headers: [], data: [] };
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(normalizeHeader);

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] || "").trim();
    }
    data.push(row);
  }

  return { headers, data };
}

/**
 * Parse a single CSV line, handling quoted fields with commas and escaped quotes.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Normalize a CSV header to snake_case key.
 * "Charter #" -> "charter_number"
 * "Business Name" -> "business_name"
 * "Agent Address (Name)" -> "agent_address_name"
 * @param {string} header
 * @returns {string}
 */
function normalizeHeader(header) {
  return header
    .trim()
    .replace(/^["']|["']$/g, "")        // strip surrounding quotes
    .replace(/#/g, "number")             // # -> number
    .replace(/\(([^)]+)\)/g, "_$1")      // (Name) -> _Name
    .replace(/[^a-zA-Z0-9]+/g, "_")      // non-alphanum -> _
    .replace(/^_|_$/g, "")               // trim leading/trailing _
    .toLowerCase();
}
