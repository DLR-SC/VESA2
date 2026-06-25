import { IDataAdapter, IAuthor, IKeyword, ISpatial, ITemporal } from "../../ingestion/contracts/IDataAdapter";
import { slugify } from "./slugify";

// Universal heuristic extractor: turn ANY parsed OAI-PMH record into IDataAdapter by
// recognising field conventions + standard geo/temporal encodings — no per-schema code.
// Verified against oai_datacite, eml, pan_md and oai_dc. Good-universal, not perfect:
// it recovers geo/temporal reliably (encodings are standardised) and title/abstract/
// authors/keywords by naming convention; it won't replicate bespoke per-source cleanups.
// ~one tree-walk per field; fine for page-sized records — collapse to a single walk only
// if a profiler ever complains.

const isObj = (x: any): x is Record<string, any> => !!x && typeof x === "object" && !Array.isArray(x);

// Best-effort single string for a node: prefer #text/value, else join descendant text.
function text(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x.trim();
  if (typeof x === "number") return String(x);
  if (Array.isArray(x)) return x.map(text).filter(Boolean).join(" ").trim();
  if (isObj(x)) {
    if (x["#text"] != null) return text(x["#text"]);
    if (x.value != null) return text(x.value);
    return Object.entries(x).filter(([k]) => k !== "#text").map(([, v]) => text(v)).filter(Boolean).join(" ").trim();
  }
  return "";
}

// Every value whose KEY matches `re`, searched across the whole tree.
function findByKey(node: any, re: RegExp, out: any[] = []): any[] {
  if (Array.isArray(node)) {
    for (const v of node) findByKey(v, re, out);
  } else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (re.test(k)) out.push(v);
      findByKey(v, re, out);
    }
  }
  return out;
}

const findFirstByKey = (node: any, re: RegExp): any => findByKey(node, re)[0];

// Matched values flattened into individual entries (arrays expanded) for per-item mapping.
function entriesByKey(node: any, re: RegExp): any[] {
  const out: any[] = [];
  for (const h of findByKey(node, re)) Array.isArray(h) ? out.push(...h) : out.push(h);
  return out;
}

function firstNumberByKey(node: any, re: RegExp): number | null {
  for (const v of entriesByKey(node, re)) {
    const n = parseFloat(text(v));
    if (Number.isFinite(n)) return n; // Number.isFinite keeps a legit 0 (the old `|| null` dropped it)
  }
  return null;
}

function nameToAuthor(full: string): IAuthor | null {
  const s = full.trim();
  if (!s) return null;
  let firstName = "";
  let lastName = s;
  if (s.includes(",")) {
    const [l, f] = s.split(",");
    lastName = l.trim();
    firstName = (f || "").trim();
  }
  return { id: slugify(`${lastName}_${firstName}`), firstName, lastName };
}

function parseAuthor(c: any): IAuthor | null {
  if (typeof c === "string") return nameToAuthor(c);
  if (!isObj(c)) return null;
  // structured: givenName/firstName + familyName/surName/lastName (datacite, eml, pan_md)
  const given = text(findFirstByKey(c, /(given|first)name$/i));
  const family = text(findFirstByKey(c, /(family|sur|last)name$/i));
  if (family) return { id: slugify(`${family}_${given}`), firstName: given, lastName: family };
  // fallback: a *Name string ("Last, First") or the node's own text
  return nameToAuthor(text(findFirstByKey(c, /name$/i)) || text(c));
}

// Standard bounding box across schemas; falls back to a degenerate box from a lat/lon point.
function extractSpatial(meta: any): ISpatial | null {
  let west = firstNumberByKey(meta, /west/i);
  let east = firstNumberByKey(meta, /east/i);
  let north = firstNumberByKey(meta, /north/i);
  let south = firstNumberByKey(meta, /south/i);
  if (west == null && east == null && north == null && south == null) {
    const lon = firstNumberByKey(meta, /longitude/i);
    const lat = firstNumberByKey(meta, /latitude/i);
    if (lon != null && lat != null) {
      west = east = lon;
      south = north = lat;
    }
  }
  if (west == null && east == null && north == null && south == null) return null;
  return { west, east, south, north };
}

