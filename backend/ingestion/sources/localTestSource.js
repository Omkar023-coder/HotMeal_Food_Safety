/**
 * Local Test Source Adapter
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  THIS IS A TEST ADAPTER ONLY.                                            │
 * │  It does NOT access the internet.                                         │
 * │  It does NOT scrape websites.                                             │
 * │  It does NOT connect to any real food-safety authority.                   │
 * │  It returns hardcoded test records to exercise the ingestion pipeline.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Future real adapters (5B/5C) will implement the same interface
 * but fetch from actual government APIs, datasets, or web pages.
 *
 * Adapter interface:
 *   - sourceType:  string identifier for this source
 *   - sourceName:  human-readable name
 *   - fetchRecords(): async function returning raw source records
 */

const sourceType = "local-test";
const sourceName = "Local Test Source";

/**
 * Fetch test records.
 *
 * Test data design:
 *   TEST-001 → will resolve if "Govinda Restaurant" exists in Latur
 *   TEST-002 → will resolve if "The Spice Garden" exists in Pune
 *   TEST-003 → intentionally unresolvable restaurant name (tests failure path)
 *   TEST-004 → intentionally invalid type (tests validation failure)
 *
 * These are clearly test records — not real evidence from any authority.
 */
const fetchRecords = async () => {
    return [
        {
            externalRecordId: "TEST-001",
            sourceType,
            sourceName,
            sourceUrl: null,

            restaurantName: "Govinda Restaurant",
            address: "JSPM College Near by 5 Number",
            city: "Latur",
            state: "Maharashtra",
            pincode: "413512",

            title: "Routine Hygiene Inspection",
            description: "TEST DATA — Routine health and hygiene inspection conducted by local food safety officer. No major violations found.",

            evidenceDate: "2026-11-04",
            publishedAt: "2026-11-04",

            type: "inspection",
            status: "positive",
            severity: "low"
        },
        {
            externalRecordId: "TEST-002",
            sourceType,
            sourceName,
            sourceUrl: null,

            restaurantName: "The Spice Garden",
            address: "12 MG Road",
            city: "Pune",
            state: "Maharashtra",
            pincode: "411001",

            title: "Food Safety Certification Renewed",
            description: "TEST DATA — FSSAI certification renewed after successful audit of kitchen facilities and food handling practices.",

            evidenceDate: "2026-10-15",
            publishedAt: "2026-10-15",

            type: "certification",
            status: "positive",
            severity: "low"
        },
        {
            externalRecordId: "TEST-003",
            sourceType,
            sourceName,
            sourceUrl: null,

            restaurantName: "Nonexistent Restaurant XYZ",
            address: "Nowhere Street",
            city: "Ghost Town",
            state: "Nowhere",
            pincode: "000000",

            title: "This should fail restaurant resolution",
            description: "TEST DATA — This record should NOT be ingested because the restaurant does not exist in the database.",

            evidenceDate: "2026-11-01",
            publishedAt: "2026-11-01",

            type: "violation",
            status: "negative",
            severity: "medium"
        },
        {
            externalRecordId: "TEST-004",
            sourceType,
            sourceName,
            sourceUrl: null,

            restaurantName: "Govinda Restaurant",
            address: "JSPM College Near by 5 Number",
            city: "Latur",
            state: "Maharashtra",
            pincode: "413512",

            title: "This should fail validation",
            description: "",

            evidenceDate: "2026-11-03",
            publishedAt: "2026-11-03",

            type: "not_a_valid_type",
            status: "positive",
            severity: "low"
        }
    ];
};

export const localTestSource = {
    sourceType,
    sourceName,
    fetchRecords
};
