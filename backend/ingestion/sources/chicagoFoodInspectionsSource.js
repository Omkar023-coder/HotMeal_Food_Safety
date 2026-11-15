/**
 * Chicago Food Inspections Source Adapter
 *
 * Source: Chicago Department of Public Health (CDPH)
 * Portal: https://data.cityofchicago.org/Health-Human-Services/Food-Inspections/4ijn-s7e5
 * API:    https://data.cityofchicago.org/resource/4ijn-s7e5.json  (Socrata SODA API)
 * Auth:   None required for basic access (1000 req/hr)
 * Format: JSON
 * Update: Daily
 *
 * This adapter fetches REAL inspection records from the Chicago open-data portal.
 *
 * IMPORTANT — Restaurant matching:
 *   Chicago records contain Chicago restaurants only.
 *   HotMeal restaurants are currently in India (Latur, Pune, etc.).
 *   The ingestion pipeline's restaurant resolver will correctly reject all
 *   Chicago records as "no matching restaurant" — producing 0 insertions.
 *   This is CORRECT behavior: no fake evidence enters the database.
 *
 *   When HotMeal expands to include Chicago-based restaurants in the DB,
 *   those will begin matching and ingesting correctly.
 *
 * Field mapping:
 *   Chicago field        → Common raw record field
 *   ─────────────────────────────────────────────
 *   inspection_id        → externalRecordId
 *   dba_name / aka_name  → restaurantName
 *   address              → address
 *   city                 → city
 *   state                → state
 *   zip                  → pincode
 *   inspection_date      → evidenceDate
 *   inspection_type      → (embedded in title)
 *   results              → status (mapped)
 *   risk                 → severity (mapped)
 *   violations           → description
 *   facility_type        → (embedded in description)
 */

import axios from "axios";

export const sourceType = "chicago-food-inspections";
export const sourceName = "Chicago Food Inspections";

const API_ENDPOINT = "https://data.cityofchicago.org/resource/4ijn-s7e5.json";

// Only fetch restaurant records (not bakeries, daycares, etc.)
const FACILITY_FILTER = "Restaurant";

// Limit per ingestion run (keeps runtime reasonable; pagination can be added)
const FETCH_LIMIT = parseInt(process.env.CHICAGO_FETCH_LIMIT || "50", 10);

/**
 * Map Chicago "results" field → our status enum
 */
const mapResult = (results) => {
    if (!results) return "unknown";
    const r = results.toLowerCase();
    if (r.includes("pass") && !r.includes("condition")) return "positive";
    if (r.includes("pass with condition"))               return "warning";
    if (r.includes("fail"))                              return "negative";
    return "unknown";
};

/**
 * Map Chicago "risk" field → our severity enum
 * Risk 1 (High) → high
 * Risk 2 (Medium) → medium
 * Risk 3 (Low) → low
 * All Risk → unknown
 */
const mapRisk = (risk) => {
    if (!risk) return "unknown";
    const r = risk.toLowerCase();
    if (r.includes("risk 1") || r.includes("high")) return "high";
    if (r.includes("risk 2") || r.includes("medium")) return "medium";
    if (r.includes("risk 3") || r.includes("low")) return "low";
    return "unknown";
};

/**
 * Build a human-readable title from the inspection record.
 */
const buildTitle = (record) => {
    const type = record.inspection_type || "Inspection";
    const result = record.results || "";
    const name = record.dba_name || record.aka_name || "Unknown";
    return `${type}: ${name}${result ? " — " + result : ""}`.substring(0, 200);
};

/**
 * Build a description from the inspection record.
 * Violations field may be long — truncate safely.
 */
const buildDescription = (record) => {
    const facilityType = record.facility_type || "Restaurant";
    const riskLevel = record.risk || "Unknown risk";
    const violations = record.violations || "No violations recorded.";
    const truncated = violations.length > 1000
        ? violations.substring(0, 1000) + "... [truncated]"
        : violations;
    return `${facilityType} (${riskLevel}). ${truncated}`;
};

/**
 * Fetch recent restaurant inspection records from Chicago Open Data.
 * @returns {Promise<Object[]>} Array of raw source records in common format
 */
export const fetchRecords = async () => {
    const params = {
        $limit:        FETCH_LIMIT,
        $order:        "inspection_date DESC",
        facility_type: FACILITY_FILTER
    };

    // If a Socrata app token is configured, attach it to increase rate limits
    const headers = {};
    if (process.env.CHICAGO_SOCRATA_APP_TOKEN) {
        headers["X-App-Token"] = process.env.CHICAGO_SOCRATA_APP_TOKEN;
    }

    const response = await axios.get(API_ENDPOINT, { params, headers, timeout: 15000 });
    const records = response.data;

    if (!Array.isArray(records)) {
        throw new Error("Chicago API returned unexpected format");
    }

    return records.map(r => ({
        externalRecordId: r.inspection_id || null,
        sourceType,
        sourceName,
        sourceUrl:  `https://data.cityofchicago.org/resource/4ijn-s7e5.json?inspection_id=${r.inspection_id}`,

        // Restaurant identity fields
        restaurantName: r.aka_name || r.dba_name || null,
        address:        r.address || null,
        city:            r.city || "Chicago",
        state:           r.state || "IL",
        pincode:         r.zip || null,

        // Evidence content
        title:       buildTitle(r),
        description: buildDescription(r),

        // Dates
        evidenceDate: r.inspection_date || null,
        publishedAt:  r.inspection_date || null,

        // Classification
        type:     "inspection",
        status:   mapResult(r.results),
        severity: mapRisk(r.risk),

        // Raw source record — preserved for auditability, never stored in DB
        rawData: {
            inspection_id:   r.inspection_id,
            dba_name:        r.dba_name,
            aka_name:        r.aka_name,
            license_:        r.license_,
            facility_type:   r.facility_type,
            risk:            r.risk,
            address:         r.address,
            city:            r.city,
            state:           r.state,
            zip:             r.zip,
            inspection_date: r.inspection_date,
            inspection_type: r.inspection_type,
            results:         r.results
            // violations intentionally omitted — already in description
        }
    }));
};

export const chicagoFoodInspectionsSource = {
    sourceType,
    sourceName,
    fetchRecords
};
