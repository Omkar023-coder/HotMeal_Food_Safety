import crypto from "crypto";

/**
 * Generates a deterministic SHA-256 hash from stable evidence fields.
 *
 * The hash is built from:
 *   sourceType + sourceName + restaurantId + title + evidenceDate + description
 *
 * This allows idempotent ingestion: running the same source twice
 * produces the same hash, so duplicate records are detected and skipped.
 *
 * @param {Object} fields - Normalized evidence fields
 * @returns {string} 64-char hex SHA-256 hash
 */
const generateContentHash = (fields) => {
    const {
        sourceType = "",
        sourceName = "",
        restaurantId = "",
        title = "",
        evidenceDate = "",
        description = ""
    } = fields;

    // Concatenate stable fields in a fixed order
    const payload = [
        String(sourceType).trim().toLowerCase(),
        String(sourceName).trim(),
        String(restaurantId).trim(),
        String(title).trim(),
        String(evidenceDate || "").trim(),
        String(description).trim()
    ].join("|");

    return crypto
        .createHash("sha256")
        .update(payload, "utf8")
        .digest("hex");
};

export { generateContentHash };
