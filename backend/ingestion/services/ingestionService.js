/**
 * Ingestion Service
 *
 * Central pipeline orchestrator. Runs the full ingestion pipeline:
 *
 *   Fetch → Normalize → Resolve Restaurant → Validate →
 *   Dedup Check → Insert if New → Record Result
 *
 * Source-specific logic lives inside the source adapter, NOT here.
 * This service is source-agnostic.
 *
 * One bad record never stops the pipeline — each record is processed
 * independently in its own try/catch.
 */

import { normalize } from "./normalizationService.js";
import { validate } from "./validationService.js";
import { resolve as resolveRestaurant } from "./restaurantResolver.js";
import { checkDuplicate } from "./deduplicationService.js";
import safetyEvidenceModel from "../../models/safetyEvidenceModel.js";
import ingestionRunModel from "../../models/ingestionRunModel.js";

/**
 * Run the ingestion pipeline for a given source adapter.
 *
 * @param {Object} sourceAdapter — Must have { sourceType, sourceName, fetchRecords() }
 * @returns {Promise<Object>} Ingestion summary
 */
const runIngestion = async (sourceAdapter) => {
    const { sourceType, sourceName } = sourceAdapter;

    // ── Create audit run record ────────────────────────────────────────────
    const run = new ingestionRunModel({
        sourceType,
        sourceName,
        startedAt: new Date(),
        status: "running",
        fetchedCount: 0,
        insertedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        processingErrors: []
    });
    await run.save();

    let fetched = 0;
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    try {
        // ── Step 1: Fetch raw records from source adapter ─────────────────
        const rawRecords = await sourceAdapter.fetchRecords();
        fetched = rawRecords.length;

        // ── Step 2: Process each record through the pipeline ──────────────
        for (const raw of rawRecords) {
            try {
                // 2a. Normalize
                const normalized = normalize(raw);

                // Ensure sourceType/sourceName from adapter if not in raw record
                if (!normalized.sourceType) normalized.sourceType = sourceType;
                if (!normalized.sourceName) normalized.sourceName = sourceName;

                // 2b. Validate
                const validationResult = validate(normalized);
                if (!validationResult.valid) {
                    failed++;
                    errors.push({
                        externalRecordId: normalized.externalRecordId || null,
                        stage: "validation",
                        message: validationResult.errors.join("; ")
                    });
                    continue;
                }

                const validated = validationResult.data;

                // 2c. Resolve restaurant
                const resolution = await resolveRestaurant(validated);
                if (!resolution.resolved) {
                    failed++;
                    errors.push({
                        externalRecordId: validated.externalRecordId || null,
                        stage: "restaurant_resolution",
                        message: resolution.reason
                    });
                    continue;
                }

                validated.restaurantId = resolution.restaurant._id;
                validated.resolvedRestaurant = resolution.restaurant.name;

                // 2d. Deduplication check
                const dupResult = await checkDuplicate(validated);
                if (dupResult.isDuplicate) {
                    skipped++;
                    continue;
                }

                // 2e. Insert new evidence
                const newEvidence = new safetyEvidenceModel({
                    restaurantId:     validated.restaurantId,
                    type:             validated.type,
                    title:            validated.title,
                    description:      validated.description,
                    sourceName:       validated.sourceName,
                    sourceUrl:        validated.sourceUrl,
                    sourceType:        validated.sourceType,
                    externalRecordId: validated.externalRecordId,
                    evidenceDate:     validated.evidenceDate,
                    publishedAt:      validated.publishedAt,
                    retrievedAt:      new Date(),
                    status:           validated.status,
                    severity:         validated.severity,
                    contentHash:      dupResult.contentHash || null
                });

                await newEvidence.save();
                inserted++;

            } catch (recordError) {
                failed++;
                errors.push({
                    externalRecordId: raw.externalRecordId || null,
                    stage: "pipeline",
                    message: recordError.message || "Unknown processing error"
                });
            }
        }

        // ── Finalize audit run ───────────────────────────────────────────
        run.completedAt = new Date();
        run.fetchedCount = fetched;
        run.insertedCount = inserted;
        run.skippedCount = skipped;
        run.failedCount = failed;
        run.processingErrors = errors;
        run.status = failed > 0 ? "completed_with_errors" : "completed";
        await run.save();

        return {
            success: true,
            runId: run._id,
            sourceType,
            sourceName,
            fetched,
            inserted,
            skipped,
            failed,
            errors
        };

    } catch (pipelineError) {
        // Fatal pipeline error (e.g., source adapter fetch crashed)
        run.completedAt = new Date();
        run.fetchedCount = fetched;
        run.insertedCount = inserted;
        run.skippedCount = skipped;
        run.failedCount = failed;
        run.processingErrors = [...errors, {
            externalRecordId: null,
            stage: "pipeline_fatal",
            message: pipelineError.message
        }];
        run.status = "failed";
        await run.save();

        return {
            success: false,
            runId: run._id,
            sourceType,
            sourceName,
            fetched,
            inserted,
            skipped,
            failed,
            errors: run.errors
        };
    }
};

export { runIngestion };
