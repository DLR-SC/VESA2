# VESA2 Architecture

## Background

Earlier versions of VESA2 fetched and merged data from multiple external APIs at the moment of each user request. This caused high latency, complicated ID mapping across sources, and fragile runtime dependencies on external availability.

The current architecture separates the system into two distinct phases: a one-time **ingestion phase** (at setup time) and a **query phase** (at runtime). External data is pulled, normalized, and written into a local ArangoDB knowledge graph during setup. All runtime queries hit only the local graph.

---

## Ingestion Phase

The ingestion pipeline is triggered by the user via the **Setup** page in the frontend. It runs once per data source and does not need to be repeated unless the source data changes.

### Setup UI

The Setup page presents a form with the following fields:

| Field | Description |
|-------|-------------|
| API Endpoint URL | The URL of the proxy that serves records in the `IDataAdapter` format. |
| Dataset Label | A short prefix (e.g. `pangaea`) used to namespace all IDs from this source. |
| Limit | Total number of records to ingest. |
| Batch Delay (s) | Seconds to wait between page requests (rate-limit control). |
| Source Color | An accent color stored alongside the source config for use in the Connected Sources panel. |

Two built-in source presets (PANGAEA, GBIF) auto-fill the endpoint URL and recommended settings. Selecting a preset locks the URL field and routes the request through the corresponding built-in proxy.

If a dataset label is already in use, the form surfaces an **Overwrite** checkbox. Confirming overwrite purges all existing records for that prefix before re-ingesting.

### Handshake Validation (`HandshakeValidator`)

Before the full sync starts, the system fetches exactly one record (`?limit=1`) from the target endpoint and checks that it conforms to the `IDataAdapter` schema: the `dataset` object must have an `id` and `title`, and `authors`/`keywords` must be arrays. If validation fails, the sync is rejected and the error is surfaced in the UI. The sync does not begin until this check passes.

Both built-in proxies also accept `?mock=true`, which returns a hardcoded deterministic fixture record. This is useful for testing proxy connectivity without fetching live data, but the HandshakeValidator itself uses `?limit=1`, not the mock flag.

### Sync Orchestrator (`SyncOrchestrator`)

Once validation passes, the orchestrator runs in the background and returns a job ID immediately. It:

1. Creates a `SyncLogs` entry with status `running`.
2. Fetches records from the proxy in pages, using the `X-Next-Token` response header for pagination.
3. For each batch: applies ID prefixing, extracts graph payloads, and writes them to ArangoDB via `GraphWriter.writeBatch`.
4. Updates `SyncLogs` with progress counts after each batch.
5. Marks the log entry `completed` or `failed` when done.

On server restart, any `SyncLogs` entry still marked `running` is immediately set to `failed` — these are crash remnants from a previous process.

The orchestrator accepts a configurable **inter-batch sleep** (from the Batch Delay field in the UI) to avoid overloading upstream APIs.

### Prefixing Service (`PrefixingService`)

Prepends the user-supplied label to all IDs in the packet before extraction. A packet with `dataset.id = "1234"` and prefix `pangaea` becomes `pangaea:1234`. This prevents ID collisions when multiple sources are ingested into the same graph.

### Relation Extractor (`RelationExtractor`)

Deconstructs each `IDataAdapter` packet into five components ready for ArangoDB:
- A `Dataset` document node
- Zero or more `Author` document nodes
- Zero or more `Keywords` document nodes
- `HasAuthor` edge records linking dataset → authors
- `HasKeyword` edge records linking dataset → keywords

IDs are slugified (lowercased, non-alphanumeric characters replaced with underscores) to produce valid ArangoDB `_key` values.

### Graph Writer (`GraphWriter`)

Writes each batch to ArangoDB using `overwriteMode: "update"` for documents (safe upsert) and `overwriteMode: "ignore"` for edges (de-duplication). In-memory deduplication within a batch prevents constraint errors when multiple datasets share the same author or keyword.

Records with `null` temporal extents (both `start` and `end` null) are filtered out before writing.

---

## Database Schema

**Database name:** `vesa2db`

### Document Collections

| Collection | Key fields |
|------------|-----------|
| `Dataset` | `_key` (slugified prefixed ID), title, abstract, URI, publicationDate, spatial, temporal, source_prefix |
| `Author` | `_key`, firstName, lastName, source_prefix |
| `Keywords` | `_key`, name, source_prefix |
| `SyncLogs` | status, prefix, source_url, count_success, count_failure, total_limit, start_time, end_time, ui_config |

### Edge Collections

| Collection | Direction | Description |
|------------|-----------|-------------|
| `HasAuthor` | `Dataset` → `Author` | Links each dataset to its contributors. |
| `HasKeyword` | `Dataset` → `Keywords` | Links each dataset to its subject tags. |

`SyncLogs` stores one entry per ingestion job. The `ui_config` field persists per-source settings (color, endpoint, label) so the Connected Sources panel can display them after the page reloads.

---

## Query Phase

At runtime, the frontend (RTK Query) sends requests to Express routes. The routes call gateway services (`DatasetService`, `KeywordService`, `AuthorService`), which delegate to `VesaAdapter`. The adapter translates each request into an AQL query against the local graph and returns the result. No external API calls occur during normal use.

The frontend uses crossfilter2 for client-side multi-dimensional filtering: selecting a region on the map, a keyword in the word cloud, or an author in the chord diagram narrows the dataset slice shown in all other visualizations simultaneously.

### Visualizations

| Component | Data source | What it shows |
|-----------|-------------|---------------|
| Geo Map | spatial extent per dataset | Dataset geographic coverage |
| Time Series | temporal extent per dataset | Publication timeline |
| Word Cloud | keyword frequency per dataset slice | Thematic topics |
| Chord Diagram | author co-occurrence across datasets | Contributor network |
| Data Grid | full dataset list for current slice | Tabular detail view |

---

## Data Contract (`IDataAdapter`)

Any proxy that returns this structure can be connected to VESA2 without changes to the backend ingestion pipeline:

```ts
interface IDataAdapter {
  dataset: {
    id: string;
    title: string;
    abstract: string | null;
    uri: string;
    publicationDate: string | null;
    spatial: { west, east, south, north: number | null } | null;
    temporal: { start: string | null; end: string | null } | null;
    source?: string;
  };
  authors: { id: string; firstName: string; lastName: string }[];
  keywords: { id: string; name: string }[];
}
```

The proxy endpoint should:
- Accept `?limit=N` to control page size.
- Return `X-Next-Token` in the response headers when more pages are available.
- Accept `?mock=true` to return a single deterministic fixture record (used in development/testing).

The built-in proxies for PANGAEA (`/pangaea/records`) and GBIF (`/gbif/records`) are working reference implementations.
