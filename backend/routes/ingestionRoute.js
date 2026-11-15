import express from "express";
import { runIngestionHandler, listSourcesHandler } from "../controllers/ingestionController.js";
import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const ingestionRouter = express.Router();

// POST /api/ingestion/run — trigger ingestion for a specific source (admin only)
// Body: { "source": "source-id" }  — defaults to "local-test"
ingestionRouter.post(
    "/run",
    authMiddleware,
    adminAuth,
    runIngestionHandler
);

// GET /api/ingestion/sources — list all configured enabled sources (admin only)
ingestionRouter.get(
    "/sources",
    authMiddleware,
    adminAuth,
    listSourcesHandler
);

export default ingestionRouter;
