import { Database } from 'arangojs';
import { GraphPayload } from './RelationExtractor';

const SKIP_NULL_TEMPORAL = true;

const isValidPayload = (payload: GraphPayload): boolean => {
  if (!SKIP_NULL_TEMPORAL) return true;
  const temporal = payload.dataset?.temporal;
  if (temporal && temporal.start === null && temporal.end === null) {
    return false;
  }
  return true;
};

export class GraphWriter {
  constructor(private db: Database) {}

  public async write(payload: GraphPayload, sourcePrefix?: string): Promise<void> {
    if (!isValidPayload(payload)) return;

    const addPrefix = (obj: any) => sourcePrefix && obj ? { ...obj, source_prefix: sourcePrefix } : obj;

    try {
      const cols = {
        ds: this.db.collection('Dataset'),
        auth: this.db.collection('Author'),
        kw: this.db.collection('Keywords'),
        hasAuth: this.db.collection('HasAuthor'),
        hasKw: this.db.collection('HasKeyword'),
      };

      // Node updates (Update Document)
      if (payload.dataset) await cols.ds.save(addPrefix(payload.dataset), { overwriteMode: "update" });
      
      for (const auth of payload.authors || []) {
        await cols.auth.save(addPrefix(auth), { overwriteMode: "update" });
      }
      
      for (const kw of payload.keywords || []) {
        await cols.kw.save(addPrefix(kw), { overwriteMode: "update" });
      }

      // Edge updates (Ignore if edge already exists)
      for (const edge of payload.edgesHasAuthor || []) {
        await cols.hasAuth.save(addPrefix(edge), { overwriteMode: "ignore" });
      }

      for (const edge of payload.edgesHasKeyword || []) {
        await cols.hasKw.save(addPrefix(edge), { overwriteMode: "ignore" });
      }
    } catch (error: any) {
      console.error(`\x1b[31m[GraphWriter]  \u2718 Failed to write entity ${payload.dataset?._key}: ${error.message}\x1b[0m`);
      throw error;
    }
  }

  public async writeBatch(payloads: GraphPayload[], sourcePrefix?: string): Promise<void> {
    const validPayloads = payloads.filter(isValidPayload);
    if (validPayloads.length === 0) return;

    const addPrefix = (obj: any) => sourcePrefix && obj ? { ...obj, source_prefix: sourcePrefix } : obj;

    try {
      const cols = {
        ds: this.db.collection('Dataset'),
        auth: this.db.collection('Author'),
        kw: this.db.collection('Keywords'),
        hasAuth: this.db.collection('HasAuthor'),
        hasKw: this.db.collection('HasKeyword'),
      };

      // In-memory deduplication to avoid ArangoDB same-array unique constraint errors
      const uniqueBy = (arr: any[], key: string) => [...new Map(arr.map(item => [item[key], item])).values()];
      const uniqueEdges = (arr: any[]) => [...new Map(arr.map(item => [`${item._from}-${item._to}`, item])).values()];

      const datasets = validPayloads.map(p => p.dataset).filter(Boolean).map(addPrefix);
      const authors = uniqueBy(validPayloads.flatMap(p => p.authors || []), '_key').map(addPrefix);
      const keywords = uniqueBy(validPayloads.flatMap(p => p.keywords || []), '_key').map(addPrefix);
      const hasAuthEdges = uniqueEdges(validPayloads.flatMap(p => p.edgesHasAuthor || [])).map(addPrefix);
      const hasKwEdges = uniqueEdges(validPayloads.flatMap(p => p.edgesHasKeyword || [])).map(addPrefix);

      if (datasets.length) await cols.ds.save(datasets, { overwriteMode: "update" });
      if (authors.length) await cols.auth.save(authors, { overwriteMode: "update" });
      if (keywords.length) await cols.kw.save(keywords, { overwriteMode: "update" });
      if (hasAuthEdges.length) await cols.hasAuth.save(hasAuthEdges, { overwriteMode: "ignore" });
      if (hasKwEdges.length) await cols.hasKw.save(hasKwEdges, { overwriteMode: "ignore" });
      
    } catch (error: any) {
      console.error(`\x1b[31m[GraphWriter] \u2718 Batch write failed: ${error.message}\x1b[0m`);
      throw error;
    }
  }
}
