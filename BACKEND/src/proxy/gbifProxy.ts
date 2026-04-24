import express, { Request, Response } from 'express';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { IDataAdapter, IDataset, IAuthor, IKeyword } from '../ingestion/contracts/IDataAdapter';

export const gbifProxyRouter = express.Router();

// GBIF production OAI-PMH registry
const OAI_BASE = "https://api.gbif.org/v1/oai-pmh/registry";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  // Added EML-specific tags to ensures they are always treated as arrays
  isArray: (tag) => ["record", "creator", "keyword", "keywordSet", "para"].includes(tag),
});

const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").substring(0, 254);

// --- Mappers for GBIF EML Schema ---

const MapDataset = (record: any, eml: any): IDataset => {
  const identifier = typeof record.header.identifier === 'object' ? record.header.identifier['#text'] : record.header.identifier;
  // GBIF identifiers usually look like oai:gbif.org:datasets:<uuid>
  const gbifId = (identifier || "").split(':').pop();
  
  const dataset = eml.dataset || {};
  const coverage = dataset.coverage || {};
  const geo = coverage.geographicCoverage?.boundingCoordinates || {};
  const temp = coverage.temporalCoverage?.rangeOfDates || {};

  // Abstract in EML can be a nested 'para' object/array
  const abstractRaw = dataset.abstract?.para;
  const abstract = Array.isArray(abstractRaw) ? abstractRaw.join(" ") : (abstractRaw || null);

  return {
    id: gbifId,
    title: dataset.title || "Untitled GBIF Dataset",
    abstract: abstract,
    uri: `https://www.gbif.org/dataset/${gbifId}`,
    publicationDate: dataset.pubDate || null,
    spatial: {
      west: parseFloat(geo.westBoundingCoordinate) || null,
      east: parseFloat(geo.eastBoundingCoordinate) || null,
      south: parseFloat(geo.southBoundingCoordinate) || null,
      north: parseFloat(geo.northBoundingCoordinate) || null,
    },
    temporal: {
      start: temp.beginDate?.calendarDate || null,
      end: temp.endDate?.calendarDate || null,
    },
    source: "GBIF"
  };
};

const MapAuthors = (emlDataset: any): IAuthor[] => {
  const creators = emlDataset.creator || [];
  const list = Array.isArray(creators) ? creators : [creators];
  
  return list.map((c: any) => {
    const name = c.individualName || {};
    return {
      id: slugify(`${name.surName || ""}_${name.givenName || ""}`),
      firstName: name.givenName || "",
      lastName: name.surName || "Unknown",
    };
  }).filter(a => a.lastName !== "Unknown");
};

const MapKeywords = (emlDataset: any): IKeyword[] => {
  const keywordSets = emlDataset.keywordSet || [];
  const list = Array.isArray(keywordSets) ? keywordSets : [keywordSets];
  const allKeywords: IKeyword[] = [];

  list.forEach((set: any) => {
    const keywords = Array.isArray(set.keyword) ? set.keyword : [set.keyword];
    keywords.forEach((k: any) => {
      const txt = typeof k === 'string' ? k : k?.['#text'];
      if (txt) {
        allKeywords.push({
          id: slugify(txt),
          name: txt.toLowerCase(),
        });
      }
    });
  });

  return allKeywords;
};

// --- Mock Fixture (Identical structure to PANGAEA for Handshake consistency) ---
const MOCK_FIXTURE: IDataAdapter = {
  dataset: {
    id: "gbif_mock_001",
    title: "Static GBIF Mock for Handshake",
    abstract: "Validation mock for GBIF EML mapping.",
    uri: "https://www.gbif.org/dataset/mock",
    publicationDate: null,
    spatial: { west: null, east: null, south: null, north: null },
    temporal: { start: null, end: null },
    source: "GBIF"
  },
  authors: [{ id: "gbif_mock_author", firstName: "GBIF", lastName: "Validator" }],
  keywords: [{ id: "gbif_mock_keyword", name: "validation" }]
};

const GBIF_HEADERS = { 'User-Agent': 'VESA-Harvester-Bot' };
const GBIF_TIMEOUT_MS = 45_000;
const GBIF_RETRY_DELAYS_MS = [8_000, 20_000]; // Two retries before giving up

async function fetchGbifWithBackoff(url: string): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt <= GBIF_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { data } = await axios.get<string>(url, { headers: GBIF_HEADERS, timeout: GBIF_TIMEOUT_MS });
      return data;
    } catch (err: any) {
      lastError = err;
      const status = err.response?.status;
      // Only retry on rate limiting or transient server errors; bail immediately on client errors.
      const isTransient = !status || status === 429 || status >= 500;
      if (!isTransient || attempt === GBIF_RETRY_DELAYS_MS.length) break;
      const waitMs = GBIF_RETRY_DELAYS_MS[attempt];
      console.warn(`\x1b[33m[GBIFProxy] GBIF returned ${status ?? 'network error'}, retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${GBIF_RETRY_DELAYS_MS.length})...\x1b[0m`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

// --- GET Endpoint for Records ---
gbifProxyRouter.get('/records', async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.query.mock === 'true') {
      res.json([MOCK_FIXTURE]);
      return;
    }

    const token = req.query.token as string | undefined;
    // GBIF uses 'eml' metadata prefix for rich ecological data
    const url = token
      ? `${OAI_BASE}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`
      : `${OAI_BASE}?verb=ListRecords&metadataPrefix=eml`;

    const data = await fetchGbifWithBackoff(url);
    const jsonObj = parser.parse(data);
    const oai = jsonObj["OAI-PMH"];

    // OAI-PMH protocol returns errors as XML inside a 200 response — detect and surface them.
    if (oai?.error) {
      const code = oai.error?.code || 'unknown';
      const message = typeof oai.error === 'string' ? oai.error : (oai.error?.['#text'] || 'OAI-PMH error');
      console.error(`\x1b[31m[GBIFProxy] OAI-PMH error: [${code}] ${message}\x1b[0m`);
      res.status(502).json({ error: `GBIF OAI-PMH error (${code}): ${message}` });
      return;
    }

    const listRecords = oai?.ListRecords;

    if (!listRecords || !listRecords.record) {
      res.json([]);
      return;
    }

    const output: IDataAdapter[] = [];
    const records = Array.isArray(listRecords.record) ? listRecords.record : [listRecords.record];

    for (const record of records) {
      // GBIF EML data is nested under eml:eml
      const eml = record.metadata?.["eml:eml"] || record.metadata?.["eml"];
      if (!eml) continue;

      output.push({
        dataset: MapDataset(record, eml),
        authors: MapAuthors(eml.dataset || {}),
        keywords: MapKeywords(eml.dataset || {})
      });
    }

    const rawToken = listRecords.resumptionToken;
    const nextToken = rawToken ? (typeof rawToken === "object" ? rawToken["#text"] : rawToken) : null;

    if (nextToken) res.set('X-Next-Token', nextToken);

    res.json(output);
  } catch (error: any) {
    console.error(`[GBIFProxy] Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});