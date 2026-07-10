# Universal OAI-PMH Proxy — Design

> **What this is:** the design for one mechanism that harvests *any* OAI-PMH data
> source into VESA2 with **no per-source and no per-schema code** — replacing the
> hand-written proxy-per-repository approach. Read top-to-bottom; it's self-contained.
>
> **Status:** transport + negotiation + frontend wiring done; the universal
> extractor is the next build. **Branch:** `feature/universal-oai-pmh-proxy`.
> **Last updated:** 2026-06-25.

---

## 1. The goal (and the pain point)

A researcher pastes the URL of any OAI-PMH source, clicks once, and VESA2 ingests
it — mapped into `IDataAdapter` — **without anyone writing a proxy, a mapper, or a
line of preprocessing for that source's metadata schema.**

The pain point we are killing: **per-repository proxies.** The old approach wrote a
custom proxy per repo (PANGAEA, GBIF, Zenodo) to translate that repo's metadata into
VESA's contract. That doesn't scale — every new repo needs a developer.

**Crucial correction (this is the heart of the design):** a *per-schema* mapper
(`oai_datacite`, `eml`, `pan_md`, …) is the **same disease at a coarser grain.** It's
better — one DataCite mapper serves thousands of DataCite repos — but for any
*bespoke* schema it collapses straight back to "a human hand-writes preprocessing for
this one repo." So **named mappers do not solve the goal.** They relocate the pain.

The thing that actually kills it is a **schema-agnostic heuristic extractor**: one
piece of code that reads *any* metadata XML and recovers the fields by recognising
conventions, not by being told the schema.

---

## 2. Why this is feasible — the pipeline is already source-agnostic

Everything except the metadata mapping is already generic and stays untouched:

| Stage | Source-specific? | Role |
|---|---|---|
| `SyncOrchestrator` | No | Loops `GET url`, follows `X-Next-Token`, batches, prefixes, writes. |
| `HandshakeValidator` | No | `GET url?limit=1`, checks it matches `IDataAdapter`. |
| `PrefixingService` / `RelationExtractor` / `GraphWriter` | No | Namespace, split, upsert. |
| **Metadata → `IDataAdapter`** | **was YES** | The *only* per-source step. This is what the universal extractor makes generic. |

So the whole feature reduces to: **one transport + one universal extractor.**

---

## 3. The constraint that shapes everything

OAI-PMH standardises only the **envelope** (verbs, `resumptionToken`,
`<record><metadata>` wrapper). What's *inside* `<metadata>` is schema-specific.

- Every repo must serve **`oai_dc`** (Dublin Core) — but it's flat free text with
  **no structured spatial box and no temporal range**. A weak floor.
- The **rich** structured data (bounding boxes, temporal ranges, curated keywords)
  lives in richer schemas — `oai_datacite`, `eml`, `iso19139`/`dif`, `pan_md`, …

**Two consequences drive the whole design:**

1. **You must fetch a *rich* schema, not `oai_dc`.** The single biggest finding from
   testing: GBIF and PANGAEA were silently downgraded to `oai_dc`, which has no geo to
   extract — so even a perfect extractor finds nothing. Negotiation must reach for the
   richest schema the source offers.
2. **The high-value fields are standardised even when the wrapper schema isn't.** A
   bounding box is `westBoundLongitude`/`geoLocationBox`/`boundingCoordinates`/a
   `latitude`+`longitude` pair across DataCite, EML, ISO, GeoRSS, and most bespoke
   schemas. Temporal ranges are ISO-8601. So you can recover geo/temporal from an
   *unknown* schema by recognising the encodings — no schema knowledge required.

---

## 4. The design — universal heuristic extractor

### 4.1 One endpoint (unchanged, working)

```
GET /oai/records?source=<oai_base_url>&prefix=<optional>&set=<optional>&token=<optional>
```
- `source` — OAI base URL, single `encodeURIComponent`-encoded param.
- Stateless: token-less call negotiates + extracts a sample page; token-ful call
  forwards the `resumptionToken`. `X-Next-Token` is wrapped `"<prefix>|<token>"` so the
  schema survives pagination with **zero `SyncOrchestrator` changes**.
- The frontend wraps the pasted URL into this endpoint, so everything downstream is
  untouched. Preset chips prefill known OAI base URLs (PANGAEA/GBIF/Zenodo).

### 4.2 Negotiation — fetch the *richest* schema, then extract

The change the logs demand: **don't fall to `oai_dc` while a rich schema exists.**

1. On the first (token-less) call, discover what the source offers via
   `ListMetadataFormats`.
