import express, { Request, Response } from 'express';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { IDataAdapter, IDataset, IAuthor, IKeyword } from '../ingestion/contracts/IDataAdapter';

export const zenodoProxyRouter = express.Router();

// Zenodo OAI-PMH endpoint — oai_datacite prefix yields the richest metadata
const OAI_BASE = "https://zenodo.org/oai2d";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  // Ensure these are always treated as arrays regardless of cardinality in XML
  isArray: (tag) =>
    [
      "record",
      "creator",
      "subject",
      "date",
      "title",
      "description",
      "geoLocation",
      "alternateIdentifier",
      "relatedIdentifier",
    ].includes(tag),
});

const slugify = (text: string) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").substring(0, 254);

// --- Mappers for Zenodo DataCite Schema ---

const MapDataset = (record: any, resource: any): IDataset => {
  const identifier =
    typeof record.header.identifier === "object"
      ? record.header.identifier["#text"]
      : record.header.identifier;

  // Zenodo OAI identifiers: oai:zenodo.org:<record_id>
  const zenodoId = (identifier || "").split(":").pop();

  // DataCite wraps DOI in <identifier identifierType="DOI">
  const doiRaw = resource.identifier?.["#text"] || resource.identifier || "";
  const doi = typeof doiRaw === "string" ? doiRaw.trim() : "";

  // Prefer the first title; DataCite allows multiple
  const titles: any[] = resource.titles?.title || [];
  const titleText =
    (Array.isArray(titles) ? titles[0] : titles)?.["#text"] ||
    (Array.isArray(titles) ? titles[0] : titles) ||
    "Untitled Zenodo Record";

  // Only pick the Abstract-typed description
  const descriptions: any[] = resource.descriptions?.description || [];
  const abstractEntry = descriptions.find(
    (d: any) => d?.descriptionType === "Abstract"
  );
  const abstract =
    abstractEntry?.["#text"] ||
    (typeof abstractEntry === "string" ? abstractEntry : null);

  // Publication date: prefer dateType="Issued", fall back to first available
  const dates: any[] = resource.dates?.date || [];
  const issuedDate = dates.find((d: any) => d?.dateType === "Issued");
  const publicationDate =
    issuedDate?.["#text"] ||
    issuedDate ||
    resource.publicationYear ||
    null;

  // Spatial: DataCite geoLocationBox — not all Zenodo records include this
  const geoLocations: any[] = resource.geoLocations?.geoLocation || [];
  const box = geoLocations[0]?.geoLocationBox || {};

  return {
    id: zenodoId,
    title: typeof titleText === "string" ? titleText : String(titleText),
    abstract: abstract,
    uri: doi ? `https://doi.org/${doi}` : `https://zenodo.org/record/${zenodoId}`,
    publicationDate: publicationDate ? String(publicationDate) : null,
    spatial: {
      west: parseFloat(box.westBoundLongitude) || null,
      east: parseFloat(box.eastBoundLongitude) || null,
      south: parseFloat(box.southBoundLatitude) || null,
      north: parseFloat(box.northBoundLatitude) || null,
    },
    temporal: {
      // Zenodo DataCite rarely exposes temporal range; use publication date as fallback
      start: typeof publicationDate === "string" ? publicationDate : null,
      end: null,
    },
    source: "ZENODO",
  };
};

const MapAuthors = (resource: any): IAuthor[] => {
  const creators: any[] = resource.creators?.creator || [];
  const list = Array.isArray(creators) ? creators : [creators];

  return list
    .map((c: any) => {
      // DataCite provides givenName/familyName directly, or falls back to creatorName ("Last, First")
      const firstName =
        c.givenName || c.creatorName?.["#text"]?.split(",")[1]?.trim() || "";
      const lastName =
        c.familyName ||
        c.creatorName?.["#text"]?.split(",")[0]?.trim() ||
        (typeof c.creatorName === "string" ? c.creatorName.split(",")[0]?.trim() : "") ||
        "";
      return {
        id: slugify(`${lastName}_${firstName}`),
        firstName,
        lastName,
      };
    })
    .filter((a) => a.lastName !== "");
};

