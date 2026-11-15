import express from "express";
import {
    runIngestionHandler,
    listSourcesHandler,
    ingestionStatusHandler,
    ingestionRunsHandler
} from "../controllers/ingestionController.js";
import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const ingestionRouter = express.Router();

// POST /api/ingestion/run — trigger ingestion (admin only)
ingestionRouter.post("/run", authMiddleware, adminAuth, runIngestionHandler);

// GET /api/ingestion/sources — list enabled sources (admin only)
ingestionRouter.get("/sources", authMiddleware, adminAuth, listSourcesHandler);

// GET /api/ingestion/status — ingestion state + scheduler (admin only)
ingestionRouter.get("/status", authMiddleware, adminAuth, ingestionStatusHandler);

// GET /api/ingestion/runs — recent run history (admin only)
ingestionRouter.get("/runs", authMiddleware, adminAuth, ingestionRunsHandler);

export default ingestionRouter;
