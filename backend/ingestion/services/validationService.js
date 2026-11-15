/**
 * Validation Service
 *
 * Validates a normalized record before it enters the database.
 * Returns a result object with `valid`, `errors`, and `sanitized` fields.
 *
 * Rules:
 *  - title is required
 *  - description is required
 *  - type must be a valid enum value (defaults to "other" if missing)
 *  - status defaults to "unknown" if missing
 *  - severity defaults to "unknown" if missing
 *  - sourceType and sourceName are required for ingestion provenance
 *  - evidenceDate is optional but recommended
 *
 * Never invents evidence information. Only fills system defaults for
 * status/severity when the source does not provide them.
 */

const VALID_TYPES = ["inspection", "violation", "complaint", "certification", "notice", "review", "other"];
const VALID_STATUSES = ["positive", "negative", "warning", "neutral", "unknown"];
const VALID_SEVERITIES = ["low", "medium", "high", "critical", "unknown"];

/**
 * Validate a normalized record.
 * @param {Object} record — Normalized record from normalizationService
 * @returns {{ valid: boolean, errors: string[], data: Object|null }}
 */
const validate = (record) => {
    const errors = [];

    // ── Required provenance ──────────────────────────────────────────────
    if (!record.sourceType) {
        errors.push("sourceType is required");
    }
    if (!record.sourceName) {
        errors.push("sourceName is required");
    }

    // ── Required content ────────────────────────────────────────────────
    if (!record.title) {
        errors.push("title is required");
    }
    if (!record.description) {
        errors.push("description is required");
    }

    // ── Type ─────────────────────────────────────────────────────────────
    let type = record.type;
    if (!type) {
        // Missing type defaults to "other" (system default, not fabrication)
        type = "other";
    } else if (!VALID_TYPES.includes(type)) {
        errors.push(`type "${type}" is not a valid enum value`);
    }

    // ── Status (defaults to "unknown" — system default, not fabrication) ─
    let status = record.status || "unknown";
    if (!VALID_STATUSES.includes(status)) {
        errors.push(`status "${status}" is not a valid enum value`);
    }

    // ── Severity (defaults to "unknown" — system default, not fabrication) ─
    let severity = record.severity || "unknown";
    if (!VALID_SEVERITIES.includes(severity)) {
        errors.push(`severity "${severity}" is not a valid enum value`);
    }

    if (errors.length > 0) {
        return { valid: false, errors, data: null };
    }

    // Return sanitized data with defaults filled
    return {
        valid: true,
        errors: [],
        data: {
            ...record,
            type,
            status,
            severity
        }
    };
};

export { validate };