const MapKeywords = (resource: any): IKeyword[] => {
  const subjects: any[] = resource.subjects?.subject || [];
  const list = Array.isArray(subjects) ? subjects : [subjects];

  return list
    .map((s: any) => {
      const txt =
        typeof s === "string" ? s : s?.["#text"] || s?.value || null;
      return txt ? txt.trim() : null;
    })
    .filter((txt): txt is string => Boolean(txt))
    .map((txt) => ({
      id: slugify(txt),
      name: txt.toLowerCase(),
    }));
};

// --- Mock Fixture (Identical structure to PANGAEA/GBIF for Handshake consistency) ---
const MOCK_FIXTURE: IDataAdapter = {
  dataset: {
    id: "zenodo_mock_001",
    title: "Static Zenodo Mock for Handshake",
    abstract: "Validation mock for Zenodo DataCite mapping.",
    uri: "https://zenodo.org/record/mock_001",
    publicationDate: null,
    spatial: { west: null, east: null, south: null, north: null },
    temporal: { start: null, end: null },
    source: "ZENODO",
  },
  authors: [{ id: "zenodo_mock_author", firstName: "Zenodo", lastName: "Validator" }],
  keywords: [{ id: "zenodo_mock_keyword", name: "validation" }],
};

const ZENODO_HEADERS = { "User-Agent": "VESA-Harvester-Bot" };
const ZENODO_TIMEOUT_MS = 45_000;
const ZENODO_RETRY_DELAYS_MS = [8_000, 20_000]; // Two retries before giving up

async function fetchZenodoWithBackoff(url: string): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt <= ZENODO_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { data } = await axios.get<string>(url, {
        headers: ZENODO_HEADERS,
        timeout: ZENODO_TIMEOUT_MS,
      });
      return data;
    } catch (err: any) {
      lastError = err;
      const status = err.response?.status;
      // Only retry on rate limiting or transient server errors; bail immediately on client errors.
      const isTransient = !status || status === 429 || status >= 500;
      if (!isTransient || attempt === ZENODO_RETRY_DELAYS_MS.length) break;
      const waitMs = ZENODO_RETRY_DELAYS_MS[attempt];
      console.warn(
        `\x1b[33m[ZenodoProxy] Zenodo returned ${status ?? "network error"}, retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${ZENODO_RETRY_DELAYS_MS.length})...\x1b[0m`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

// --- GET Endpoint for Records ---
zenodoProxyRouter.get("/records", async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.query.mock === "true") {
      res.json([MOCK_FIXTURE]);
      return;
    }

    const token = req.query.token as string | undefined;

    // oai_datacite is the richest prefix Zenodo exposes; covers geo, temporal, creators, subjects
    const url = token
      ? `${OAI_BASE}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`
      : `${OAI_BASE}?verb=ListRecords&metadataPrefix=oai_datacite`;

    const data = await fetchZenodoWithBackoff(url);
    const jsonObj = parser.parse(data);
    const oai = jsonObj["OAI-PMH"];

    // OAI-PMH protocol returns errors as XML inside a 200 response — detect and surface them.
    if (oai?.error) {
      const code = oai.error?.code || "unknown";
      const message =
        typeof oai.error === "string"
          ? oai.error
          : oai.error?.["#text"] || "OAI-PMH error";
      console.error(
        `\x1b[31m[ZenodoProxy] OAI-PMH error: [${code}] ${message}\x1b[0m`
      );
      res.status(502).json({ error: `Zenodo OAI-PMH error (${code}): ${message}` });
      return;
    }

    const listRecords = oai?.ListRecords;

    if (!listRecords || !listRecords.record) {
      res.json([]);
      return;
    }

    const output: IDataAdapter[] = [];
    const records = Array.isArray(listRecords.record)
      ? listRecords.record
      : [listRecords.record];

    for (const record of records) {
      // Zenodo DataCite nests resource under oai_datacite > payload > resource
      const payload =
        record.metadata?.oai_datacite?.payload ||
        record.metadata?.["oai_datacite"]?.payload;
      const resource = payload?.resource;

      if (!resource) continue;

      output.push({
        dataset: MapDataset(record, resource),
        authors: MapAuthors(resource),
        keywords: MapKeywords(resource),
      });
    }

    const rawToken = listRecords.resumptionToken;
    const nextToken = rawToken
      ? typeof rawToken === "object"
        ? rawToken["#text"]
        : rawToken
      : null;

    if (nextToken) res.set("X-Next-Token", nextToken);

    res.json(output);
  } catch (error: any) {
    console.error(`[ZenodoProxy] Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});