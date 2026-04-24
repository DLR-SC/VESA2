import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { Database } from "arangojs";

// --- 1. CORE INTERFACES ---

export interface GeographicExtent {
  west_bound_longitude: number | null;
  east_bound_longitude: number | null;
  south_bound_latitude: number | null;
  north_bound_latitude: number | null;
  mean_longitude: number | null;
  mean_latitude: number | null;
}

export interface DatasetDocument {
  _key: string;
  pangaea_id: string;
  title: string;
  text_abstract: string | null;
  publication_date: string | null;
  uri: string;
  extent: {
    geographic: GeographicExtent;
    temporal: { min_date_time: string | null; max_date_time: string | null };
    elevation: { name: string; unit: string; min: number | null; max: number | null };
  };
  api_urls: { openaire: null; openalex: null; eudat: null };
}

export interface AuthorDocument {
  _key: string;
  display_name: string;
  first_name: string;
  last_name: string;
  e_mail: string | null;
  uri: string | null;
  orcid: string | null;
}

export interface KeywordDocument {
  _key: string;
  display_name: string;
  name: string;
}

// --- 2. DECOUPLED GRAPH LINKER SERVICE ---
// This service only cares about standardized entities and handles all ArangoDB logic.

const GraphLinkerService = {
  /**
   * Synchronizes a dataset and its relationships to the Graph
   */
  async sync(
    db: Database,
    dataset: DatasetDocument,
    authors: AuthorDocument[],
    keywords: KeywordDocument[]
  ) {
    const cols = {
      ds: db.collection("Dataset"),
      auth: db.collection("Author"),
      kw: db.collection("Keywords"),
      hasAuth: db.collection("HasAuthor"),
      hasKw: db.collection("HasKeyword"),
    };

    // 1. Save the Dataset (Update if exists)
    await cols.ds.save(dataset, { overwriteMode: "update" });

    // 2. Process Authors and Edges
    for (const author of authors) {
      if (!author._key) continue;
      // Save Author entity (Ignore if exists)
      await cols.auth.save(author, { overwriteMode: "ignore" });
      // Create relationship edge
      await cols.hasAuth.save(
        { _from: `Dataset/${dataset._key}`, _to: `Author/${author._key}` },
        { overwriteMode: "ignore" }
      );
    }

    // 3. Process Keywords and Edges
    for (const keyword of keywords) {
      if (!keyword._key) continue;
      // Save Keyword entity (Ignore if exists)
      await cols.kw.save(keyword, { overwriteMode: "ignore" });
      // Create relationship edge
      await cols.hasKw.save(
        { _from: `Dataset/${dataset._key}`, _to: `Keywords/${keyword._key}` },
        { overwriteMode: "ignore" }
      );
    }
  },
};

// --- 3. PANGAEA SPECIFIC MAPPERS ---
// These translate raw XML into the standardized interfaces.

const slugify = (text: string) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").substring(0, 254);

const MapDataset = (record: any, metadata: any): DatasetDocument => {
  const pangaeaId = record.header.identifier.replace("oai:pangaea.de:doi:10.1594/PANGAEA.", "");
  const citation = metadata["md:citation"] || {};
  const event = metadata["md:event"]?.[0] || {};

  return {
    _key: pangaeaId,
    pangaea_id: pangaeaId,
    title: citation["md:title"] || "Untitled",
    text_abstract: metadata["md:abstract"] || null,
    publication_date: citation["md:dateTime"] || null,
    uri: `https://doi.org/10.1594/PANGAEA.${pangaeaId}`,
    extent: {
      geographic: {
        west_bound_longitude: parseFloat(event["md:longitude"]) || null,
        east_bound_longitude: parseFloat(event["md:longitude"]) || null,
        south_bound_latitude: parseFloat(event["md:latitude"]) || null,
        north_bound_latitude: parseFloat(event["md:latitude"]) || null,
        mean_longitude: parseFloat(event["md:longitude"]) || null,
        mean_latitude: parseFloat(event["md:latitude"]) || null,
      },
      temporal: {
        min_date_time: event["md:dateTime"] || citation["md:dateTime"] || null,
        max_date_time: event["md:dateTime"] || citation["md:dateTime"] || null,
      },
      elevation: {
        name: "Elevation",
        unit: "m",
        min: parseFloat(event["md:elevation"]) || null,
        max: parseFloat(event["md:elevation"]) || null,
      },
    },
    api_urls: { openaire: null, openalex: null, eudat: null },
  };
};

