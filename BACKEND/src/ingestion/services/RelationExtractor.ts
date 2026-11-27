import { createHash } from 'crypto';
import { IDataAdapter, IDataset, IAuthor, IKeyword } from '../contracts/IDataAdapter';

type Edge = { _key: string; _from: string; _to: string };

export interface GraphPayload {
  dataset: IDataset & { _key: string };
  authors: (IAuthor & { _key: string })[];
  keywords: (IKeyword & { _key: string })[];
  edgesHasAuthor: Edge[];
  edgesHasKeyword: Edge[];
}

// Deterministic edge _key: GraphWriter saves edges with overwriteMode "ignore", which only skips a
// document whose _key already exists, so re-imports and resumes upsert instead of duplicating.
const edge = (_from: string, _to: string): Edge => ({
  _key: createHash('sha1').update(`${_from}|${_to}`).digest('hex'),
  _from,
  _to,
});

export class RelationExtractor {
  private slugify(text: string): string {
    return text.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").substring(0, 254);
  }

  public extract(packet: IDataAdapter): GraphPayload {
    try {
      const rawId = packet.dataset.id || "";
      const dsKey = this.slugify(rawId);
      
      const datasetNode: IDataset & { _key: string } = {
        _key: dsKey,
        ...packet.dataset
      };

      const authors = packet.authors.map(a => ({
        ...a,
        _key: this.slugify(a.id || ""),
      }));

      const keywords = packet.keywords.map(k => ({
        ...k,
        _key: this.slugify(k.id || ""),
      }));

      const edgesHasAuthor = authors.map(a => edge(`Dataset/${dsKey}`, `Author/${a._key}`));
      const edgesHasKeyword = keywords.map(k => edge(`Dataset/${dsKey}`, `Keywords/${k._key}`));

      return {
        dataset: datasetNode,
        authors,
        keywords,
        edgesHasAuthor,
        edgesHasKeyword
      };
    } catch (error: any) {
      console.error(`\x1b[31m[RelationExtractor] \u2718 Failed to extract graph payload for packet ID ${packet?.dataset?.id}: ${error.message}\x1b[0m`);
      throw error;
    }
  }
}
