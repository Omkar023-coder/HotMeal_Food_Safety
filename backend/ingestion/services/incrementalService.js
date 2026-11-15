/**
 * Incremental Service — Milestone 5D
 *
 * Manages per-source incremental ingestion state:
 *   - Checkpoint storage (last successful fetch timestamp)
 *   - Checkpoint advancement (only after successful run)
 *   - Providing `sinceDate` to source adapters that support incremental
 *
 * Checkpoint Safety Rule:
 *   SUCCESSFUL run → checkpoint may advance
 *   PARTIAL/FAILED run → checkpoint must NOT advance
 *
 * This prevents silent data loss on retry.
 */

import ingestionStateModel from "../../models/ingestionStateModel.js";
import { getOrCreateState } from "./ingestionLockService.js";

/**
 * Get the current checkpoint for a source.
 * Returns null if no checkpoint has ever been set.
 *
 * @param {string} sourceType
 * @returns {Promise<Date|null>}
 */
const getCheckpoint = async (sourceType) => {
    const state = await getOrCreateState(sourceType);
    return state.lastCheckpoint;
};

/**
 * Advance the checkpoint ONLY if the run succeeded.
 *
 * @param {string} sourceType
 * @param {boolean} runSucceeded — if false, checkpoint is NOT advanced
 * @param {string} runId — ObjectId of the run (for audit trail)
 * @param {Date|null} newCheckpoint — the timestamp to advance to
 * @returns {Promise<Date|null>} the current checkpoint after this call
 */
const advanceCheckpoint = async (sourceType, runSucceeded, runId, newCheckpoint) => {
    const state = await getOrCreateState(sourceType);

    if (runSucceeded) {
        // Only advance if the new checkpoint is newer than the current one
        if (newCheckpoint && (!state.lastCheckpoint || new Date(newCheckpoint) > state.lastCheckpoint)) {
            state.lastCheckpoint = new Date(newCheckpoint);
        }
        state.lastRunId     = runId;
        state.lastSuccessAt = new Date();
        state.lastError     = null;
    } else {
        // Do NOT advance checkpoint — leave it where it was
        state.lastRunId = runId;
        state.lastError = "Last run did not succeed — checkpoint not advanced";
    }

    state.lastAttemptAt = new Date();
    await state.save();
    return state.lastCheckpoint;
};

/**
 * Determine the `sinceDate` to pass to a source adapter.
 *
 * If the source supports incremental and has a checkpoint, return the checkpoint.
 * Otherwise return null (full fetch).
 *
 * @param {Object} sourceMeta — source registry entry
 * @returns {Promise<Date|null>}
 */
const getSinceDate = async (sourceMeta) => {
    if (!sourceMeta.supportsIncremental) {
        return null;
    }

    const checkpoint = await getCheckpoint(sourceMeta.sourceType || sourceMeta.id);
    return checkpoint;
};

/**
 * Get the latest evidence date from the most recent ingestion,
 * to use as the new checkpoint after a successful run.
 * We use the max of evidenceDate across processed records.
 * Falls back to `now` if no records had evidenceDate.
 *
 * @param {Array} rawRecords — the records fetched this run
 * @returns {Date}
 */
const computeNewCheckpoint = (rawRecords) => {
    let maxDate = new Date(0);

    for (const record of rawRecords) {
        const dateField = record.evidenceDate || record.publishedAt;
        if (dateField) {
            const d = new Date(dateField);
            if (!isNaN(d.getTime()) && d > maxDate) {
                maxDate = d;
            }
        }
    }

    // If no evidence dates were found, use current time
    if (maxDate.getTime() === 0) {
        return new Date();
    }

    return maxDate;
};

export {
    getCheckpoint,
    advanceCheckpoint,
    getSinceDate,
    computeNewCheckpoint
};
