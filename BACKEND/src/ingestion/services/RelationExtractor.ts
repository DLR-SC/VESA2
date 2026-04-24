import { IDataAdapter, IDataset, IAuthor, IKeyword } from '../contracts/IDataAdapter';

export interface GraphPayload {
  dataset: IDataset & { _key: string };
  authors: (IAuthor & { _key: string })[];
  keywords: (IKeyword & { _key: string })[];
  edgesHasAuthor: { _from: string; _to: string }[];
  edgesHasKeyword: { _from: string; _to: string }[];
}

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

      const edgesHasAuthor = authors.map(a => ({
        _from: `Dataset/${dsKey}`,
        _to: `Author/${a._key}`
      }));

      const edgesHasKeyword = keywords.map(k => ({
        _from: `Dataset/${dsKey}`,
        _to: `Keywords/${k._key}`
      }));

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
