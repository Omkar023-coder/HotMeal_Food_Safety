import express from "express";
import {
    addSafetyEvidence,
    listSafetyEvidence,
    getSafetyEvidence,
    deleteSafetyEvidence
} from "../controllers/safetyEvidenceController.js";
import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const safetyEvidenceRouter = express.Router();

// Add evidence — Admin only
safetyEvidenceRouter.post(
    "/add",
    authMiddleware,
    adminAuth,
    addSafetyEvidence
);

// List all evidence — Public (supports ?restaurantId=<id> filter)
safetyEvidenceRouter.get(
    "/list",
    listSafetyEvidence
);

// Get single evidence by ID — Public
// NOTE: this must be defined BEFORE any route that could shadow it
safetyEvidenceRouter.get(
    "/:id",
    getSafetyEvidence
);

// Delete evidence — Admin only
safetyEvidenceRouter.post(
    "/remove",
    authMiddleware,
    adminAuth,
    deleteSafetyEvidence
);

export default safetyEvidenceRouter;
