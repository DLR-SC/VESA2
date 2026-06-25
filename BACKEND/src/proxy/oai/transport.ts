import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { oaiDebug } from "./debugLog";

// Shared OAI-PMH transport: fetch + retry + parse + token extraction. Consolidated
// from the hardened (v2) proxies so every source reuses one code path.

const HEADERS = { "User-Agent": "VESA-Harvester-Bot" };
const TIMEOUT_MS = 45_000;
const RETRY_DELAYS_MS = [8_000, 20_000]; // two retries before giving up

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  // A 50-100 record page (e.g. arXiv abstracts) blows past the default 1000 entity
  // expansions on legit `&amp;`/`&lt;`. Raise the volume caps; keep the depth/count
  // guards (the real billion-laughs vector — OAI feeds don't define custom entities).
  processEntities: { enabled: true, maxTotalExpansions: 2_000_000, maxExpandedLength: 50_000_000 },
  // No isArray forcing: parseOaiPage and extract() both normalise single-vs-array themselves.
});

export interface OaiPage {
  records: any[]; // raw parsed <record> nodes; the extractor turns each into IDataAdapter
  nextToken: string | null;
}

async function fetchWithBackoff(url: string): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      oaiDebug("fetch", `GET ${url}`);
      const { data } = await axios.get<string>(url, { headers: HEADERS, timeout: TIMEOUT_MS });
      return data;
    } catch (err: any) {
      lastError = err;
      const status = err.response?.status;
      // Retry only on rate-limit / transient server errors; bail on client errors.
      const isTransient = !status || status === 429 || status >= 500;
      if (!isTransient || attempt === RETRY_DELAYS_MS.length) break;
      const waitMs = RETRY_DELAYS_MS[attempt];
      oaiDebug("fetch", `${status ?? "network error"} → retry in ${waitMs / 1000}s (${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

// Pure: parse one ListRecords XML page. OAI-PMH returns errors as XML inside HTTP
// 200, so surface them as thrown errors. Split out from the fetch so it's testable
// without a network call.
export function parseOaiPage(xml: string): OaiPage {
  const oai = parser.parse(xml)["OAI-PMH"];

  if (oai?.error) {
    const code = oai.error?.code || "unknown";
    const message =
      typeof oai.error === "string" ? oai.error : oai.error?.["#text"] || "OAI-PMH error";
    const err: any = new Error(`OAI-PMH error (${code}): ${message}`);
    err.oaiCode = code; // negotiation falls through on cannotDisseminateFormat
    throw err;
  }

  const listRecords = oai?.ListRecords;
  if (!listRecords || !listRecords.record) {
    oaiDebug("parse", "0 records on page");
    return { records: [], nextToken: null };
  }

  const records = Array.isArray(listRecords.record) ? listRecords.record : [listRecords.record];
  const rawToken = listRecords.resumptionToken;
  const nextToken = rawToken ? (typeof rawToken === "object" ? rawToken["#text"] : rawToken) : null;

  oaiDebug("parse", `${records.length} records parsed`, { nextToken: nextToken ? "yes" : "no" });
  return { records, nextToken: nextToken ?? null };
}

export async function fetchOaiPage(oaiUrl: string): Promise<OaiPage> {
  return parseOaiPage(await fetchWithBackoff(oaiUrl));
}

// Discover the metadataPrefixes a source serves (needed to find bespoke rich schemas
// by name — you can't probe a prefix you can't guess).
export async function listFormats(source: string): Promise<string[]> {
  const url = `${source}${source.includes("?") ? "&" : "?"}verb=ListMetadataFormats`;
  const oai = parser.parse(await fetchWithBackoff(url))["OAI-PMH"];
  const fmts = oai?.ListMetadataFormats?.metadataFormat;
  if (!fmts) return [];
  const list = Array.isArray(fmts) ? fmts : [fmts];
  const prefixes = list.map((f: any) => text(f?.metadataPrefix)).filter(Boolean);
  oaiDebug("negotiate", `ListMetadataFormats: ${prefixes.join(", ") || "none"}`);
  return prefixes;
}

const text = (x: any): string => (typeof x === "string" ? x : x?.["#text"] ?? "");

// First page selects the schema via metadataPrefix (+ optional set); follow-up
// pages carry only the resumptionToken, which already encodes prefix/set.
export function buildOaiUrl(
  source: string,
  prefix: string,
  set: string | undefined,
  token: string | undefined
): string {
  const base = `${source}${source.includes("?") ? "&" : "?"}verb=ListRecords`;
  if (token) return `${base}&resumptionToken=${encodeURIComponent(token)}`;
  let url = `${base}&metadataPrefix=${encodeURIComponent(prefix)}`;
  if (set) url += `&set=${encodeURIComponent(set)}`;
  return url;
}
