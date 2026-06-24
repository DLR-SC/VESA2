# Universal OAI-PMH Proxy — Design Session Handoff

> **Purpose of this file:** a self-contained snapshot of an in-progress design
> discussion (a `/grill-me` session) so it can be **resumed on another machine**.
> A fresh Claude Code session should read this top-to-bottom, then continue the
> grilling from the **OPEN QUESTION** at the bottom. Nothing here is implemented
> yet — this is design only.
>
> Branch: `feature/universal-oai-pmh-proxy` (based on `develop`).
> Last updated: 2026-06-24.

---

## 0. How to resume (read this first)

1. Make sure you're on branch `feature/universal-oai-pmh-proxy`.
2. Read this whole document. It contains the full decision log and rationale.
3. Re-orient in the code using the **Key files** map in §2 (verify they still
   exist / match before quoting them — the codebase may have moved on).
4. Resume the `/grill-me` interview at **§6 OPEN QUESTION (Q3)**. Ask one
   question at a time, give a recommendation with each, walk the tree.

---

## 1. Goal

Build a **universal OAI-PMH proxy**: one mechanism that can harvest *any*
data source speaking the OAI-PMH protocol and normalize it into the project's
`IDataAdapter` contract — instead of hand-writing a new proxy file per source
(currently PANGAEA, GBIF, Zenodo).

**Hard product constraint (stated by the user):** the end users are
**researchers and scientists, not developers**. The whole point is to remove
the need for a user to bring/build their own proxy or write any code to add a
source.

---

## 2. What the codebase actually is (context recap)

**VESA2** (Visualisation Enabled Search Application, DLR-SC) — a visual
search/exploration tool over a local **ArangoDB knowledge graph**. Data is
ingested from external sources at setup time; all runtime queries hit the local
graph. React/TS frontend + TS/Express backend, Dockerized. Visualisations:
Map (spatial), Line charts (temporal), Network graph (relations), Word cloud
(thematic) — so **spatial + temporal fidelity is the core value prop**.

Branches: `main` = stable (initial migration only). `develop` = all the recent
refactor/perf/backend work, including the three proxies and the ingestion
pipeline. This feature branches off `develop`.

### Key files (the pipeline, in dependency order)

| Concern | File |
|---|---|
| Output contract (the target shape) | `BACKEND/src/ingestion/contracts/IDataAdapter.ts` |
| PANGAEA proxy (OAI `pan_md` schema) | `BACKEND/src/proxy/pangaeaProxy.ts` |
| GBIF proxy (OAI `eml` schema) | `BACKEND/src/proxy/gbifProxy.ts` |
| Zenodo proxy (OAI `oai_datacite` schema) | `BACKEND/src/proxy/zenodoProxy.ts` |
| Harvest loop / pagination / batching / persistence | `BACKEND/src/ingestion/SyncOrchestrator.ts` |
| Schema/reachability check | `BACKEND/src/ingestion/validation/HandshakeValidator.ts` |
| ID namespacing | `BACKEND/src/ingestion/services/PrefixingService.ts` |
| Relation extraction → graph payload | `BACKEND/src/ingestion/services/RelationExtractor.ts` |
| Graph writes | `BACKEND/src/ingestion/services/GraphWriter.ts` |
| HTTP routes (`/sync/*`) | `BACKEND/src/ingestion/ingestionRouter.ts` |
| Route registry (mounts each proxy) | `BACKEND/src/index.ts` |
| Frontend ingestion form (free-text URL + presets) | `FRONTEND/src/components/ingestion/HandshakeForm.tsx` |
| Frontend sync controls | `FRONTEND/src/components/ingestion/SyncControl.tsx` |
| Frontend sync RTK Query API | `FRONTEND/src/store/services/syncApi.ts` |

### The single most important architectural finding

**The pipeline is already source-agnostic.** The per-source proxies do **not**
drive harvesting — the `SyncOrchestrator` does:

- `SyncOrchestrator.sync(url, ...)` just loops `axios.get(url, { params })`,
  follows the `X-Next-Token` response header for pagination, batches records,
  applies the prefix, and writes to Arango. It has **zero** knowledge of which
  source it's talking to.
- `HandshakeValidator.validate(url)` just GETs `url?limit=1` and checks the
  response matches `IDataAdapter` (`dataset.id`, `dataset.title`, `authors[]`,
  `keywords[]` arrays).
- `HandshakeForm.tsx` already exposes a **free-text "API Endpoint URL" field**;
  the PANGAEA/GBIF chips are just presets that prefill a proxy path. A user can
  already paste any URL.

**Therefore** the *only* unique thing each proxy file contributes is:
**OAI-PMH `ListRecords` fetch + XML parse + map that specific metadata schema
→ `IDataAdapter`.** Transport, pagination, retry, batching, prefixing, and
persistence are all already generic (transport/retry is duplicated across the
proxies but is conceptually shared).

### What the three proxies have in common (asked & answered earlier)