const MapAuthors = (citation: any): AuthorDocument[] => {
  const authors = citation["md:author"] || [];
  const list = Array.isArray(authors) ? authors : [authors];
  return list.map((a: any) => ({
    _key: slugify(`${a["md:lastName"]}_${a["md:firstName"]}`),
    display_name: `${a["md:firstName"] || ""} ${a["md:lastName"] || ""}`.trim(),
    first_name: a["md:firstName"] || "",
    last_name: a["md:lastName"] || "",
    e_mail: a["md:eMail"] || null,
    uri: a["md:URI"] || null,
    orcid: a["md:orcid"] || null,
  }));
};

const MapKeywords = (metadata: any): KeywordDocument[] => {
  const techKeywords = metadata["md:keywords"]?.["md:techKeyword"] || [];
  const list = Array.isArray(techKeywords) ? techKeywords : [techKeywords];
  const noise = /^(param|method|author|basis|campaign|event|inst|journal|license|project|ref|term|geocode)/;

  return list
    .map((k: any) => k["#text"]?.trim())
    .filter((txt: string) => txt && !noise.test(txt))
    .map((txt: string) => ({
      _key: slugify(txt),
      display_name: txt,
      name: txt.toLowerCase(),
    }));
};

// --- 4. ORCHESTRATION ENGINE ---

export async function harvestPangaea(db: Database, limit = 10000) {
  const OAI_BASE = "https://ws.pangaea.de/oai/provider";
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (tag) => ["record", "md:author", "md:techKeyword", "md:event"].includes(tag),
  });

  let harvestedCount = 0;
  let resumptionToken: string | null = null;

  console.log(`[INIT] Starting unified harvest for ${db.name}...`);

  while (harvestedCount < limit) {
    const url = resumptionToken
      ? `${OAI_BASE}?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken)}`
      : `${OAI_BASE}?verb=ListRecords&metadataPrefix=pan_md&set=citable`;

    try {
      const { data } = await axios.get(url);
      const jsonObj = parser.parse(data);
      const listRecords = jsonObj["OAI-PMH"]?.ListRecords;

      if (!listRecords?.record) break;

      for (const record of listRecords.record) {
        if (harvestedCount >= limit) break;
        const metadata = record.metadata?.["md:MetaData"];
        if (!metadata) continue;

        // Step 1: Extract standardized data via Mappers
        const ds = MapDataset(record, metadata);
        const auths = MapAuthors(metadata["md:citation"] || {});
        const kws = MapKeywords(metadata);

        // Step 2: Push to decoupled Graph Linker Service
        await GraphLinkerService.sync(db, ds, auths, kws);

        harvestedCount++;
      }

      // Step 3: Handle Pagination & Rate Limits
      const rawToken = listRecords.resumptionToken;
      resumptionToken = rawToken ? (typeof rawToken === "object" ? rawToken["#text"] : rawToken) : null;

      if (resumptionToken) {
        process.stdout.write(`\r[SYNC] Progress: ${harvestedCount}/${limit}...`);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        break;
      }
    } catch (err: any) {
      console.error(`\n[ERROR] Pipeline failed: ${err.message}`);
      throw err;
    }
  }
  console.log(`\n[DONE] Knowledge Graph synchronized with ${harvestedCount} records.`);
}