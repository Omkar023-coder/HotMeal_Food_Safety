# HotMeal — Ingestion Module (Milestones 5A + 5B + 5C)

---

## Milestones

| Milestone | Status | Purpose |
|---|---|---|
| 5A | ✅ | Pipeline foundation, local test source |
| 5B | ✅ | Real authoritative sources (Chicago CDPH, NYC DOHMH) |
| 5C | ✅ | Production-oriented pipeline with granular result tracking, rawData preservation, idempotency verification |

---

## Core Principle

> **Evidence must come from a source. AI may later analyze evidence, but AI must never become the source of evidence.**

---

## Pipeline Flow

```
Authoritative Source
        ↓
Source Adapter
  fetchRecords() → RawRecord[]
        ↓
Normalization Service
  trim, clean enums, parse dates → NormalizedRecord
        ↓
Validation Service
  required fields, enum bounds → ValidatedRecord
        ↓
Restaurant Identity Resolver
  name + city exact match → restaurantId
        ↓
Deduplication Service
  externalRecordId triple OR contentHash → isDuplicate
        ↓
Safety Evidence insert
  provenance fields populated → MongoDB
        ↓
Ingestion Run Audit
  per-run counts + error log → MongoDB
```

---

## Result Tracking (5C Granularity)

Each ingestion run now returns and records:

| Field | Meaning |
|---|---|
| `fetched` | Total records returned by the source adapter |
| `inserted` | New evidence records written to MongoDB |
| `duplicates` | Records already in DB — skipped (idempotent) |
| `unresolved` | Records that could not be matched to a HotMeal restaurant |
| `validationFailed` | Records that failed title/description/enum validation |
| `failed` | Unexpected per-record processing errors |

Example response for Chicago source (HotMeal DB has Indian restaurants only):

```json
{
  "fetched": 50,
  "inserted": 0,
  "duplicates": 0,
  "unresolved": 50,
  "validationFailed": 0,
  "failed": 0
}
```

---

## Idempotency

Running the same source twice produces:

```
Run 1: fetched=N  inserted=M  duplicates=0
Run 2: fetched=N  inserted=0  duplicates=M
```

The deduplication service uses:
1. `externalRecordId + sourceType + sourceName` triple when available
2. SHA-256 `contentHash` of stable fields as fallback

---

## rawData Preservation

Each source adapter now includes a `rawData` field on every raw record.

`rawData` contains a safe subset of the original source API response — the fields most useful for future provenance tracing. It is used only within the ingestion pipeline and is never stored in MongoDB.

This allows the pipeline to include the original source context without polluting the safety evidence schema.

---

## Conservative Restaurant Matching

**Rule: FALSE NEGATIVE is safer than FALSE POSITIVE.**

A missed record is acceptable. Attaching evidence to the wrong restaurant is not.

**Current strategy:**
1. Match by `restaurantName` (case-insensitive) + `city` (case-insensitive)
2. Exactly 1 match → accepted
3. 0 matches → `unresolved`
4. >1 matches → `unresolved` (ambiguous)

**Current DB state:** HotMeal has Indian restaurants (Pune, Latur).
Chicago/NYC records all produce `unresolved`. This is correct.
No fake evidence is inserted.

---

## Source Registry

Sources are configured in `backend/config/safetySources.js`.

| Source ID | Status | Authority |
|---|---|---|
| `local-test` | ✅ Enabled | Test only — no internet |
| `chicago-food-inspections` | ✅ Enabled | Chicago CDPH (live Socrata API) |
| `nyc-dohmh-inspections` | ✅ Enabled | NYC DOHMH (live Socrata API) |
| `fssai-india` | ❌ Disabled | FSSAI — no official public API available |

---

## Admin API

### Trigger ingestion

```
POST /api/ingestion/run
Authorization: token <admin-jwt>
Content-Type: application/json

{ "source": "chicago-food-inspections" }
```

### List available sources

```
GET /api/ingestion/sources
Authorization: token <admin-jwt>
```

---

## Security

- All ingestion endpoints require `authMiddleware + adminAuth`
- No token → `"Not Authorized. Login Again."`
- Normal user token → `"Access denied. Admin only."`
- Disabled source → 400 with explanation
- Unknown source → 400 with available source IDs

---

## Adding a New Source

1. Add entry to `backend/config/safetySources.js`
2. Create `backend/ingestion/sources/<id>Source.js`
3. Implement `fetchRecords()` returning raw records with `rawData` field
4. Import and register adapter in `backend/controllers/ingestionController.js`
5. The pipeline runs automatically — no changes to services needed

---

## Out of Scope

- ❌ No automatic startup ingestion
- ❌ No cron jobs / scheduled tasks
- ❌ No web scraping (official APIs only)
- ❌ No AI-generated evidence
- ❌ No PostgreSQL / pgvector / embeddings / RAG / LLM

Those belong to later milestones (5D, 6, 7, 8).
