/**
 * Deduplication Service
 *
 * Checks whether a normalized + validated evidence record already exists
 * in MongoDB to ensure idempotent ingestion.
 *
 * Strategy:
 *  1. If externalRecordId + sourceType + sourceName all exist →
 *     dedup by that triple (external source identity)
 *  2. Otherwise → dedup by contentHash (SHA-256 of stable fields)
 *
 * Running ingestion twice with the same records will skip all duplicates.
 */

import safetyEvidenceModel from "../../models/safetyEvidenceModel.js";
import { generateContentHash } from "../utils/contentHash.js";

/**
 * Check if an evidence record is a duplicate.
 * @param {Object} record — Validated + normalized record with restaurantId
 * @returns {Promise<{ isDuplicate: boolean, existingId: string|null, dedupKey: string }>}
 */
const checkDuplicate = async (record) => {
    // ── Strategy 1: External record identity ──────────────────────────────
    if (record.externalRecordId && record.sourceType && record.sourceName) {
        const existing = await safetyEvidenceModel.findOne({
            sourceType: record.sourceType,
            sourceName: record.sourceName,
            externalRecordId: record.externalRecordId
        }).lean();

        if (existing) {
            return {
                isDuplicate: true,
                existingId: existing._id,
                dedupKey: `external:${record.sourceType}:${record.sourceName}:${record.externalRecordId}`
            };
        }
    }

    // ── Strategy 2: Content hash ──────────────────────────────────────────
    const hash = generateContentHash({
        sourceType:   record.sourceType,
        sourceName:   record.sourceName,
        restaurantId: record.restaurantId,
        title:        record.title,
        evidenceDate: record.evidenceDate,
        description:  record.description
    });

    const existing = await safetyEvidenceModel.findOne({ contentHash: hash }).lean();

    if (existing) {
        return {
            isDuplicate: true,
            existingId: existing._id,
            dedupKey: `hash:${hash}`
        };
    }

    return {
        isDuplicate: false,
        existingId: null,
        dedupKey: `hash:${hash}`,
        contentHash: hash  // pass back for insertion
    };
};

export { checkDuplicate };
