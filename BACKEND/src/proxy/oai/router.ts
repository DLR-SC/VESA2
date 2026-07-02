import express, { Request, Response } from "express";
import { IDataAdapter } from "../../ingestion/contracts/IDataAdapter";
import { fetchOaiPage, buildOaiUrl, listFormats, getBackoff, OaiPage } from "./transport";
import { extract } from "./extract";
import { oaiDebug } from "./debugLog";

// Universal OAI-PMH proxy. One endpoint for any OAI-PMH source. No per-schema mappers:
// negotiation fetches the richest schema offered, the heuristic extractor maps it.
// Stateless — X-Next-Token is wrapped "<prefix>|<oaiToken>" so the schema survives
// pagination while the orchestrator just echoes the token back.
export const oaiProxyRouter = express.Router();

// Prefer rich structured schemas over the Dublin Core floor. An unknown non-dc schema
// still ranks above oai_dc because the extractor handles whatever XML it returns.
// Name-based ranking — if a source's best schema is bespoke and unguessable, pin it via
// the explicit `prefix` override (e.g. a preset chip).
export function formatRank(prefix: string): 0 | 1 | 3 {
  const l = prefix.toLowerCase();
  if (l === "oai_dc" || l === "dc") return 0;
  if (/datacite|eml|iso19139|^iso|^gmd|dif|inspire/.test(l)) return 3;
  return 1;
}
export function rankFormats(formats: string[]): string[] {
  return [...new Set(formats)].sort((a, b) => formatRank(b) - formatRank(a));
}

// Probe in richness order, falling through only on cannotDisseminateFormat (repos
// sometimes list a format they won't actually serve). fetchPage/getFormats are
// injectable so the logic is testable without network.
export async function negotiate(
  source: string,
  set: string | undefined,
  explicit: string | undefined,
  fetchPage: (url: string) => Promise<OaiPage> = fetchOaiPage,
  getFormats: (source: string) => Promise<string[]> = listFormats
): Promise<{ prefix: string; page: OaiPage }> {
  let candidates: string[];
  if (explicit) {
    candidates = [explicit];
  } else {
    const formats = await getFormats(source).catch(() => [] as string[]);
    candidates = rankFormats(formats);
    if (candidates.length === 0) candidates = ["oai_datacite"]; // discovery failed → probe a common rich one
  }
  if (!candidates.includes("oai_dc")) candidates.push("oai_dc"); // guaranteed floor, always last

  let lastErr: any;
  for (const prefix of candidates) {
    try {
      oaiDebug("negotiate", `try ${prefix}`, { set: set ?? null });
      const page = await fetchPage(buildOaiUrl(source, prefix, set, undefined));
      oaiDebug("negotiate", `selected ${prefix} (${page.records.length} sampled)`);
      return { prefix, page };
    } catch (e: any) {
      lastErr = e;
      if (e?.oaiCode === "cannotDisseminateFormat") {
        oaiDebug("negotiate", `${prefix} not served → next`);
        continue;
      }
      throw e; // network / other OAI error — bail
    }
  }
  throw lastErr ?? new Error("No usable metadataPrefix could be negotiated.");
}

// Polled by the UI while a request is in flight, so a retry/backoff sleep shows as
// "retrying…" rather than an indefinite hang.
oaiProxyRouter.get("/backoff", (_req: Request, res: Response): void => {
  res.json({ backoff: getBackoff() });
});

// --- Staging inspection (Phase 1): sample a source read-only, no graph writes. ---

export interface IInspectResult {
  source: string;
  selectedPrefix: string;
  discovered: Array<{ prefix: string; rank: 0 | 1 | 3; selected: boolean }>;
  sample: Array<{ raw: any; extracted: IDataAdapter | null }>;
  fidelity: {
    sampled: number;
    mapPct: number;
    timePct: number;
    abstractPct: number;
    authorsAvg: number;
    keywordsAvg: number;
  };
}

function aggregateFidelity(extracted: Array<IDataAdapter | null>): IInspectResult["fidelity"] {
  const recs = extracted.filter((x): x is IDataAdapter => !!x);
  const n = recs.length;
  const pct = (c: number) => (n ? Math.round((c / n) * 100) : 0);
  const avg = (sum: number) => (n ? Math.round((sum / n) * 10) / 10 : 0);
  return {
    sampled: n,
    mapPct: pct(recs.filter((r) => r.dataset.spatial != null).length),
    timePct: pct(recs.filter((r) => r.dataset.temporal != null).length),
    abstractPct: pct(recs.filter((r) => r.dataset.abstract != null).length),
    authorsAvg: avg(recs.reduce((s, r) => s + r.authors.length, 0)),
    keywordsAvg: avg(recs.reduce((s, r) => s + r.keywords.length, 0)),
  };
}