// Metadata housekeeping dates (revision / harvest / stamp) are NOT data coverage — a
// DIF Last_Revision or an EML dateStamp would otherwise drag every timeline to "today".
const META_DATE_KEY = /revision|stamp|metadata|harvest|modif|accessed|updated|download/i;
const DATE_TOKEN = /\d{4}(-\d{2}(-\d{2})?)?/;

// Key-aware: collect date tokens under keys matching `re`, skipping housekeeping keys.
function collectDates(node: any, re: RegExp, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const v of node) collectDates(v, re, out);
  } else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (re.test(k) && !META_DATE_KEY.test(k)) {
        const m = text(v).match(DATE_TOKEN);
        if (m) out.push(m[0]);
      }
      collectDates(v, re, out);
    }
  }
  return out;
}
const sortedUniq = (xs: string[]) => [...new Set(xs)].sort();

// Temporal coverage from explicit begin/end fields; otherwise a single publication
// point. Never builds a range out of scattered dates — that's how revision dates leak in.
function extractTime(meta: any): { publicationDate: string | null; temporal: ITemporal | null } {
  const begin = sortedUniq(collectDates(meta, /begin|start/i));
  const end = sortedUniq(collectDates(meta, /\bend|stop/i));
  const issued = sortedUniq(collectDates(meta, /publi|issued|pubdate|available|created|submitted/i));
  const any = sortedUniq(collectDates(meta, /date|temporal|year|calendar|created|submitted/i));

  const start = begin[0] ?? null;
  const stop = end.length ? end[end.length - 1] : null;

  let temporal: ITemporal | null = null;
  if (start || stop) temporal = { start: (start ?? stop)!, end: start && stop && stop !== start ? stop : null };
  else if (any.length) temporal = { start: any[0], end: null };

  const publicationDate = issued[0] ?? any[0] ?? start ?? null;
  return { publicationDate, temporal };
}

function extractUri(meta: any, headerId: string): string {
  const ids = entriesByKey(meta, /identifier$|^doi$|url$/i).map(text).filter(Boolean);
  const http = ids.find((s) => /^https?:\/\//i.test(s));
  if (http) return http;
  const doiOf = (s: string) => s.match(/10\.\d{4,}\/\S+/)?.[0] ?? null;
  const doi = ids.map(doiOf).find(Boolean) || doiOf(headerId);
  return doi ? `https://doi.org/${doi}` : headerId;
}

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

export function extract(record: any, source = "oai"): IDataAdapter | null {
  const meta = record?.metadata;
  if (!isObj(meta)) return null;

  const headerId = text(record.header?.identifier);
  const id = (headerId.split(":").pop() || headerId || "").trim();
  if (!id) return null;

  const title = entriesByKey(meta, /title$/i).map(text).find(Boolean) || "Untitled Record";
  const abstract = entriesByKey(meta, /abstract$|description$/i).map(text).find(Boolean) || null;

  const authors = uniqById(
    entriesByKey(meta, /creator$|author$/i)
      // DIF and some DC feeds pack co-authors into one "A; B; C" string — split them.
      .flatMap((e) => (typeof e === "string" ? e.split(/\s*;\s*/) : [e]))
      .map(parseAuthor)
      .filter((a): a is IAuthor => !!a && !!a.lastName)
  );
  const keywords = uniqById<IKeyword>(
    entriesByKey(meta, /keyword$|subject$|topic$|categor/i)
      .map(text)
      .filter(Boolean)
      .map((t) => ({ id: slugify(t), name: t.toLowerCase() }))
  );

  const { publicationDate, temporal } = extractTime(meta);

  return {
    dataset: {
      id,
      title,
      abstract,
      uri: extractUri(meta, headerId),
      publicationDate,
      spatial: extractSpatial(meta),
      temporal,
      source,
    },
    authors,
    keywords,
  };
}
