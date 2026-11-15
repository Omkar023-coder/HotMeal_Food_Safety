# HotMeal — Ingestion Module (Milestones 5A + 5B)

---

## Milestones

| Milestone | Status | Purpose |
|---|---|---|
| 5A | ✅ | Ingestion foundation, pipeline, local test source |
| 5B | ✅ | Real authoritative sources (Chicago CDPH, NYC DOHMH) |

---

## Core Principle

> **Evidence must come from a source. AI may later analyze evidence, but AI must never become the source of evidence.**

---

## Architecture

```
Authoritative Source
        ↓
Source Adapter (fetches raw records)
        ↓
Normalization Service (clean, map fields)
        ↓
Validation Service (required fields, enum checks)
        ↓
Restaurant Identity Resolver (conservative match)
        ↓
Deduplication Service (SHA-256 or external ID)
        ↓
safetyEvidenceModel (MongoDB)
        ↓
Ingestion Run Audit (MongoDB)
```

---

## Folder Structure

```
backend/
├── config/
│   └── safetySources.js       ← Source registry (metadata for all sources)
│
└── ingestion/
    ├── sources/
    │   ├── localTestSource.js            ← TEST ONLY
    │   ├── chicagoFoodInspectionsSource.js ← Chicago CDPH (real, live)
    │   └── nycDohmhSource.js              ← NYC DOHMH (real, live)
    │
    ├── services/
    │   ├── ingestionService.js    ← Central pipeline
    │   ├── normalizationService.js
    │   ├── validationService.js
    │   ├── deduplicationService.js
    │   └── restaurantResolver.js
    │
    ├── utils/
    │   └── contentHash.js
    │
    └── README.md
```

---

## Authoritative Sources (5B)

### Chicago Food Inspections

| Field | Value |
|---|---|
| Authority | Chicago Department of Public Health (CDPH) |
| Country | US |
| Region | Chicago, Illinois |
| Official URL | https://data.cityofchicago.org/Health-Human-Services/Food-Inspections/4ijn-s7e5 |
| API Endpoint | https://data.cityofchicago.org/resource/4ijn-s7e5.json |
| Auth Required | No (Socrata Open Data) |
| Rate Limit | 1000 req/hr (unauthenticated); higher with Socrata app token |
| Update Frequency | Daily |
| Data Format | JSON (Socrata SODA API) |
| Coverage | January 2010 — present |

**Field mapping:**

| Chicago Field | HotMeal Field |
|---|---|
| `inspection_id` | `externalRecordId` |
| `aka_name` / `dba_name` | `restaurantName` |
| `address` | `address` |
| `city` | `city` |
| `state` | `state` |
| `zip` | `pincode` |
| `inspection_date` | `evidenceDate` |
| `results` | `status` (mapped) |
| `risk` | `severity` (mapped) |
| `violations` | `description` |

**Status mapping:** Pass → positive, Pass w/ conditions → warning, Fail → negative

**Severity mapping:** Risk 1 (High) → high, Risk 2 (Medium) → medium, Risk 3 (Low) → low

---

### NYC DOHMH Restaurant Inspection Results

| Field | Value |
|---|---|
| Authority | NYC Department of Health and Mental Hygiene (DOHMH) |
| Country | US |
| Region | New York City, New York |
| Official URL | https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j |
| API Endpoint | https://data.cityofnewyork.us/resource/43nn-pn8j.json |
| Auth Required | No (Socrata Open Data) |
| Update Frequency | Daily |
| Data Format | JSON (Socrata SODA API) |

**Field mapping:**

| NYC Field | HotMeal Field |
|---|---|
| `camis` + `inspection_date` | `externalRecordId` |
| `dba` | `restaurantName` |
| `building` + `street` | `address` |
| `boro` | `city` |
| `zipcode` | `pincode` |
| `inspection_date` | `evidenceDate` |
| `grade` | `status` (mapped) |
| `critical_flag` | `severity` (mapped) |
| `violation_description` | `description` |

**Status mapping:** Grade A → positive, B → warning, C → negative

**Severity mapping:** Critical → high, Not Critical → low

---

### FSSAI (India) — Disabled

FSSAI operates FoSCoS (Food Compliance System) for Indian food business operators.
No official bulk-download or public REST API is available.
A third-party paid API exists (RapidAPI) but is not an official government source.
**This source is disabled until an official API or verified data export is available.**

---

## Source Registry

Sources are configured in `backend/config/safetySources.js`.

Each entry contains metadata only — no credentials or secrets.

API tokens (optional) are stored in environment variables:

```bash
CHICAGO_SOCRATA_APP_TOKEN=   # optional, increases rate limit
NYC_SOCRATA_APP_TOKEN=       # optional, increases rate limit
CHICAGO_FETCH_LIMIT=50       # optional, default 50
NYC_FETCH_LIMIT=50           # optional, default 50
```

---

## Admin API

### Trigger ingestion

```
POST /api/ingestion/run
Authorization: token <admin-jwt>
Content-Type: application/json

{
    "source": "chicago-food-inspections"
}
```

Supported source IDs:
- `local-test` (default)
- `chicago-food-inspections`
- `nyc-dohmh-inspections`

### List available sources

```
GET /api/ingestion/sources
Authorization: token <admin-jwt>
```

---

## Restaurant Identity Matching

**Current strategy (conservative):**

1. Match by `restaurantName` (case-insensitive) + `city` (case-insensitive)
2. Exactly 1 match → accepted
3. 0 matches → skipped (not inserted)
4. >1 matches → skipped (ambiguous)

**Current behavior with Chicago/NYC sources:**

HotMeal's current restaurant database contains Indian restaurants (Latur, Pune).
Chicago and NYC records will correctly produce **0 insertions** — all records fail
restaurant resolution because no Chicago/NYC restaurants exist in HotMeal's DB.

This is **correct behavior** — no fake evidence is created.

When HotMeal adds Chicago or NYC restaurants to its database, those records will
begin matching and ingesting correctly.

---

## Deduplication & Idempotency

- External record ID (`externalRecordId + sourceType + sourceName`) when available
- SHA-256 content hash of stable fields as fallback
- Running the same source twice is safe — duplicates are skipped

---

## How to Add a New Source

1. Add source metadata to `backend/config/safetySources.js`
2. Create `backend/ingestion/sources/<id>Source.js`
3. Implement `fetchRecords()` returning raw records in common format
4. Import and register the adapter in `backend/controllers/ingestionController.js`
5. The pipeline (normalize → validate → resolve → dedup → insert → audit) runs automatically

---

## What This Module Does NOT Do

- ❌ No automatic startup ingestion
- ❌ No cron jobs / scheduled tasks
- ❌ No web scraping (uses official APIs only)
- ❌ No authentication bypass or CAPTCHA solving
- ❌ No AI-generated evidence
- ❌ No PostgreSQL / pgvector / embeddings / RAG / LLM

Those belong to later milestones (6, 7, 8).
