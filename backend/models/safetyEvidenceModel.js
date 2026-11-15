import mongoose from "mongoose";

/**
 * Safety Evidence Model
 *
 * Stores individual safety evidence records for restaurants.
 *
 * Provenance fields (sourceType, externalRecordId, publishedAt,
 * retrievedAt, contentHash) are all optional with defaults so that:
 *   - Existing manual CRUD from the admin UI continues to work unchanged
 *   - Ingestion-created records carry full provenance
 *
 * Key date distinction:
 *   evidenceDate — date the inspection/event occurred
 *   publishedAt  — date the source published the record
 *   retrievedAt  — date our system downloaded/processed it
 *   createdAt    — Mongoose auto timestamp for record creation
 */

const safetyEvidenceSchema = new mongoose.Schema(
    {
        // ── Core relationship ──────────────────────────────────────────────
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "restaurant",
            required: true
        },

        // ── Evidence content ───────────────────────────────────────────────
        type: {
            type: String,
            enum: ["inspection", "violation", "complaint", "certification", "notice", "review", "other"],
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        // ── Evidence dates ─────────────────────────────────────────────────
        evidenceDate: {
            type: Date,
            default: null
        },

        // ── Assessment ────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ["positive", "negative", "warning", "neutral", "unknown"],
            default: "unknown"
        },

        severity: {
            type: String,
            enum: ["low", "medium", "high", "critical", "unknown"],
            default: "unknown"
        },

        // ── Source / citation ──────────────────────────────────────────────
        sourceName: {
            type: String,
            trim: true,
            default: null
        },

        sourceUrl: {
            type: String,
            trim: true,
            default: null
        },

        // ── Provenance (populated by ingestion pipeline) ───────────────────
        // All optional — manual admin CRUD leaves these null by default

        sourceType: {
            type: String,
            trim: true,
            default: null   // e.g. "local-test", "fssai-api", "government-dataset"
        },

        externalRecordId: {
            type: String,
            trim: true,
            default: null   // ID from the original source system
        },

        publishedAt: {
            type: Date,
            default: null   // date the source published the record
        },

        retrievedAt: {
            type: Date,
            default: null   // date our ingestion system processed it
        },

        contentHash: {
            type: String,
            default: null   // SHA-256 hash for deduplication
        }
    },
    {
        timestamps: true   // createdAt + updatedAt (auto-managed by Mongoose)
    }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
// Fast filtering by restaurant (existing)
safetyEvidenceSchema.index({ restaurantId: 1 });

// Deduplication by external record identity
safetyEvidenceSchema.index(
    { sourceType: 1, sourceName: 1, externalRecordId: 1 },
    { sparse: true }   // sparse: only index docs where these fields exist
);

// Deduplication by content hash
safetyEvidenceSchema.index(
    { contentHash: 1 },
    { sparse: true }
);

const safetyEvidenceModel =
    mongoose.models.safetyEvidence ||
    mongoose.model("safetyEvidence", safetyEvidenceSchema);

export default safetyEvidenceModel;