oaiProxyRouter.get("/inspect", async (req: Request, res: Response): Promise<void> => {
  const source = req.query.source as string | undefined;
  try {
    if (!source) {
      res.status(400).json({ error: "Missing required 'source' query param (OAI base URL)." });
      return;
    }
    const set = req.query.set as string | undefined;
    const explicit = req.query.prefix as string | undefined;
    const sampleSize = Math.min(Math.max(Number(req.query.sample) || 10, 1), 25);
    oaiDebug("request", `GET /inspect source=${source}`, { explicitPrefix: explicit ?? null, set: set ?? null });

    const formats = await listFormats(source).catch(() => [] as string[]);

    let prefix: string;
    let page: OaiPage;
    if (explicit) {
      // Override: fetch exactly this schema; if it isn't served, say so rather than silently
      // falling back to oai_dc (the way negotiate would).
      prefix = explicit;
      try {
        page = await fetchOaiPage(buildOaiUrl(source, explicit, set, undefined));
      } catch (e: any) {
        if (e?.oaiCode === "cannotDisseminateFormat") {
          res.status(409).json({ error: `Source does not serve '${explicit}'.`, unsupportedPrefix: explicit });
          return;
        }
        throw e;
      }
    } else {
      // Reuse the formats we just fetched so ListMetadataFormats isn't called twice.
      ({ prefix, page } = await negotiate(source, set, undefined, fetchOaiPage, async () => formats));
    }

    const sample = page.records.slice(0, sampleSize).map((raw) => ({ raw, extracted: extract(raw, prefix) }));

    const discovered = [...new Set([...formats, prefix])]
      .sort((a, b) => formatRank(b) - formatRank(a))
      .map((p) => ({ prefix: p, rank: formatRank(p), selected: p === prefix }));

    const result: IInspectResult = {
      source,
      selectedPrefix: prefix,
      discovered,
      sample,
      fidelity: aggregateFidelity(sample.map((s) => s.extracted)),
    };
    oaiDebug("response", `inspect ${prefix} · ${result.fidelity.sampled} sampled · map ${result.fidelity.mapPct}% time ${result.fidelity.timePct}%`);
    res.json(result);
  } catch (error: any) {
    oaiDebug("error", error.message, { source: source ?? null });
    console.error(`[oai] Inspect error:`, error.message);
    res.status(502).json({ error: error.message });
  }
});

oaiProxyRouter.get("/records", async (req: Request, res: Response): Promise<void> => {
  const source = req.query.source as string | undefined;
  try {
    if (!source) {
      res.status(400).json({ error: "Missing required 'source' query param (OAI base URL)." });
      return;
    }
    const rawToken = req.query.token as string | undefined;
    oaiDebug("request", `GET /records source=${source}`, {
      token: rawToken ? "present" : "none",
      explicitPrefix: req.query.prefix ?? null,
      set: req.query.set ?? null,
    });

    let prefix: string;
    let page: OaiPage;
    if (rawToken) {
      const sep = rawToken.indexOf("|");
      prefix = sep >= 0 ? rawToken.slice(0, sep) : (req.query.prefix as string) || "oai_dc";
      const oaiToken = sep >= 0 ? rawToken.slice(sep + 1) : rawToken;
      oaiDebug("request", `follow-up page prefix=${prefix}`);
      page = await fetchOaiPage(buildOaiUrl(source, prefix, undefined, oaiToken));
    } else {
      ({ prefix, page } = await negotiate(
        source,
        req.query.set as string | undefined,
        req.query.prefix as string | undefined
      ));
    }

    const output: IDataAdapter[] = [];
    for (const record of page.records) {
      const mapped = extract(record, prefix);
      if (mapped) output.push(mapped);
    }
    oaiDebug("map", `extracted ${output.length}/${page.records.length} via ${prefix}`, {
      skipped: page.records.length - output.length,
    });

    if (page.nextToken) res.set("X-Next-Token", `${prefix}|${page.nextToken}`);
    oaiDebug("response", `200 · ${output.length} records · next-token ${page.nextToken ? "yes" : "no"}`);
    res.json(output);
  } catch (error: any) {
    oaiDebug("error", error.message, { source: source ?? null });
    console.error(`[oai] Error:`, error.message);
    res.status(502).json({ error: error.message });
  }
});
