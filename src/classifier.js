// =============================================================================
// OHIO SOS SCANNER — AI Classifier
// Uses Workers AI (or OpenAI-compatible) to classify entity signals
// =============================================================================

// Signal classification levels
const CLASSIFICATIONS = ["HIGH", "MEDIUM", "LOW", "NOISE"];

// Silos that entity formations might map to
const SILOS = [
  "entity_formation",    // Default — new business filings
  "real_estate",         // Property-related LLCs
  "construction",        // Construction / contracting entities
  "development",         // Development companies
  "infrastructure",      // Infrastructure-related
  "retail_commercial",   // Retail / commercial ventures
  "healthcare",          // Healthcare entities
  "technology",          // Tech companies
  "logistics",           // Logistics / warehousing
];

// Keywords that suggest thesis-relevant entity types (DSH corridor)
const HIGH_SIGNAL_KEYWORDS = [
  "property", "properties", "real estate", "realty", "holdings",
  "development", "redevelopment", "revitalization",
  "construction", "builders", "contracting", "renovation",
  "investment", "capital", "ventures", "equity", "fund",
  "management", "asset", "portfolio",
  "warehouse", "logistics", "distribution",
  "affordable housing", "multifamily", "apartments",
];

const MEDIUM_SIGNAL_KEYWORDS = [
  "consulting", "advisors", "solutions", "services",
  "commercial", "industrial", "manufacturing",
  "healthcare", "medical", "clinic",
  "technology", "tech", "digital", "software",
  "restaurant", "food", "retail", "shop",
  "transportation", "trucking", "freight",
];

/**
 * Classify a batch of entities from CSV data.
 * Uses keyword matching as primary classifier with optional AI enhancement.
 *
 * @param {object[]} entities - Normalized entity objects
 * @param {object} env - Worker env bindings
 * @returns {object[]} Classification results
 */
export async function classifyEntities(entities, env) {
  // Try AI classification first if available
  if (env.AI_GATEWAY_URL && env.AI_API_KEY) {
    try {
      return await classifyWithAI(entities, env);
    } catch (e) {
      console.warn(`AI classification failed, falling back to keyword: ${e.message}`);
    }
  }

  // Keyword-based fallback classification
  return entities.map(entity => classifyByKeyword(entity));
}

/**
 * Classify search results content using AI or keyword fallback.
 *
 * @param {object} source - Search source config
 * @param {string} content - Concatenated search result snippets
 * @param {object} env - Worker env bindings
 * @returns {object[]} Extracted and classified signals
 */
export async function classifySearchContent(source, content, env) {
  if (env.AI_GATEWAY_URL && env.AI_API_KEY) {
    try {
      return await classifySearchWithAI(source, content, env);
    } catch (e) {
      console.warn(`AI search classification failed, falling back: ${e.message}`);
    }
  }

  // Keyword-based extraction from search results
  return extractSignalsFromSearch(source, content);
}

// ---------------------------------------------------------------------------
// KEYWORD-BASED CLASSIFICATION (fallback)
// ---------------------------------------------------------------------------

function classifyByKeyword(entity) {
  const name = (entity.entity_name || "").toLowerCase();
  const filingType = (entity.filing_type || "").toLowerCase();

  // Check high-signal keywords
  const highMatches = HIGH_SIGNAL_KEYWORDS.filter(kw => name.includes(kw));
  if (highMatches.length >= 2) {
    return {
      classification: "HIGH",
      silo: inferSilo(name),
      summary: `Entity "${entity.entity_name}" matches high-signal keywords: ${highMatches.join(", ")}. Filing type: ${entity.filing_type || "N/A"}.`,
      thesis_connection: `Multiple corridor-relevant indicators detected in entity name.`,
    };
  }

  if (highMatches.length === 1) {
    return {
      classification: "MEDIUM",
      silo: inferSilo(name),
      summary: `Entity "${entity.entity_name}" matches signal keyword: ${highMatches[0]}. Filing type: ${entity.filing_type || "N/A"}.`,
      thesis_connection: `Single corridor-relevant indicator in entity name.`,
    };
  }

  // Check medium-signal keywords
  const medMatches = MEDIUM_SIGNAL_KEYWORDS.filter(kw => name.includes(kw));
  if (medMatches.length >= 1) {
    return {
      classification: "LOW",
      silo: inferSilo(name),
      summary: `Entity "${entity.entity_name}" has general business keywords: ${medMatches.join(", ")}.`,
      thesis_connection: `General business activity in corridor — monitor for pattern.`,
    };
  }

  // New LLC/Corp formation is still worth tracking at LOW
  if (filingType.includes("original") || filingType.includes("new") || filingType.includes("formation")) {
    return {
      classification: "LOW",
      silo: "entity_formation",
      summary: `New entity formation: "${entity.entity_name}" (${entity.filing_type}).`,
      thesis_connection: `New entity in corridor — baseline formation tracking.`,
    };
  }

  return { classification: "NOISE" };
}

