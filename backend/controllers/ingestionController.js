/**
 * Ingestion Controller
 *
 * Handles POST /api/ingestion/run
 *
 * Protected by authMiddleware + adminAuth.
 * Only authenticated admin users can manually trigger ingestion.
 * Does NOT auto-run on server startup.
 *
 * Request body:
 *   { "source": "source-id" }  — optional; defaults to "local-test"
 *
 * Supported source IDs:
 *   "local-test"               — 5A test pipeline (no internet)
 *   "chicago-food-inspections" — Chicago CDPH real inspections (live API)
 *   "nyc-dohmh-inspections"    — NYC DOHMH real inspections (live API)
 */

import { runIngestion } from "../ingestion/services/ingestionService.js";
import { localTestSource } from "../ingestion/sources/localTestSource.js";
import { chicagoFoodInspectionsSource } from "../ingestion/sources/chicagoFoodInspectionsSource.js";
import { nycDohmhSource } from "../ingestion/sources/nycDohmhSource.js";
import { getSourceById, getEnabledSources } from "../config/safetySources.js";

// Map source IDs → adapter objects
const ADAPTER_MAP = {
    "local-test":               localTestSource,
    "chicago-food-inspections": chicagoFoodInspectionsSource,
    "nyc-dohmh-inspections":    nycDohmhSource
};

/**
 * POST /api/ingestion/run
 *
 * Body: { "source": "source-id" }  (optional, defaults to "local-test")
 *
 * Returns a structured ingestion summary.
 */
const runIngestionHandler = async (req, res) => {
    try {
        const sourceId = req.body?.source || "local-test";

        // Validate source exists in registry
        const sourceMeta = getSourceById(sourceId);
        if (!sourceMeta) {
            return res.status(400).json({
                success: false,
                message: `Unknown source: "${sourceId}". Available sources: ${Object.keys(ADAPTER_MAP).join(", ")}`
            });
        }

        // Check source is enabled
        if (!sourceMeta.enabled) {
            return res.status(400).json({
                success: false,
                message: `Source "${sourceId}" is disabled. Reason: ${sourceMeta.notes || "Not available."}`
            });
        }

        // Get the adapter
        const adapter = ADAPTER_MAP[sourceId];
        if (!adapter) {
            return res.status(500).json({
                success: false,
                message: `Source "${sourceId}" is configured but no adapter is registered.`
            });
        }

        // Run the ingestion pipeline
        const result = await runIngestion(adapter);

        const statusCode = result.success ? 200 : 500;

        return res.status(statusCode).json({
            success: result.success,
            message: result.success
                ? `Ingestion completed. ${result.inserted} inserted, ${result.skipped} skipped, ${result.failed} failed.`
                : `Ingestion failed: ${result.errors?.[result.errors.length - 1]?.message || "Unknown error"}`,
            data: {
                runId:      result.runId,
                sourceId,
                sourceType: result.sourceType,
                sourceName: result.sourceName,
                fetched:    result.fetched,
                inserted:   result.inserted,
                skipped:    result.skipped,
                failed:     result.failed,
                errors:     result.errors
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
 * GET /api/ingestion/sources
 *
 * Returns the list of all configured sources and their status.
 * Protected by authMiddleware + adminAuth.
 */
const listSourcesHandler = async (req, res) => {
    try {
        const sources = getEnabledSources().map(s => ({
            id:          s.id,
            name:        s.name,
            authority:   s.authority,
            country:     s.country,
            region:      s.region || null,
            sourceType:  s.sourceType,
            officialUrl: s.officialUrl || null,
            accessType:  s.accessType,
            enabled:     s.enabled,
            description: s.description,
            notes:       s.notes || null
        }));

        return res.json({
            success: true,
            data: sources
        });
    } catch (error) {
        console.error("listSourcesHandler error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error fetching sources."
        });
    }
};

export { runIngestionHandler, listSourcesHandler };
