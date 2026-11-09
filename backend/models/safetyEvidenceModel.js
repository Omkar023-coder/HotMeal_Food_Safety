import mongoose from "mongoose";

const safetyEvidenceSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "restaurant",
            required: true
        },

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

        evidenceDate: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: ["positive", "negative", "warning", "neutral", "unknown"],
            default: "unknown"
        },

        severity: {
            type: String,
            enum: ["low", "medium", "high", "critical", "unknown"],
            default: "unknown"
        }
    },
    {
        timestamps: true   // createdAt + updatedAt
    }
);

// Index on restaurantId for fast filtering by restaurant
safetyEvidenceSchema.index({ restaurantId: 1 });

const safetyEvidenceModel =
    mongoose.models.safetyEvidence ||
    mongoose.model("safetyEvidence", safetyEvidenceSchema);

export default safetyEvidenceModel;
