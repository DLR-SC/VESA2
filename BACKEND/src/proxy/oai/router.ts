import express, { Request, Response } from "express";
import { IDataAdapter } from "../../ingestion/contracts/IDataAdapter";
import { fetchOaiPage, buildOaiUrl, listFormats, OaiPage } from "./transport";
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
export function rankFormats(formats: string[]): string[] {
  const score = (f: string): number => {
    const l = f.toLowerCase();
    if (l === "oai_dc" || l === "dc") return 0;
    if (/datacite|eml|iso19139|^iso|^gmd|dif|inspire/.test(l)) return 3;
    return 1;
  };
  return [...new Set(formats)].sort((a, b) => score(b) - score(a));
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
