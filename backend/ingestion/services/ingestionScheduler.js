/**
 * Ingestion Scheduler — Milestone 5D
 *
 * Lightweight setInterval-based scheduler.
 * Disabled by default — must be explicitly enabled via env vars.
 *
 * Configuration (environment variables):
 *   SAFETY_INGESTION_ENABLED=false          — default: disabled
 *   SAFETY_INGESTION_INTERVAL_MINUTES=360   — default: 6 hours
 *
 * Only enabled sources in the source registry are scheduled.
 * Each scheduled run uses the same ingestionService as manual runs.
 *
 * No heavy job queue. No Redis. No BullMQ.
 */

import { runIngestion } from "./ingestionService.js";
import { getEnabledSources } from "../../config/safetySources.js";
import ingestionRunModel from "../../models/ingestionRunModel.js";

let schedulerInterval = null;
let isRunning = false;

// Map source IDs → adapter objects (same as controller)
import { localTestSource } from "../sources/localTestSource.js";
import { chicagoFoodInspectionsSource } from "../sources/chicagoFoodInspectionsSource.js";
import { nycDohmhSource } from "../sources/nycDohmhSource.js";

const ADAPTER_MAP = {
    "local-test":               localTestSource,
    "chicago-food-inspections": chicagoFoodInspectionsSource,
    "nyc-dohmh-inspections":    nycDohmhSource
};

/**
 * Run ingestion for all enabled sources (called by scheduler).
 */
const runScheduledIngestion = async () => {
    if (isRunning) {
        console.log("[scheduler] Previous scheduled run still in progress — skipping");
        return;
    }

    isRunning = true;
    const sources = getEnabledSources();

    for (const sourceMeta of sources) {
        const adapter = ADAPTER_MAP[sourceMeta.id];
        if (!adapter) {
            console.log(`[scheduler] No adapter for source "${sourceMeta.id}" — skipping`);
            continue;
        }

        console.log(`[scheduler] Starting scheduled ingestion: ${sourceMeta.id}`);
        try {
            const result = await runIngestion(adapter, {
                triggerType: "scheduled",
                sourceMeta
            });

            if (result.skipped) {
                console.log(`[scheduler] ${sourceMeta.id}: skipped (${result.message})`);
            } else {
                console.log(`[scheduler] ${sourceMeta.id}: fetched=${result.fetched} `+
                    `inserted=${result.inserted} duplicates=${result.duplicates} `+
                    `unresolved=${result.unresolved} failed=${result.failed}`);
            }
        } catch (error) {
            console.error(`[scheduler] ${sourceMeta.id} error:`, error.message);
        }
    }

    isRunning = false;
};

/**
 * Start the scheduler.
 * Only starts if SAFETY_INGESTION_ENABLED is explicitly "true".
 */
const startScheduler = () => {
    const enabled  = process.env.SAFETY_INGESTION_ENABLED === "true";
    const interval = parseInt(
        process.env.SAFETY_INGESTION_INTERVAL_MINUTES || "360", 10
    );

    if (!enabled) {
        console.log("[scheduler] Safety ingestion scheduler is DISABLED (SAFETY_INGESTION_ENABLED != true)");
        return;
    }

    const intervalMs = interval * 60 * 1000;
    console.log(`[scheduler] Safety ingestion scheduler ENABLED — interval: ${interval} minutes`);

    // Run once immediately on first start, then on interval
    // (No — per spec, do NOT run on startup. Only on interval.)
    // Wait for the first interval tick.

    schedulerInterval = setInterval(() => {
        runScheduledIngestion().catch(err => {
            console.error("[scheduler] Fatal error during scheduled run:", err.message);
        });
    }, intervalMs);

    // Prevent the interval from keeping the process alive on shutdown
    if (schedulerInterval.unref) {
        schedulerInterval.unref();
    }
};

/**
 * Stop the scheduler (clean shutdown).
 */
const stopScheduler = () => {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log("[scheduler] Safety ingestion scheduler stopped");
    }
};

/**
 * Get current scheduler status (for admin API).
 */
const getSchedulerStatus = () => {
    return {
        enabled:  process.env.SAFETY_INGESTION_ENABLED === "true",
        interval:  parseInt(process.env.SAFETY_INGESTION_INTERVAL_MINUTES || "360", 10),
        running:   isRunning
    };
};

export { startScheduler, stopScheduler, getSchedulerStatus, runScheduledIngestion };