2. Pick the **richest** available prefix (prefer anything over `oai_dc`; tilt toward
   known geo-bearing schemas — `iso19139`/`datacite`/`eml`/`dif` — but **any** non-`dc`
   schema is tried because the extractor doesn't need to know it).
3. Fetch that schema. If it errors (`cannotDisseminateFormat` — repos sometimes
   misreport), fall to the next richest, finally `oai_dc`.
4. Run the **universal extractor** on whatever XML came back.
5. An explicit `prefix` override skips discovery (e.g. force a specific schema).

This is what lets PANGAEA's `pan_md` and GBIF's `eml` actually get fetched — their
geo/temporal/keywords are *in there*, we just have to ask for the rich schema.

### 4.3 The extractor — recognise conventions, not schemas

One function: parsed record (any schema) → `IDataAdapter`. It walks the object tree
and pulls fields by recognisable patterns:

| Field | How it's found |
|---|---|
| **spatial** | the standard box encodings anywhere in the tree: `west/east/north/southBound*`, `geoLocationBox`, `boundingCoordinates`, or a `latitude`+`longitude` pair → bbox. **High confidence — standardised across schemas.** |
| **temporal** | keys matching `/date/i`, ISO-8601 values, `begin`/`end` pairs. |
| **title** | first node with key `/title/i` and text. |
| **abstract** | `/abstract|description/i`. |
| **authors** | nodes under `/creator|author|contributor/i`; handle `givenName`/`familyName`, `"Last, First"`, or a plain string. |
| **keywords** | `/subject|keyword|topic/i`. |
| **id / uri** | `header.identifier`; a DOI/`http` identifier for `uri`. |

**This solves PANGAEA with zero PANGAEA code:** run it over `pan_md` and it finds
`md:latitude`/`md:longitude` (→ geo) and `md:techKeyword` (→ keywords) *by name*. No
`pan_md` mapper, no `eml` mapper, no `iso19139` mapper — one extractor, every schema.

### 4.4 Honest ceiling

- **Good-universal, not perfect.** Nails geo/temporal (standardised encodings) and
  gets title/abstract/keywords well; the fuzzy edge is unusual author-name structures
  and bespoke cleanups (e.g. PANGAEA's keyword noise-filtering). Polish, not core.
- **Cannot invent absent data.** Zenodo shows no geo because its records don't publish
  boxes. No technique recovers what was never sent. The handshake should *report* this
  (fidelity), not pretend.

### 4.5 Optional precision overrides (not required)

A named mapper (e.g. the existing `oai_datacite` extraction) can be registered to
guarantee exact extraction for a schema where you want determinism. It is **opt-in
polish layered on top of the extractor — never required to onboard a source.** Default
path is always the heuristic.

---

## 5. Debug log (developer observability)

`oaiDebug(phase, message, data)` traces every step (request / negotiate / fetch /
parse / map / response / error) to the **server console**. Backend-only — the polled
frontend debug panel was removed to keep the surface lean.

---

## 6. Decisions at a glance

| # | Decision | Choice |
|---|---|---|
| Core approach | per-schema mappers vs universal extractor | **Universal heuristic extractor** (primary path) |
| Named mappers | required vs optional | **Optional precision overrides only** |
| Negotiation | fall to `oai_dc` vs fetch richest | **Fetch the richest schema offered**, extract from it |
| Schema discovery | probe-by-attempt vs `ListMetadataFormats` | **`ListMetadataFormats`** (needed to discover bespoke schema names), probe-fallback on error |
| Geo/temporal recovery | per-schema vs encoding-recognition | **Recognise standard encodings** across any schema |
| API surface | — | `GET /oai/records?source=…`, stateless, token-wrapped |
| Debug | frontend panel vs console | **Backend console only** |
| Absent source data (e.g. Zenodo geo) | — | Unrecoverable — report it, don't fake it |

---

## 7. Status & next steps

**Done:** universal endpoint, stateless token-wrapped pagination, frontend URL-wrapping
+ preset chips, backend debug log.

**Next (build order):**
1. **Universal extractor** (§4.3) — replaces the per-schema registry as the default path.
2. **Broaden negotiation** (§4.2) — `ListMetadataFormats` → fetch richest, not `oai_dc`.
3. **Fidelity report at handshake** — sample a page, report which capabilities (Map /
   Time) the source actually populates, so the user knows the shortcomings.

**Explicitly out / deferred:** writing `eml`/`pan_md`/`iso19139` mappers (the extractor
makes them unnecessary), LLM-assisted mapping (only ever a last resort if the heuristic
proves insufficient on real sources).

---

## 8. Key files

| Concern | File |
|---|---|
| Output contract | `BACKEND/src/ingestion/contracts/IDataAdapter.ts` |
| Universal endpoint + negotiation | `BACKEND/src/proxy/oai/router.ts` |
| Shared transport (fetch/parse/token) | `BACKEND/src/proxy/oai/transport.ts` |
| **Universal extractor (to build)** | `BACKEND/src/proxy/oai/extract.ts` *(new)* |
| Debug log (console) | `BACKEND/src/proxy/oai/debugLog.ts` |
| Harvest loop (unchanged) | `BACKEND/src/ingestion/SyncOrchestrator.ts` |
| Handshake (gains fidelity report) | `BACKEND/src/ingestion/validation/HandshakeValidator.ts` |
| Ingestion form (URL wrap + presets) | `FRONTEND/src/components/ingestion/HandshakeForm.tsx` |

Reference-only (kept, unmounted): the former `pangaeaProxy.ts` / `gbifProxy.ts` /
`zenodoProxy.ts` — useful as worked examples of each schema's real layout while
building and tuning the extractor.
