/**
 * Ingestion Service — Milestone 5D
 *
 * Central pipeline orchestrator with:
 *   - Run locking (concurrent-run protection)
 *   - Incremental fetching (source-specific)
 *   - Checkpoint safety (only advance after success)
 *   - Persistent state (survives restarts)
 *   - Granular result tracking (from 5C)
 *   - Per-record error isolation
 *
 * Both manual and scheduled runs call this same service.
 */

import { normalize }              from "./normalizationService.js";
import { validate }               from "./validationService.js";
import { resolve as resolveRestaurant } from "./restaurantResolver.js";
import { checkDuplicate }         from "./deduplicationService.js";
import safetyEvidenceModel        from "../../models/safetyEvidenceModel.js";
import ingestionRunModel          from "../../models/ingestionRunModel.js";
import { acquireLock, releaseLock } from "./ingestionLockService.js";
import { getSinceDate, advanceCheckpoint, computeNewCheckpoint } from "./incrementalService.js";

/**
 * Run the ingestion pipeline for a given source adapter.
 *
 * @param {Object} sourceAdapter — Must have { sourceType, sourceName, fetchRecords() }
 * @param {Object} options
 * @param {string} options.triggerType — "manual" | "scheduled" | "retry"
 * @param {Object|null} options.sourceMeta — source registry entry (for incremental support)
 * @returns {Promise<Object>} Ingestion summary
 */
