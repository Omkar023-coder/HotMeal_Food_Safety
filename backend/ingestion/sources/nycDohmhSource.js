/**
 * NYC DOHMH Restaurant Inspection Results Source Adapter
 *
 * Source: NYC Department of Health and Mental Hygiene (DOHMH)
 * Portal: https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j
 * API:    https://data.cityofnewyork.us/resource/43nn-pn8j.json  (Socrata SODA API)
 * Auth:   None required for basic access (1000 req/hr)
 * Format: JSON
 * Update: Daily
 *
 * This adapter fetches REAL inspection records from NYC Open Data.
 *
 * IMPORTANT — Restaurant matching:
 *   NYC records contain NYC restaurants only.
 *   HotMeal restaurants are currently in India (Latur, Pune, etc.).
 *   The ingestion pipeline's restaurant resolver will correctly reject all
 *   NYC records as "no matching restaurant" — producing 0 insertions.
 *   This is CORRECT behavior: no fake evidence enters the database.
 *
 * Field mapping:
 *   NYC field               → Common raw record field
 *   ──────────────────────────────────────────────────
 *   camis                   → externalRecordId (stable per establishment)
 *   dba                     → restaurantName
 *   building + street       → address
 *   boro                    → city (borough used as city)
 *   zipcode                 → pincode
 *   inspection_date         → evidenceDate
 *   inspection_type         → (embedded in title)
 *   action                  → (embedded in title/description)
 *   violation_code          → (embedded in description)
 *   violation_description   → description
 *   critical_flag           → severity (mapped)
 *   score                   → (embedded in description)
 *   grade                   → status (mapped)
 */

import axios from "axios";

export const sourceType = "nyc-dohmh-inspections";
export const sourceName = "NYC DOHMH Restaurant Inspection Results";

const API_ENDPOINT = "https://data.cityofnewyork.us/resource/43nn-pn8j.json";

const FETCH_LIMIT = parseInt(process.env.NYC_FETCH_LIMIT || "50", 10);

/**
 * Map NYC grade → our status enum
 */
const mapGrade = (grade, action) => {
    if (!grade && !action) return "unknown";
    if (grade === "A") return "positive";
    if (grade === "B") return "warning";
    if (grade === "C") return "negative";
    if (grade === "Z" || grade === "P") return "warning"; // grade pending
    // Fall back to action field
    if (action) {
        const a = action.toLowerCase();
        if (a.includes("no violation")) return "positive";
        if (a.includes("violation")) return "negative";
    }
    return "unknown";
};

/**
 * Map NYC critical_flag → our severity enum
 */
const mapCriticalFlag = (flag) => {
    if (!flag) return "unknown";
    const f = flag.toLowerCase();
    if (f === "critical") return "high";
    if (f === "not critical") return "low";
    return "unknown";
};

/**
 * Build title from NYC record.
 */
const buildTitle = (r) => {
    const type = r.inspection_type || "Inspection";
    const grade = r.grade ? ` — Grade ${r.grade}` : "";
    const name = r.dba || "Unknown";
    return `${type}: ${name}${grade}`.substring(0, 200);
};

/**
 * Build description from NYC record.
 */
const buildDescription = (r) => {
    const parts = [];
    if (r.action)                parts.push(`Action: ${r.action}`);
    if (r.violation_description) parts.push(`Violation: ${r.violation_description}`);
    if (r.score)                 parts.push(`Score: ${r.score}`);
    if (r.critical_flag)         parts.push(`Critical: ${r.critical_flag}`);
    return parts.length > 0
        ? parts.join(" | ").substring(0, 1000)
        : "No violation details recorded.";
};

/**
 * Map inspection_type → our type enum
 */
const mapType = (inspectionType) => {
    if (!inspectionType) return "inspection";
    const t = inspectionType.toLowerCase();
    if (t.includes("complaint")) return "complaint";
    if (t.includes("re-inspection")) return "inspection";
    return "inspection";
};

/**
 * Fetch recent restaurant inspection records from NYC Open Data.
 * @returns {Promise<Object[]>} Array of raw source records in common format
 */
export const fetchRecords = async () => {
    const params = {
        $limit:  FETCH_LIMIT,
        $order:  "inspection_date DESC",
        $where:  "inspection_date > '1900-01-02T00:00:00'"  // filter out placeholder dates
    };

    const headers = {};
    if (process.env.NYC_SOCRATA_APP_TOKEN) {
        headers["X-App-Token"] = process.env.NYC_SOCRATA_APP_TOKEN;
    }

    const response = await axios.get(API_ENDPOINT, { params, headers, timeout: 15000 });
    const records = response.data;

    if (!Array.isArray(records)) {
        throw new Error("NYC DOHMH API returned unexpected format");
    }

    return records.map(r => ({
        // CAMIS is the stable NYC restaurant identifier — use as external ID
        // We append inspection_date to make it record-specific (one restaurant can have many inspections)
        externalRecordId: r.camis && r.inspection_date
            ? `${r.camis}_${r.inspection_date}`
            : r.camis || null,

        sourceType,
        sourceName,
        sourceUrl: `https://data.cityofnewyork.us/resource/43nn-pn8j.json?camis=${r.camis}`,

        // Restaurant identity
        restaurantName: r.dba || null,
        address:        r.building && r.street ? `${r.building} ${r.street}` : (r.street || null),
        city:            r.boro || "New York City",
        state:           "NY",
        pincode:         r.zipcode || null,

        // Evidence content
        title:       buildTitle(r),
        description: buildDescription(r),

        // Dates
        evidenceDate: r.inspection_date || null,
        publishedAt:  r.record_date || r.inspection_date || null,

        // Classification
        type:     mapType(r.inspection_type),
        status:   mapGrade(r.grade, r.action),
        severity: mapCriticalFlag(r.critical_flag),

        // Raw source record — preserved for auditability, never stored in DB
        rawData: {
            camis:               r.camis,
            dba:                 r.dba,
            boro:                r.boro,
            zipcode:             r.zipcode,
            inspection_date:     r.inspection_date,
            inspection_type:     r.inspection_type,
            action:              r.action,
            violation_code:      r.violation_code,
            critical_flag:       r.critical_flag,
            score:               r.score,
            grade:               r.grade,
            grade_date:          r.grade_date,
            record_date:         r.record_date
        }
    }));
};

export const nycDohmhSource = {
    sourceType,
    sourceName,
    fetchRecords
};
