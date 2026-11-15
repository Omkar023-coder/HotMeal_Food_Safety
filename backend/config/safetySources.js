/**
 * Safety Source Registry
 *
 * Central registry of all supported safety evidence sources.
 *
 * Rules:
 *   - Never store API keys or secrets here
 *   - Use process.env for any credentials that may be required
 *   - Set enabled: false for sources that are temporarily unavailable
 *   - accessType values: "api" | "csv-download" | "web" | "manual"
 *
 * Adding a new source:
 *   1. Add an entry here
 *   2. Create a source adapter in backend/ingestion/sources/<id>Source.js
 *   3. Import and register the adapter in ingestionController.js
 */

export const safetySources = [
    // ── Local test source (5A, pipeline testing only) ────────────────────────
    {
        id:           "local-test",
        name:         "Local Test Source",
        authority:    "HotMeal Internal",
        country:      "IN",
        region:       null,
        sourceType:   "local-test",
        officialUrl:  null,
        accessType:   "manual",
        dataFormat:   "json",
        enabled:      true,
        adapterFile:  "localTestSource",
        description:  "Hardcoded test records for pipeline testing. Not real evidence. Never for production use.",
        notes:        "TEST ONLY — does not access the internet or any real authority.",
        // 5D — incremental capabilities
        supportsIncremental: false,
        incrementalStrategy: "none"
    },

    // ── Chicago Department of Public Health — Food Inspections ──────────────
    {
        id:           "chicago-food-inspections",
        name:         "Chicago Food Inspections",
        authority:    "Chicago Department of Public Health (CDPH)",
        country:      "US",
        region:       "Chicago, Illinois",
        sourceType:   "government-open-data",
        officialUrl:  "https://data.cityofchicago.org/Health-Human-Services/Food-Inspections/4ijn-s7e5",
        accessType:   "api",
        apiEndpoint:  "https://data.cityofchicago.org/resource/4ijn-s7e5.json",
        dataFormat:   "json",
        authRequired: false,
        rateLimit:    "1000 req/hr without token; higher with Socrata app token",
        updateFreq:   "Daily",
        recordFields: "inspection_id, dba_name, aka_name, license_, facility_type, risk, address, city, state, zip, inspection_date, inspection_type, results, violations, latitude, longitude",
        enabled:      true,
        adapterFile:  "chicagoFoodInspectionsSource",
        description:  "Real inspection records for Chicago food establishments from January 2010 to present, via Socrata Open Data API.",
        notes:        "Publicly accessible, no auth required. Use ?$limit and ?$offset for pagination.",
        // 5D — incremental capabilities
        // Socrata SODA API supports $where=inspection_date > 'timestamp'
        supportsIncremental: true,
        incrementalStrategy: "timestamp",
        incrementalField:    "inspection_date"
    },

    // ── NYC DOHMH Restaurant Inspection Results ──────────────────────────────
    {
        id:           "nyc-dohmh-inspections",
        name:         "NYC DOHMH Restaurant Inspection Results",
        authority:    "NYC Department of Health and Mental Hygiene (DOHMH)",
        country:      "US",
        region:       "New York City, New York",
        sourceType:   "government-open-data",
        officialUrl:  "https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j",
        accessType:   "api",
        apiEndpoint:  "https://data.cityofnewyork.us/resource/43nn-pn8j.json",
        dataFormat:   "json",
        authRequired: false,
        rateLimit:    "1000 req/hr without token; higher with Socrata app token",
        updateFreq:   "Daily",
        recordFields: "camis, dba, boro, building, street, zipcode, phone, cuisine_description, inspection_date, action, violation_code, violation_description, critical_flag, score, grade, grade_date, inspection_type",
        enabled:      true,
        adapterFile:  "nycDohmhSource",
        description:  "Every sustained or not-yet-adjudicated violation from NYC restaurant inspections up to 3 years prior, via NYC Open Data / Socrata.",
        notes:        "Publicly accessible, no auth required. CAMIS is the stable restaurant identifier.",
        // 5D — incremental capabilities
        // Socrata SODA API supports $where=inspection_date > 'timestamp'
        supportsIncremental: true,
        incrementalStrategy: "timestamp",
        incrementalField:    "inspection_date"
    },

    // ── FSSAI (India) ─────────────────────────────────────────────────────────
    {
        id:           "fssai-india",
        name:         "FSSAI Food Business Operator Registry",
        authority:    "Food Safety and Standards Authority of India (FSSAI)",
        country:      "IN",
        region:       "India",
        sourceType:   "government-regulatory",
        officialUrl:  "https://foscos.fssai.gov.in",
        accessType:   "web",
        apiEndpoint:  null,
        dataFormat:   "web-form",
        authRequired: false,
        enabled:      false,  // No stable public bulk-download or JSON API available
        adapterFile:  null,
        description:  "FSSAI maintains a searchable portal (FoSCoS) of licensed food businesses in India. No official bulk-download or public REST API is available as of Milestone 5B.",
        notes:        "LIMITATION: FoSCoS provides a web UI for individual lookups only. A third-party paid API exists (RapidAPI) but is not official. Enable this source when an official API or verified data export becomes available.",
        // 5D — no incremental support (disabled source)
        supportsIncremental: false,
        incrementalStrategy: "none"
    }
];

/**
 * Get a source configuration by ID.
 * @param {string} id
 * @returns {Object|null}
 */
export const getSourceById = (id) => {
    return safetySources.find(s => s.id === id) || null;
};

/**
 * Get all enabled sources.
 * @returns {Object[]}
 */
export const getEnabledSources = () => {
    return safetySources.filter(s => s.enabled);
};
