import mongoose from "mongoose";

/**
 * Ingestion State Model — Milestone 5D
 *
 * Persistent per-source ingestion state.
 * Survives server restarts. Stored in MongoDB, not in memory.
 *
 * Fields:
 *   sourceType        — which source this state belongs to
 *   lastCheckpoint    — ISO timestamp of last successful incremental fetch
 *   lastRunId         — ObjectId of the last ingestion run
 *   lastSuccessAt     — when the last successful run completed
 *   lastAttemptAt     — when the last run was attempted (any outcome)
 *   lastError         — last fatal error message (cleared on success)
 *
 * Lock fields (concurrent-run protection):
 *   lockStatus        — "unlocked" | "locked"
 *   lockAcquiredAt    — when the current lock was acquired
 *   lockRunId         — ObjectId of the run holding the lock
 *   lockExpiresAt     — when the lock becomes stale and can be recovered
 */

const ingestionStateSchema = new mongoose.Schema(
    {
        sourceType: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        // ── Incremental checkpoint ────────────────────────────────────────────
        lastCheckpoint: {
            type: Date,
            default: null
        },

        lastRunId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ingestionRun",
            default: null
        },

        lastSuccessAt: {
            type: Date,
            default: null
        },

        lastAttemptAt: {
            type: Date,
            default: null
        },

        lastError: {
            type: String,
            default: null
        },

        // ── Run lock (concurrent-run protection) ──────────────────────────────
        lockStatus: {
            type: String,
            enum: ["unlocked", "locked"],
            default: "unlocked"
        },

        lockAcquiredAt: {
            type: Date,
            default: null
        },

        lockRunId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ingestionRun",
            default: null
        },

        lockExpiresAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

const ingestionStateModel =
    mongoose.models.ingestionState ||
    mongoose.model("ingestionState", ingestionStateSchema);

export default ingestionStateModel;