1. **Same protocol** — OAI-PMH `verb=ListRecords`, paginated via
   `resumptionToken`, surfaced to the orchestrator as an `X-Next-Token` header.
   - PANGAEA: `ws.pangaea.de/oai/provider`, `metadataPrefix=pan_md`, `set=citable`
   - GBIF: `api.gbif.org/v1/oai-pmh/registry`, `metadataPrefix=eml`
   - Zenodo: `zenodo.org/oai2d`, `metadataPrefix=oai_datacite`
2. **Same output contract** — each maps a totally different XML schema into
   `{ dataset, authors, keywords }` (`IDataAdapter`). Only `dataset.source`
   differs downstream.
3. **Identical structural template** — `express.Router` with one `GET /records`,
   `fast-xml-parser` with the same `isArray` cardinality trick, a `slugify`
   helper, a `MapDataset`/`MapAuthors`/`MapKeywords` trio, a `MOCK_FIXTURE`
   returned on `?mock=true` (kept structurally identical "for Handshake
   consistency"), and `X-Next-Token` pagination.
4. **Divergence worth noting:** PANGAEA is the v1 template — **no retry/backoff
   and no OAI-error detection**. GBIF & Zenodo are hardened v2 copies
   (`fetch*WithBackoff`, `VESA-Harvester-Bot` UA, 45s timeout, `[8s,20s]`
   retries, explicit handling of OAI errors returned inside an HTTP 200).

---

## 3. The crux of feasibility (must internalize before any design)

OAI-PMH standardizes only the **envelope**: the verbs (`Identify`,
`ListMetadataFormats`, `ListRecords`), `resumptionToken` pagination, and the
`<record><header>/<metadata>` wrapper. It does **not** standardize what's
*inside* `<metadata>` — that's the `metadataPrefix`-specific schema.

The **only** metadata schema every OAI-PMH repository is *required* by spec to
serve is **`oai_dc`** (simple Dublin Core): 15 flat, free-text elements
(`dc:title`, `dc:creator`, `dc:subject`, `dc:date`, `dc:coverage`, ...). It has
**no structured spatial bounding box and no structured temporal range**
(`dc:coverage` is free text), and `dc:creator` is one string (no first/last
split → weaker author-dedup `id` slug).

**Consequence:** "universal proxy" cannot mean "one mapper that understands any
schema" — that's a mirage. It means "one transport that works against any
OAI-PMH endpoint," plus a strategy for the schema inside.

---

## 4. Decisions made so far (decision log)

### Q1 — Metadata schema strategy → **DECIDED: (C) Hybrid**

Options were:
- (A) Dublin Core LCD only — universal, zero per-source code, but loses
  spatial + structured temporal (kills the Map/Time value prop for many sources).
- (B) Declarative mapping registry — universal transport + per-*schema* mapping
  descriptors; preserves richness, no new file per source.
- **(C) Hybrid — CHOSEN.** Generic `oai_dc` mapper as the universal *fallback*
  (any OAI-PMH endpoint works on day one at Dublin-Core quality), **plus** a
  registry of richer mappers keyed by `metadataPrefix`. New sources are instantly
  usable and can be "upgraded" to full geo/temporal fidelity when a richer schema
  is available. Lets the three hand-written proxies collapse into:
  one shared transport + an `oai_dc` mapper + three small schema mappers.

### Q2 — What *form* does a rich mapper take? → **Reframed, not yet finalized**

The tempting idea ("a mapper is just JSON field-paths, so adding a source is
pure config") **breaks** on real transforms seen in the existing proxies, which
a path-only DSL can't express:
- PANGAEA: keyword **noise-regex filtering**; squashes a single `md:event`
  lat/lon into a degenerate bbox (west=east, south=north).
- GBIF: **joins** `abstract.para` arrays; **drops** authors with
  `lastName === "Unknown"`.
- DataCite/Zenodo: **find-by-sibling-attribute** (description where
  `descriptionType==="Abstract"`, date where `dateType==="Issued"`); **splits**
  `creatorName` `"Last, First"` into structured names.

A pure-JSON DSL would have to grow `filter`/`find-by-attr`/`split`/`join`/
`coalesce` operators — i.e. reinvent a worse programming language.

**The reframe that resolves the user's "users shouldn't write code" concern:**
Separate two actors —
1. **VESA maintainer** writes mapper code **once** per *standardized schema*.
2. **End-user researcher** pastes a URL, picks nothing, writes nothing.

A mapper is keyed by **`metadataPrefix` (the schema), not the source.** The set
of rich OAI-PMH schemas that actually occur for scientific *data* repos is
**small, finite, and public**:
- `oai_datacite` / `datacite` — Zenodo, Dryad, Dataverse, most DOI-minting repos
- `eml` — GBIF, DataONE, ecological networks
- `iso19139` / `dif` — geospatial & NASA/GCMD catalogs
- `oai_dc` — the universal mandatory floor (fallback)

So ~4 maintainer-written mappers mean a researcher pointing VESA at *any*
DataCite repo on earth gets full rich mapping **with zero code**, because the
repo reuses the same standard schema. "B" is therefore **not** "users write
code" — it's "maintainers cover a closed set of public standards, once."

**Leaning recommendation (to confirm under Q3):** imperative mapper modules
behind a shared interface — `ISchemaMapper { prefix, mapDataset, mapAuthors,
mapKeywords }`, registered in a `Map<metadataPrefix, ISchemaMapper>`. Shared
once: transport, pagination, retry, OAI-error handling, `oai_dc` fallback. Per
schema: ~40 lines of transform. The existing three proxies become three
registered mappers.

#### Long-tail (genuinely custom, non-standard schema) options — for Q3 scoping
- **(1) `oai_dc` fallback only** *(free with hybrid C)* — unknown schema →
  Dublin Core; degraded/absent geo; zero code, works everywhere, today.
- **(2) No-code visual mapping wizard** — fetch a sample record, show the XML
  tree, researcher clicks "this node = title / latitude," store a descriptor.
  True BYO-source-no-code, but asks a scientist to reason about XML and struggles
  with conditional transforms. Big build, real UX risk.
- **(3) LLM-assisted mapping** — feed a sample record + the `IDataAdapter`
  target to a model (Claude), auto-generate the mapping, show for one-click
  confirm, then **gate it through the existing `HandshakeValidator`** before
  saving so a hallucinated mapping can't corrupt the graph. Handles arbitrary
  schemas + weird transforms, zero user code. Cost: API key + validation
  discipline. More on-brand and less UX-hostile than (2).

---

## 5. Design implications already identified (carry forward)

These follow from C + the orchestrator being source-agnostic. Not yet ratified
as questions, but flagged so they aren't lost:

- **API surface:** likely a single endpoint, e.g.
  `GET /oai/records?source=<base_url>&prefix=<metadataPrefix>&set=<set>&token=<token>`.
  It must preserve the **exact** orchestrator contract: accept `token`, emit
  `X-Next-Token`. Done right → **zero changes to `SyncOrchestrator`**.
- **Two registries, two concerns:** a **schema-mapper** registry (keyed by
  `metadataPrefix`, reusable across sources) vs a **source descriptor**
  (per-repository: base URL, preferred prefix, `set`, batch delay, retry
  profile). Don't conflate them.
- **Prefix negotiation:** on the first (token-less) request, call
  `ListMetadataFormats` (and/or `Identify`), pick the best available prefix by a
  priority order (`oai_datacite` > `eml` > `iso19139`/`dif` > `oai_dc`), use the
  matching mapper, else fall back to `oai_dc`. Follow-up requests carry only
  `resumptionToken` (which already encodes prefix/set) so **negotiation happens
  once**, not per page. Allow an explicit override.
- **OAI error envelope:** OAI-PMH returns errors as XML inside HTTP 200. Handle
  `cannotDisseminateFormat` (drives the negotiation fallback),
  `badResumptionToken` (tokens expire — matters for resume), `noRecordsMatch`,
  `badArgument`. Consolidate the GBIF/Zenodo backoff into the shared transport
  (PANGAEA currently lacks it).
- **`limit` is advisory:** existing proxies ignore `limit` and return a full OAI
  page; the orchestrator enforces the global cap in its per-record loop, and the
  handshake just takes `response.data[0]`. The universal proxy can do the same.
- **Migration of the 3 proxies:** re-implement as registered mappers; repoint the
  frontend preset chips to the universal endpoint; delete the old files. Decide:
  clean cut vs build-alongside-then-delete.

---

## 6. OPEN QUESTION (Q3) — resume the grilling here

> Ask this next. Give a recommendation. Then continue down the tree
> (mapper interface shape → API surface → negotiation → migration → MVP scope).

**Q3 — Scope of "no-code" coverage for this branch.**

Is the target for this feature **"finite standard-schema mappers
(`oai_datacite` + `eml` + `iso19139`/`dif`) + `oai_dc` fallback"** — meaning a
researcher never writes code for any *mainstream* research repo, and a genuinely
*non-standard* schema is handled at Dublin-Core quality (long-tail rich mapping
deferred)?

**Or** do you consider the feature incomplete unless a researcher can fully map
an **arbitrary, non-standard** schema with **no code** — which means committing
now to the **LLM-assisted mapping path (option 3 above)**?

**Recommendation:** ship the finite standard-schema mapper set + `oai_dc`
fallback as *this* branch (it already delivers "researchers never code for
standard repos," which is the stated goal), and treat LLM-assisted mapping (3)
as an explicitly deferred Phase 2 — pursued only if real bespoke-schema repos
turn out to matter. Rationale: (3) adds an API-key dependency and a
hallucination-safety surface that shouldn't gate the core win, and the standard
schemas already cover the overwhelming majority of real OAI-PMH research repos.

### Decision-tree items still queued after Q3
- Q4: Mapper interface shape — confirm imperative `ISchemaMapper` modules vs a
  declarative descriptor (revisit given Q3's answer).
- Q5: API surface & routing (`/oai/records?source=...`), confirm zero
  orchestrator changes.
- Q6: Prefix auto-negotiation order + override mechanism.
- Q7: Migration plan for the existing 3 proxies (clean cut vs parallel).
- Q8: MVP cut for the first PR (which mappers ship first; DataCite is highest
  leverage because it covers the most repos).