function inferSilo(name) {
  const n = name.toLowerCase();
  if (/property|properties|real\s*estate|realty|land/.test(n)) return "real_estate";
  if (/construct|build|contract|renovation|roofing|plumb/.test(n)) return "construction";
  if (/develop|redevelop|revitaliz/.test(n)) return "development";
  if (/warehouse|logistic|distribut|freight|trucking/.test(n)) return "logistics";
  if (/health|medical|clinic|dental|pharma/.test(n)) return "healthcare";
  if (/tech|software|digital|cyber|data/.test(n)) return "technology";
  if (/restaurant|food|retail|shop|store/.test(n)) return "retail_commercial";
  if (/infrastructure|utility|energy|solar|power/.test(n)) return "infrastructure";
  return "entity_formation";
}

// ---------------------------------------------------------------------------
// SEARCH RESULT EXTRACTION (fallback)
// ---------------------------------------------------------------------------

function extractSignalsFromSearch(source, content) {
  const signals = [];
  const sections = content.split("---");

  for (const section of sections) {
    const titleMatch = section.match(/Title:\s*(.+)/);
    const urlMatch = section.match(/URL:\s*(.+)/);
    const snippetMatch = section.match(/Snippet:\s*(.+)/s);

    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const url = urlMatch ? urlMatch[1].trim() : "";
    const snippet = snippetMatch ? snippetMatch[1].trim() : "";
    const combined = `${title} ${snippet}`.toLowerCase();

    // Check for corridor relevance
    const highMatches = HIGH_SIGNAL_KEYWORDS.filter(kw => combined.includes(kw));
    const medMatches = MEDIUM_SIGNAL_KEYWORDS.filter(kw => combined.includes(kw));

    let classification = "NOISE";
    let thesisConnection = "";

    if (highMatches.length >= 2) {
      classification = "HIGH";
      thesisConnection = `Search result matches multiple high-signal terms: ${highMatches.join(", ")}`;
    } else if (highMatches.length === 1) {
      classification = "MEDIUM";
      thesisConnection = `Search result matches signal term: ${highMatches[0]}`;
    } else if (medMatches.length >= 1) {
      classification = "LOW";
      thesisConnection = `Search result has general business relevance: ${medMatches.join(", ")}`;
    }

    if (classification !== "NOISE") {
      signals.push({
        entity_name: title,
        classification,
        silo: source.silo || inferSilo(combined),
        summary: snippet.slice(0, 300),
        source_url: url,
        thesis_connection: thesisConnection,
      });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// AI-POWERED CLASSIFICATION
// ---------------------------------------------------------------------------

async function classifyWithAI(entities, env) {
  const prompt = buildEntityClassificationPrompt(entities);

  const response = await fetch(env.AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an entity formation intelligence analyst for the Dayton–Springfield–Hamilton (DSH) corridor in Ohio. You classify newly filed business entities by their relevance to a real estate and economic development investment thesis.

Classify each entity as:
- HIGH: Directly relevant to real estate, property development, construction, or corridor investment thesis
- MEDIUM: Potentially relevant — consulting, services, or industries that support development
- LOW: General business formation worth tracking for baseline patterns
- NOISE: Not relevant (trusts, estates, sole proprietor DBAs, etc.)

For each entity, also identify:
- silo: One of [entity_formation, real_estate, construction, development, infrastructure, retail_commercial, healthcare, technology, logistics]
- summary: One sentence describing the entity and its potential relevance
- thesis_connection: How this entity connects to the DSH corridor investment thesis

Respond with a JSON array of objects matching the input order.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API returned ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "[]";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("No JSON array found in AI response");
  }

  const classifications = JSON.parse(jsonMatch[0]);

  // Validate and normalize
  return classifications.map((cls, i) => ({
    classification: CLASSIFICATIONS.includes(cls.classification) ? cls.classification : "LOW",
    silo: SILOS.includes(cls.silo) ? cls.silo : "entity_formation",
    summary: cls.summary || `Entity: ${entities[i]?.entity_name}`,
    thesis_connection: cls.thesis_connection || "",
  }));
}

async function classifySearchWithAI(source, content, env) {
  const response = await fetch(env.AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an entity formation intelligence analyst for the Dayton–Springfield–Hamilton (DSH) corridor in Ohio. Extract and classify entity formation signals from search results.

For each distinct entity or filing mentioned, extract:
- entity_name: The business or entity name
- classification: HIGH | MEDIUM | LOW | NOISE
- silo: One of [entity_formation, real_estate, construction, development, infrastructure, retail_commercial, healthcare, technology, logistics]
- summary: One sentence about the entity and its relevance
- source_url: URL from the search result if available
- thesis_connection: How this connects to the DSH corridor investment thesis

Respond with a JSON array. Only include entities that are at least LOW relevance.`,
        },
        {
          role: "user",
          content: `Search query: "${source.query}"\nZone: ${source.zone}\n\nResults:\n${content}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API returned ${response.status}`);
  }

  const result = await response.json();
  const aiContent = result.choices?.[0]?.message?.content || "[]";
  const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  return JSON.parse(jsonMatch[0]);
}

function buildEntityClassificationPrompt(entities) {
  return entities.map((e, i) =>
    `[${i}] Name: "${e.entity_name}" | Filing: ${e.filing_type || "N/A"} | Date: ${e.filing_date || "N/A"} | County: ${e.county || "N/A"} | Agent: ${e.agent_name || "N/A"}`
  ).join("\n");
}
