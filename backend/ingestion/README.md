# HotMeal — Ingestion Module (Milestones 5A → 5B → 5C → 5D)

---

## Milestones

| Milestone | Status | Purpose |
|---|---|---|
| 5A | ✅ | Pipeline foundation, local test source |
| 5B | ✅ | Real authoritative sources (Chicago CDPH, NYC DOHMH) |
| 5C | ✅ | Production pipeline with granular result tracking, rawData |
| 5D | ✅ | Incremental ingestion, scheduling, run locking, checkpoint safety |
| 5E | ✅ | Ingestion observability: duration, source health, health endpoint, run detail |

---

## Core Principle

> **Evidence must come from a source. AI may later analyze evidence, but AI must never become the source of evidence.**

---

## 5D Features

### Incremental Ingestion

Each source declares its incremental capability in the source registry:

| Source | Supports Incremental | Strategy |
|---|---|---|
| local-test | ❌ No | none |
| chicago-food-inspections | ✅ Yes | timestamp (`inspection_date`) |
| nyc-dohmh-inspections | ✅ Yes | timestamp (`inspection_date`) |
| fssai-india | ❌ No | disabled |

For sources that support incremental: the adapter accepts a `sinceDate` parameter and filters API results by date.

For sources that don't: full fetch + deduplication (5C behavior) remains active.

### Persistent Ingestion State

Per-source state stored in MongoDB (`ingestionState` collection):

- `lastCheckpoint` — timestamp of last successful incremental fetch
- `lastRunId` — ObjectId of last ingestion run
- `lastSuccessAt` — when last successful run completed
- `lastAttemptAt` — when last run was attempted
- `lastError` — last error message

State survives server restarts. Not stored in memory.

### Checkpoint Safety

**Mandatory rule:**

| Outcome | Checkpoint |
|---|---|
| Successful run | Advances to max evidence date |
| Partial failure (unresolved/validation) | Advances (these are expected, not errors) |
| Pipeline failure | Does NOT advance |
| Source API failure | Does NOT advance |
| Database error | Does NOT advance |

This prevents silent data loss. Retries can safely reprocess the same records.

### Scheduling

Lightweight `setInterval`-based scheduler. No Redis, no BullMQ.

**Configuration (environment variables):**

```bash
SAFETY_INGESTION_ENABLED=false              # default: disabled
SAFETY_INGESTION_INTERVAL_MINUTES=360        # default: 6 hours
```

**Defaults are SAFE:** scheduler is disabled unless explicitly enabled.

Starting the server does NOT trigger ingestion. The scheduler only runs at the configured interval after enable.

### Run Locking

Prevents two concurrent ingestion runs for the same source.

**MongoDB-based lock** (not in-memory):
- `lockStatus`: `unlocked` | `locked`
- `lockAcquiredAt`, `lockRunId`, `lockExpiresAt`
- Lock lease: 10 minutes (configurable via `INGESTION_LOCK_LEASE_MS`)

If a second run is attempted while the first is in progress:
- Returns HTTP 409 with `skipped: true`
- Records `already_running` status in audit

### Stale Lock Recovery

If a process crashes while holding a lock:
- Lock has an expiration time (`lockExpiresAt`)
- Next run attempt checks for stale locks
- Stale locks are automatically recovered
- No permanent deadlocks

### Retry Behavior

- Source API temporarily unavailable → run fails → checkpoint unchanged → next run retries
- MongoDB temporary failure → run fails → checkpoint unchanged → next run retries
- One bad source record → record failure isolated → other records continue
- Deduplication makes retries idempotent — no duplicate evidence created

---

## Pipeline Flow

```
Source Adapter
  fetchRecords({ sinceDate }) → RawRecord[]
        ↓
Normalization Service
        ↓
Validation Service
        ↓
Restaurant Identity Resolver
        ↓
Deduplication Service
        ↓
Safety Evidence insert (provenance populated) → MongoDB
        ↓
Ingestion Run Audit → MongoDB
        ↓
Ingestion State (checkpoint updated on success) → MongoDB
        ↓
Lock released
```

---

## API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/ingestion/run` | Admin | Trigger manual ingestion |
| GET | `/api/ingestion/sources` | Admin | List enabled sources with capabilities |
| GET | `/api/ingestion/status` | Admin | Full operational snapshot: scheduler, source health, locks, checkpoints |
| GET | `/api/ingestion/health` | Admin | Lightweight health/readiness check (fast, no external calls) |
| GET | `/api/ingestion/runs` | Admin | Recent run history (default 20, max 100; `?limit=N`) |
| GET | `/api/ingestion/runs/:id` | Admin | Single run detail including processingErrors |

---

## Run Status Semantics

| Status | Meaning |
|---|---|
| `running` | Run started, not yet finished |
| `completed` | All records processed, no failures |
| `completed_with_errors` | Completed but some records were unresolved or validation failed |
| `failed` | Critical failure — source fetch or pipeline crash |
| `already_running` | Skipped because a concurrent run was in progress |

## Run Duration (5E)

Every completed run records `durationMs` (milliseconds):

```text
durationMs = completedAt - startedAt
```

Calculated by the backend in UTC. Never uses client-provided values.

## Source Health (5E)

The `/api/ingestion/status` endpoint exposes per-source operational health:

- `lastRun` — most recent run summary (any status)
- `lastSuccessfulRun` — most recent completed/completed_with_errors run
- `lastFailedRun` — most recent failed run
- `lastAttemptAt`, `lastSuccessAt`, `lastError` — from persistent state

## Ingestion Health Endpoint (5E)

`GET /api/ingestion/health` — fast, no external API calls:

- DB connectivity (implicit — if this responds, DB is reachable)
- Scheduler enabled/running status
- Stale lock detection
- Misconfigured source detection

---

## Ingestion Run Audit

Each run (manual or scheduled) creates an `ingestionRun` document:

- `sourceType`, `sourceName`, `startedAt`, `completedAt`, `durationMs`
- `status`: `running` | `completed` | `completed_with_errors` | `failed` | `skipped` | `already_running`
- `triggerType`: `manual` | `scheduled` | `retry`
- `checkpointBefore`, `checkpointAfter`
- `fetchedCount`, `insertedCount`, `skippedCount`, `failedCount`
- `unresolvedCount`, `validationFailedCount`
- `processingErrors[]`

---

## Environment Variables

```bash
# Scheduler
SAFETY_INGESTION_ENABLED=false
SAFETY_INGESTION_INTERVAL_MINUTES=360

# Lock lease (optional)
INGESTION_LOCK_LEASE_MS=600000

# Source-specific (optional)
CHICAGO_SOCRATA_APP_TOKEN=
NYC_SOCRATA_APP_TOKEN=
CHICAGO_FETCH_LIMIT=50
NYC_FETCH_LIMIT=50
```

---

## Out of Scope

- ❌ No Redis / Kafka / RabbitMQ
- ❌ No PostgreSQL / pgvector / embeddings / RAG / LLM
- ❌ No cron jobs (uses setInterval)
- ❌ No Docker / AWS deployment

Those belong to future milestones (6, 7, 8).
