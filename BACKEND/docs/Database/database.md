# Database Structure

**Database name:** `vesa2db`  
**Engine:** ArangoDB

## Collections

### Document Collections

| Collection | Description |
|------------|-------------|
| `Dataset`  | One document per ingested dataset. Holds metadata fields: title, abstract, DOI, temporal extent, spatial coordinates, source URL, and source prefix. |
| `Author`   | One document per unique author (prefixed, de-duplicated). Fields: name, source prefix, normalized ID. |
| `Keywords` | One document per unique keyword/tag (prefixed, de-duplicated). Fields: label, source prefix, normalized ID. |

### Edge Collections

| Collection   | From → To            | Description |
|--------------|----------------------|-------------|
| `HasAuthor`  | `Dataset` → `Author` | Links a dataset to each of its authors. |
| `HasKeyword` | `Dataset` → `Keywords` | Links a dataset to each of its keywords/tags. |

## Indexes

All collections have a unique index on the prefixed `id` field (e.g. `pangaea:dataset_1`) enforced at ingestion time by `GraphWriter`. Edge collections enforce de-duplication via a unique composite index on `(_from, _to)`.

## Prefixing Convention

All document IDs are namespaced at ingestion time by `PrefixingService` to avoid collisions between data sources:

```
<source-prefix>:<entity-type>_<original-id>
e.g.  pangaea:dataset_1234
      gbif:author_99
```

## Ingestion Pipeline

Records flow through the pipeline in this order:

```
Proxy API (/records)
  → HandshakeValidator  (schema check on first record)
  → SyncOrchestrator    (paginated batch fetch loop)
  → PrefixingService    (namespace IDs)
  → RelationExtractor   (split into Dataset / Author / Keyword payloads)
  → GraphWriter         (atomic upserts into ArangoDB)
```

See [`BACKEND/src/ingestion/`](../../src/ingestion/) for implementation details.
