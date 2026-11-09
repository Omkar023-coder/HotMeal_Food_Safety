import safetyEvidenceModel from "../models/safetyEvidenceModel.js";
import restaurantModel from "../models/restaurantModel.js";
import mongoose from "mongoose";

// ─── Add Safety Evidence (admin only) ─────────────────────────────────────────
const addSafetyEvidence = async (req, res) => {
    try {
        const {
            restaurantId,
            type,
            title,
            description,
            sourceName,
            sourceUrl,
            evidenceDate,
            status,
            severity
        } = req.body;

        // Validate restaurantId is a valid ObjectId before querying
        if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing restaurantId."
            });
        }

        // Confirm the restaurant actually exists
        const restaurant = await restaurantModel.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found. Cannot add evidence for a non-existent restaurant."
            });
        }

        const evidence = new safetyEvidenceModel({
            restaurantId,
            type,
            title,
            description,
            sourceName:   sourceName   || null,
            sourceUrl:    sourceUrl    || null,
            evidenceDate: evidenceDate || null,
            status:       status       || "unknown",
            severity:     severity     || "unknown"
        });

        await evidence.save();

        res.status(201).json({
            success: true,
            message: "Safety evidence added.",
            data: evidence
        });

    } catch (error) {
        console.log("addSafetyEvidence error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Error adding safety evidence."
        });
    }
};

// ─── List Safety Evidence (public, optional restaurantId filter) ───────────────
const listSafetyEvidence = async (req, res) => {
    try {
        const filter = {};

        // Optional query param: ?restaurantId=<id>
        if (req.query.restaurantId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.restaurantId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid restaurantId query parameter."
                });
            }
            filter.restaurantId = req.query.restaurantId;
        }

        const evidenceList = await safetyEvidenceModel
            .find(filter)
            .populate("restaurantId", "name city state status")
            .sort({ evidenceDate: -1, createdAt: -1 });  // most recent first

        res.json({
            success: true,
            data: evidenceList
        });

    } catch (error) {
        console.log("listSafetyEvidence error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Error fetching safety evidence."
        });
    }
};

// ─── Get Single Safety Evidence by ID (public) ────────────────────────────────
const getSafetyEvidence = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid evidence ID."
            });
        }

        const evidence = await safetyEvidenceModel
            .findById(req.params.id)
            .populate("restaurantId", "name city state status");

        if (!evidence) {
            return res.status(404).json({
                success: false,
                message: "Safety evidence not found."
            });
        }

        res.json({
            success: true,
            data: evidence
        });

    } catch (error) {
        console.log("getSafetyEvidence error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Error fetching safety evidence."
        });
    }
};

// ─── Delete Safety Evidence (admin only) ──────────────────────────────────────
const deleteSafetyEvidence = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing evidence ID."
            });
        }

        const evidence = await safetyEvidenceModel.findById(id);
        if (!evidence) {
            return res.status(404).json({
                success: false,
                message: "Safety evidence not found."
            });
        }

        await safetyEvidenceModel.findByIdAndDelete(id);

        res.json({
            success: true,
            message: "Safety evidence removed."
        });

    } catch (error) {
        console.log("deleteSafetyEvidence error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Error removing safety evidence."
        });
    }
};

export {
    addSafetyEvidence,
    listSafetyEvidence,
    getSafetyEvidence,
    deleteSafetyEvidence
};