const runIngestion = async (sourceAdapter, options = {}) => {
    const { sourceType, sourceName } = sourceAdapter;
    const triggerType = options.triggerType || "manual";
    const sourceMeta  = options.sourceMeta  || null;

    // ── Pre-create the run record (needed for lock acquisition) ──────────────
    const run = new ingestionRunModel({
        sourceType,
        sourceName,
        startedAt: new Date(),
        status: "running",
        triggerType,
        fetchedCount:         0,
        insertedCount:        0,
        skippedCount:         0,
        failedCount:          0,
        unresolvedCount:      0,
        validationFailedCount: 0,
        processingErrors:     []
    });
    await run.save();

    // ── Acquire lock ──────────────────────────────────────────────────────────
    const lockResult = await acquireLock(sourceType, run._id.toString());
    if (!lockResult.acquired) {
        // Another run is in progress — skip this one
        run.status      = "already_running";
        run.completedAt = new Date();
        run.processingErrors = [{
            externalRecordId: null,
            stage:   "lock",
            message: lockResult.reason
        }];
        await run.save();
        return {
            success:   false,
            skipped:   true,
            runId:     run._id,
            sourceType,
            sourceName,
            message:   lockResult.reason,
            fetched:   0,
            inserted:  0,
            duplicates: 0,
            unresolved: 0,
            validationFailed: 0,
            failed: 0,
            errors:    run.processingErrors
        };
    }

    // ── Determine incremental sinceDate ───────────────────────────────────────
    let sinceDate = null;
    if (sourceMeta?.supportsIncremental) {
        sinceDate = await getSinceDate(sourceMeta);
    }

    // Record checkpoint before run
    const checkpointBefore = sinceDate;

    // ── Per-run counters ─────────────────────────────────────────────────────
    let fetched          = 0;
    let inserted         = 0;
    let duplicates       = 0;
    let unresolved       = 0;
    let validationFailed = 0;
    let failed           = 0;
    const errors         = [];
    let rawRecords       = [];

    try {
        // ── Step 1: Fetch raw records (pass sinceDate for incremental) ────────
        rawRecords = await sourceAdapter.fetchRecords({ sinceDate });
        fetched = rawRecords.length;

        // ── Step 2: Process each record through the pipeline ──────────────────
        for (const raw of rawRecords) {
            try {
                // 2a. Normalize
                const normalized = normalize(raw);

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
                failed++;
                errors.push({
                    externalRecordId: raw?.externalRecordId || null,
                    stage:   "pipeline",
                    message: recordError.message || "Unknown processing error"
                });
            }
        }

        // ── Determine if run succeeded ─────────────────────────────────────────
        // A run "succeeds" if it completed without fatal/pipeline errors.
        // Unresolved + validationFailed are expected outcomes, not failures.
        const runSucceeded = failed === 0;

        // ── Compute new checkpoint ─────────────────────────────────────────────
        const newCheckpoint = computeNewCheckpoint(rawRecords);

        // ── Advance checkpoint (only if succeeded) ────────────────────────────
        await advanceCheckpoint(sourceType, runSucceeded, run._id, newCheckpoint);

        // ── Finalize audit run ─────────────────────────────────────────────────
        const ranWithErrors = (validationFailed + unresolved + failed) > 0;
        run.completedAt           = new Date();
        run.durationMs            = run.completedAt.getTime() - run.startedAt.getTime();
        run.fetchedCount          = fetched;
        run.insertedCount         = inserted;
        run.skippedCount          = duplicates;
        run.failedCount           = failed;
        run.unresolvedCount       = unresolved;
        run.validationFailedCount = validationFailed;
        run.processingErrors      = errors;
        run.checkpointBefore       = checkpointBefore;
        run.checkpointAfter        = runSucceeded ? newCheckpoint : checkpointBefore;
        run.status = failed > 0 ? "failed" : (ranWithErrors ? "completed_with_errors" : "completed");
        await run.save();

        // ── Structured log ─────────────────────────────────────────────────────
        console.log(`[INGESTION] source=${sourceType} run=${run._id} status=${run.status} `+
            `fetched=${fetched} inserted=${inserted} duplicates=${duplicates} `+
            `unresolved=${unresolved} validationFailed=${validationFailed} `+
            `failed=${failed} durationMs=${run.durationMs}`);

        // ── Release lock ───────────────────────────────────────────────────────
        await releaseLock(sourceType, run._id.toString());

        return {
            success:         true,
            runId:           run._id,
            sourceType,
            sourceName,
            triggerType,
            incremental:      !!sinceDate,
            checkpointBefore,
            checkpointAfter:  run.checkpointAfter,
            fetched,
            inserted,
            duplicates,
            unresolved,
            validationFailed,
            failed,
            skipped: duplicates,  // legacy alias
            errors
        };

    } catch (pipelineError) {
        // Fatal pipeline error — do NOT advance checkpoint
        run.completedAt           = new Date();
        run.durationMs            = run.completedAt.getTime() - run.startedAt.getTime();
        run.fetchedCount          = fetched;
        run.insertedCount         = inserted;
        run.skippedCount          = duplicates;
        run.failedCount           = failed + 1;
        run.unresolvedCount       = unresolved;
        run.validationFailedCount = validationFailed;
        run.processingErrors      = [
            ...errors,
            { externalRecordId: null, stage: "pipeline_fatal", message: pipelineError.message }
        ];
        run.checkpointBefore       = checkpointBefore;
        run.checkpointAfter        = checkpointBefore;  // unchanged — checkpoint safety
        run.status = "failed";
        await run.save();

        // ── Structured log (fatal) ─────────────────────────────────────────────
        console.log(`[INGESTION] source=${sourceType} run=${run._id} status=failed `+
            `stage=pipeline_fatal error="${pipelineError.message}" durationMs=${run.durationMs}`);

        // Record error in state
        await advanceCheckpoint(sourceType, false, run._id, null);

        // Release lock
        await releaseLock(sourceType, run._id.toString());

        return {
            success:         false,
            runId:           run._id,
            sourceType,
            sourceName,
            triggerType,
            incremental:      !!sinceDate,
            checkpointBefore,
            checkpointAfter:  checkpointBefore,  // unchanged
            fetched,
            inserted,
            duplicates,
            unresolved,
            validationFailed,
            failed:          failed + 1,
            skipped: duplicates,
            errors:  run.processingErrors
        };
    }
};

export { runIngestion };
