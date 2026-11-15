/**
 * Ingestion Controller — Milestone 5D
 *
 * Admin-only endpoints for ingestion management.
 *
 * POST /api/ingestion/run       — trigger ingestion (manual)
 * GET  /api/ingestion/sources   — list configured sources
 * GET  /api/ingestion/status    — ingestion state + scheduler status
 * GET  /api/ingestion/runs      — recent ingestion run history
 */

import { runIngestion } from "../ingestion/services/ingestionService.js";
import { localTestSource } from "../ingestion/sources/localTestSource.js";
import { chicagoFoodInspectionsSource } from "../ingestion/sources/chicagoFoodInspectionsSource.js";
import { nycDohmhSource } from "../ingestion/sources/nycDohmhSource.js";
import { getSourceById, getEnabledSources } from "../config/safetySources.js";
import { getSchedulerStatus } from "../ingestion/services/ingestionScheduler.js";
import { getLockStatus } from "../ingestion/services/ingestionLockService.js";
import { getCheckpoint } from "../ingestion/services/incrementalService.js";
import ingestionRunModel from "../models/ingestionRunModel.js";

// Map source IDs → adapter objects
const ADAPTER_MAP = {
    "local-test":               localTestSource,
    "chicago-food-inspections": chicagoFoodInspectionsSource,
    "nyc-dohmh-inspections":    nycDohmhSource
};

/**
 * POST /api/ingestion/run
 * Body: { "source": "source-id" }  (defaults to "local-test")
 */
const runIngestionHandler = async (req, res) => {
    try {
        const sourceId = req.body?.source || "local-test";

        const sourceMeta = getSourceById(sourceId);
        if (!sourceMeta) {
            return res.status(400).json({
                success: false,
                message: `Unknown source: "${sourceId}". Available: ${Object.keys(ADAPTER_MAP).join(", ")}`
            });
        }

        if (!sourceMeta.enabled) {
            return res.status(400).json({
                success: false,
                message: `Source "${sourceId}" is disabled. ${sourceMeta.notes || ""}`
            });
        }

        const adapter = ADAPTER_MAP[sourceId];
        if (!adapter) {
            return res.status(500).json({
                success: false,
                message: `Source "${sourceId}" has no registered adapter.`
            });
        }

        // Run with lock + incremental + triggerType
        const result = await runIngestion(adapter, {
            triggerType: "manual",
            sourceMeta
        });

        if (result.skipped === true) {
            // Lock was not acquired — run was genuinely skipped
            return res.status(409).json({
                success: false,
                message: result.message,
                data: {
                    runId:     result.runId,
                    sourceId,
                    sourceType: result.sourceType,
                    skipped:   true
                }
            });
        }

        const statusCode = result.success ? 200 : 500;
        return res.status(statusCode).json({
            success: result.success,
            message: result.success
                ? `Ingestion completed. ${result.inserted} inserted, ${result.duplicates} duplicates, ${result.unresolved} unresolved, ${result.validationFailed} validation failed, ${result.failed} errors.`
                : `Ingestion failed: ${result.errors?.[result.errors.length - 1]?.message || "Unknown error"}`,
            data: {
                runId:              result.runId,
                sourceId,
                sourceType:         result.sourceType,
                sourceName:         result.sourceName,
                triggerType:        result.triggerType,
                incremental:        result.incremental,
                checkpointBefore:   result.checkpointBefore,
                checkpointAfter:    result.checkpointAfter,
                fetched:            result.fetched,
                inserted:           result.inserted,
                duplicates:         result.duplicates,
                unresolved:         result.unresolved,
                validationFailed:   result.validationFailed,
                failed:             result.failed,
                skipped:            result.duplicates,
                errors:             result.errors
            }
        });

    } catch (error) {
        console.error("runIngestionHandler error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Unexpected error during ingestion."
        });
    }
};

/**
 * GET /api/ingestion/sources — list all enabled sources
 */
const listSourcesHandler = async (req, res) => {
    try {
        const sources = getEnabledSources().map(s => ({
            id:                   s.id,
            name:                 s.name,
            authority:            s.authority,
            country:              s.country,
            region:               s.region || null,
            sourceType:           s.sourceType,
            officialUrl:          s.officialUrl || null,
            accessType:           s.accessType,
            enabled:              s.enabled,
            supportsIncremental:  s.supportsIncremental || false,
            incrementalStrategy:  s.incrementalStrategy || "none",
            description:          s.description,
            notes:                s.notes || null
        }));
        return res.json({ success: true, data: sources });
    } catch (error) {
        console.error("listSourcesHandler error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/ingestion/status — ingestion state for all sources + scheduler status
 */
const ingestionStatusHandler = async (req, res) => {
    try {
        const scheduler = getSchedulerStatus();
        const sources = getEnabledSources();

        const sourceStates = [];
        for (const source of sources) {
            // State documents are keyed by source.id (which matches the adapter's sourceType)
            const stateKey   = source.id;
            const lockStatus = await getLockStatus(stateKey);
            const checkpoint  = await getCheckpoint(stateKey);
            sourceStates.push({
                sourceId:              source.id,
                sourceName:            source.name,
                supportsIncremental:   source.supportsIncremental || false,
                lastCheckpoint:        checkpoint,
                locked:                lockStatus.locked,
                lockRunId:             lockStatus.lockRunId,
                lockAcquiredAt:        lockStatus.lockAcquiredAt,
                lockExpiresAt:         lockStatus.lockExpiresAt,
                isStaleLock:           lockStatus.isStale
            });
        }

        return res.json({
            success: true,
            data: {
                scheduler,
                sources: sourceStates
            }
        });
    } catch (error) {
        console.error("ingestionStatusHandler error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/ingestion/runs — recent ingestion run history
 * Query: ?limit=10  (default 10, max 50)
 */
const ingestionRunsHandler = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query?.limit || "10", 10), 50);

        const runs = await ingestionRunModel
            .find({})
            .sort({ startedAt: -1 })
            .limit(limit)
            .select("-processingErrors")  // exclude large error array from list
            .lean();

        return res.json({
            success: true,
            data: runs
        });
    } catch (error) {
        console.error("ingestionRunsHandler error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export {
    runIngestionHandler,
    listSourcesHandler,
    ingestionStatusHandler,
    ingestionRunsHandler
};
