import mongoose from "mongoose";

/**
 * Ingestion Run Audit Model
 *
 * Records each ingestion run for traceability and debugging.
 * Answers: "When was this source last ingested? How many records were processed?"
 */

const ingestionRunSchema = new mongoose.Schema(
    {
        sourceType: {
            type: String,
            required: true
        },

        sourceName: {
            type: String,
            required: true
        },

        startedAt: {
            type: Date,
            required: true
        },

        completedAt: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: ["running", "completed", "completed_with_errors", "failed", "skipped", "already_running"],
            default: "running"
        },

        // 5D — who triggered this run?
        triggerType: {
            type: String,
            enum: ["manual", "scheduled", "retry"],
            default: "manual"
        },

        // 5D — incremental checkpoint tracking
        checkpointBefore: {
            type: Date,
            default: null
        },

        checkpointAfter: {
            type: Date,
            default: null
        },

        fetchedCount: {
            type: Number,
            default: 0
        },

        insertedCount: {
            type: Number,
            default: 0
        },

        skippedCount: {
            type: Number,
            default: 0
        },

        failedCount: {
            type: Number,
            default: 0
        },

        // 5C — granular sub-counts within failedCount
        unresolvedCount: {
            type: Number,
            default: 0
        },

        validationFailedCount: {
            type: Number,
            default: 0
        },

        processingErrors: {
            type: Array,
            default: []
            // Each error: { externalRecordId: String|null, stage: String, message: String }
        }
    },
    {
        timestamps: true
    }
);

// Index on sourceType for querying run history
ingestionRunSchema.index({ sourceType: 1, startedAt: -1 });

const ingestionRunModel =
    mongoose.models.ingestionRun ||
    mongoose.model("ingestionRun", ingestionRunSchema);

export default ingestionRunModel;
