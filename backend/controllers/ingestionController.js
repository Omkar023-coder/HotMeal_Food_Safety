/**
 * Ingestion Controller — Milestone 5E
 *
 * Admin-only endpoints for ingestion management and observability.
 *
 * POST /api/ingestion/run        — trigger ingestion (manual)
 * GET  /api/ingestion/sources    — list configured sources
 * GET  /api/ingestion/status     — full operational snapshot (5E enriched)
 * GET  /api/ingestion/runs       — recent run history (up to 100)
 * GET  /api/ingestion/runs/:id   — single run detail with processingErrors
 * GET  /api/ingestion/health     — lightweight health/readiness check
 */

import { runIngestion } from "../ingestion/services/ingestionService.js";
import { localTestSource } from "../ingestion/sources/localTestSource.js";
import { chicagoFoodInspectionsSource } from "../ingestion/sources/chicagoFoodInspectionsSource.js";
import { nycDohmhSource } from "../ingestion/sources/nycDohmhSource.js";
import { getSourceById, getEnabledSources, safetySources } from "../config/safetySources.js";
import { getSchedulerStatus } from "../ingestion/services/ingestionScheduler.js";
import { getLockStatus } from "../ingestion/services/ingestionLockService.js";
import { getCheckpoint } from "../ingestion/services/incrementalService.js";
import ingestionRunModel from "../models/ingestionRunModel.js";
import ingestionStateModel from "../models/ingestionStateModel.js";
import mongoose from "mongoose";

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
 * GET /api/ingestion/status — full operational snapshot
 * 5E: enriched with source health (last run, last success, last error, counters)
 */
const ingestionStatusHandler = async (req, res) => {
    try {
        const scheduler = getSchedulerStatus();
        const sources = getEnabledSources();

        const sourceStates = [];
        for (const source of sources) {
            const stateKey   = source.id;
            const lockStatus = await getLockStatus(stateKey);
            const checkpoint  = await getCheckpoint(stateKey);

            // Fetch persistent state for last-run health info
            const state = await ingestionStateModel.findOne({ sourceType: stateKey }).lean();

            // Fetch the most recent run for this source (any status)
            const lastRun = await ingestionRunModel.findOne({ sourceType: stateKey })
                .sort({ startedAt: -1 })
                .select("_id status startedAt completedAt durationMs fetchedCount insertedCount skippedCount failedCount unresolvedCount validationFailedCount")
                .lean();

            // Fetch the most recent successful run
            const lastSuccessfulRun = await ingestionRunModel.findOne({
                sourceType: stateKey,
                status: { $in: ["completed", "completed_with_errors"] }
            })
                .sort({ startedAt: -1 })
                .select("_id status startedAt completedAt durationMs insertedCount fetchedCount")
                .lean();

            // Fetch the most recent failed run
            const lastFailedRun = await ingestionRunModel.findOne({
                sourceType: stateKey,
                status: "failed"
            })
                .sort({ startedAt: -1 })
                .select("_id status startedAt completedAt")
                .lean();

            sourceStates.push({
                sourceId:              source.id,
                sourceName:            source.name,
                enabled:               source.enabled,
                supportsIncremental:   source.supportsIncremental || false,
                // Checkpoint
                lastCheckpoint:        checkpoint,
                // Lock
                locked:                lockStatus.locked,
                lockRunId:             lockStatus.lockRunId || null,
                lockAcquiredAt:        lockStatus.lockAcquiredAt || null,
                lockExpiresAt:         lockStatus.lockExpiresAt || null,
                isStaleLock:           lockStatus.isStale || false,
                // Source health (from persistent state)
                lastAttemptAt:         state?.lastAttemptAt || null,
                lastSuccessAt:         state?.lastSuccessAt || null,
                lastError:             state?.lastError || null,
                // Run history summary
                lastRun:               lastRun || null,
                lastSuccessfulRun:     lastSuccessfulRun || null,
                lastFailedRun:         lastFailedRun || null
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
 * Query: ?limit=20  (default 20, max 100)
 */
const ingestionRunsHandler = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query?.limit || "20", 10), 100);

        const runs = await ingestionRunModel
            .find({})
            .sort({ startedAt: -1 })
            .limit(limit)
            .select("-processingErrors")  // exclude large error array from list view
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

/**
 * GET /api/ingestion/runs/:id — single run detail including processingErrors
 */
const ingestionRunDetailHandler = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid run ID." });
        }

        const run = await ingestionRunModel.findById(id).lean();

        if (!run) {
            return res.status(404).json({ success: false, message: "Ingestion run not found." });
        }

        return res.json({ success: true, data: run });
    } catch (error) {
        console.error("ingestionRunDetailHandler error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/ingestion/health — lightweight ingestion health check
 *
 * Does NOT call external APIs.
 * Does NOT perform expensive queries.
 * Returns fast operational status.
 */
const ingestionHealthHandler = async (req, res) => {
    try {
        const scheduler = getSchedulerStatus();

        // Count total runs and running runs (cheap indexed query)
        const [totalRuns, runningRuns] = await Promise.all([
            ingestionRunModel.countDocuments(),
            ingestionRunModel.countDocuments({ status: "running" })
        ]);

        // Check for any currently locked sources
        const lockedSources = await ingestionStateModel
            .find({ lockStatus: "locked" })
            .select("sourceType lockAcquiredAt lockExpiresAt")
            .lean();

        // Check for stale locks
        const now = new Date();
        const staleLocks = lockedSources.filter(s => s.lockExpiresAt && s.lockExpiresAt < now);

        // Source configuration validity (all enabled sources have registered adapters)
        const enabledSources = getEnabledSources();
        const registeredAdapterIds = Object.keys(ADAPTER_MAP);
        const misconfiguredSources = enabledSources
            .filter(s => !registeredAdapterIds.includes(s.id))
            .map(s => s.id);

        const healthy = staleLocks.length === 0 && misconfiguredSources.length === 0;

        return res.json({
            success: true,
            data: {
                healthy,
                schedulerEnabled:      scheduler.enabled,
                schedulerRunning:      scheduler.running,
                totalRunsRecorded:     totalRuns,
                currentlyRunning:      runningRuns,
                lockedSources:         lockedSources.length,
                staleLocks:            staleLocks.length,
                misconfiguredSources,
                enabledSourceCount:    enabledSources.length,
                timestamp:             now.toISOString()
            }
        });
    } catch (error) {
        console.error("ingestionHealthHandler error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export {
    runIngestionHandler,
    listSourcesHandler,
    ingestionStatusHandler,
    ingestionRunsHandler,
    ingestionRunDetailHandler,
    ingestionHealthHandler
};
