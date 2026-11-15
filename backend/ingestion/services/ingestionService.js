/**
 * Ingestion Service — Milestone 5C
 *
 * Central pipeline orchestrator.
 *
 * Pipeline per record:
 *   Fetch → Normalize → Validate → Resolve Restaurant →
 *   Dedup Check → Insert → Record Result
 *
 * Source-specific logic lives inside source adapters, NOT here.
 * This service is source-agnostic.
 *
 * Result tracking (5C granularity):
 *   fetched           — total records returned by source adapter
 *   inserted          — new evidence records written to MongoDB
 *   duplicates        — records already in DB (skipped, idempotent)
 *   unresolved        — records that could not be matched to a HotMeal restaurant
 *   validationFailed  — records that failed content validation
 *   failed            — unexpected per-record processing errors
 *
 * One bad record never stops the pipeline — per-record try/catch throughout.
 */

import { normalize }              from "./normalizationService.js";
import { validate }               from "./validationService.js";
import { resolve as resolveRestaurant } from "./restaurantResolver.js";
import { checkDuplicate }         from "./deduplicationService.js";
import safetyEvidenceModel        from "../../models/safetyEvidenceModel.js";
import ingestionRunModel          from "../../models/ingestionRunModel.js";

/**
 * Run the ingestion pipeline for a given source adapter.
 *
 * @param {Object} sourceAdapter — Must have { sourceType, sourceName, fetchRecords() }
 * @returns {Promise<Object>} Ingestion summary
 */
const runIngestion = async (sourceAdapter) => {
    const { sourceType, sourceName } = sourceAdapter;

    // ── Create audit run record ───────────────────────────────────────────────
    const run = new ingestionRunModel({
        sourceType,
        sourceName,
        startedAt: new Date(),
        status: "running",
        fetchedCount:         0,
        insertedCount:        0,
        skippedCount:         0,
        failedCount:          0,
        unresolvedCount:      0,
        validationFailedCount: 0,
        processingErrors:     []
    });
    await run.save();

    // ── Per-run counters ─────────────────────────────────────────────────────
    let fetched          = 0;
    let inserted         = 0;
    let duplicates       = 0;   // "skipped" in model/API — renamed internally for clarity
    let unresolved       = 0;
    let validationFailed = 0;
    let failed           = 0;   // unexpected errors only
    const errors         = [];

    try {
        // ── Step 1: Fetch raw records from source adapter ─────────────────────
        const rawRecords = await sourceAdapter.fetchRecords();
        fetched = rawRecords.length;

        // ── Step 2: Process each record through the pipeline ──────────────────
        for (const raw of rawRecords) {
            try {
                // 2a. Normalize
                const normalized = normalize(raw);

                // Ensure sourceType/sourceName from adapter if adapter omitted them
                if (!normalized.sourceType) normalized.sourceType = sourceType;
                if (!normalized.sourceName) normalized.sourceName = sourceName;

                // 2b. Validate
                const validationResult = validate(normalized);
                if (!validationResult.valid) {
                    validationFailed++;
                    errors.push({
                        externalRecordId: normalized.externalRecordId || null,
                        stage:   "validation",
                        message: validationResult.errors.join("; ")
                    });
                    continue;
                }

                const validated = validationResult.data;

                // 2c. Resolve restaurant (conservative — safe > clever)
                const resolution = await resolveRestaurant(validated);
                if (!resolution.resolved) {
                    unresolved++;
                    errors.push({
                        externalRecordId: validated.externalRecordId || null,
                        stage:   "restaurant_resolution",
                        message: resolution.reason
                    });
                    continue;
                }

                validated.restaurantId        = resolution.restaurant._id;
                validated.resolvedRestaurant  = resolution.restaurant.name;

                // 2d. Deduplication check
                const dupResult = await checkDuplicate(validated);
                if (dupResult.isDuplicate) {
                    duplicates++;
                    continue;
                }

                // 2e. Insert new evidence record with full provenance
                const newEvidence = new safetyEvidenceModel({
                    restaurantId:     validated.restaurantId,
                    type:             validated.type,
                    title:            validated.title,
                    description:      validated.description,
                    sourceName:       validated.sourceName,
                    sourceUrl:        validated.sourceUrl,
                    sourceType:       validated.sourceType,
                    externalRecordId: validated.externalRecordId,
                    evidenceDate:     validated.evidenceDate  || null,
                    publishedAt:      validated.publishedAt   || null,
                    retrievedAt:      new Date(),
                    status:           validated.status,
                    severity:         validated.severity,
                    contentHash:      dupResult.contentHash   || null
                });

                await newEvidence.save();
                inserted++;

            } catch (recordError) {
                // Unexpected per-record error — isolate and continue
                failed++;
                errors.push({
                    externalRecordId: raw?.externalRecordId || null,
                    stage:   "pipeline",
                    message: recordError.message || "Unknown processing error"
                });
            }
        }

        // ── Finalize audit run ─────────────────────────────────────────────────
        const ranWithErrors = (validationFailed + unresolved + failed) > 0;
        run.completedAt           = new Date();
        run.fetchedCount          = fetched;
        run.insertedCount         = inserted;
        run.skippedCount          = duplicates;
        run.failedCount           = failed;
        run.unresolvedCount       = unresolved;
        run.validationFailedCount = validationFailed;
        run.processingErrors      = errors;
        run.status = ranWithErrors ? "completed_with_errors" : "completed";
        await run.save();

        return {
            success:         true,
            runId:           run._id,
            sourceType,
            sourceName,
            fetched,
            inserted,
            duplicates,
            unresolved,
            validationFailed,
            failed,
            // legacy alias kept for backward compatibility
            skipped: duplicates,
            errors
        };

    } catch (pipelineError) {
        // Fatal pipeline error (e.g., source adapter fetch threw)
        run.completedAt           = new Date();
        run.fetchedCount          = fetched;
        run.insertedCount         = inserted;
        run.skippedCount          = duplicates;
        run.failedCount           = failed;
        run.unresolvedCount       = unresolved;
        run.validationFailedCount = validationFailed;
        run.processingErrors      = [
            ...errors,
            { externalRecordId: null, stage: "pipeline_fatal", message: pipelineError.message }
        ];
        run.status = "failed";
        await run.save();

        return {
            success:         false,
            runId:           run._id,
            sourceType,
            sourceName,
            fetched,
            inserted,
            duplicates,
            unresolved,
            validationFailed,
            failed,
            skipped: duplicates,
            errors:  run.processingErrors
        };
    }
};

export { runIngestion };
