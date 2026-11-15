/**
 * Normalization Service
 *
 * Transforms a raw source record into a clean, validated internal representation.
 *
 * Rules:
 *  - Trim all strings
 *  - Convert empty strings to null
 *  - Lowercase type/status/severity and validate against allowed enums
 *  - Parse dates into ISO strings (or null)
 *  - Never invent missing values — unknown maps to the system's "unknown" default
 */

const VALID_TYPES = ["inspection", "violation", "complaint", "certification", "notice", "review", "other"];
const VALID_STATUSES = ["positive", "negative", "warning", "neutral", "unknown"];
const VALID_SEVERITIES = ["low", "medium", "high", "critical", "unknown"];

/**
 * Trim a string, convert empty to null.
 * @param {*} val
 * @returns {string|null}
 */
const cleanString = (val) => {
    if (val === undefined || val === null) return null;
    const trimmed = String(val).trim();
    return trimmed === "" ? null : trimmed;
};

/**
 * Lowercase + validate an enum value.
 * If invalid or missing, returns null (caller decides default).
 * @param {*} val
 * @param {string[]} allowed
 * @returns {string|null}
 */
const cleanEnum = (val, allowed) => {
    if (val === undefined || val === null) return null;
    const lower = String(val).trim().toLowerCase();
    return allowed.includes(lower) ? lower : null;
};

/**
 * Parse a date value into an ISO string, or null if invalid/missing.
 * Accepts Date objects, ISO strings, and common date formats.
 * @param {*} val
 * @returns {string|null}
 */
const cleanDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
};

/**
 * Normalize a raw source record.
 * @param {Object} raw - Raw record from a source adapter
 * @returns {Object} Normalized record (always has all expected keys)
 */
const normalize = (raw) => {
    return {
        // Provenance
        externalRecordId: cleanString(raw.externalRecordId),
        sourceType:       cleanString(raw.sourceType),
        sourceName:       cleanString(raw.sourceName),
        sourceUrl:        cleanString(raw.sourceUrl),

        // Restaurant identity
        restaurantName: cleanString(raw.restaurantName),
        address:        cleanString(raw.address),
        city:            cleanString(raw.city),
        state:           cleanString(raw.state),
        pincode:         cleanString(raw.pincode),

        // Evidence content
        title:       cleanString(raw.title),
        description: cleanString(raw.description),

        // Dates
        publishedAt:  cleanDate(raw.publishedAt),
        evidenceDate: cleanDate(raw.evidenceDate),

        // Enums — null if invalid/missing; caller fills defaults
        type:     cleanEnum(raw.type, VALID_TYPES),
        status:   cleanEnum(raw.status, VALID_STATUSES),
        severity: cleanEnum(raw.severity, VALID_SEVERITIES)
    };
};

export { normalize };
