/**
 * Ingestion Lock Service — Milestone 5D
 *
 * MongoDB-based run locking to prevent concurrent ingestion runs
 * for the same source.
 *
 * Features:
 *   - acquireLock: atomically set lockStatus → "locked" if currently "unlocked"
 *   - releaseLock: set lockStatus → "unlocked"
 *   - recoverStaleLock: if lock is older than lease time, force-release
 *   - Lock has expiration (lease) time — stale locks auto-recover
 *
 * This is NOT an in-memory lock — it persists in MongoDB.
 * Survives server restarts and works across multiple server instances.
 */

import ingestionStateModel from "../../models/ingestionStateModel.js";

// Lock lease: 10 minutes. If a run takes longer, the lock becomes stale
// and can be recovered by the next attempt.
const LOCK_LEASE_MS = parseInt(process.env.INGESTION_LOCK_LEASE_MS || "600000", 10);

/**
 * Get or create the state record for a source.
 */
const getOrCreateState = async (sourceType) => {
    let state = await ingestionStateModel.findOne({ sourceType });
    if (!state) {
        state = new ingestionStateModel({ sourceType });
        await state.save();
    }
    return state;
};

/**
 * Attempt to acquire a lock for a source.
 *
 * @param {string} sourceType
 * @param {string} runId — MongoDB ObjectId (as string) of the run requesting the lock
 * @returns {Promise<{ acquired: boolean, reason: string, state: Object }>}
 */
const acquireLock = async (sourceType, runId) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_LEASE_MS);

    // First, try to recover stale locks
    await recoverStaleLock(sourceType);

    // Ensure state document exists
    await getOrCreateState(sourceType);

    // Atomically acquire: only if lockStatus is "unlocked"
    // Use updateOne + modifiedCount to avoid findOneAndUpdate return format issues
    const updateResult = await ingestionStateModel.updateOne(
        { sourceType, lockStatus: "unlocked" },
        {
            $set: {
                lockStatus:     "locked",
                lockAcquiredAt:  now,
                lockRunId:       runId,
                lockExpiresAt:   expiresAt,
                lastAttemptAt:   now
            }
        }
    );

    if (updateResult.modifiedCount === 0) {
        // Lock is held by another run
        const state = await ingestionStateModel.findOne({ sourceType }).lean();
        return {
            acquired: false,
            reason:    `Source "${sourceType}" is already running (lock held by run ${state?.lockRunId})`,
            state
        };
    }

    return { acquired: true, reason: "Lock acquired" };
};

/**
 * Release the lock for a source.
 *
 * @param {string} sourceType
 * @param {string} runId — must match the runId that acquired the lock
 * @returns {Promise<boolean>}
 */
const releaseLock = async (sourceType, runId) => {
    const result = await ingestionStateModel.updateOne(
        { sourceType, lockRunId: runId, lockStatus: "locked" },
        {
            $set: {
                lockStatus:      "unlocked",
                lockAcquiredAt:   null,
                lockRunId:        null,
                lockExpiresAt:    null
            }
        }
    );
    return result.modifiedCount > 0;
};

/**
 * Recover a stale lock if it has exceeded its lease time.
 * This prevents permanent deadlocks when a process crashes mid-run.
 *
 * @param {string} sourceType
 * @returns {Promise<boolean>} true if a stale lock was recovered
 */
const recoverStaleLock = async (sourceType) => {
    const now = new Date();

    const result = await ingestionStateModel.updateOne(
        {
            sourceType,
            lockStatus: "locked",
            lockExpiresAt: { $lt: now }
        },
        {
            $set: {
                lockStatus:      "unlocked",
                lockAcquiredAt:   null,
                lockRunId:        null,
                lockExpiresAt:    null,
                lastError:        "Stale lock recovered (process may have crashed)"
            }
        }
    );

    return result.modifiedCount > 0;
};

/**
 * Force-release any lock for a source (admin override).
 * Use with caution.
 */
const forceReleaseLock = async (sourceType) => {
    await ingestionStateModel.updateOne(
        { sourceType },
        {
            $set: {
                lockStatus:      "unlocked",
                lockAcquiredAt:   null,
                lockRunId:        null,
                lockExpiresAt:    null
            }
        }
    );
};

/**
 * Get current lock status for a source.
 */
const getLockStatus = async (sourceType) => {
    const state = await getOrCreateState(sourceType);
    return {
        locked:       state.lockStatus === "locked",
        lockRunId:     state.lockRunId,
        lockAcquiredAt: state.lockAcquiredAt,
        lockExpiresAt:   state.lockExpiresAt,
        isStale:        state.lockStatus === "locked" &&
                        state.lockExpiresAt &&
                        new Date() > state.lockExpiresAt
    };
};

export {
    acquireLock,
    releaseLock,
    recoverStaleLock,
    forceReleaseLock,
    getLockStatus,
    getOrCreateState,
    LOCK_LEASE_MS
};
