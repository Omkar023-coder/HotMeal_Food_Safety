import express from "express";
import {
    runIngestionHandler,
    listSourcesHandler,
    ingestionStatusHandler,
    ingestionRunsHandler,
    ingestionRunDetailHandler,
    ingestionHealthHandler
} from "../controllers/ingestionController.js";
import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const ingestionRouter = express.Router();

// POST /api/ingestion/run — trigger ingestion (admin only)
ingestionRouter.post("/run", authMiddleware, adminAuth, runIngestionHandler);

// GET /api/ingestion/sources — list enabled sources (admin only)
ingestionRouter.get("/sources", authMiddleware, adminAuth, listSourcesHandler);

// GET /api/ingestion/status — full operational snapshot with source health (admin only)
ingestionRouter.get("/status", authMiddleware, adminAuth, ingestionStatusHandler);

// GET /api/ingestion/health — lightweight health/readiness check (admin only)
ingestionRouter.get("/health", authMiddleware, adminAuth, ingestionHealthHandler);

// GET /api/ingestion/runs — recent run history, up to 100 (admin only)
ingestionRouter.get("/runs", authMiddleware, adminAuth, ingestionRunsHandler);

// GET /api/ingestion/runs/:id — single run detail with processingErrors (admin only)
// NOTE: must be defined after /runs to avoid matching "runs" as an :id
ingestionRouter.get("/runs/:id", authMiddleware, adminAuth, ingestionRunDetailHandler);

export default ingestionRouter;
